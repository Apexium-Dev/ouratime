-- ============================================================
-- Migration 007: Workspaces & Team
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Extend profiles ──────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email        TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url   TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Copy emails from auth.users for existing rows
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- Update trigger to also store email on new signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Create tables first (no policies yet) ────────────────────

CREATE TABLE IF NOT EXISTS public.workspaces (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  owner_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  accepted_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);

GRANT ALL ON public.workspaces         TO authenticated;
GRANT ALL ON public.workspace_members  TO authenticated;
GRANT ALL ON public.workspace_invites  TO authenticated;

-- ── Helper: avoids self-referential RLS recursion ─────────────
-- Used inside policies that need to check workspace_members.
CREATE OR REPLACE FUNCTION public.my_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.my_workspace_ids() TO authenticated;

-- ── Profiles: extend select policy ───────────────────────────
-- (workspace_members now exists so this is safe)
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR id IN (
      SELECT wm2.user_id
      FROM public.workspace_members wm1
      JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.user_id = auth.uid()
    )
  );

-- ── Workspaces RLS ────────────────────────────────────────────
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspaces_select" ON public.workspaces
  FOR SELECT USING (id IN (SELECT my_workspace_ids()));

CREATE POLICY "workspaces_insert" ON public.workspaces
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "workspaces_update" ON public.workspaces
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "workspaces_delete" ON public.workspaces
  FOR DELETE USING (owner_id = auth.uid());

-- ── Workspace Members RLS ─────────────────────────────────────
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Use helper function to avoid self-referential recursion
CREATE POLICY "members_select" ON public.workspace_members
  FOR SELECT USING (workspace_id IN (SELECT my_workspace_ids()));

CREATE POLICY "members_insert" ON public.workspace_members
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "members_update" ON public.workspace_members
  FOR UPDATE USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

CREATE POLICY "members_delete" ON public.workspace_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── Workspace Invites RLS ─────────────────────────────────────
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites_select" ON public.workspace_invites
  FOR SELECT USING (workspace_id IN (SELECT my_workspace_ids()));

-- Anyone with the token can read it (needed for /join page)
CREATE POLICY "invites_select_by_token" ON public.workspace_invites
  FOR SELECT USING (true);

CREATE POLICY "invites_insert" ON public.workspace_invites
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "invites_delete" ON public.workspace_invites
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "invites_update" ON public.workspace_invites
  FOR UPDATE USING (true);

-- ── Time entries: workspace members can see each other's ──────
CREATE POLICY "workspace_view_entries" ON public.time_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm1
      JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.user_id = auth.uid()
        AND wm2.user_id = time_entries.user_id
    )
  );

-- ── RPC: accept an invite ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_workspace_invite(invite_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite workspace_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite
  FROM workspace_invites
  WHERE token = invite_token AND accepted_at IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invalid or already used invite link');
  END IF;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_invite.workspace_id, auth.uid(), v_invite.role)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  UPDATE workspace_invites SET accepted_at = now() WHERE id = v_invite.id;

  RETURN json_build_object('success', true, 'workspace_id', v_invite.workspace_id::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(TEXT) TO authenticated;

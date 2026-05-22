-- ── Drop everything problematic from 018 ─────────────────────────────────────
DROP POLICY IF EXISTS "view project members"        ON public.project_members;
DROP POLICY IF EXISTS "add project members"         ON public.project_members;
DROP POLICY IF EXISTS "update project members"      ON public.project_members;
DROP POLICY IF EXISTS "remove project members"      ON public.project_members;
DROP POLICY IF EXISTS "members can view shared projects" ON public.projects;
DROP POLICY IF EXISTS "co-members can view profiles"    ON public.profiles;
DROP FUNCTION IF EXISTS public.my_project_ids();

-- ── SECURITY DEFINER helpers ──────────────────────────────────────────────────
-- These run as postgres (BYPASSRLS). Use PL/pgSQL so the optimizer cannot
-- inline them and accidentally strip the SECURITY DEFINER context.

-- Is the current user an active member of this project?
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id
      AND user_id    = auth.uid()
      AND status     = 'active'
  );
END;
$$;

-- Do the current user and target user share at least one project?
CREATE OR REPLACE FUNCTION public.share_project_with(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.project_members a
    JOIN public.project_members b ON b.project_id = a.project_id
    WHERE a.user_id = auth.uid()
      AND b.user_id = p_user_id
      AND a.status  = 'active'
      AND b.status  = 'active'
  );
END;
$$;

-- ── project_members RLS: keep policies self-contained (no projects ref) ───────
-- SELECT: only your own rows. Co-member list fetched via get_project_members().
CREATE POLICY "own membership"
  ON public.project_members FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: must be the project owner (insert via trigger bypasses RLS anyway)
CREATE POLICY "owner adds members"
  ON public.project_members FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

-- UPDATE: project owner only (admin role-changes go through update_member_role RPC)
CREATE POLICY "owner updates members"
  ON public.project_members FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

-- DELETE: leave yourself OR project owner removes (admin removes via RPC)
CREATE POLICY "leave or owner removes"
  ON public.project_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

-- ── projects: members can view projects they belong to ────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects' AND policyname = 'members view shared projects'
  ) THEN
    CREATE POLICY "members view shared projects"
      ON public.projects FOR SELECT
      USING (
        user_id = auth.uid()
        OR public.is_project_member(id)
      );
  END IF;
END $$;

-- ── profiles: co-members can see each other's display info ───────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'co-members view profiles'
  ) THEN
    CREATE POLICY "co-members view profiles"
      ON public.profiles FOR SELECT
      USING (
        id = auth.uid()
        OR public.share_project_with(id)
      );
  END IF;
END $$;

-- ── RPC: get all members of a project (with profile data) ────────────────────
CREATE OR REPLACE FUNCTION public.get_project_members(p_project_id UUID)
RETURNS TABLE(
  id          UUID,
  user_id     UUID,
  role        TEXT,
  status      TEXT,
  created_at  TIMESTAMPTZ,
  full_name   TEXT,
  avatar_url  TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Caller must be a member or the project owner
  IF NOT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = auth.uid() AND status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_project_id AND user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT pm.id, pm.user_id, pm.role, pm.status, pm.created_at,
         p.full_name, p.avatar_url
  FROM   public.project_members pm
  LEFT JOIN public.profiles p ON p.id = pm.user_id
  WHERE  pm.project_id = p_project_id AND pm.status = 'active'
  ORDER  BY pm.created_at;
END;
$$;

-- ── RPC: add a member (admins + owners) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_project_member(
  p_project_id UUID,
  p_user_id    UUID,
  p_role       TEXT DEFAULT 'member'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_project_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
      AND role IN ('owner','admin') AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.project_members (project_id, user_id, role, invited_by, status)
  VALUES (p_project_id, p_user_id, p_role, auth.uid(), 'active')
  ON CONFLICT (project_id, user_id) DO NOTHING;
END;
$$;

-- ── RPC: change a member's role (admins + owners) ────────────────────────────
CREATE OR REPLACE FUNCTION public.update_member_role(
  p_member_id UUID,
  p_new_role  TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_project_id UUID;
BEGIN
  SELECT project_id INTO v_project_id FROM public.project_members WHERE id = p_member_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.projects WHERE id = v_project_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = v_project_id AND user_id = auth.uid()
      AND role IN ('owner','admin') AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.project_members SET role = p_new_role WHERE id = p_member_id;
END;
$$;

-- ── RPC: remove a member (admins + owners, or self-leave) ────────────────────
CREATE OR REPLACE FUNCTION public.remove_project_member(p_member_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_project_id UUID; v_user_id UUID;
BEGIN
  SELECT project_id, user_id INTO v_project_id, v_user_id
  FROM public.project_members WHERE id = p_member_id;

  IF v_user_id <> auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM public.projects WHERE id = v_project_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = v_project_id AND user_id = auth.uid()
      AND role IN ('owner','admin') AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.project_members WHERE id = p_member_id;
END;
$$;

-- ── RPC: get time entries for a project ──────────────────────────────────────
-- Admins/owners see all entries; members see only their own.
CREATE OR REPLACE FUNCTION public.get_project_time_entries(p_project_id UUID)
RETURNS TABLE(
  id          UUID,
  started_at  TIMESTAMPTZ,
  duration    BIGINT,
  billable    BOOLEAN,
  description TEXT,
  user_id     UUID,
  full_name   TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_is_admin BOOLEAN;
BEGIN
  -- Verify access
  IF NOT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = auth.uid() AND status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_project_id AND user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  SELECT (
    EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = p_project_id AND user_id = auth.uid()
        AND role IN ('owner','admin') AND status = 'active'
    )
  ) INTO v_is_admin;

  RETURN QUERY
  SELECT te.id, te.started_at, te.duration::BIGINT, te.billable,
         te.description, te.user_id, p.full_name
  FROM   public.time_entries te
  LEFT JOIN public.profiles p ON p.id = te.user_id
  WHERE  te.project_id = p_project_id
    AND  te.stopped_at IS NOT NULL
    AND  (v_is_admin OR te.user_id = auth.uid())
  ORDER  BY te.started_at DESC
  LIMIT  200;
END;
$$;

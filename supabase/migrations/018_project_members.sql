-- ── Add description and tags to projects ──────────────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS tags        TEXT[] DEFAULT '{}';

-- ── Project members table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id)  ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member'
              CHECK (role IN ('owner', 'admin', 'member')),
  invited_by  UUID REFERENCES auth.users(id),
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('pending', 'active')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- ── Helper: returns the project IDs the current user is a member of ──────────
-- SECURITY DEFINER so it bypasses RLS on project_members (avoids recursion)
CREATE OR REPLACE FUNCTION public.my_project_ids()
RETURNS UUID[] LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(array_agg(project_id), '{}')
  FROM public.project_members
  WHERE user_id = auth.uid() AND status = 'active'
$$;

-- ── Helper: find a user by email (for invite flow) ───────────────────────────
CREATE OR REPLACE FUNCTION public.find_user_by_email(lookup_email TEXT)
RETURNS TABLE(id UUID, full_name TEXT, avatar_url TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.full_name, p.avatar_url
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE lower(u.email) = lower(lookup_email)
  LIMIT 1;
END;
$$;

-- ── RLS: project_members ──────────────────────────────────────────────────────
-- View: own row OR any row in a project you belong to OR project you own
CREATE POLICY "view project members"
  ON public.project_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR project_id = ANY(public.my_project_ids())
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

-- Insert: project owner OR existing admin/owner member
CREATE POLICY "add project members"
  ON public.project_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
        AND pm.status = 'active'
    )
  );

-- Update: project owner OR admin/owner member
CREATE POLICY "update project members"
  ON public.project_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
        AND pm.status = 'active'
    )
  );

-- Delete: own row (leave) OR project owner OR admin/owner member
CREATE POLICY "remove project members"
  ON public.project_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
        AND pm.status = 'active'
    )
  );

-- ── RLS: projects — members can view projects they're part of ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects' AND policyname = 'members can view shared projects'
  ) THEN
    CREATE POLICY "members can view shared projects"
      ON public.projects FOR SELECT
      USING (
        user_id = auth.uid()
        OR id = ANY(public.my_project_ids())
      );
  END IF;
END $$;

-- ── RLS: profiles — co-members can see each other's display info ──────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'co-members can view profiles'
  ) THEN
    CREATE POLICY "co-members can view profiles"
      ON public.profiles FOR SELECT
      USING (
        id = auth.uid()
        OR id = ANY(
          SELECT pm.user_id FROM public.project_members pm
          WHERE pm.project_id = ANY(public.my_project_ids())
            AND pm.status = 'active'
        )
      );
  END IF;
END $$;

-- ── Trigger: auto-add project creator as owner ────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_add_project_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role, status)
  VALUES (NEW.id, NEW.user_id, 'owner', 'active')
  ON CONFLICT (project_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_project_created ON public.projects;
CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.auto_add_project_owner();

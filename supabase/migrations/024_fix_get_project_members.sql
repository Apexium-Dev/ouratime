-- Fix get_project_members: same ambiguity bug as get_inbox.
-- RETURNS TABLE declares `status TEXT` which PL/pgSQL treats as an OUT variable,
-- making unqualified `status = 'active'` in SQL queries resolve to NULL.
-- Fix: add #variable_conflict use_column so column names always win over variables,
-- and qualify all column references explicitly.

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
#variable_conflict use_column
BEGIN
  -- Caller must be an active member or the project owner
  IF NOT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = p_project_id
      AND pm.user_id    = auth.uid()
      AND pm.status     = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id      = p_project_id
      AND p.user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT pm.id, pm.user_id, pm.role, pm.status, pm.created_at,
         pr.full_name, pr.avatar_url
  FROM   public.project_members pm
  LEFT JOIN public.profiles pr ON pr.id = pm.user_id
  WHERE  pm.project_id = p_project_id
    AND  pm.status      = 'active'
  ORDER  BY pm.created_at;
END;
$$;

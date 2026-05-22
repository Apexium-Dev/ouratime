-- Fix get_pending_invites: RETURNS TABLE declares `role TEXT` which conflicts
-- with unqualified `role IN ('owner','admin')` in the auth check WHERE clause.
-- Add #variable_conflict use_column and fully qualify all column references.

CREATE OR REPLACE FUNCTION public.get_pending_invites(p_project_id UUID)
RETURNS TABLE(
  notification_id UUID,
  recipient_id    UUID,
  recipient_name  TEXT,
  role            TEXT,
  created_at      TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
#variable_conflict use_column
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE  p.id      = p_project_id
      AND  p.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE  pm.project_id = p_project_id
      AND  pm.user_id    = auth.uid()
      AND  pm.role       IN ('owner','admin')
      AND  pm.status     = 'active'
  ) THEN RETURN; END IF;

  RETURN QUERY
  SELECT n.id, n.recipient_id, pr.full_name, n.role, n.created_at
  FROM   public.notifications n
  LEFT JOIN public.profiles pr ON pr.id = n.recipient_id
  WHERE  n.project_id = p_project_id
    AND  n.type       = 'project_invite'
    AND  n.status     = 'pending'
  ORDER  BY n.created_at DESC;
END;
$$;

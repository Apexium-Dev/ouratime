-- Backfill project_members for project owners who were created before the
-- auto_add_project_owner trigger was in place (migration 018).
-- This inserts an active owner row for any project whose creator has no row yet.

INSERT INTO public.project_members (project_id, user_id, role, status)
SELECT p.id, p.user_id, 'owner', 'active'
FROM   public.projects p
WHERE  NOT EXISTS (
  SELECT 1 FROM public.project_members pm
  WHERE  pm.project_id = p.id AND pm.user_id = p.user_id
)
ON CONFLICT DO NOTHING;

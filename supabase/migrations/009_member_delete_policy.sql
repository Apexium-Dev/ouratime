-- ============================================================
-- Migration 009: Allow owners/admins to remove workspace members
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Owners and admins can delete non-owner members from workspaces they manage.
-- Members can also remove themselves (leave), unless they are the owner.
DROP POLICY IF EXISTS "members_delete" ON public.workspace_members;

CREATE POLICY "members_delete" ON public.workspace_members
  FOR DELETE USING (
    role != 'owner'
    AND (
      -- Admin or owner removing someone else
      workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
      -- Or the member removing themselves (leaving)
      OR user_id = auth.uid()
    )
  );

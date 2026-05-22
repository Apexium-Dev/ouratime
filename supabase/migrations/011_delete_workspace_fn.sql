-- ============================================================
-- Migration 011: SECURITY DEFINER function to delete a workspace
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_workspace(p_workspace_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_owner_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  SELECT owner_id INTO v_owner_id FROM workspaces WHERE id = p_workspace_id;

  IF v_owner_id IS NULL THEN
    RETURN json_build_object('error', 'Workspace not found');
  END IF;

  IF v_owner_id != v_uid THEN
    RETURN json_build_object('error', 'Only the workspace owner can delete it');
  END IF;

  -- time_entries.workspace_id is ON DELETE SET NULL, handled by FK
  DELETE FROM workspace_invites WHERE workspace_id = p_workspace_id;
  DELETE FROM workspace_members WHERE workspace_id = p_workspace_id;
  DELETE FROM workspaces WHERE id = p_workspace_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_workspace(UUID) TO authenticated;

-- ============================================================
-- Migration 010: SECURITY DEFINER function to remove a workspace member
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

CREATE OR REPLACE FUNCTION public.remove_workspace_member(member_row_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_ws_id      UUID;
  v_target_role TEXT;
  v_caller_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Get the target member's workspace and role
  SELECT workspace_id, role INTO v_ws_id, v_target_role
  FROM workspace_members
  WHERE id = member_row_id;

  IF v_ws_id IS NULL THEN
    RETURN json_build_object('error', 'Member not found');
  END IF;

  -- Cannot remove the workspace owner
  IF v_target_role = 'owner' THEN
    RETURN json_build_object('error', 'Cannot remove the workspace owner');
  END IF;

  -- Get the caller's role in this workspace
  SELECT role INTO v_caller_role
  FROM workspace_members
  WHERE workspace_id = v_ws_id AND user_id = v_uid;

  -- Allow: owner or admin removing someone, or member removing themselves
  IF v_caller_role IN ('owner', 'admin') OR (
    SELECT user_id FROM workspace_members WHERE id = member_row_id
  ) = v_uid THEN
    DELETE FROM workspace_members WHERE id = member_row_id;
    RETURN json_build_object('ok', true);
  END IF;

  RETURN json_build_object('error', 'Not authorized');
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_workspace_member(UUID) TO authenticated;

-- ============================================================
-- Migration 007b: Fix workspace creation bootstrap
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- SECURITY DEFINER function creates workspace + owner membership atomically,
-- bypassing the RLS bootstrap problem (can't satisfy member policy when
-- you're not yet a member of the workspace you're creating).
CREATE OR REPLACE FUNCTION public.create_workspace(workspace_name TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id   UUID;
  v_uid  UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  INSERT INTO workspaces (name, owner_id)
  VALUES (workspace_name, v_uid)
  RETURNING id INTO v_id;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_id, v_uid, 'owner');

  RETURN json_build_object('id', v_id, 'name', workspace_name, 'owner_id', v_uid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT) TO authenticated;

-- Fix members_insert policy to also cover the case where
-- an owner directly adds someone (needed for direct-add flows).
DROP POLICY IF EXISTS "members_insert" ON public.workspace_members;

CREATE POLICY "members_insert" ON public.workspace_members
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

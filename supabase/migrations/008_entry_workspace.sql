-- ============================================================
-- Migration 008: Link time entries to a workspace
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS time_entries_workspace_id_idx ON public.time_entries (workspace_id);

-- Replace the broad "any teammate's entries" policy with a tighter one:
-- only show entries explicitly tagged to a workspace you're a member of.
DROP POLICY IF EXISTS "workspace_view_entries" ON public.time_entries;

CREATE POLICY "workspace_view_entries" ON public.time_entries
  FOR SELECT USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (SELECT my_workspace_ids())
  );

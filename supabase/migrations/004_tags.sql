-- ============================================================
-- Migration 004: Tags
-- Run AFTER 003_projects_tasks_entries.sql
-- ============================================================

-- ── Tags ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tags (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#008080',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all_tags" ON public.tags
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Time entry ↔ Tags (many-to-many) ──────────────────────
CREATE TABLE IF NOT EXISTS public.time_entry_tags (
  time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE CASCADE NOT NULL,
  tag_id        UUID REFERENCES public.tags(id)         ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (time_entry_id, tag_id)
);

ALTER TABLE public.time_entry_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all_time_entry_tags" ON public.time_entry_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.time_entries te
      WHERE te.id = time_entry_id AND te.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.time_entries te
      WHERE te.id = time_entry_id AND te.user_id = auth.uid()
    )
  );

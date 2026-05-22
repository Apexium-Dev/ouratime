-- ============================================================
-- Migration 016: Per-project hourly rate
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2) DEFAULT 0;

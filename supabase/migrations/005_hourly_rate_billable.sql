-- ============================================================
-- Migration 005: Hourly rate + billable flag
-- Run AFTER 004_tags.sql
-- ============================================================

-- ── Hourly rate on profiles ─────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10, 2);

-- ── Billable flag on time entries ───────────────────────────
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS billable BOOLEAN NOT NULL DEFAULT true;

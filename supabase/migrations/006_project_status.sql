-- ============================================================
-- Migration 006: Project status fields
-- Run AFTER 005_hourly_rate_billable.sql
-- ============================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS archived     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_template  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_favorite  BOOLEAN NOT NULL DEFAULT false;

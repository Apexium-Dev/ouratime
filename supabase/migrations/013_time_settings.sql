-- ============================================================
-- Migration 013: Add time preference columns to profiles
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone    TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS date_format TEXT DEFAULT 'MM/DD/YYYY',
  ADD COLUMN IF NOT EXISTS time_format TEXT DEFAULT '24h',
  ADD COLUMN IF NOT EXISTS day_start   TIME DEFAULT '09:00';

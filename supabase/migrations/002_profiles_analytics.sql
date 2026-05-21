-- ============================================================
-- Migration 002: Add analytics columns to profiles
-- Run AFTER 001_create_profiles.sql
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

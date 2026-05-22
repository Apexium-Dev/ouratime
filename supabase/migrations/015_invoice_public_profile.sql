-- ============================================================
-- Migration 015: Allow anon to read profiles linked to public invoices
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Allow anon to read a profile row only when
-- that user has at least one sent/paid/overdue invoice.
GRANT SELECT ON public.profiles TO anon;

CREATE POLICY "profiles_public_invoice_read" ON public.profiles
  FOR SELECT TO anon
  USING (
    id IN (
      SELECT user_id FROM public.invoices
      WHERE status IN ('sent', 'paid', 'overdue')
    )
  );

-- Also add from_name / from_email columns on invoices
-- so freelancers can override what appears on the invoice.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS from_name  TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS from_email TEXT DEFAULT '';

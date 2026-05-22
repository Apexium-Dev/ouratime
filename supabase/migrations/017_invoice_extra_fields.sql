-- ============================================================
-- Migration 017: Invoice extra fields + logo
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS purchase_order  TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_terms   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS pay_to          TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS logo_url        TEXT DEFAULT '';

-- Storage bucket for invoice logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-logos', 'invoice-logos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for invoice logos: owner can upload/update/delete, public can read
CREATE POLICY "invoice_logos_owner_write" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'invoice-logos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'invoice-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "invoice_logos_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'invoice-logos');

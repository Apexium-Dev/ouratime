-- ============================================================
-- Migration 014: Invoices
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

CREATE TABLE public.invoices (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  number         TEXT NOT NULL,
  client_name    TEXT NOT NULL DEFAULT '',
  client_email   TEXT          DEFAULT '',
  client_address TEXT          DEFAULT '',
  status         TEXT          DEFAULT 'draft'
                   CHECK (status IN ('draft','sent','paid','overdue')),
  issue_date     DATE          DEFAULT CURRENT_DATE,
  due_date       DATE,
  notes          TEXT          DEFAULT '',
  currency       TEXT          DEFAULT 'USD',
  tax_rate       NUMERIC(5,2)  DEFAULT 0,
  created_at     TIMESTAMPTZ   DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE public.invoice_items (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id  UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  description TEXT         NOT NULL DEFAULT '',
  quantity    NUMERIC(10,2) DEFAULT 1,
  rate        NUMERIC(10,2) DEFAULT 0,
  sort_order  INTEGER       DEFAULT 0
);

-- RLS
ALTER TABLE public.invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Owner policies
CREATE POLICY "invoices_owner"  ON public.invoices
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "items_owner" ON public.invoice_items
  USING  (invoice_id IN (SELECT id FROM public.invoices WHERE user_id = auth.uid()))
  WITH CHECK (invoice_id IN (SELECT id FROM public.invoices WHERE user_id = auth.uid()));

-- Public read for sent/paid invoices (shareable links)
CREATE POLICY "invoices_public_read" ON public.invoices
  FOR SELECT USING (status IN ('sent','paid','overdue'));

CREATE POLICY "items_public_read" ON public.invoice_items
  FOR SELECT USING (
    invoice_id IN (SELECT id FROM public.invoices WHERE status IN ('sent','paid','overdue'))
  );

-- Grants
GRANT ALL    ON public.invoices      TO authenticated;
GRANT ALL    ON public.invoice_items TO authenticated;
GRANT SELECT ON public.invoices      TO anon;
GRANT SELECT ON public.invoice_items TO anon;

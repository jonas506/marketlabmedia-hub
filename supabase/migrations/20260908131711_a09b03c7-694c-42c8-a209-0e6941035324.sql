ALTER TABLE public.signature_documents
  ADD COLUMN IF NOT EXISTS amount_net numeric(12,2),
  ADD COLUMN IF NOT EXISTS amount_currency text NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS amount_source text;
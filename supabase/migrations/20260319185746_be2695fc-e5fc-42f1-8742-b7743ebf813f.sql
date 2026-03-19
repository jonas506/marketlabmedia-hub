
-- Add source column to crm_leads
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS source text DEFAULT NULL;
-- Add contact fields directly on leads for simpler access
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS contact_name text DEFAULT NULL;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS contact_email text DEFAULT NULL;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS contact_phone text DEFAULT NULL;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL;

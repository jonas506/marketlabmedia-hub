ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS meta_lead_id text,
  ADD COLUMN IF NOT EXISTS meta_form_id text,
  ADD COLUMN IF NOT EXISTS meta_campaign_name text,
  ADD COLUMN IF NOT EXISTS meta_adset_name text,
  ADD COLUMN IF NOT EXISTS meta_ad_name text;

CREATE UNIQUE INDEX IF NOT EXISTS crm_leads_meta_lead_id_unique
  ON public.crm_leads (meta_lead_id)
  WHERE meta_lead_id IS NOT NULL;
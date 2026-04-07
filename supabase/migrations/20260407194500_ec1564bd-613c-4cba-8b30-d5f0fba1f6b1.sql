
-- New columns on crm_leads
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'erstkontakt';
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS deal_value numeric DEFAULT 0;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS next_step text;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS next_step_date date;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS last_activity_at timestamptz DEFAULT now();
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS instagram_handle text;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS linkedin_url text;

-- New columns on crm_activities
ALTER TABLE public.crm_activities ADD COLUMN IF NOT EXISTS file_urls text[];
ALTER TABLE public.crm_activities ADD COLUMN IF NOT EXISTS ai_extracted boolean DEFAULT false;

-- Storage bucket for CRM files
INSERT INTO storage.buckets (id, name, public)
VALUES ('crm-files', 'crm-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload crm files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'crm-files');

CREATE POLICY "Authenticated users can read crm files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'crm-files');

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_crm_leads_stage ON public.crm_leads (stage);
CREATE INDEX IF NOT EXISTS idx_crm_leads_last_activity ON public.crm_leads (last_activity_at DESC);

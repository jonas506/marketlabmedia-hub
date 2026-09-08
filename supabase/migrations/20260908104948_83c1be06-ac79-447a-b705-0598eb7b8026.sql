INSERT INTO public.crm_pipelines (name)
SELECT 'Standard'
WHERE NOT EXISTS (SELECT 1 FROM public.crm_pipelines);

ALTER TABLE public.crm_stage_config
  ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES public.crm_pipelines(id) ON DELETE CASCADE;

ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES public.crm_pipelines(id) ON DELETE SET NULL;

UPDATE public.crm_stage_config
SET pipeline_id = (SELECT id FROM public.crm_pipelines ORDER BY created_at LIMIT 1)
WHERE pipeline_id IS NULL;

UPDATE public.crm_leads
SET pipeline_id = (SELECT id FROM public.crm_pipelines ORDER BY created_at LIMIT 1)
WHERE pipeline_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_stage_config_pipeline ON public.crm_stage_config(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_pipeline ON public.crm_leads(pipeline_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_pipelines TO authenticated;
GRANT ALL ON public.crm_pipelines TO service_role;

ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal users manage pipelines" ON public.crm_pipelines;
CREATE POLICY "Internal users manage pipelines"
ON public.crm_pipelines FOR ALL TO authenticated
USING (public.is_internal(auth.uid()))
WITH CHECK (public.is_internal(auth.uid()));
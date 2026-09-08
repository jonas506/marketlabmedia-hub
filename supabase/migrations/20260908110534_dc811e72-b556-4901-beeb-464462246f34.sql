CREATE TABLE public.crm_lead_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  stage text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, pipeline_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_lead_pipelines TO authenticated;
GRANT ALL ON public.crm_lead_pipelines TO service_role;

ALTER TABLE public.crm_lead_pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users manage lead pipelines"
ON public.crm_lead_pipelines FOR ALL
TO authenticated
USING (public.is_internal(auth.uid()))
WITH CHECK (public.is_internal(auth.uid()));

CREATE TRIGGER update_crm_lead_pipelines_updated_at
BEFORE UPDATE ON public.crm_lead_pipelines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_crm_lead_pipelines_pipeline ON public.crm_lead_pipelines(pipeline_id);
CREATE INDEX idx_crm_lead_pipelines_lead ON public.crm_lead_pipelines(lead_id);

INSERT INTO public.crm_lead_pipelines (lead_id, pipeline_id, stage)
SELECT l.id, COALESCE(l.pipeline_id, (SELECT p.id FROM public.crm_pipelines p ORDER BY p.created_at LIMIT 1)), l.stage
FROM public.crm_leads l
WHERE COALESCE(l.pipeline_id, (SELECT p.id FROM public.crm_pipelines p ORDER BY p.created_at LIMIT 1)) IS NOT NULL
ON CONFLICT DO NOTHING;
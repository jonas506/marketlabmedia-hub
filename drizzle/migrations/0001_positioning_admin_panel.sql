CREATE OR REPLACE FUNCTION public.is_funnel_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select coalesce(lower(auth.jwt() ->> 'email') = 'jonas@marketlab-media.de', false)
$$;

ALTER TABLE public.positioning_analysis_leads
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'neu',
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS admin_notes text;

CREATE OR REPLACE FUNCTION public.validate_positioning_lead_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('neu','kontaktiert','termin','angebot','abschluss','unqualifiziert','doppelt') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.status := 'neu'; NEW.admin_notes := NULL; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN NEW.status_updated_at := now(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_positioning_lead_status ON public.positioning_analysis_leads;
CREATE TRIGGER trg_positioning_lead_status BEFORE INSERT OR UPDATE ON public.positioning_analysis_leads
  FOR EACH ROW EXECUTE FUNCTION public.validate_positioning_lead_status();

DROP POLICY IF EXISTS "Internal team can read positioning analysis leads" ON public.positioning_analysis_leads;
DROP POLICY IF EXISTS "Admins can manage positioning analysis leads" ON public.positioning_analysis_leads;
CREATE POLICY "Funnel admin reads leads" ON public.positioning_analysis_leads FOR SELECT TO authenticated USING (public.is_funnel_admin());
CREATE POLICY "Funnel admin updates leads" ON public.positioning_analysis_leads FOR UPDATE TO authenticated USING (public.is_funnel_admin()) WITH CHECK (public.is_funnel_admin());
GRANT SELECT, UPDATE ON public.positioning_analysis_leads TO authenticated;

CREATE TABLE public.positioning_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  step text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, step)
);
GRANT INSERT ON public.positioning_funnel_events TO anon, authenticated;
GRANT SELECT ON public.positioning_funnel_events TO authenticated;
GRANT ALL ON public.positioning_funnel_events TO service_role;
ALTER TABLE public.positioning_funnel_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone logs funnel steps" ON public.positioning_funnel_events FOR INSERT TO anon, authenticated
  WITH CHECK (step IN ('besuch','video','formular','eingetragen') AND length(session_id) BETWEEN 8 AND 64);
CREATE POLICY "Funnel admin reads events" ON public.positioning_funnel_events FOR SELECT TO authenticated USING (public.is_funnel_admin());
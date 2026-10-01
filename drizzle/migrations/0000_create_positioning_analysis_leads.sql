CREATE TABLE public.positioning_analysis_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry text NOT NULL,
  monthly_revenue text NOT NULL,
  company text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  source text NOT NULL DEFAULT 'positionierungs-analyse',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.positioning_analysis_leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positioning_analysis_leads TO authenticated;
GRANT ALL ON public.positioning_analysis_leads TO service_role;

ALTER TABLE public.positioning_analysis_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can submit positioning analysis leads"
ON public.positioning_analysis_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(industry)) BETWEEN 2 AND 100
  AND length(trim(monthly_revenue)) BETWEEN 2 AND 100
  AND length(trim(company)) BETWEEN 2 AND 200
  AND length(trim(contact_name)) BETWEEN 2 AND 200
  AND length(trim(email)) BETWEEN 5 AND 320
  AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  AND length(trim(phone)) BETWEEN 5 AND 60
  AND source = 'positionierungs-analyse'
);

CREATE POLICY "Internal team can read positioning analysis leads"
ON public.positioning_analysis_leads
FOR SELECT
TO authenticated
USING (public.is_internal(auth.uid()));

CREATE POLICY "Admins can manage positioning analysis leads"
ON public.positioning_analysis_leads
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
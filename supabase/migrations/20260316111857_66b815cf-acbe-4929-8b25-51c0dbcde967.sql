CREATE TABLE public.contingent_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type text NOT NULL,
  target_month integer NOT NULL,
  target_year integer NOT NULL,
  extra_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, type, target_month, target_year)
);

ALTER TABLE public.contingent_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read contingent_extras"
  ON public.contingent_extras FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert contingent_extras"
  ON public.contingent_extras FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update contingent_extras"
  ON public.contingent_extras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
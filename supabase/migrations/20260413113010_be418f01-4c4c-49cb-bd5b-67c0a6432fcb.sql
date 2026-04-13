
CREATE TABLE public.crm_stage_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280',
  sort_order integer NOT NULL DEFAULT 0,
  is_win boolean NOT NULL DEFAULT false,
  is_loss boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_stage_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on crm_stage_config"
  ON public.crm_stage_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view crm_stage_config"
  ON public.crm_stage_config FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.crm_stage_config (value, label, color, sort_order, is_win, is_loss) VALUES
  ('interessiert', 'Interessiert', '#8B5CF6', 0, false, false),
  ('erstkontakt', 'Erstgespräch', '#6B7280', 1, false, false),
  ('gespraech', 'Gespräch', '#3B82F6', 2, false, false),
  ('angebot', 'Angebot', '#F59E0B', 3, false, false),
  ('gewonnen', 'Gewonnen', '#22C55E', 4, true, false),
  ('verloren', 'Verloren', '#EF4444', 5, false, true);

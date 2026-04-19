-- KPI definitions: per-user KPI targets defined by admin
CREATE TABLE public.kpi_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  emoji text DEFAULT '📊',
  target_value numeric(8,1) NOT NULL,
  unit text DEFAULT '',
  cadence text NOT NULL DEFAULT 'weekly',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

CREATE INDEX idx_kpi_definitions_user ON public.kpi_definitions(user_id) WHERE is_active = true;

ALTER TABLE public.kpi_definitions ENABLE ROW LEVEL SECURITY;

-- Users see their own KPIs; admin sees all
CREATE POLICY "Users view own kpi_definitions" ON public.kpi_definitions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin manages kpi_definitions" ON public.kpi_definitions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Validate cadence
CREATE OR REPLACE FUNCTION public.validate_kpi_definition()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.cadence NOT IN ('daily', 'weekly') THEN
    RAISE EXCEPTION 'Invalid cadence: %', NEW.cadence;
  END IF;
  IF NEW.target_value <= 0 THEN
    RAISE EXCEPTION 'target_value must be positive';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_kpi_definition
BEFORE INSERT OR UPDATE ON public.kpi_definitions
FOR EACH ROW EXECUTE FUNCTION public.validate_kpi_definition();

-- KPI entries: actual values logged by users
CREATE TABLE public.kpi_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id uuid NOT NULL REFERENCES public.kpi_definitions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  date date NOT NULL,
  value numeric(8,1) NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kpi_id, date)
);

CREATE INDEX idx_kpi_entries_user_date ON public.kpi_entries(user_id, date DESC);
CREATE INDEX idx_kpi_entries_kpi_date ON public.kpi_entries(kpi_id, date DESC);

ALTER TABLE public.kpi_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own kpi_entries" ON public.kpi_entries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own kpi_entries" ON public.kpi_entries
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users update own kpi_entries" ON public.kpi_entries
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users delete own kpi_entries" ON public.kpi_entries
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
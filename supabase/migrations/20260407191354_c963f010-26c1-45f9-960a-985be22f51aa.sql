
-- Travel expenses table
CREATE TABLE public.travel_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  destination text NOT NULL,
  purpose text NOT NULL,
  departure_date date NOT NULL,
  departure_time time NOT NULL,
  return_date date NOT NULL,
  return_time time NOT NULL,
  transport text NOT NULL,
  km_driven numeric(7,1) DEFAULT 0,
  km_rate numeric(4,2) DEFAULT 0.36,
  overnight_count integer DEFAULT 0,
  overnight_rate numeric(5,2) DEFAULT 20.00,
  meals_total numeric(7,2) DEFAULT 0,
  extras_description text,
  extras_amount numeric(7,2) DEFAULT 0,
  total_amount numeric(8,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_travel_expenses_user_year_month ON public.travel_expenses (user_id, year, month);

ALTER TABLE public.travel_expenses ENABLE ROW LEVEL SECURITY;

-- RLS: Users see own
CREATE POLICY "Users can view own travel_expenses"
  ON public.travel_expenses FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- RLS: Users can insert own
CREATE POLICY "Users can insert own travel_expenses"
  ON public.travel_expenses FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS: Users can update own drafts, admins can update all
CREATE POLICY "Users can update own draft travel_expenses"
  ON public.travel_expenses FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'draft')
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- RLS: Users can delete own drafts
CREATE POLICY "Users can delete own draft travel_expenses"
  ON public.travel_expenses FOR DELETE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'draft')
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_travel_expense()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.transport NOT IN ('car', 'train', 'plane', 'other') THEN
    RAISE EXCEPTION 'Invalid transport: %', NEW.transport;
  END IF;
  IF NEW.status NOT IN ('draft', 'submitted', 'approved') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.return_date < NEW.departure_date THEN
    RAISE EXCEPTION 'Return date must be on or after departure date';
  END IF;
  IF NEW.return_date = NEW.departure_date AND NEW.return_time < NEW.departure_time THEN
    RAISE EXCEPTION 'Return time must be after departure time on same day';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_travel_expense_trigger
  BEFORE INSERT OR UPDATE ON public.travel_expenses
  FOR EACH ROW EXECUTE FUNCTION public.validate_travel_expense();

-- Updated_at trigger
CREATE TRIGGER update_travel_expenses_updated_at
  BEFORE UPDATE ON public.travel_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Travel expense reports table
CREATE TABLE public.travel_expense_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  total_meals numeric(8,2) DEFAULT 0,
  total_km numeric(8,2) DEFAULT 0,
  total_overnight numeric(8,2) DEFAULT 0,
  total_extras numeric(8,2) DEFAULT 0,
  grand_total numeric(8,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  pdf_url text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, month)
);

ALTER TABLE public.travel_expense_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own travel_expense_reports"
  ON public.travel_expense_reports FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own travel_expense_reports"
  ON public.travel_expense_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own travel_expense_reports"
  ON public.travel_expense_reports FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users can delete own travel_expense_reports"
  ON public.travel_expense_reports FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Validation trigger for reports
CREATE OR REPLACE FUNCTION public.validate_travel_expense_report()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('draft', 'sent', 'signed') THEN
    RAISE EXCEPTION 'Invalid report status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_travel_expense_report_trigger
  BEFORE INSERT OR UPDATE ON public.travel_expense_reports
  FOR EACH ROW EXECUTE FUNCTION public.validate_travel_expense_report();

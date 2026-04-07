
-- Table: time_entries
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  date date NOT NULL,
  hours numeric(4,2) NOT NULL,
  activity_type text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_entries_user_date ON public.time_entries (user_id, date);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own time entries"
  ON public.time_entries FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own time entries"
  ON public.time_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own time entries"
  ON public.time_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own time entries"
  ON public.time_entries FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all time entries"
  ON public.time_entries FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Validation trigger for hours
CREATE OR REPLACE FUNCTION public.validate_time_entry_hours()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.hours <= 0 OR NEW.hours > 24 THEN
    RAISE EXCEPTION 'Hours must be between 0 and 24';
  END IF;
  IF NEW.activity_type NOT IN ('scripting', 'editing', 'shooting', 'strategy', 'publishing', 'admin', 'meeting', 'other') THEN
    RAISE EXCEPTION 'Invalid activity_type: %', NEW.activity_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_time_entry
  BEFORE INSERT OR UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_time_entry_hours();

-- Table: vacation_requests
CREATE TABLE public.vacation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days numeric(3,1) NOT NULL,
  type text NOT NULL DEFAULT 'vacation',
  status text NOT NULL DEFAULT 'pending',
  note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and approved requests"
  ON public.vacation_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR status = 'approved' OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own requests"
  ON public.vacation_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pending requests"
  ON public.vacation_requests FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Users can delete own pending requests"
  ON public.vacation_requests FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins can manage all vacation requests"
  ON public.vacation_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Validation trigger for vacation requests
CREATE OR REPLACE FUNCTION public.validate_vacation_request()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.type NOT IN ('vacation', 'sick', 'personal') THEN
    RAISE EXCEPTION 'Invalid vacation type: %', NEW.type;
  END IF;
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_vacation
  BEFORE INSERT OR UPDATE ON public.vacation_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_vacation_request();

-- Table: vacation_budgets
CREATE TABLE public.vacation_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year integer NOT NULL,
  total_days numeric(3,1) NOT NULL,
  carry_over_days numeric(3,1) NOT NULL DEFAULT 0,
  UNIQUE (user_id, year)
);

ALTER TABLE public.vacation_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budget"
  ON public.vacation_budgets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all budgets"
  ON public.vacation_budgets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

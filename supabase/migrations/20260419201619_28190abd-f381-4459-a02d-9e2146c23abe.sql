-- Drop old KPI tables (replace with simpler meeting-goals concept)
DROP TABLE IF EXISTS public.kpi_entries CASCADE;
DROP TABLE IF EXISTS public.kpi_definitions CASCADE;

-- New: meeting_goals — simple per-user goals for a day or week, set by admin
CREATE TABLE public.meeting_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_type text NOT NULL DEFAULT 'week', -- 'day' | 'week'
  period_date date NOT NULL, -- the day OR the monday of the week
  title text NOT NULL,
  emoji text DEFAULT '🎯',
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_goals_user_period ON public.meeting_goals(user_id, period_type, period_date);

ALTER TABLE public.meeting_goals ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view goals
CREATE POLICY "Authenticated can view meeting_goals"
ON public.meeting_goals FOR SELECT TO authenticated
USING (true);

-- Only admin can create
CREATE POLICY "Admin can insert meeting_goals"
ON public.meeting_goals FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admin can update everything; user can update own (for checking off)
CREATE POLICY "Admin can update all meeting_goals"
ON public.meeting_goals FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "User can update own meeting_goals"
ON public.meeting_goals FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- Only admin can delete
CREATE POLICY "Admin can delete meeting_goals"
ON public.meeting_goals FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Validation
CREATE OR REPLACE FUNCTION public.validate_meeting_goal()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.period_type NOT IN ('day', 'week') THEN
    RAISE EXCEPTION 'Invalid period_type: %', NEW.period_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_meeting_goal
BEFORE INSERT OR UPDATE ON public.meeting_goals
FOR EACH ROW EXECUTE FUNCTION public.validate_meeting_goal();

CREATE TRIGGER trg_meeting_goals_updated_at
BEFORE UPDATE ON public.meeting_goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
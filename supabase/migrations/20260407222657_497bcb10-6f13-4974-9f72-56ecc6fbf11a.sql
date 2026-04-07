
CREATE TABLE public.daily_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plans"
  ON public.daily_plans FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own plans"
  ON public.daily_plans FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own plans"
  ON public.daily_plans FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own plans"
  ON public.daily_plans FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_daily_plans_updated_at
  BEFORE UPDATE ON public.daily_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

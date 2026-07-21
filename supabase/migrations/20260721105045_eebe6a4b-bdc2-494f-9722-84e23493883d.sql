
CREATE TABLE public.client_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  checkin_date date NOT NULL DEFAULT current_date,
  calendar_week int NOT NULL,
  year int NOT NULL,
  week_focus int NOT NULL,
  mood text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  wishes text,
  content_ideas text,
  nps int,
  next_action text,
  next_action_date date,
  escalated boolean NOT NULL DEFAULT false,
  upsell_flag boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT week_focus_range CHECK (week_focus BETWEEN 1 AND 4),
  CONSTRAINT nps_range CHECK (nps IS NULL OR (nps BETWEEN 0 AND 10)),
  CONSTRAINT mood_values CHECK (mood IS NULL OR mood IN ('happy','neutral','unhappy'))
);

CREATE INDEX idx_client_checkins_client ON public.client_checkins(client_id, checkin_date DESC);
CREATE INDEX idx_client_checkins_date ON public.client_checkins(checkin_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_checkins TO authenticated;
GRANT ALL ON public.client_checkins TO service_role;

ALTER TABLE public.client_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view checkins" ON public.client_checkins
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'head_of_content')
    OR public.has_role(auth.uid(), 'cutter')
  );

CREATE POLICY "Admin and HoC can insert checkins" ON public.client_checkins
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'head_of_content')
  );

CREATE POLICY "Admin, HoC and owner can update checkins" ON public.client_checkins
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'head_of_content')
    OR created_by = auth.uid()
  );

CREATE POLICY "Admins can delete checkins" ON public.client_checkins
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_client_checkins_updated_at
  BEFORE UPDATE ON public.client_checkins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

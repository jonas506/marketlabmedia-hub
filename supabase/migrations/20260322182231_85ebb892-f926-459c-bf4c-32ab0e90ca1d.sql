
-- Story Sequence Templates
CREATE TABLE public.story_sequence_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.story_sequence_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage story_sequence_templates"
  ON public.story_sequence_templates FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Story Sequence Days
CREATE TABLE public.story_sequence_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.story_sequence_templates(id) ON DELETE CASCADE,
  day_number int NOT NULL,
  day_label text NOT NULL,
  slides jsonb DEFAULT '[]'::jsonb,
  keyword_trigger text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.story_sequence_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage story_sequence_days"
  ON public.story_sequence_days FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Story Tracking
CREATE TABLE public.story_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tracking_date date NOT NULL DEFAULT CURRENT_DATE,
  day_type text NOT NULL,
  stories_posted int DEFAULT 0,
  story_views int DEFAULT 0,
  story_replies int DEFAULT 0,
  keyword_triggers_received int DEFAULT 0,
  link_clicks int DEFAULT 0,
  profile_visits_from_stories int DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (client_id, tracking_date)
);

ALTER TABLE public.story_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage story_tracking"
  ON public.story_tracking FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

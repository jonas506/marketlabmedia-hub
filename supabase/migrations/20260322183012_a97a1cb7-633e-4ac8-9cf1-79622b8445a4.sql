
-- Drop old story tables from previous iteration
DROP TABLE IF EXISTS public.story_tracking CASCADE;
DROP TABLE IF EXISTS public.story_sequence_days CASCADE;
DROP TABLE IF EXISTS public.story_sequence_templates CASCADE;

-- New: story_sequences
CREATE TABLE public.story_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  posted_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);
-- Validation trigger instead of CHECK for status
CREATE OR REPLACE FUNCTION public.validate_story_sequence_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'posted', 'tracked') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_story_sequence_status
  BEFORE INSERT OR UPDATE ON public.story_sequences
  FOR EACH ROW EXECUTE FUNCTION public.validate_story_sequence_status();

ALTER TABLE public.story_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage story_sequences"
  ON public.story_sequences FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- New: story_slides
CREATE TABLE public.story_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES public.story_sequences(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  content_text text NOT NULL DEFAULT '',
  slide_type text NOT NULL DEFAULT 'text',
  image_url text,
  created_at timestamptz DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.validate_story_slide_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.slide_type NOT IN ('text', 'poll', 'cta', 'video', 'image') THEN
    RAISE EXCEPTION 'Invalid slide_type: %', NEW.slide_type;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_story_slide_type
  BEFORE INSERT OR UPDATE ON public.story_slides
  FOR EACH ROW EXECUTE FUNCTION public.validate_story_slide_type();

ALTER TABLE public.story_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage story_slides"
  ON public.story_slides FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- New: story_sequence_tracking
CREATE TABLE public.story_sequence_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES public.story_sequences(id) ON DELETE CASCADE,
  total_views int DEFAULT 0,
  total_replies int DEFAULT 0,
  total_link_clicks int DEFAULT 0,
  total_profile_visits int DEFAULT 0,
  keyword_triggers int DEFAULT 0,
  screenshot_urls text[] DEFAULT '{}',
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(sequence_id)
);

ALTER TABLE public.story_sequence_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage story_sequence_tracking"
  ON public.story_sequence_tracking FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-screenshots', 'story-screenshots', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view story screenshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'story-screenshots');

CREATE POLICY "Authenticated can upload story screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'story-screenshots');

CREATE POLICY "Authenticated can delete story screenshots"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'story-screenshots');

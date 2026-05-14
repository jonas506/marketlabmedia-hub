
-- 1. content_formats
CREATE TABLE public.content_formats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tag text NOT NULL,
  funnel_stage text NOT NULL,
  emoji text DEFAULT '🎬',
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tag, funnel_stage)
);

ALTER TABLE public.content_formats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view content_formats"
  ON public.content_formats FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage content_formats"
  ON public.content_formats FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.validate_content_format()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.funnel_stage NOT IN ('tofu','mofu','bofu') THEN
    RAISE EXCEPTION 'Invalid funnel_stage: %', NEW.funnel_stage;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_content_format
  BEFORE INSERT OR UPDATE ON public.content_formats
  FOR EACH ROW EXECUTE FUNCTION public.validate_content_format();

-- 2. format_references
CREATE TABLE public.format_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  format_id uuid NOT NULL REFERENCES public.content_formats(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  source_type text NOT NULL DEFAULT 'instagram',
  thumbnail_url text,
  is_own boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_format_references_format_id ON public.format_references(format_id);

ALTER TABLE public.format_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view format_references"
  ON public.format_references FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage format_references"
  ON public.format_references FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.validate_format_reference()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.source_type NOT IN ('instagram','tiktok','youtube','drive','other') THEN
    RAISE EXCEPTION 'Invalid source_type: %', NEW.source_type;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_format_reference
  BEFORE INSERT OR UPDATE ON public.format_references
  FOR EACH ROW EXECUTE FUNCTION public.validate_format_reference();

-- 3. Storage Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('reference-thumbnails', 'reference-thumbnails', true, 524288)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read reference-thumbnails"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reference-thumbnails');

CREATE POLICY "Admins can manage reference-thumbnails"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'reference-thumbnails' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'reference-thumbnails' AND has_role(auth.uid(), 'admin'::app_role));

-- 4. content_pieces.format_id
ALTER TABLE public.content_pieces
  ADD COLUMN IF NOT EXISTS format_id uuid REFERENCES public.content_formats(id) ON DELETE SET NULL;

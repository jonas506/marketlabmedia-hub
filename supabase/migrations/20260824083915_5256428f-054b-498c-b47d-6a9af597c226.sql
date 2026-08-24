CREATE TABLE public.client_referral_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  headline_name text,
  role_title text,
  photo_url text,
  intro_text text,
  results_text text,
  stats jsonb NOT NULL DEFAULT '[]'::jsonb,
  quote text,
  phone text,
  cal_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.client_referral_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.client_referral_pages(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'image',
  url text NOT NULL,
  caption text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_referral_media_page ON public.client_referral_media(page_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_referral_pages TO authenticated;
GRANT ALL ON public.client_referral_pages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_referral_media TO authenticated;
GRANT ALL ON public.client_referral_media TO service_role;

ALTER TABLE public.client_referral_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_referral_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal manage referral pages" ON public.client_referral_pages
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'head_of_content'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'head_of_content'));

CREATE POLICY "Internal manage referral media" ON public.client_referral_media
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'head_of_content'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'head_of_content'));

CREATE TRIGGER trg_referral_pages_updated_at
BEFORE UPDATE ON public.client_referral_pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_referral_page(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page RECORD;
  v_media jsonb;
BEGIN
  SELECT p.*, c.name AS client_name, c.logo_url
  INTO v_page
  FROM public.client_referral_pages p
  JOIN public.clients c ON c.id = p.client_id
  WHERE p.slug = _slug AND p.is_active = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id, 'type', m.type, 'url', m.url, 'caption', m.caption, 'sort_order', m.sort_order
  ) ORDER BY m.sort_order ASC, m.created_at ASC), '[]'::jsonb)
  INTO v_media
  FROM public.client_referral_media m
  WHERE m.page_id = v_page.id;

  RETURN jsonb_build_object(
    'slug', v_page.slug,
    'client_name', v_page.client_name,
    'logo_url', v_page.logo_url,
    'headline_name', COALESCE(NULLIF(v_page.headline_name, ''), v_page.client_name),
    'role_title', v_page.role_title,
    'photo_url', v_page.photo_url,
    'intro_text', v_page.intro_text,
    'results_text', v_page.results_text,
    'stats', v_page.stats,
    'quote', v_page.quote,
    'phone', v_page.phone,
    'cal_link', v_page.cal_link,
    'media', v_media
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_page(text) TO anon, authenticated;
CREATE POLICY "Public read active referral pages" ON public.client_referral_pages
FOR SELECT TO anon, authenticated
USING (is_active = true);

CREATE POLICY "Public read referral media of active pages" ON public.client_referral_media
FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.client_referral_pages p
  WHERE p.id = page_id AND p.is_active = true
));

CREATE OR REPLACE FUNCTION public.get_referral_page(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
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
    'id', m.id, 'type', m.type, 'url', m.url, 'caption', m.caption,
    'category', COALESCE(NULLIF(m.category, ''), 'other'), 'sort_order', m.sort_order
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
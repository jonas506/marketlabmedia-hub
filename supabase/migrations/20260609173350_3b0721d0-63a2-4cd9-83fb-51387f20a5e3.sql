
-- 1. Tighten admin policies on client_contracts/client_projects to authenticated role
ALTER POLICY "Admins manage contracts" ON public.client_contracts TO authenticated;
ALTER POLICY "Admins manage client projects" ON public.client_projects TO authenticated;

-- 2. Create dedicated table for client approval tokens (admin/head_of_content only)
CREATE TABLE IF NOT EXISTS public.client_approval_tokens (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_approval_tokens TO authenticated;
GRANT ALL ON public.client_approval_tokens TO service_role;

ALTER TABLE public.client_approval_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage approval tokens"
  ON public.client_approval_tokens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Head of content manage approval tokens"
  ON public.client_approval_tokens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'head_of_content'))
  WITH CHECK (public.has_role(auth.uid(), 'head_of_content'));

-- 3. Backfill from existing approval_token column
INSERT INTO public.client_approval_tokens (client_id, token)
SELECT id, approval_token FROM public.clients WHERE approval_token IS NOT NULL
ON CONFLICT (client_id) DO NOTHING;

-- 4. Update RPCs that lookup client by approval_token to use new table
CREATE OR REPLACE FUNCTION public.add_client_piece_comment(_token uuid, _piece_id uuid, _comment text, _timestamp_seconds numeric DEFAULT NULL::numeric, _category text DEFAULT 'video'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id uuid;
  v_comment RECORD;
  v_category text;
BEGIN
  SELECT client_id INTO v_client_id FROM public.client_approval_tokens WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid token'; END IF;

  IF COALESCE(btrim(_comment), '') = '' THEN
    RAISE EXCEPTION 'Comment required';
  END IF;

  v_category := COALESCE(NULLIF(_category, ''), 'video');
  IF v_category NOT IN ('video', 'caption', 'general') THEN
    v_category := 'video';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.content_pieces cp
    WHERE cp.id = _piece_id AND cp.client_id = v_client_id AND cp.phase = 'review'
  ) THEN
    RAISE EXCEPTION 'Invalid piece';
  END IF;

  INSERT INTO public.content_piece_comments (content_piece_id, client_id, timestamp_seconds, comment_text, category)
  VALUES (_piece_id, v_client_id, _timestamp_seconds, btrim(_comment), v_category)
  RETURNING id, content_piece_id, timestamp_seconds, comment_text, category, created_at
  INTO v_comment;

  RETURN jsonb_build_object(
    'id', v_comment.id, 'content_piece_id', v_comment.content_piece_id,
    'timestamp_seconds', v_comment.timestamp_seconds, 'comment_text', v_comment.comment_text,
    'category', v_comment.category, 'created_at', v_comment.created_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_client_piece_comment(_token uuid, _piece_id uuid, _comment text, _timestamp_seconds numeric DEFAULT NULL::numeric)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id uuid;
  v_comment RECORD;
BEGIN
  SELECT client_id INTO v_client_id FROM public.client_approval_tokens WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid token'; END IF;
  IF COALESCE(btrim(_comment), '') = '' THEN RAISE EXCEPTION 'Comment required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.content_pieces cp WHERE cp.id = _piece_id AND cp.client_id = v_client_id AND cp.phase = 'review') THEN
    RAISE EXCEPTION 'Invalid piece';
  END IF;
  INSERT INTO public.content_piece_comments (content_piece_id, client_id, timestamp_seconds, comment_text)
  VALUES (_piece_id, v_client_id, _timestamp_seconds, btrim(_comment))
  RETURNING id, content_piece_id, timestamp_seconds, comment_text, created_at INTO v_comment;
  RETURN jsonb_build_object('id', v_comment.id, 'content_piece_id', v_comment.content_piece_id,
    'timestamp_seconds', v_comment.timestamp_seconds, 'comment_text', v_comment.comment_text, 'created_at', v_comment.created_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_client_piece_comment(_token uuid, _comment_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_client_id uuid;
BEGIN
  SELECT client_id INTO v_client_id FROM public.client_approval_tokens WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid token'; END IF;
  DELETE FROM public.content_piece_comments WHERE id = _comment_id AND client_id = v_client_id;
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_client_piece_caption(_token uuid, _piece_id uuid, _caption text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_client_id uuid;
BEGIN
  SELECT client_id INTO v_client_id FROM public.client_approval_tokens WHERE token = _token;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Invalid token'; END IF;
  UPDATE public.content_pieces SET caption = _caption, updated_at = now()
  WHERE id = _piece_id AND client_id = v_client_id AND phase = 'review';
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_client_piece_review(_token uuid, _piece_id uuid, _action text, _comment text DEFAULT NULL::text, _comments jsonb DEFAULT '[]'::jsonb)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id uuid;
  v_piece RECORD;
  v_combined_comment text;
BEGIN
  SELECT client_id INTO v_client_id FROM public.client_approval_tokens WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid token'; END IF;

  SELECT id, client_id, phase, type, revision_count INTO v_piece FROM public.content_pieces WHERE id = _piece_id;
  IF NOT FOUND OR v_piece.client_id <> v_client_id OR v_piece.phase <> 'review' THEN
    RAISE EXCEPTION 'Invalid piece';
  END IF;

  IF _action = 'approve' THEN
    UPDATE public.content_pieces SET phase = 'approved', client_comment = NULL WHERE id = _piece_id;
    DELETE FROM public.content_piece_comments WHERE content_piece_id = _piece_id;
    RETURN true;
  ELSIF _action = 'reject' THEN
    IF v_piece.revision_count >= 2 THEN
      RAISE EXCEPTION 'Maximale Anzahl an Revisionen erreicht (2). Bitte kontaktiere dein Team direkt.';
    END IF;
    v_combined_comment := NULLIF(btrim(COALESCE(_comment, '')), '');
    IF jsonb_typeof(_comments) = 'array' AND jsonb_array_length(_comments) > 0 THEN
      SELECT string_agg(
        format('%s%s%s',
          CASE COALESCE(elem->>'category', 'video') WHEN 'caption' THEN '[Caption] ' WHEN 'general' THEN '[Allgemein] ' ELSE '[Video] ' END,
          CASE WHEN elem->>'timestamp_seconds' IS NOT NULL AND elem->>'timestamp_seconds' <> '' THEN
            format('[%s:%s] ', floor((elem->>'timestamp_seconds')::numeric / 60)::int,
              lpad((floor(mod((elem->>'timestamp_seconds')::numeric, 60)))::int::text, 2, '0'))
          ELSE '' END,
          COALESCE(elem->>'comment_text', '')
        ), E'\n')
      INTO v_combined_comment FROM jsonb_array_elements(_comments) elem;
    END IF;
    UPDATE public.content_pieces
    SET phase = 'feedback', client_comment = COALESCE(v_combined_comment, 'Änderung gewünscht'),
        revision_count = revision_count + 1
    WHERE id = _piece_id;
    RETURN true;
  ELSE
    RAISE EXCEPTION 'Invalid action';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_client_approval_data(_token uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_client RECORD;
  v_pieces jsonb;
  v_comments jsonb;
  v_marketing jsonb;
  v_upcoming jsonb;
  v_in_progress jsonb;
  v_pipeline jsonb;
  v_client_id uuid;
BEGIN
  SELECT client_id INTO v_client_id FROM public.client_approval_tokens WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid token'; END IF;

  SELECT id, name, logo_url, show_marketing_approval, require_caption_for_review
  INTO v_client FROM public.clients WHERE id = v_client_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid token'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', cp.id, 'title', cp.title, 'type', cp.type, 'phase', cp.phase,
      'preview_link', cp.preview_link, 'client_comment', cp.client_comment,
      'team_reply', cp.team_reply, 'script_text', cp.script_text,
      'caption', cp.caption, 'slide_images', cp.slide_images,
      'revision_count', cp.revision_count, 'scheduled_post_date', cp.scheduled_post_date
    ) ORDER BY cp.created_at DESC), '[]'::jsonb)
  INTO v_pieces FROM public.content_pieces cp
  WHERE cp.client_id = v_client.id AND cp.phase = 'review'
    AND (NOT v_client.require_caption_for_review OR cp.type <> 'reel'
         OR (cp.caption IS NOT NULL AND length(trim(cp.caption)) > 0));

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', c.id, 'content_piece_id', c.content_piece_id,
      'timestamp_seconds', c.timestamp_seconds, 'comment_text', c.comment_text,
      'category', c.category, 'created_at', c.created_at
    ) ORDER BY c.created_at ASC), '[]'::jsonb)
  INTO v_comments FROM public.content_piece_comments c
  WHERE c.client_id = v_client.id
    AND EXISTS (SELECT 1 FROM public.content_pieces cp WHERE cp.id = c.content_piece_id AND cp.client_id = v_client.id AND cp.phase = 'review');

  SELECT row_to_json(m)::jsonb INTO v_marketing FROM (
    SELECT COALESCE(SUM(ad_spend), 0)::numeric AS ad_spend,
      COALESCE(SUM(new_followers), 0)::int AS new_followers,
      COALESCE(SUM(dm_sent), 0)::int AS dm_sent,
      COALESCE(SUM(new_conversations), 0)::int AS new_conversations,
      COALESCE(SUM(appointments_booked), 0)::int AS appointments_booked,
      COALESCE(SUM(appointments_attended), 0)::int AS appointments_attended,
      COALESCE(SUM(closings), 0)::int AS closings
    FROM public.marketing_tracking
    WHERE client_id = v_client.id AND tracking_date >= (CURRENT_DATE - INTERVAL '30 days')
  ) m;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', cp.id, 'title', cp.title, 'type', cp.type, 'scheduled_post_date', cp.scheduled_post_date)
    ORDER BY cp.scheduled_post_date ASC), '[]'::jsonb)
  INTO v_upcoming FROM public.content_pieces cp
  WHERE cp.client_id = v_client.id AND cp.scheduled_post_date IS NOT NULL
    AND cp.scheduled_post_date >= CURRENT_DATE AND cp.scheduled_post_date <= CURRENT_DATE + INTERVAL '30 days'
    AND cp.phase IN ('handed_over', 'approved', 'cutting', 'review');

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', cp.id, 'title', cp.title, 'type', cp.type, 'phase', cp.phase)), '[]'::jsonb)
  INTO v_in_progress FROM public.content_pieces cp
  WHERE cp.client_id = v_client.id AND cp.phase IN ('feedback', 'approved');

  SELECT COALESCE(jsonb_object_agg(phase, cnt), '{}'::jsonb) INTO v_pipeline FROM (
    SELECT phase, COUNT(*)::int AS cnt FROM public.content_pieces
    WHERE client_id = v_client.id AND phase NOT IN ('handed_over') GROUP BY phase
  ) p;

  RETURN jsonb_build_object(
    'client', jsonb_build_object('id', v_client.id, 'name', v_client.name, 'logo_url', v_client.logo_url),
    'pieces', v_pieces, 'comments', v_comments, 'marketing', v_marketing,
    'upcoming_posts', v_upcoming, 'in_progress', v_in_progress, 'pipeline_summary', v_pipeline
  );
END;
$function$;

-- 5. Helper RPC for staff to fetch a client's approval token (admin/head_of_content only)
CREATE OR REPLACE FUNCTION public.get_client_approval_token(_client_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_token uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'head_of_content')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT token INTO v_token FROM public.client_approval_tokens WHERE client_id = _client_id;
  IF v_token IS NULL THEN
    INSERT INTO public.client_approval_tokens (client_id) VALUES (_client_id)
    ON CONFLICT (client_id) DO NOTHING RETURNING token INTO v_token;
    IF v_token IS NULL THEN
      SELECT token INTO v_token FROM public.client_approval_tokens WHERE client_id = _client_id;
    END IF;
  END IF;
  RETURN v_token;
END;
$function$;

-- 6. Drop the exposed approval_token column from clients
ALTER TABLE public.clients DROP COLUMN IF EXISTS approval_token;

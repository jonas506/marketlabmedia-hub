ALTER TABLE public.content_piece_comments
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'video'
  CHECK (category IN ('video', 'caption', 'general'));

CREATE OR REPLACE FUNCTION public.add_client_piece_comment(
  _token uuid,
  _piece_id uuid,
  _comment text,
  _timestamp_seconds numeric DEFAULT NULL,
  _category text DEFAULT 'video'
)
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
  SELECT id INTO v_client_id FROM public.clients WHERE approval_token = _token;
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
    WHERE cp.id = _piece_id
      AND cp.client_id = v_client_id
      AND cp.phase = 'review'
  ) THEN
    RAISE EXCEPTION 'Invalid piece';
  END IF;

  INSERT INTO public.content_piece_comments (
    content_piece_id, client_id, timestamp_seconds, comment_text, category
  )
  VALUES (_piece_id, v_client_id, _timestamp_seconds, btrim(_comment), v_category)
  RETURNING id, content_piece_id, timestamp_seconds, comment_text, category, created_at
  INTO v_comment;

  RETURN jsonb_build_object(
    'id', v_comment.id,
    'content_piece_id', v_comment.content_piece_id,
    'timestamp_seconds', v_comment.timestamp_seconds,
    'comment_text', v_comment.comment_text,
    'category', v_comment.category,
    'created_at', v_comment.created_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_client_approval_data(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client RECORD;
  v_pieces jsonb;
  v_comments jsonb;
  v_marketing jsonb;
  v_upcoming jsonb;
  v_in_progress jsonb;
  v_pipeline jsonb;
BEGIN
  SELECT id, name, logo_url, show_marketing_approval, require_caption_for_review
  INTO v_client FROM public.clients WHERE approval_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid token'; END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', cp.id, 'title', cp.title, 'type', cp.type, 'phase', cp.phase,
      'preview_link', cp.preview_link, 'client_comment', cp.client_comment,
      'team_reply', cp.team_reply, 'script_text', cp.script_text,
      'caption', cp.caption, 'slide_images', cp.slide_images,
      'revision_count', cp.revision_count, 'scheduled_post_date', cp.scheduled_post_date
    ) ORDER BY cp.created_at DESC
  ), '[]'::jsonb)
  INTO v_pieces
  FROM public.content_pieces cp
  WHERE cp.client_id = v_client.id AND cp.phase = 'review'
    AND (
      NOT v_client.require_caption_for_review
      OR cp.type <> 'reel'
      OR (cp.caption IS NOT NULL AND length(trim(cp.caption)) > 0)
    );

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id, 'content_piece_id', c.content_piece_id,
      'timestamp_seconds', c.timestamp_seconds,
      'comment_text', c.comment_text,
      'category', c.category,
      'created_at', c.created_at
    ) ORDER BY c.created_at ASC
  ), '[]'::jsonb)
  INTO v_comments
  FROM public.content_piece_comments c
  WHERE c.client_id = v_client.id
    AND EXISTS (
      SELECT 1 FROM public.content_pieces cp
      WHERE cp.id = c.content_piece_id AND cp.client_id = v_client.id AND cp.phase = 'review'
    );

  SELECT row_to_json(m)::jsonb INTO v_marketing FROM (
    SELECT
      COALESCE(SUM(ad_spend), 0)::numeric AS ad_spend,
      COALESCE(SUM(new_followers), 0)::int AS new_followers,
      COALESCE(SUM(dm_sent), 0)::int AS dm_sent,
      COALESCE(SUM(new_conversations), 0)::int AS new_conversations,
      COALESCE(SUM(appointments_booked), 0)::int AS appointments_booked,
      COALESCE(SUM(appointments_attended), 0)::int AS appointments_attended,
      COALESCE(SUM(closings), 0)::int AS closings
    FROM public.marketing_daily_metrics
    WHERE client_id = v_client.id
      AND metric_date >= (CURRENT_DATE - INTERVAL '30 days')
  ) m;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', cp.id, 'title', cp.title, 'type', cp.type, 'scheduled_post_date', cp.scheduled_post_date)
    ORDER BY cp.scheduled_post_date ASC
  ), '[]'::jsonb)
  INTO v_upcoming
  FROM public.content_pieces cp
  WHERE cp.client_id = v_client.id
    AND cp.scheduled_post_date IS NOT NULL
    AND cp.scheduled_post_date >= CURRENT_DATE
    AND cp.scheduled_post_date <= CURRENT_DATE + INTERVAL '30 days'
    AND cp.phase IN ('handed_over', 'approved', 'cutting', 'review');

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', cp.id, 'title', cp.title, 'type', cp.type, 'phase', cp.phase)
  ), '[]'::jsonb)
  INTO v_in_progress
  FROM public.content_pieces cp
  WHERE cp.client_id = v_client.id AND cp.phase IN ('feedback', 'approved');

  SELECT COALESCE(jsonb_object_agg(phase, cnt), '{}'::jsonb) INTO v_pipeline
  FROM (
    SELECT phase, COUNT(*)::int AS cnt FROM public.content_pieces
    WHERE client_id = v_client.id AND phase NOT IN ('handed_over')
    GROUP BY phase
  ) p;

  RETURN jsonb_build_object(
    'client', jsonb_build_object('id', v_client.id, 'name', v_client.name, 'logo_url', v_client.logo_url),
    'pieces', v_pieces,
    'comments', v_comments,
    'marketing', v_marketing,
    'upcoming_posts', v_upcoming,
    'in_progress', v_in_progress,
    'pipeline_summary', v_pipeline
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_client_piece_review(
  _token uuid,
  _piece_id uuid,
  _action text,
  _comment text DEFAULT NULL,
  _comments jsonb DEFAULT '[]'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id uuid;
  v_piece RECORD;
  v_combined_comment text;
BEGIN
  SELECT id INTO v_client_id FROM public.clients WHERE approval_token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid token'; END IF;

  SELECT id, client_id, phase, type, revision_count INTO v_piece
  FROM public.content_pieces WHERE id = _piece_id;

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
        format(
          '%s%s%s',
          CASE COALESCE(elem->>'category', 'video')
            WHEN 'caption' THEN '[Caption] '
            WHEN 'general' THEN '[Allgemein] '
            ELSE '[Video] '
          END,
          CASE
            WHEN elem->>'timestamp_seconds' IS NOT NULL AND elem->>'timestamp_seconds' <> '' THEN
              format(
                '[%s:%s] ',
                floor((elem->>'timestamp_seconds')::numeric / 60)::int,
                lpad((floor(mod((elem->>'timestamp_seconds')::numeric, 60)))::int::text, 2, '0')
              )
            ELSE ''
          END,
          COALESCE(elem->>'comment_text', '')
        ),
        E'\n'
      )
      INTO v_combined_comment
      FROM jsonb_array_elements(_comments) elem;
    END IF;

    UPDATE public.content_pieces
    SET phase = 'feedback',
        client_comment = COALESCE(v_combined_comment, 'Änderung gewünscht'),
        revision_count = revision_count + 1
    WHERE id = _piece_id;

    RETURN true;
  ELSE
    RAISE EXCEPTION 'Invalid action';
  END IF;
END;
$function$;
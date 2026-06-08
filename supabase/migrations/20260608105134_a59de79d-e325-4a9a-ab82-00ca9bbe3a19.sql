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
    FROM public.marketing_tracking
    WHERE client_id = v_client.id
      AND tracking_date >= (CURRENT_DATE - INTERVAL '30 days')
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

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
  INTO v_client
  FROM public.clients
  WHERE approval_token = _token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;

  -- Pieces awaiting review
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', cp.id,
        'title', cp.title,
        'type', cp.type,
        'phase', cp.phase,
        'preview_link', cp.preview_link,
        'client_comment', cp.client_comment,
        'team_reply', cp.team_reply,
        'script_text', cp.script_text,
        'caption', cp.caption,
        'slide_images', cp.slide_images,
        'revision_count', cp.revision_count,
        'scheduled_post_date', cp.scheduled_post_date
      )
      ORDER BY cp.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_pieces
  FROM public.content_pieces cp
  WHERE cp.client_id = v_client.id
    AND cp.phase = 'review'
    AND (
      NOT v_client.require_caption_for_review
      OR cp.type <> 'reel'
      OR (cp.caption IS NOT NULL AND length(trim(cp.caption)) > 0)
    );

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'content_piece_id', c.content_piece_id,
        'timestamp_seconds', c.timestamp_seconds,
        'comment_text', c.comment_text,
        'created_at', c.created_at
      )
      ORDER BY c.created_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_comments
  FROM public.content_piece_comments c
  WHERE c.client_id = v_client.id
    AND EXISTS (
      SELECT 1
      FROM public.content_pieces cp
      WHERE cp.id = c.content_piece_id
        AND cp.client_id = v_client.id
        AND cp.phase = 'review'
    );

  -- In progress: pieces that returned to editing after client feedback, OR already approved waiting to be scheduled
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', cp.id,
        'title', cp.title,
        'type', cp.type,
        'phase', cp.phase,
        'scheduled_post_date', cp.scheduled_post_date,
        'updated_at', cp.updated_at
      )
      ORDER BY cp.updated_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_in_progress
  FROM public.content_pieces cp
  WHERE cp.client_id = v_client.id
    AND cp.phase IN ('editing', 'script', 'approved')
    AND cp.revision_count > 0
  LIMIT 20;

  -- Upcoming scheduled posts (next 30 days, in handed_over phase)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', cp.id,
        'title', cp.title,
        'type', cp.type,
        'scheduled_post_date', cp.scheduled_post_date,
        'preview_link', cp.preview_link
      )
      ORDER BY cp.scheduled_post_date ASC
    ),
    '[]'::jsonb
  )
  INTO v_upcoming
  FROM public.content_pieces cp
  WHERE cp.client_id = v_client.id
    AND cp.phase = 'handed_over'
    AND cp.scheduled_post_date IS NOT NULL
    AND cp.scheduled_post_date >= CURRENT_DATE
    AND cp.scheduled_post_date <= CURRENT_DATE + INTERVAL '30 days';

  -- Pipeline summary: count by phase (excl. handed_over archive)
  SELECT COALESCE(
    jsonb_object_agg(phase, cnt),
    '{}'::jsonb
  )
  INTO v_pipeline
  FROM (
    SELECT cp.phase, COUNT(*)::int AS cnt
    FROM public.content_pieces cp
    WHERE cp.client_id = v_client.id
      AND cp.phase IN ('idea','script','shooting','editing','review','approved')
    GROUP BY cp.phase
  ) s;

  IF v_client.show_marketing_approval THEN
    SELECT jsonb_build_object(
      'ad_spend', COALESCE(SUM(mt.ad_spend), 0),
      'new_followers', COALESCE(SUM(mt.new_followers), 0),
      'dm_sent', COALESCE(SUM(mt.dm_sent), 0),
      'new_conversations', COALESCE(SUM(mt.new_conversations), 0),
      'appointments_booked', COALESCE(SUM(mt.appointments_booked), 0),
      'appointments_attended', COALESCE(SUM(mt.appointments_attended), 0),
      'closings', COALESCE(SUM(mt.closings), 0),
      'revenue_net', COALESCE(SUM(mt.revenue_net), 0),
      'days_tracked', COUNT(*),
      'month', EXTRACT(MONTH FROM CURRENT_DATE)::int,
      'year', EXTRACT(YEAR FROM CURRENT_DATE)::int
    )
    INTO v_marketing
    FROM public.marketing_tracking mt
    WHERE mt.client_id = v_client.id
      AND EXTRACT(MONTH FROM mt.tracking_date) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM mt.tracking_date) = EXTRACT(YEAR FROM CURRENT_DATE);
  ELSE
    v_marketing := NULL;
  END IF;

  RETURN jsonb_build_object(
    'client', jsonb_build_object(
      'id', v_client.id,
      'name', v_client.name,
      'logo_url', v_client.logo_url
    ),
    'pieces', v_pieces,
    'comments', v_comments,
    'marketing', v_marketing,
    'upcoming_posts', v_upcoming,
    'in_progress', v_in_progress,
    'pipeline_summary', v_pipeline
  );
END;
$function$;

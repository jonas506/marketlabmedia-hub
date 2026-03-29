
ALTER TABLE public.content_pieces ADD COLUMN IF NOT EXISTS team_reply text DEFAULT NULL;

-- Update the approval data function to include team_reply
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
BEGIN
  SELECT id, name, logo_url, show_marketing_approval
  INTO v_client
  FROM public.clients
  WHERE approval_token = _token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;

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
        'slide_images', cp.slide_images,
        'revision_count', cp.revision_count
      )
      ORDER BY cp.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_pieces
  FROM public.content_pieces cp
  WHERE cp.client_id = v_client.id
    AND cp.phase = 'review';

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
    'marketing', v_marketing
  );
END;
$function$;

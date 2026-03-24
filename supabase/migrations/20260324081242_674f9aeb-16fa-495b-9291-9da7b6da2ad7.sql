-- Add revision_count to content_pieces
ALTER TABLE public.content_pieces ADD COLUMN IF NOT EXISTS revision_count integer NOT NULL DEFAULT 0;

-- Update submit_client_piece_review to increment revision_count and block after 2
CREATE OR REPLACE FUNCTION public.submit_client_piece_review(_token uuid, _piece_id uuid, _action text, _comment text DEFAULT NULL::text, _comments jsonb DEFAULT '[]'::jsonb)
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
  SELECT id
  INTO v_client_id
  FROM public.clients
  WHERE approval_token = _token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;

  SELECT id, client_id, phase, type, revision_count
  INTO v_piece
  FROM public.content_pieces
  WHERE id = _piece_id;

  IF NOT FOUND OR v_piece.client_id <> v_client_id OR v_piece.phase <> 'review' THEN
    RAISE EXCEPTION 'Invalid piece';
  END IF;

  IF _action = 'approve' THEN
    UPDATE public.content_pieces
    SET phase = 'approved', client_comment = NULL
    WHERE id = _piece_id;

    DELETE FROM public.content_piece_comments
    WHERE content_piece_id = _piece_id;

    RETURN true;
  ELSIF _action = 'reject' THEN
    -- Block after 2 revisions
    IF v_piece.revision_count >= 2 THEN
      RAISE EXCEPTION 'Maximale Anzahl an Revisionen erreicht (2). Bitte kontaktiere dein Team direkt.';
    END IF;

    v_combined_comment := NULLIF(btrim(COALESCE(_comment, '')), '');

    IF jsonb_typeof(_comments) = 'array' AND jsonb_array_length(_comments) > 0 THEN
      SELECT string_agg(
        CASE
          WHEN elem->>'timestamp_seconds' IS NOT NULL AND elem->>'timestamp_seconds' <> '' THEN
            format(
              '[%s:%s] %s',
              floor((elem->>'timestamp_seconds')::numeric / 60)::int,
              lpad((floor(mod((elem->>'timestamp_seconds')::numeric, 60)))::int::text, 2, '0'),
              COALESCE(elem->>'comment_text', '')
            )
          ELSE COALESCE(elem->>'comment_text', '')
        END,
        E'\n'
      )
      INTO v_combined_comment
      FROM jsonb_array_elements(_comments) elem;
    END IF;

    UPDATE public.content_pieces
    SET phase = CASE WHEN v_piece.type = 'carousel' THEN 'script' ELSE 'editing' END,
        client_comment = COALESCE(v_combined_comment, 'Änderung gewünscht'),
        revision_count = revision_count + 1
    WHERE id = _piece_id;

    RETURN true;
  ELSE
    RAISE EXCEPTION 'Invalid action';
  END IF;
END;
$function$;

-- Update get_client_approval_data to include revision_count
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
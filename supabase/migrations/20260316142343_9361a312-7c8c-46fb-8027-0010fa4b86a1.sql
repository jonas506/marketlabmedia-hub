CREATE OR REPLACE FUNCTION public.get_client_approval_data(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client RECORD;
  v_pieces jsonb;
  v_comments jsonb;
BEGIN
  SELECT id, name, logo_url
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
        'client_comment', cp.client_comment
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

  RETURN jsonb_build_object(
    'client', jsonb_build_object(
      'id', v_client.id,
      'name', v_client.name,
      'logo_url', v_client.logo_url
    ),
    'pieces', v_pieces,
    'comments', v_comments
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.add_client_piece_comment(
  _token uuid,
  _piece_id uuid,
  _comment text,
  _timestamp_seconds numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_id uuid;
  v_comment RECORD;
BEGIN
  SELECT id
  INTO v_client_id
  FROM public.clients
  WHERE approval_token = _token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;

  IF COALESCE(btrim(_comment), '') = '' THEN
    RAISE EXCEPTION 'Comment required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.content_pieces cp
    WHERE cp.id = _piece_id
      AND cp.client_id = v_client_id
      AND cp.phase = 'review'
  ) THEN
    RAISE EXCEPTION 'Invalid piece';
  END IF;

  INSERT INTO public.content_piece_comments (
    content_piece_id,
    client_id,
    timestamp_seconds,
    comment_text
  )
  VALUES (
    _piece_id,
    v_client_id,
    _timestamp_seconds,
    btrim(_comment)
  )
  RETURNING id, content_piece_id, timestamp_seconds, comment_text, created_at
  INTO v_comment;

  RETURN jsonb_build_object(
    'id', v_comment.id,
    'content_piece_id', v_comment.content_piece_id,
    'timestamp_seconds', v_comment.timestamp_seconds,
    'comment_text', v_comment.comment_text,
    'created_at', v_comment.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_client_piece_comment(
  _token uuid,
  _comment_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  SELECT id
  INTO v_client_id
  FROM public.clients
  WHERE approval_token = _token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;

  DELETE FROM public.content_piece_comments
  WHERE id = _comment_id
    AND client_id = v_client_id;

  RETURN FOUND;
END;
$$;

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
AS $$
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

  SELECT id, client_id, phase, type
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
        client_comment = COALESCE(v_combined_comment, 'Änderung gewünscht')
    WHERE id = _piece_id;

    RETURN true;
  ELSE
    RAISE EXCEPTION 'Invalid action';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_approval_data(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_client_piece_comment(uuid, uuid, text, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_client_piece_comment(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_client_piece_review(uuid, uuid, text, text, jsonb) TO anon, authenticated;
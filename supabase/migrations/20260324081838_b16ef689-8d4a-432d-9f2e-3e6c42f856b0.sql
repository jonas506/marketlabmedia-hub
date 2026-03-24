-- Update validate_content_piece_phase to allow 'feedback' phase
CREATE OR REPLACE FUNCTION public.validate_content_piece_phase()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.type NOT IN ('reel', 'carousel', 'ad', 'youtube_longform') THEN
    RAISE EXCEPTION 'Invalid type "%"', NEW.type;
  END IF;
  IF NEW.type = 'carousel' AND NEW.phase NOT IN ('script', 'feedback', 'review', 'approved', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for carousel', NEW.phase;
  END IF;
  IF NEW.type IN ('reel', 'ad') AND NEW.phase NOT IN ('script', 'filmed', 'editing', 'feedback', 'review', 'approved', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for %', NEW.phase, NEW.type;
  END IF;
  IF NEW.type = 'youtube_longform' AND NEW.phase NOT IN ('filmed', 'editing', 'feedback', 'review', 'approved', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for youtube_longform', NEW.phase;
  END IF;
  RETURN NEW;
END;
$function$;

-- Update submit_client_piece_review to set phase to 'feedback' on reject
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
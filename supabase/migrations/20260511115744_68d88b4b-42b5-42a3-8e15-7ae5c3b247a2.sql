-- 1. Add internal_note column
ALTER TABLE public.content_pieces ADD COLUMN IF NOT EXISTS internal_note text;

-- 2. Update phase validation to include internal_review
CREATE OR REPLACE FUNCTION public.validate_content_piece_phase()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.type NOT IN ('reel', 'carousel', 'ad', 'youtube_longform', 'story') THEN
    RAISE EXCEPTION 'Invalid type "%"', NEW.type;
  END IF;
  IF NEW.type = 'carousel' AND NEW.phase NOT IN ('script', 'feedback', 'internal_review', 'review', 'approved', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for carousel', NEW.phase;
  END IF;
  IF NEW.type IN ('reel', 'ad') AND NEW.phase NOT IN ('script', 'filmed', 'editing', 'feedback', 'internal_review', 'review', 'approved', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for %', NEW.phase, NEW.type;
  END IF;
  IF NEW.type = 'youtube_longform' AND NEW.phase NOT IN ('filmed', 'editing', 'feedback', 'internal_review', 'review', 'approved', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for youtube_longform', NEW.phase;
  END IF;
  IF NEW.type = 'story' AND NEW.phase NOT IN ('script', 'feedback', 'internal_review', 'review', 'approved', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for story', NEW.phase;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Auto-assign to Jonas + Slack DM when entering internal_review
CREATE OR REPLACE FUNCTION public.handle_internal_review_phase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_jonas_id uuid := '6db3220c-93b4-4c09-80a4-b14491a6e2be';
  edge_url text;
  anon_key text;
BEGIN
  IF NEW.phase = 'internal_review'
     AND (TG_OP = 'INSERT' OR OLD.phase IS DISTINCT FROM 'internal_review') THEN

    -- Auto-assign to Jonas
    NEW.assigned_to := v_jonas_id;

    -- Fire Slack DM (after row commit via http_post)
    SELECT decrypted_secret INTO edge_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO anon_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

    IF edge_url IS NOT NULL THEN
      PERFORM net.http_post(
        url := edge_url || '/functions/v1/notify-internal-review',
        body := jsonb_build_object('content_piece_id', NEW.id),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || anon_key
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_handle_internal_review ON public.content_pieces;
CREATE TRIGGER trg_handle_internal_review
BEFORE INSERT OR UPDATE OF phase ON public.content_pieces
FOR EACH ROW
EXECUTE FUNCTION public.handle_internal_review_phase();
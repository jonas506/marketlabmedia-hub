
CREATE OR REPLACE FUNCTION public.validate_content_piece_phase()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.type NOT IN ('reel', 'carousel', 'ad', 'youtube_longform', 'story') THEN
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
  IF NEW.type = 'story' AND NEW.phase NOT IN ('script', 'feedback', 'review', 'approved', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for story', NEW.phase;
  END IF;
  RETURN NEW;
END;
$function$;

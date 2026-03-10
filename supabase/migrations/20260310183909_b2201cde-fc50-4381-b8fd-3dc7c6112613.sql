
CREATE OR REPLACE FUNCTION public.validate_content_piece_phase()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.type NOT IN ('reel', 'carousel', 'story', 'ad') THEN
    RAISE EXCEPTION 'Invalid type "%"', NEW.type;
  END IF;
  IF NEW.type = 'carousel' AND NEW.phase NOT IN ('script', 'review', 'approved', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for carousel', NEW.phase;
  END IF;
  IF NEW.type IN ('reel', 'story', 'ad') AND NEW.phase NOT IN ('filmed', 'editing', 'review', 'approved', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for %', NEW.phase, NEW.type;
  END IF;
  RETURN NEW;
END;
$function$;

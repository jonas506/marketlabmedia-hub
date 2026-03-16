CREATE OR REPLACE FUNCTION validate_content_piece_phase()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.type NOT IN ('reel', 'carousel', 'story', 'ad', 'youtube_longform') THEN
    RAISE EXCEPTION 'Invalid type "%"', NEW.type;
  END IF;
  IF NEW.type = 'carousel' AND NEW.phase NOT IN ('script', 'review', 'approved', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for carousel', NEW.phase;
  END IF;
  IF NEW.type IN ('reel', 'story', 'ad') AND NEW.phase NOT IN ('script', 'filmed', 'editing', 'review', 'approved', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for %', NEW.phase, NEW.type;
  END IF;
  IF NEW.type = 'youtube_longform' AND NEW.phase NOT IN ('filmed', 'editing', 'review', 'approved', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for youtube_longform', NEW.phase;
  END IF;
  RETURN NEW;
END;
$$;
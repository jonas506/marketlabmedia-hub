
-- Add services array and monthly_youtube_longform to clients
ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS services text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS monthly_youtube_longform integer NOT NULL DEFAULT 0;

-- Update content piece validation trigger to support youtube_longform and website types
CREATE OR REPLACE FUNCTION public.validate_content_piece_phase()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.type NOT IN ('reel', 'carousel', 'story', 'ad', 'youtube_longform') THEN
    RAISE EXCEPTION 'Invalid type "%"', NEW.type;
  END IF;
  IF NEW.type = 'carousel' AND NEW.phase NOT IN ('script', 'review', 'approved', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for carousel', NEW.phase;
  END IF;
  IF NEW.type IN ('reel', 'story', 'ad') AND NEW.phase NOT IN ('filmed', 'editing', 'review', 'approved', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for %', NEW.phase, NEW.type;
  END IF;
  IF NEW.type = 'youtube_longform' AND NEW.phase NOT IN ('filmed', 'editing', 'review', 'approved', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for youtube_longform', NEW.phase;
  END IF;
  RETURN NEW;
END;
$function$;

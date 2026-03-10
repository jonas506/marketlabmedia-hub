
-- Add approval_token to clients for public approval links
ALTER TABLE public.clients ADD COLUMN approval_token uuid DEFAULT gen_random_uuid() UNIQUE;

-- Add client_comment to content_pieces for client feedback
ALTER TABLE public.content_pieces ADD COLUMN client_comment text;

-- Update phase validation function to support new phases
CREATE OR REPLACE FUNCTION public.validate_content_piece_phase()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.type NOT IN ('reel', 'carousel', 'story') THEN
    RAISE EXCEPTION 'Invalid type "%"', NEW.type;
  END IF;
  IF NEW.type = 'carousel' AND NEW.phase NOT IN ('script', 'review', 'approved', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for carousel', NEW.phase;
  END IF;
  IF NEW.type IN ('reel', 'story') AND NEW.phase NOT IN ('filmed', 'editing', 'review', 'approved', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for %', NEW.phase, NEW.type;
  END IF;
  RETURN NEW;
END;
$$;

-- Migrate existing "done" phase to "approved" 
UPDATE public.content_pieces SET phase = 'approved' WHERE phase = 'done';

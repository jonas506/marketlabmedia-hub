
-- Create content_pieces table
CREATE TABLE IF NOT EXISTS public.content_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  shoot_day_id uuid REFERENCES public.shoot_days(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text,
  assigned_to uuid,
  target_month integer NOT NULL,
  target_year integer NOT NULL,
  phase text NOT NULL,
  has_script boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Validation trigger for type-specific phases
CREATE OR REPLACE FUNCTION public.validate_content_piece_phase()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.type NOT IN ('reel', 'carousel', 'story') THEN
    RAISE EXCEPTION 'Invalid type "%"', NEW.type;
  END IF;
  IF NEW.type = 'carousel' AND NEW.phase NOT IN ('script', 'approved', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for carousel', NEW.phase;
  END IF;
  IF NEW.type IN ('reel', 'story') AND NEW.phase NOT IN ('filmed', 'editing', 'done', 'handed_over') THEN
    RAISE EXCEPTION 'Invalid phase "%" for %', NEW.phase, NEW.type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_content_piece_phase_trigger
  BEFORE INSERT OR UPDATE ON public.content_pieces
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_content_piece_phase();

-- updated_at trigger
CREATE TRIGGER update_content_pieces_updated_at
  BEFORE UPDATE ON public.content_pieces
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.content_pieces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view content pieces" ON public.content_pieces FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage content pieces" ON public.content_pieces FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Head of content can manage content pieces" ON public.content_pieces FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'head_of_content'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'head_of_content'::app_role));
CREATE POLICY "Cutters can update assigned content pieces" ON public.content_pieces FOR UPDATE TO authenticated USING (assigned_to = auth.uid());

ALTER TABLE public.content_pieces ADD COLUMN IF NOT EXISTS phase_changed_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.content_pieces SET phase_changed_at = COALESCE(updated_at, created_at, now()) WHERE phase_changed_at IS NULL OR phase_changed_at = created_at;

CREATE OR REPLACE FUNCTION public.set_phase_changed_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.phase IS DISTINCT FROM OLD.phase THEN
    NEW.phase_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_content_pieces_phase_changed_at ON public.content_pieces;
CREATE TRIGGER trg_content_pieces_phase_changed_at
BEFORE UPDATE ON public.content_pieces
FOR EACH ROW EXECUTE FUNCTION public.set_phase_changed_at();
CREATE OR REPLACE FUNCTION public.reset_review_notification_on_phase_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phase = 'review' AND (OLD.phase IS DISTINCT FROM 'review') THEN
    DELETE FROM public.review_notification_queue
    WHERE content_piece_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reset_review_notification_on_phase_change ON public.content_pieces;
CREATE TRIGGER reset_review_notification_on_phase_change
AFTER UPDATE OF phase ON public.content_pieces
FOR EACH ROW
EXECUTE FUNCTION public.reset_review_notification_on_phase_change();
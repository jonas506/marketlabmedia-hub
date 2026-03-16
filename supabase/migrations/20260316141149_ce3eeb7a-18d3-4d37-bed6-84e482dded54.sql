-- Ensure only one pending review notification exists per content piece
CREATE UNIQUE INDEX IF NOT EXISTS review_notification_queue_unsent_unique_idx
ON public.review_notification_queue (content_piece_id)
WHERE sent_at IS NULL;

-- Harden trigger function so it works for both INSERT and phase changes to review
CREATE OR REPLACE FUNCTION public.queue_review_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.phase = 'review'
     AND (TG_OP = 'INSERT' OR OLD.phase IS DISTINCT FROM 'review') THEN
    INSERT INTO public.review_notification_queue (client_id, content_piece_id, piece_title, piece_type)
    VALUES (NEW.client_id, NEW.id, NEW.title, NEW.type)
    ON CONFLICT (content_piece_id) WHERE sent_at IS NULL
    DO UPDATE SET
      client_id = EXCLUDED.client_id,
      piece_title = EXCLUDED.piece_title,
      piece_type = EXCLUDED.piece_type;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger idempotently in case it was never attached in the database
DROP TRIGGER IF EXISTS on_content_piece_to_review ON public.content_pieces;

CREATE TRIGGER on_content_piece_to_review
AFTER INSERT OR UPDATE OF phase ON public.content_pieces
FOR EACH ROW
EXECUTE FUNCTION public.queue_review_notification();

-- Backfill currently pending review items that were missed while the trigger was absent
INSERT INTO public.review_notification_queue (client_id, content_piece_id, piece_title, piece_type)
SELECT cp.client_id, cp.id, cp.title, cp.type
FROM public.content_pieces cp
WHERE cp.phase = 'review'
ON CONFLICT (content_piece_id) WHERE sent_at IS NULL
DO UPDATE SET
  client_id = EXCLUDED.client_id,
  piece_title = EXCLUDED.piece_title,
  piece_type = EXCLUDED.piece_type;
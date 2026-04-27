-- Ensure a content piece can only ever have one review notification queue entry
DROP INDEX IF EXISTS public.review_notification_queue_unsent_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS review_notification_queue_content_piece_unique_idx
ON public.review_notification_queue (content_piece_id);

-- Update trigger to never create another queue entry for a content piece after one exists
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
    ON CONFLICT (content_piece_id)
    DO UPDATE SET
      client_id = EXCLUDED.client_id,
      piece_title = EXCLUDED.piece_title,
      piece_type = EXCLUDED.piece_type
    WHERE public.review_notification_queue.sent_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;
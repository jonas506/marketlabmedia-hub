CREATE OR REPLACE FUNCTION public.queue_review_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.phase = 'review'
     AND (TG_OP = 'INSERT' OR OLD.phase IS DISTINCT FROM 'review') THEN
    INSERT INTO public.review_notification_queue (client_id, content_piece_id, piece_title, piece_type, sent_at, created_at)
    VALUES (NEW.client_id, NEW.id, NEW.title, NEW.type, NULL, now())
    ON CONFLICT (content_piece_id)
    DO UPDATE SET
      client_id = EXCLUDED.client_id,
      piece_title = EXCLUDED.piece_title,
      piece_type = EXCLUDED.piece_type,
      sent_at = NULL,
      created_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reset_review_notification_on_phase_change ON public.content_pieces;
DROP FUNCTION IF EXISTS public.reset_review_notification_on_phase_change();

UPDATE public.review_notification_queue rnq
SET
  sent_at = NULL,
  created_at = now(),
  client_id = cp.client_id,
  piece_title = cp.title,
  piece_type = cp.type
FROM public.content_pieces cp
WHERE rnq.content_piece_id = cp.id
  AND cp.phase = 'review'
  AND rnq.sent_at IS NOT NULL;
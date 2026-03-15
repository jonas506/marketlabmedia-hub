
-- Add notification email addresses to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS review_notify_emails text[] NOT NULL DEFAULT '{}';

-- Queue table for pending review notifications
CREATE TABLE public.review_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  content_piece_id uuid NOT NULL REFERENCES public.content_pieces(id) ON DELETE CASCADE,
  piece_title text,
  piece_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

ALTER TABLE public.review_notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage review queue"
  ON public.review_notification_queue FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "HoC can manage review queue"
  ON public.review_notification_queue FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'head_of_content'))
  WITH CHECK (public.has_role(auth.uid(), 'head_of_content'));

-- Trigger: when content_piece phase changes to 'review', queue notification
CREATE OR REPLACE FUNCTION public.queue_review_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.phase = 'review' AND (OLD.phase IS NULL OR OLD.phase <> 'review') THEN
    INSERT INTO public.review_notification_queue (client_id, content_piece_id, piece_title, piece_type)
    VALUES (NEW.client_id, NEW.id, NEW.title, NEW.type);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_content_piece_to_review
  AFTER UPDATE ON public.content_pieces
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_review_notification();

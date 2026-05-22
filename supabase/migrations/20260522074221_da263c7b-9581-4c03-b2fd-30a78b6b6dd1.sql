
CREATE TABLE public.piece_internal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_piece_id uuid NOT NULL,
  client_id uuid NOT NULL,
  author_id uuid NOT NULL,
  body text NOT NULL,
  mentioned_user_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pic_piece ON public.piece_internal_comments(content_piece_id, created_at DESC);

ALTER TABLE public.piece_internal_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view internal comments"
  ON public.piece_internal_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert own comments"
  ON public.piece_internal_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors and admins can delete comments"
  ON public.piece_internal_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'head_of_content'::app_role));

CREATE POLICY "Authors can update own comments"
  ON public.piece_internal_comments FOR UPDATE TO authenticated USING (author_id = auth.uid());

-- Notify mentioned users
CREATE OR REPLACE FUNCTION public.notify_piece_comment_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid;
  v_client_name text;
  v_piece_title text;
  v_piece_type text;
  v_author_name text;
  v_type_label text;
BEGIN
  IF NEW.mentioned_user_ids IS NULL OR array_length(NEW.mentioned_user_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
  SELECT title, type INTO v_piece_title, v_piece_type FROM public.content_pieces WHERE id = NEW.content_piece_id;
  SELECT name INTO v_author_name FROM public.profiles WHERE user_id = NEW.author_id;
  v_type_label := CASE v_piece_type
    WHEN 'reel' THEN 'Reel' WHEN 'carousel' THEN 'Karussell'
    WHEN 'ad' THEN 'Ad' WHEN 'youtube_longform' THEN 'YouTube' WHEN 'story' THEN 'Story'
    ELSE v_piece_type END;

  FOREACH v_uid IN ARRAY NEW.mentioned_user_ids LOOP
    IF v_uid IS DISTINCT FROM NEW.author_id THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, reference_id, reference_type)
      VALUES (
        v_uid,
        'mention',
        '💬 ' || COALESCE(v_author_name, 'Jemand') || ' hat dich erwähnt — ' || v_type_label || ' „' || COALESCE(v_piece_title, 'Ohne Titel') || '" (' || COALESCE(v_client_name, 'Kunde') || ')',
        NEW.body,
        '/client/' || NEW.client_id || '?piece=' || NEW.content_piece_id,
        NEW.content_piece_id,
        'content_piece'
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_piece_comment_mentions
  AFTER INSERT ON public.piece_internal_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_piece_comment_mentions();

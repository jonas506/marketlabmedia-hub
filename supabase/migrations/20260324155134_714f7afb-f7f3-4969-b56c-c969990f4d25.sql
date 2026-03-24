
-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  reference_id uuid,
  reference_type text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "Allow trigger inserts" ON public.notifications
  FOR INSERT TO public WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger 1 & 2: Content piece status change + assignment
CREATE OR REPLACE FUNCTION public.notify_content_piece_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_name text;
  v_type_label text;
  v_actor_id uuid;
  v_user record;
BEGIN
  SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
  
  v_type_label := CASE NEW.type
    WHEN 'reel' THEN 'Reel'
    WHEN 'carousel' THEN 'Karussell'
    WHEN 'ad' THEN 'Ad'
    WHEN 'youtube_longform' THEN 'YouTube Longform'
    ELSE NEW.type
  END;

  -- Get the actor (user who made the change)
  v_actor_id := auth.uid();

  -- Assignment change
  IF TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    IF NEW.assigned_to IS DISTINCT FROM v_actor_id THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, reference_id, reference_type)
      VALUES (
        NEW.assigned_to,
        'piece_assigned',
        '📋 Dir wurde ' || v_type_label || ' „' || COALESCE(NEW.title, 'Ohne Titel') || '" von ' || v_client_name || ' zugewiesen',
        NULL,
        '/client/' || NEW.client_id,
        NEW.id,
        'content_piece'
      );
    END IF;
  END IF;

  -- Phase change
  IF TG_OP = 'UPDATE' AND NEW.phase IS DISTINCT FROM OLD.phase THEN
    -- review -> notify admins + head_of_content
    IF NEW.phase = 'review' THEN
      FOR v_user IN
        SELECT ur.user_id FROM public.user_roles ur
        WHERE ur.role IN ('admin', 'head_of_content')
        AND ur.user_id IS DISTINCT FROM v_actor_id
      LOOP
        INSERT INTO public.notifications (user_id, type, title, link, reference_id, reference_type)
        VALUES (
          v_user.user_id,
          'review_ready',
          '🎬 ' || v_type_label || ' „' || COALESCE(NEW.title, 'Ohne Titel') || '" von ' || v_client_name || ' ist zur Freigabe bereit',
          '/client/' || NEW.client_id,
          NEW.id,
          'content_piece'
        );
      END LOOP;
    END IF;

    -- editing -> notify assigned_to
    IF NEW.phase = 'editing' AND NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM v_actor_id THEN
      INSERT INTO public.notifications (user_id, type, title, link, reference_id, reference_type)
      VALUES (
        NEW.assigned_to,
        'piece_status',
        '✂️ ' || v_type_label || ' „' || COALESCE(NEW.title, 'Ohne Titel') || '" von ' || v_client_name || ' ist bereit zum Schnitt',
        '/client/' || NEW.client_id,
        NEW.id,
        'content_piece'
      );
    END IF;

    -- approved -> notify assigned_to
    IF NEW.phase = 'approved' AND NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM v_actor_id THEN
      INSERT INTO public.notifications (user_id, type, title, link, reference_id, reference_type)
      VALUES (
        NEW.assigned_to,
        'piece_status',
        '✅ ' || v_type_label || ' „' || COALESCE(NEW.title, 'Ohne Titel') || '" von ' || v_client_name || ' wurde freigegeben',
        '/client/' || NEW.client_id,
        NEW.id,
        'content_piece'
      );
    END IF;

    -- handed_over -> notify all admins
    IF NEW.phase = 'handed_over' THEN
      FOR v_user IN
        SELECT ur.user_id FROM public.user_roles ur
        WHERE ur.role = 'admin'
        AND ur.user_id IS DISTINCT FROM v_actor_id
      LOOP
        INSERT INTO public.notifications (user_id, type, title, link, reference_id, reference_type)
        VALUES (
          v_user.user_id,
          'piece_status',
          '📤 ' || v_type_label || ' „' || COALESCE(NEW.title, 'Ohne Titel') || '" von ' || v_client_name || ' wurde übergeben',
          '/client/' || NEW.client_id,
          NEW.id,
          'content_piece'
        );
      END LOOP;
    END IF;

    -- feedback -> notify assigned_to
    IF NEW.phase = 'feedback' AND NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM v_actor_id THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, reference_id, reference_type)
      VALUES (
        NEW.assigned_to,
        'piece_status',
        '💬 ' || v_type_label || ' „' || COALESCE(NEW.title, 'Ohne Titel') || '" von ' || v_client_name || ' hat Feedback erhalten',
        NEW.client_comment,
        '/client/' || NEW.client_id,
        NEW.id,
        'content_piece'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_content_piece_change
  AFTER UPDATE ON public.content_pieces
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_content_piece_change();

-- Trigger 3: Task assignment
CREATE OR REPLACE FUNCTION public.notify_task_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_name text;
  v_actor_id uuid;
  v_user record;
BEGIN
  SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
  v_actor_id := auth.uid();

  -- Task assigned (insert or update)
  IF NEW.assigned_to IS NOT NULL THEN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
      IF NEW.assigned_to IS DISTINCT FROM v_actor_id THEN
        INSERT INTO public.notifications (user_id, type, title, link, reference_id, reference_type)
        VALUES (
          NEW.assigned_to,
          'task_assigned',
          '📌 Neue Aufgabe: „' || NEW.title || '" für ' || COALESCE(v_client_name, 'Allgemein'),
          CASE WHEN NEW.client_id IS NOT NULL THEN '/client/' || NEW.client_id ELSE '/tasks' END,
          NEW.id,
          'task'
        );
      END IF;
    END IF;
  END IF;

  -- Task completed
  IF TG_OP = 'UPDATE' AND NEW.is_completed = true AND (OLD.is_completed IS DISTINCT FROM true) THEN
    FOR v_user IN
      SELECT ur.user_id FROM public.user_roles ur
      WHERE ur.role = 'admin'
      AND ur.user_id IS DISTINCT FROM v_actor_id
    LOOP
      INSERT INTO public.notifications (user_id, type, title, link, reference_id, reference_type)
      VALUES (
        v_user.user_id,
        'task_completed',
        '✓ Aufgabe „' || NEW.title || '" für ' || COALESCE(v_client_name, 'Allgemein') || ' wurde erledigt',
        CASE WHEN NEW.client_id IS NOT NULL THEN '/client/' || NEW.client_id ELSE '/tasks' END,
        NEW.id,
        'task'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_task_change
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_change();

-- Cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.notifications WHERE created_at < now() - interval '30 days';
  DELETE FROM public.notifications WHERE is_read = true AND created_at < now() - interval '7 days';
$$;

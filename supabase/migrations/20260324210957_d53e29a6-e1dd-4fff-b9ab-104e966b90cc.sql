
-- Activity Log table
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  action text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  summary text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_entity ON public.activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_client ON public.activity_log(client_id, created_at DESC);
CREATE INDEX idx_activity_actor ON public.activity_log(actor_id, created_at DESC);
CREATE INDEX idx_activity_created ON public.activity_log(created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read activity logs"
  ON public.activity_log FOR SELECT TO authenticated
  USING (true);

-- Cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_activity_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.activity_log WHERE created_at < now() - interval '90 days';
$$;

-- Trigger: content_pieces changes
CREATE OR REPLACE FUNCTION public.log_content_piece_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name text;
  v_actor_name text;
  v_type_label text;
  v_summary text;
  v_assignee_name text;
BEGIN
  SELECT name INTO v_client_name FROM public.clients WHERE id = COALESCE(NEW.client_id, OLD.client_id);
  SELECT name INTO v_actor_name FROM public.profiles WHERE user_id = auth.uid();
  
  v_type_label := CASE COALESCE(NEW.type, OLD.type)
    WHEN 'reel' THEN 'Reel'
    WHEN 'carousel' THEN 'Karussell'
    WHEN 'ad' THEN 'Ad'
    WHEN 'youtube_longform' THEN 'YouTube'
    ELSE COALESCE(NEW.type, OLD.type)
  END;

  -- INSERT
  IF TG_OP = 'INSERT' THEN
    v_summary := COALESCE(v_actor_name, 'System') || ' hat neues ' || v_type_label || ' für ' || COALESCE(v_client_name, 'Unbekannt') || ' erstellt';
    INSERT INTO public.activity_log (actor_id, entity_type, entity_id, client_id, action, summary, metadata)
    VALUES (auth.uid(), 'content_piece', NEW.id, NEW.client_id, 'created', v_summary,
      jsonb_build_object('piece_type', NEW.type, 'piece_title', NEW.title, 'client_name', v_client_name));
    RETURN NEW;
  END IF;

  -- DELETE
  IF TG_OP = 'DELETE' THEN
    v_summary := COALESCE(v_actor_name, 'System') || ' hat ' || v_type_label || ' „' || COALESCE(OLD.title, 'Ohne Titel') || '" von ' || COALESCE(v_client_name, 'Unbekannt') || ' gelöscht';
    INSERT INTO public.activity_log (actor_id, entity_type, entity_id, client_id, action, summary, metadata)
    VALUES (auth.uid(), 'content_piece', OLD.id, OLD.client_id, 'deleted', v_summary,
      jsonb_build_object('piece_type', OLD.type, 'piece_title', OLD.title, 'client_name', v_client_name));
    RETURN OLD;
  END IF;

  -- UPDATE: Phase change
  IF NEW.phase IS DISTINCT FROM OLD.phase THEN
    DECLARE
      v_old_label text;
      v_new_label text;
    BEGIN
      v_old_label := CASE OLD.phase WHEN 'script' THEN 'Skript' WHEN 'filmed' THEN 'Gedreht' WHEN 'editing' THEN 'Schnitt' WHEN 'review' THEN 'Freigabe' WHEN 'feedback' THEN 'Feedback' WHEN 'approved' THEN 'Freigegeben' WHEN 'handed_over' THEN 'Übergeben' ELSE OLD.phase END;
      v_new_label := CASE NEW.phase WHEN 'script' THEN 'Skript' WHEN 'filmed' THEN 'Gedreht' WHEN 'editing' THEN 'Schnitt' WHEN 'review' THEN 'Freigabe' WHEN 'feedback' THEN 'Feedback' WHEN 'approved' THEN 'Freigegeben' WHEN 'handed_over' THEN 'Übergeben' ELSE NEW.phase END;
      v_summary := COALESCE(v_actor_name, 'System') || ' hat ' || v_type_label || ' „' || COALESCE(NEW.title, 'Ohne Titel') || '" von ' || v_old_label || ' nach ' || v_new_label || ' verschoben';
      INSERT INTO public.activity_log (actor_id, entity_type, entity_id, client_id, action, field_name, old_value, new_value, summary, metadata)
      VALUES (auth.uid(), 'content_piece', NEW.id, NEW.client_id, 'phase_changed', 'phase', OLD.phase, NEW.phase, v_summary,
        jsonb_build_object('piece_type', NEW.type, 'piece_title', NEW.title, 'client_name', v_client_name));
    END;
  END IF;

  -- UPDATE: Assignment change
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    SELECT name INTO v_assignee_name FROM public.profiles WHERE user_id = NEW.assigned_to;
    IF NEW.assigned_to IS NULL THEN
      v_summary := COALESCE(v_actor_name, 'System') || ' hat Zuweisung für ' || v_type_label || ' „' || COALESCE(NEW.title, 'Ohne Titel') || '" entfernt';
    ELSE
      v_summary := COALESCE(v_actor_name, 'System') || ' hat ' || v_type_label || ' „' || COALESCE(NEW.title, 'Ohne Titel') || '" an ' || COALESCE(v_assignee_name, 'Unbekannt') || ' zugewiesen';
    END IF;
    INSERT INTO public.activity_log (actor_id, entity_type, entity_id, client_id, action, field_name, old_value, new_value, summary, metadata)
    VALUES (auth.uid(), 'content_piece', NEW.id, NEW.client_id, 'assigned', 'assigned_to', OLD.assigned_to::text, NEW.assigned_to::text, v_summary,
      jsonb_build_object('piece_type', NEW.type, 'piece_title', NEW.title, 'client_name', v_client_name, 'assignee_name', v_assignee_name));
  END IF;

  -- UPDATE: Deadline change
  IF NEW.deadline IS DISTINCT FROM OLD.deadline THEN
    IF NEW.deadline IS NULL THEN
      v_summary := COALESCE(v_actor_name, 'System') || ' hat Deadline für ' || v_type_label || ' „' || COALESCE(NEW.title, 'Ohne Titel') || '" entfernt';
    ELSE
      v_summary := COALESCE(v_actor_name, 'System') || ' hat Deadline für ' || v_type_label || ' „' || COALESCE(NEW.title, 'Ohne Titel') || '" auf ' || to_char(NEW.deadline, 'DD.MM.YYYY') || ' gesetzt';
    END IF;
    INSERT INTO public.activity_log (actor_id, entity_type, entity_id, client_id, action, field_name, old_value, new_value, summary, metadata)
    VALUES (auth.uid(), 'content_piece', NEW.id, NEW.client_id, 'deadline_changed', 'deadline', OLD.deadline::text, NEW.deadline::text, v_summary,
      jsonb_build_object('piece_type', NEW.type, 'piece_title', NEW.title, 'client_name', v_client_name));
  END IF;

  -- UPDATE: Priority change
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    DECLARE
      v_old_prio text;
      v_new_prio text;
    BEGIN
      v_old_prio := CASE OLD.priority WHEN 'low' THEN 'Niedrig' WHEN 'normal' THEN 'Normal' WHEN 'high' THEN 'Hoch' WHEN 'urgent' THEN 'Dringend' ELSE COALESCE(OLD.priority, 'Keine') END;
      v_new_prio := CASE NEW.priority WHEN 'low' THEN 'Niedrig' WHEN 'normal' THEN 'Normal' WHEN 'high' THEN 'Hoch' WHEN 'urgent' THEN 'Dringend' ELSE COALESCE(NEW.priority, 'Keine') END;
      v_summary := COALESCE(v_actor_name, 'System') || ' hat Priorität für ' || v_type_label || ' „' || COALESCE(NEW.title, 'Ohne Titel') || '" auf ' || v_new_prio || ' gesetzt';
      INSERT INTO public.activity_log (actor_id, entity_type, entity_id, client_id, action, field_name, old_value, new_value, summary, metadata)
      VALUES (auth.uid(), 'content_piece', NEW.id, NEW.client_id, 'priority_changed', 'priority', OLD.priority, NEW.priority, v_summary,
        jsonb_build_object('piece_type', NEW.type, 'piece_title', NEW.title, 'client_name', v_client_name));
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_content_piece_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.content_pieces
  FOR EACH ROW EXECUTE FUNCTION public.log_content_piece_changes();

-- Trigger: tasks changes
CREATE OR REPLACE FUNCTION public.log_task_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name text;
  v_actor_name text;
  v_summary text;
  v_assignee_name text;
BEGIN
  SELECT name INTO v_client_name FROM public.clients WHERE id = COALESCE(NEW.client_id, OLD.client_id);
  SELECT name INTO v_actor_name FROM public.profiles WHERE user_id = auth.uid();

  -- INSERT
  IF TG_OP = 'INSERT' THEN
    v_summary := COALESCE(v_actor_name, 'System') || ' hat neue Aufgabe „' || NEW.title || '" für ' || COALESCE(v_client_name, 'Allgemein') || ' erstellt';
    INSERT INTO public.activity_log (actor_id, entity_type, entity_id, client_id, action, summary, metadata)
    VALUES (auth.uid(), 'task', NEW.id, NEW.client_id, 'created', v_summary,
      jsonb_build_object('task_title', NEW.title, 'client_name', v_client_name));
    RETURN NEW;
  END IF;

  -- DELETE
  IF TG_OP = 'DELETE' THEN
    v_summary := COALESCE(v_actor_name, 'System') || ' hat Aufgabe „' || OLD.title || '" von ' || COALESCE(v_client_name, 'Allgemein') || ' gelöscht';
    INSERT INTO public.activity_log (actor_id, entity_type, entity_id, client_id, action, summary, metadata)
    VALUES (auth.uid(), 'task', OLD.id, OLD.client_id, 'deleted', v_summary,
      jsonb_build_object('task_title', OLD.title, 'client_name', v_client_name));
    RETURN OLD;
  END IF;

  -- UPDATE: Completed
  IF NEW.is_completed IS DISTINCT FROM OLD.is_completed AND NEW.is_completed = true THEN
    v_summary := COALESCE(v_actor_name, 'System') || ' hat Aufgabe „' || NEW.title || '" als erledigt markiert';
    INSERT INTO public.activity_log (actor_id, entity_type, entity_id, client_id, action, summary, metadata)
    VALUES (auth.uid(), 'task', NEW.id, NEW.client_id, 'completed', v_summary,
      jsonb_build_object('task_title', NEW.title, 'client_name', v_client_name));
  END IF;

  -- UPDATE: Status change
  IF NEW.status IS DISTINCT FROM OLD.status AND (NEW.is_completed IS NOT DISTINCT FROM OLD.is_completed) THEN
    DECLARE
      v_old_status text;
      v_new_status text;
    BEGIN
      v_old_status := CASE OLD.status WHEN 'not_started' THEN 'Offen' WHEN 'in_progress' THEN 'Begonnen' WHEN 'review' THEN 'Besprechen' WHEN 'done' THEN 'Erledigt' ELSE COALESCE(OLD.status, 'Offen') END;
      v_new_status := CASE NEW.status WHEN 'not_started' THEN 'Offen' WHEN 'in_progress' THEN 'Begonnen' WHEN 'review' THEN 'Besprechen' WHEN 'done' THEN 'Erledigt' ELSE COALESCE(NEW.status, 'Offen') END;
      v_summary := COALESCE(v_actor_name, 'System') || ' hat Status von Aufgabe „' || NEW.title || '" auf ' || v_new_status || ' gesetzt';
      INSERT INTO public.activity_log (actor_id, entity_type, entity_id, client_id, action, field_name, old_value, new_value, summary, metadata)
      VALUES (auth.uid(), 'task', NEW.id, NEW.client_id, 'status_changed', 'status', OLD.status, NEW.status, v_summary,
        jsonb_build_object('task_title', NEW.title, 'client_name', v_client_name));
    END;
  END IF;

  -- UPDATE: Assignment change
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    SELECT name INTO v_assignee_name FROM public.profiles WHERE user_id = NEW.assigned_to;
    IF NEW.assigned_to IS NULL THEN
      v_summary := COALESCE(v_actor_name, 'System') || ' hat Zuweisung für Aufgabe „' || NEW.title || '" entfernt';
    ELSE
      v_summary := COALESCE(v_actor_name, 'System') || ' hat Aufgabe „' || NEW.title || '" an ' || COALESCE(v_assignee_name, 'Unbekannt') || ' zugewiesen';
    END IF;
    INSERT INTO public.activity_log (actor_id, entity_type, entity_id, client_id, action, field_name, old_value, new_value, summary, metadata)
    VALUES (auth.uid(), 'task', NEW.id, NEW.client_id, 'assigned', 'assigned_to', OLD.assigned_to::text, NEW.assigned_to::text, v_summary,
      jsonb_build_object('task_title', NEW.title, 'client_name', v_client_name, 'assignee_name', v_assignee_name));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_task_changes();


-- 1) Drop automatic task-creation triggers and their functions
DROP TRIGGER IF EXISTS trg_create_task_on_phase_change ON public.content_pieces;
DROP TRIGGER IF EXISTS trg_sop_piece_editing ON public.content_pieces;
DROP TRIGGER IF EXISTS trg_sop_piece_approved ON public.content_pieces;
DROP TRIGGER IF EXISTS trg_sop_shoot_day_created ON public.shoot_days;

DROP FUNCTION IF EXISTS public.create_task_on_phase_change() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_sop_on_piece_editing() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_sop_on_piece_approved() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_sop_on_shoot_day() CASCADE;

-- 2) Automatic Slack notification on task assignment (insert OR assignee change)
CREATE OR REPLACE FUNCTION public.notify_task_assignment_slack()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  edge_url text;
  anon_key text;
  v_client_name text;
BEGIN
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.assigned_to IS NOT DISTINCT FROM NEW.assigned_to THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;

  SELECT decrypted_secret INTO edge_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO anon_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

  IF edge_url IS NOT NULL THEN
    PERFORM net.http_post(
      url := edge_url || '/functions/v1/notify-task-assignment',
      body := jsonb_build_object(
        'assigned_to', NEW.assigned_to,
        'task_title', NEW.title,
        'task_count', 1,
        'client_name', v_client_name,
        'tag', NEW.tag
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_task_assignment_slack ON public.tasks;
CREATE TRIGGER trg_notify_task_assignment_slack
  AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assignment_slack();

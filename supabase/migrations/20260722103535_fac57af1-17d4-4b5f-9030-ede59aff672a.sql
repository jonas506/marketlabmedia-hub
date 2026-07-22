
CREATE OR REPLACE FUNCTION public.notify_task_completed_slack()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  edge_url text;
  anon_key text;
  v_client_name text;
  v_recipient uuid;
  v_actor uuid;
BEGIN
  -- Only fire when transitioning to completed
  IF NEW.is_completed IS NOT TRUE THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_completed IS TRUE THEN RETURN NEW; END IF;

  v_recipient := COALESCE(NEW.created_by, NEW.assigned_to);
  v_actor := COALESCE(NEW.completed_by, auth.uid());

  IF v_recipient IS NULL THEN RETURN NEW; END IF;
  IF v_actor IS NOT NULL AND v_recipient = v_actor THEN RETURN NEW; END IF;

  SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
  SELECT decrypted_secret INTO edge_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO anon_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

  IF edge_url IS NOT NULL THEN
    PERFORM net.http_post(
      url := edge_url || '/functions/v1/notify-task-assignment',
      body := jsonb_build_object(
        'assigned_to', v_recipient,
        'task_title', NEW.title,
        'client_name', v_client_name,
        'kind', 'completed'
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

DROP TRIGGER IF EXISTS trg_notify_task_completed_slack ON public.tasks;
CREATE TRIGGER trg_notify_task_completed_slack
AFTER UPDATE OF is_completed ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_completed_slack();

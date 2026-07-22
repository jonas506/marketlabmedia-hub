
CREATE OR REPLACE FUNCTION public.notify_task_review_slack()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edge_url text;
  anon_key text;
  v_client_name text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'review' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'review' THEN RETURN NEW; END IF;
  IF NEW.created_by IS NULL THEN RETURN NEW; END IF;
  IF NEW.created_by = NEW.assigned_to THEN RETURN NEW; END IF;

  SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
  SELECT decrypted_secret INTO edge_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO anon_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

  IF edge_url IS NOT NULL THEN
    PERFORM net.http_post(
      url := edge_url || '/functions/v1/notify-task-assignment',
      body := jsonb_build_object(
        'assigned_to', NEW.created_by,
        'task_title', NEW.title,
        'client_name', v_client_name,
        'kind', 'review_ready'
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_review_slack ON public.tasks;
CREATE TRIGGER trg_notify_task_review_slack
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_review_slack();

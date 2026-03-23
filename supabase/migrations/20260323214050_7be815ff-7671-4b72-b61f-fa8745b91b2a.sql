
CREATE OR REPLACE FUNCTION public.notify_on_assignment()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  edge_url text;
  anon_key text;
BEGIN
  -- Only fire when assigned_to changes to a non-null value
  IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    SELECT decrypted_secret INTO edge_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO anon_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

    PERFORM net.http_post(
      url := edge_url || '/functions/v1/notify-assignment',
      body := jsonb_build_object('content_piece_id', NEW.id, 'assigned_to', NEW.assigned_to),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_content_piece_assigned
  AFTER INSERT OR UPDATE OF assigned_to ON public.content_pieces
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_assignment();

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_slack_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  edge_url text;
  anon_key text;
BEGIN
  IF NEW.phase = 'approved' AND (TG_OP = 'INSERT' OR OLD.phase IS DISTINCT FROM 'approved') THEN
    SELECT decrypted_secret INTO edge_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO anon_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

    PERFORM net.http_post(
      url := edge_url || '/functions/v1/notify-slack-approval',
      body := jsonb_build_object('content_piece_id', NEW.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_slack_approval ON public.content_pieces;
CREATE TRIGGER trg_notify_slack_approval
  AFTER INSERT OR UPDATE OF phase ON public.content_pieces
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_slack_on_approval();
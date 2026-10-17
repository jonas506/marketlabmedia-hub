CREATE TABLE public.positioning_slack_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.positioning_analysis_leads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.positioning_slack_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.positioning_slack_outbox TO service_role;
ALTER TABLE public.positioning_slack_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_only ON public.positioning_slack_outbox FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX positioning_slack_outbox_created_at ON public.positioning_slack_outbox(created_at);
CREATE OR REPLACE FUNCTION public.notify_positioning_lead_slack()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  notification_id uuid;
BEGIN
  BEGIN
    DELETE FROM public.positioning_slack_outbox WHERE created_at < now() - interval '1 day';
    INSERT INTO public.positioning_slack_outbox(lead_id) VALUES (NEW.id) RETURNING id INTO notification_id;
    PERFORM net.http_post(
      url := 'https://winsekbpsgwtwfdehyms.supabase.co/functions/v1/lead-slack-notify',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('notification_id', notification_id),
      timeout_milliseconds := 10000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'lead-slack-notify: enqueue failed';
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_positioning_lead_slack() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER positioning_lead_slack_after_insert AFTER INSERT ON public.positioning_analysis_leads FOR EACH ROW EXECUTE FUNCTION public.notify_positioning_lead_slack();
COMMENT ON TABLE public.positioning_slack_outbox IS 'Single-use expiring callback capabilities. No contact data or webhook credentials. At-most-once best-effort Slack delivery.';
DROP TRIGGER IF EXISTS positioning_lead_slack_after_insert ON public.positioning_analysis_leads;
DROP FUNCTION IF EXISTS public.notify_positioning_lead_slack();
REVOKE ALL ON TABLE public.positioning_slack_outbox FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON TABLE public.positioning_slack_outbox IS 'DEPRECATED: Slack integration cancelled; unused and inaccessible. No trigger or function references this table.';
ALTER TABLE public.positioning_funnel_events ADD COLUMN IF NOT EXISTS funnel text NOT NULL DEFAULT 'positionierung', ADD COLUMN IF NOT EXISTS weg text, ADD COLUMN IF NOT EXISTS variant text, ADD COLUMN IF NOT EXISTS event_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS positioning_funnel_events_vc_once ON public.positioning_funnel_events(session_id, step) WHERE funnel='vertriebs-check';
CREATE INDEX IF NOT EXISTS positioning_funnel_events_funnel_created ON public.positioning_funnel_events(funnel, created_at);

ALTER TABLE public.vertriebs_check_submissions
 ADD COLUMN IF NOT EXISTS tracking_consent boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS fbp text, ADD COLUMN IF NOT EXISTS fbc text,
 ADD COLUMN IF NOT EXISTS client_ip text, ADD COLUMN IF NOT EXISTS client_user_agent text,
 ADD COLUMN IF NOT EXISTS kontakt_at timestamptz, ADD COLUMN IF NOT EXISTS lead_sent_at timestamptz,
 ADD COLUMN IF NOT EXISTS termin_at timestamptz, ADD COLUMN IF NOT EXISTS schedule_sent_at timestamptz,
 ADD COLUMN IF NOT EXISTS abschluss_at timestamptz, ADD COLUMN IF NOT EXISTS purchase_sent_at timestamptz,
 ADD COLUMN IF NOT EXISTS slack_status text;

CREATE TABLE IF NOT EXISTS public.capi_log(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 funnel text NOT NULL DEFAULT 'vertriebs-check',
 submission_id uuid,
 event_name text NOT NULL,
 event_id text,
 status text NOT NULL,
 events_received integer,
 error text,
 test boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.capi_log TO authenticated;
GRANT ALL ON public.capi_log TO service_role;
ALTER TABLE public.capi_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Funnel admins read capi log" ON public.capi_log FOR SELECT TO authenticated USING (public.is_funnel_admin());

-- Records CRM stage milestones for Vertriebs-Check leads and wakes the sender. CRM edits never fail because of it.
CREATE OR REPLACE FUNCTION public.vc_stage_reached() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE lid uuid; pid uuid; st text; old_st text; sid uuid; consent boolean; pending boolean;
BEGIN
 IF TG_TABLE_NAME='crm_leads' THEN lid:=NEW.id; pid:=NEW.pipeline_id; ELSE lid:=NEW.lead_id; pid:=NEW.pipeline_id; END IF;
 st:=NEW.stage; IF TG_OP='UPDATE' THEN old_st:=OLD.stage; END IF;
 IF pid IS DISTINCT FROM 'a1000000-0000-0000-0000-000000000001'::uuid OR st IS NOT DISTINCT FROM old_st THEN RETURN NEW; END IF;
 BEGIN
  UPDATE vertriebs_check_submissions SET
   kontakt_at=CASE WHEN st IN ('erstkontakt','gespraech','angebot','stage_1788359427146','gewonnen') THEN coalesce(kontakt_at,now()) ELSE kontakt_at END,
   termin_at=CASE WHEN st IN ('erstkontakt','gespraech','angebot','stage_1788359427146') THEN coalesce(termin_at,now()) ELSE termin_at END,
   abschluss_at=CASE WHEN st='gewonnen' THEN coalesce(abschluss_at,now()) ELSE abschluss_at END
  WHERE lead_id=lid
  RETURNING id, tracking_consent, (kontakt_at IS NOT NULL AND lead_sent_at IS NULL) OR (termin_at IS NOT NULL AND schedule_sent_at IS NULL) OR (abschluss_at IS NOT NULL AND purchase_sent_at IS NULL) INTO sid, consent, pending;
  IF sid IS NOT NULL AND consent AND pending THEN
   PERFORM net.http_post(url:='https://winsekbpsgwtwfdehyms.supabase.co/functions/v1/vertriebs-check?action=status',
    headers:=jsonb_build_object('Content-Type','application/json','apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbnNla2Jwc2d3dHdmZGVoeW1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODc0NTcsImV4cCI6MjA4ODY2MzQ1N30.V4AnsmBlJKjIBnLzwsLr6-EXTfw2vAwepK5NF55NT1s'),
    body:=jsonb_build_object('submission_id',sid));
  END IF;
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'vc_stage_reached failed: %', SQLERRM;
 END;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS vc_stage_reached_leads ON public.crm_leads;
CREATE TRIGGER vc_stage_reached_leads AFTER UPDATE OF stage, pipeline_id ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION public.vc_stage_reached();
DROP TRIGGER IF EXISTS vc_stage_reached_pipelines ON public.crm_lead_pipelines;
CREATE TRIGGER vc_stage_reached_pipelines AFTER INSERT OR UPDATE OF stage ON public.crm_lead_pipelines FOR EACH ROW EXECUTE FUNCTION public.vc_stage_reached();
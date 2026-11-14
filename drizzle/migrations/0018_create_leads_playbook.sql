CREATE TABLE public.playbook_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  aktion_bis date,
  cover_bild_url text CHECK (cover_bild_url IS NULL OR (length(cover_bild_url) <= 2048 AND cover_bild_url ~ '^https://')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.playbook_settings TO authenticated;
GRANT ALL ON public.playbook_settings TO service_role;
ALTER TABLE public.playbook_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage playbook settings" ON public.playbook_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.playbook_settings(id) VALUES (true);

CREATE TABLE public.playbook_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  first_name text NOT NULL CHECK (length(first_name) BETWEEN 1 AND 100),
  last_name text NOT NULL CHECK (length(last_name) BETWEEN 1 AND 100),
  email text NOT NULL CHECK (length(email) <= 255),
  phone text NOT NULL CHECK (length(phone) <= 32),
  privacy_consent boolean NOT NULL DEFAULT true CHECK (privacy_consent),
  consent_evidence jsonb NOT NULL,
  attribution jsonb NOT NULL DEFAULT '{}',
  variant text,
  tracking_consent boolean NOT NULL DEFAULT false,
  session_id uuid,
  advertising_consent_id uuid REFERENCES public.vertriebs_check_consents(id),
  fbp text,
  fbc text,
  client_ip text,
  client_user_agent text,
  berater_typ text,
  umsatz_stufe text,
  step2_completed_at timestamptz,
  skipped_at timestamptz,
  pdf_path text,
  pdf_status text NOT NULL DEFAULT 'pending',
  pdf_error text,
  mail_status text NOT NULL DEFAULT 'pending',
  slack_status text,
  crm_error text,
  is_test boolean NOT NULL DEFAULT false,
  kontakt_at timestamptz,
  lead_sent_at timestamptz NOT NULL DEFAULT now(),
  termin_at timestamptz,
  schedule_sent_at timestamptz,
  abschluss_at timestamptz,
  purchase_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.playbook_submissions TO authenticated;
GRANT ALL ON public.playbook_submissions TO service_role;
ALTER TABLE public.playbook_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read playbook submissions" ON public.playbook_submissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update playbook submissions" ON public.playbook_submissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX playbook_submissions_created_idx ON public.playbook_submissions(created_at DESC);
CREATE INDEX playbook_submissions_lead_idx ON public.playbook_submissions(lead_id);
CREATE UNIQUE INDEX positioning_funnel_events_playbook_once ON public.positioning_funnel_events(session_id, step) WHERE funnel='leads-playbook';

CREATE OR REPLACE FUNCTION public.playbook_submit(_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.playbook_submissions; c uuid; l uuid; owner_id uuid; evidence jsonb; full_name text; new_tags text[]; now_ts timestamptz:=now();
BEGIN
  SELECT * INTO s FROM public.playbook_submissions WHERE request_id=(_data->>'request_id')::uuid;
  IF FOUND THEN RETURN jsonb_build_object('token',s.token,'id',s.id,'lead_id',s.lead_id,'existing',true); END IF;
  IF coalesce((_data->>'privacy')::boolean,false)=false OR length(trim(_data->>'first_name')) NOT BETWEEN 1 AND 100 OR length(trim(_data->>'last_name')) NOT BETWEEN 1 AND 100 OR length(_data->>'email')>255 OR _data->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR _data->>'phone' !~ '^\+[0-9]{7,15}$' THEN RAISE EXCEPTION 'invalid submission'; END IF;
  evidence:=jsonb_build_object('privacy',jsonb_build_object('accepted',true,'at',now_ts,'text','Ich habe die Datenschutzerklärung gelesen. Marketlab Media darf mich zum Playbook per E-Mail und telefonisch kontaktieren.'));
  full_name:=trim(_data->>'first_name')||' '||trim(_data->>'last_name');
  new_tags:=ARRAY['leads-playbook']||CASE WHEN lower(_data->>'email') LIKE '%@example.com' THEN ARRAY['test'] ELSE '{}'::text[] END;
  INSERT INTO public.playbook_submissions(request_id,first_name,last_name,email,phone,consent_evidence,variant,is_test)
  VALUES((_data->>'request_id')::uuid,trim(_data->>'first_name'),trim(_data->>'last_name'),lower(trim(_data->>'email')),_data->>'phone',evidence,left(nullif(_data->>'variant',''),40),lower(_data->>'email') LIKE '%@example.com') RETURNING * INTO s;
  BEGIN
    SELECT user_id INTO owner_id FROM public.user_roles WHERE role='admin' AND user_id IN (SELECT id FROM auth.users WHERE email='jonas@marketlab-media.de') LIMIT 1;
    IF owner_id IS NULL THEN SELECT user_id INTO owner_id FROM public.user_roles WHERE role='admin' ORDER BY created_at LIMIT 1; END IF;
    IF owner_id IS NULL THEN RAISE EXCEPTION 'owner not configured'; END IF;
    c:=public.crm_match_contact(NULL,s.email,NULL,NULL,NULL,NULL);
    IF c IS NULL THEN
      INSERT INTO public.crm_contacts(full_name,first_name,email,phone,segment,relationship,source,tags,created_by) VALUES(full_name,s.first_name,s.email,s.phone,'immo_finanz','lead','Leads-Playbook',new_tags,owner_id) RETURNING id INTO c;
    ELSE
      UPDATE public.crm_contacts SET full_name=full_name,first_name=coalesce(nullif(crm_contacts.first_name,''),s.first_name),phone=coalesce(nullif(crm_contacts.phone,''),s.phone),tags=(SELECT array_agg(DISTINCT t) FROM unnest(coalesce(crm_contacts.tags,'{}')||new_tags) t) WHERE id=c;
    END IF;
    INSERT INTO public.crm_leads(name,contact_name,contact_email,contact_phone,contact_id,source,stage,pipeline_id,created_by,next_step,next_step_date,description,vertriebs_check_data)
    VALUES(full_name,full_name,s.email,s.phone,c,'Leads-Playbook','interessiert','a1000000-0000-0000-0000-000000000001',owner_id,'Anrufen (15 Min) – Playbook',(now_ts AT TIME ZONE 'Europe/Berlin')::date,'Leads-Playbook 2027 angefordert',jsonb_build_object('funnel','leads-playbook','submission_id',s.id,'variant',s.variant,'consent_evidence',evidence,'result_path','/playbook/danke/'||s.token)) RETURNING id INTO l;
    INSERT INTO public.crm_lead_pipelines(lead_id,pipeline_id,stage) VALUES(l,'a1000000-0000-0000-0000-000000000001','interessiert') ON CONFLICT (lead_id,pipeline_id) DO NOTHING;
    INSERT INTO public.crm_activities(lead_id,contact_id,type,title,body,created_by,metadata) VALUES(l,c,'note','Leads-Playbook angefordert','Leads-Playbook 2027 angefordert',owner_id,jsonb_build_object('submission_id',s.id,'result_path','/playbook/danke/'||s.token));
    UPDATE public.playbook_submissions SET contact_id=c,lead_id=l WHERE id=s.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'playbook crm sync failed: %',SQLERRM;
    UPDATE public.playbook_submissions SET crm_error=left(SQLERRM,500) WHERE id=s.id;
  END;
  RETURN jsonb_build_object('token',s.token,'id',s.id,'lead_id',l,'existing',false);
END $$;
REVOKE ALL ON FUNCTION public.playbook_submit(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.playbook_submit(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.playbook_stage_reached() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE lid uuid; pid uuid; st text; old_st text; sid uuid; consent boolean; pending boolean;
BEGIN
  IF TG_TABLE_NAME='crm_leads' THEN lid:=NEW.id; pid:=NEW.pipeline_id; ELSE lid:=NEW.lead_id; pid:=NEW.pipeline_id; END IF;
  st:=NEW.stage; IF TG_OP='UPDATE' THEN old_st:=OLD.stage; END IF;
  IF pid IS DISTINCT FROM 'a1000000-0000-0000-0000-000000000001'::uuid OR st IS NOT DISTINCT FROM old_st THEN RETURN NEW; END IF;
  BEGIN
    UPDATE public.playbook_submissions SET
      kontakt_at=CASE WHEN st IN ('erstkontakt','gespraech','angebot','stage_1788359427146','gewonnen') THEN coalesce(kontakt_at,now()) ELSE kontakt_at END,
      termin_at=CASE WHEN st IN ('erstkontakt','gespraech','angebot','stage_1788359427146') THEN coalesce(termin_at,now()) ELSE termin_at END,
      abschluss_at=CASE WHEN st='gewonnen' THEN coalesce(abschluss_at,now()) ELSE abschluss_at END,
      updated_at=now()
    WHERE lead_id=lid
    RETURNING id,tracking_consent,(termin_at IS NOT NULL AND schedule_sent_at IS NULL) OR (abschluss_at IS NOT NULL AND purchase_sent_at IS NULL) INTO sid,consent,pending;
    IF sid IS NOT NULL AND consent AND pending THEN
      PERFORM net.http_post(url:='https://winsekbpsgwtwfdehyms.supabase.co/functions/v1/playbook?action=status',headers:=jsonb_build_object('Content-Type','application/json','apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbnNla2Jwc2d3dHdmZGVoeW1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODc0NTcsImV4cCI6MjA4ODY2MzQ1N30.V4AnsmBlJKjIBnLzwsLr6-EXTfw2vAwepK5NF55NT1s'),body:=jsonb_build_object('submission_id',sid));
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'playbook_stage_reached failed: %',SQLERRM; END;
  RETURN NEW;
END $$;
CREATE TRIGGER playbook_stage_reached_leads AFTER UPDATE OF stage,pipeline_id ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION public.playbook_stage_reached();
CREATE TRIGGER playbook_stage_reached_pipelines AFTER INSERT OR UPDATE OF stage ON public.crm_lead_pipelines FOR EACH ROW EXECUTE FUNCTION public.playbook_stage_reached();
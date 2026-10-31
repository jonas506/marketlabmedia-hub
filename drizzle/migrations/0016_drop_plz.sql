ALTER TABLE public.vertriebs_check_submissions ALTER COLUMN postcode DROP NOT NULL;
ALTER TABLE public.vertriebs_check_submissions DROP CONSTRAINT IF EXISTS vertriebs_check_submissions_postcode_check;
COMMENT ON COLUMN public.vertriebs_check_submissions.postcode IS 'DEPRECATED: PLZ wird im Vertriebs-Check nicht mehr erhoben';

CREATE OR REPLACE FUNCTION public.vc_submit(_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE a integer[]; w text; c uuid; l uuid; s vertriebs_check_submissions; owner_id uuid; total_points integer; pct integer; typ text; station_scores jsonb; evidence jsonb; red text; names text[]; keys text[]; weg_label text; tag text; v text; summary text; ampel text; now_ts timestamptz := now();
BEGIN
SELECT * INTO s FROM vertriebs_check_submissions WHERE request_id=(_data->>'request_id')::uuid; IF FOUND THEN RETURN jsonb_build_object('token',s.token,'id',s.id,'lead_id',s.lead_id,'existing',true); END IF;
w := _data->>'weg';
SELECT array_agg(value::integer ORDER BY ord) INTO a FROM jsonb_array_elements_text(_data->'answers') WITH ORDINALITY AS x(value,ord);
IF w NOT IN ('a','b') OR array_length(a,1) IS DISTINCT FROM 5 OR NOT (a <@ ARRAY[0,1,2]) OR coalesce((_data->>'privacy')::boolean,false)=false OR length(trim(_data->>'first_name')) NOT BETWEEN 1 AND 100 OR length(trim(_data->>'company')) NOT BETWEEN 1 AND 200 OR length(_data->>'email')>255 OR _data->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR _data->>'phone' !~ '^\+?[0-9 ()/-]{7,32}$' THEN RAISE EXCEPTION 'invalid submission'; END IF;
v := left(nullif(_data->>'variant',''),40);
IF w='a' THEN names:=ARRAY['Anzeigen','Cockpit','Filter','Vertrauen','Tempo']; keys:=ARRAY['anzeigen','cockpit','filter','vertrauen','tempo']; weg_label:='Weg A (schaltet Ads)'; tag:='schaltet-ads';
ELSE names:=ARRAY['Sichtbarkeit','Gesichter','Tempo','Kapazität','Zielgruppe']; keys:=ARRAY['sichtbarkeit','kamera','tempo','kapazitaet','zielgruppe']; weg_label:='Weg B (will starten)'; tag:='will-starten'; END IF;
SELECT sum(x) INTO total_points FROM unnest(a) x;
pct := round(total_points::numeric/10*100);
typ := CASE WHEN w='a' THEN CASE WHEN total_points<=3 THEN 'Blindflug' WHEN total_points<=7 THEN 'Lead-Hamsterrad' ELSE 'Kurz vor Marktführer' END
            ELSE CASE WHEN total_points<=3 THEN 'Erst Grundlagen' WHEN total_points<=7 THEN 'Fast startklar' ELSE 'Startklar' END END;
SELECT jsonb_object_agg(keys[i],a[i]) INTO station_scores FROM generate_series(1,5) i;
SELECT string_agg(names[i],', ') INTO red FROM generate_series(1,5) i WHERE a[i]=0;
SELECT string_agg(names[i]||': '||(ARRAY['rot','gelb','grün'])[a[i]+1],' · ') INTO ampel FROM generate_series(1,5) i;
evidence:=jsonb_build_object('recorded_at',now_ts,
 'privacy',jsonb_build_object('accepted',true,'at',now_ts,'text','Ich habe die Datenschutzerklärung gelesen.'),
 'whatsapp',jsonb_build_object('accepted',coalesce((_data->>'whatsapp_consent')::boolean,false),'at',CASE WHEN coalesce((_data->>'whatsapp_consent')::boolean,false) THEN now_ts END,'text','Schickt mir meine Auswertung auch per WhatsApp.'),
 'email',jsonb_build_object('accepted',coalesce((_data->>'email_consent')::boolean,false),'at',CASE WHEN coalesce((_data->>'email_consent')::boolean,false) THEN now_ts END,'text','Ich möchte weitere Tipps zu meiner Auswertung per E-Mail, jederzeit abbestellbar.'));
INSERT INTO vertriebs_check_submissions(request_id,first_name,company,email,phone,answers,scores,total,score,result_type,weg,variant,whatsapp_consent,email_consent,consent_evidence,attribution)
VALUES((_data->>'request_id')::uuid,trim(_data->>'first_name'),trim(_data->>'company'),lower(trim(_data->>'email')),_data->>'phone',a,station_scores,total_points,pct,typ,w,v,coalesce((_data->>'whatsapp_consent')::boolean,false),coalesce((_data->>'email_consent')::boolean,false),evidence,'{}') RETURNING * INTO s;
summary := weg_label||' · Typ: '||typ||' · Score '||pct||'/100 · '||ampel;
-- CRM failures must never block the result page.
BEGIN
 SELECT user_id INTO owner_id FROM user_roles WHERE role='admin' AND user_id IN (SELECT id FROM auth.users WHERE email='jonas@marketlab-media.de') LIMIT 1;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'owner not configured'; END IF;
 c:=crm_match_contact(NULL,s.email,NULL,NULL,NULL,NULL);
 IF c IS NULL THEN
  INSERT INTO crm_contacts(full_name,first_name,company,email,phone,segment,relationship,source,tags,created_by) VALUES(s.first_name,s.first_name,s.company,s.email,s.phone,'immo_finanz','lead','Vertriebs-Check',ARRAY['vertriebs-check',tag],owner_id) RETURNING id INTO c;
 ELSE
  UPDATE crm_contacts SET tags=(SELECT array_agg(DISTINCT t) FROM unnest(coalesce(tags,'{}')||ARRAY['vertriebs-check',tag]) t), phone=coalesce(nullif(phone,''),s.phone), company=coalesce(nullif(company,''),s.company), first_name=coalesce(nullif(first_name,''),s.first_name) WHERE id=c;
 END IF;
 INSERT INTO crm_leads(name,contact_name,contact_email,contact_phone,contact_id,source,stage,pipeline_id,created_by,next_step,next_step_date,description,vertriebs_check_data)
 VALUES(s.company,s.first_name,s.email,s.phone,c,'Vertriebs-Check','interessiert','a1000000-0000-0000-0000-000000000001',owner_id,'Anrufen (15 Min) – '||weg_label||', rot: '||coalesce(red,'keine'),(now_ts AT TIME ZONE 'Europe/Berlin')::date,summary,
  jsonb_build_object('weg',w,'answers',a,'scores',station_scores,'total',total_points,'score',pct,'type',typ,'variant',v,'consent_evidence',evidence,'submission_id',s.id,'result_path','/check/auswertung/'||s.token)) RETURNING id INTO l;
 INSERT INTO crm_lead_pipelines(lead_id,pipeline_id,stage) VALUES(l,'a1000000-0000-0000-0000-000000000001','interessiert') ON CONFLICT (lead_id,pipeline_id) DO NOTHING;
 INSERT INTO crm_activities(lead_id,contact_id,type,title,body,created_by,metadata) VALUES(l,c,'note','Vertriebs-Check ausgefüllt',summary,owner_id,jsonb_build_object('scores',station_scores,'submission_id',s.id,'result_path','/check/auswertung/'||s.token));
 INSERT INTO notifications(user_id,type,title,body,link,reference_id,reference_type) VALUES(owner_id,'info','Neuer Vertriebs-Check',s.first_name||' · '||s.company||' · '||typ||' · Rot: '||coalesce(red,'keine'),'/crm/lead/'||l,l,'crm_lead');
 UPDATE vertriebs_check_submissions SET contact_id=c, lead_id=l WHERE id=s.id;
 IF s.whatsapp_consent THEN INSERT INTO vertriebs_check_jobs(submission_id,channel,due_at,body) VALUES(s.id,'whatsapp',now_ts,'Hallo '||s.first_name||', hier ist deine Auswertung: https://hub.marketlab-media.de/check/auswertung/'||s.token); END IF;
 IF s.email_consent THEN INSERT INTO vertriebs_check_jobs(submission_id,channel,day,due_at) SELECT s.id,'email',d,now_ts+d*interval '1 day' FROM unnest(ARRAY[1,2,4,6,9,14]) d; END IF;
EXCEPTION WHEN OTHERS THEN
 RAISE WARNING 'vertriebs-check crm sync failed: %', SQLERRM;
 UPDATE vertriebs_check_submissions SET crm_error=left(SQLERRM,500) WHERE id=s.id;
END;
RETURN jsonb_build_object('token',s.token,'id',s.id,'lead_id',l,'existing',false);
END $function$;
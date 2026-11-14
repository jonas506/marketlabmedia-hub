CREATE OR REPLACE FUNCTION public.playbook_submit(_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.playbook_submissions; c uuid; l uuid; owner_id uuid; evidence jsonb; person_name text; new_tags text[]; now_ts timestamptz:=now();
BEGIN
  SELECT * INTO s FROM public.playbook_submissions WHERE request_id=(_data->>'request_id')::uuid;
  IF FOUND THEN RETURN jsonb_build_object('token',s.token,'id',s.id,'lead_id',s.lead_id,'existing',true); END IF;
  IF coalesce((_data->>'privacy')::boolean,false)=false OR length(trim(_data->>'first_name')) NOT BETWEEN 1 AND 100 OR length(trim(_data->>'last_name')) NOT BETWEEN 1 AND 100 OR length(_data->>'email')>255 OR _data->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR _data->>'phone' !~ '^\+[0-9]{7,15}$' THEN RAISE EXCEPTION 'invalid submission'; END IF;
  evidence:=jsonb_build_object('privacy',jsonb_build_object('accepted',true,'at',now_ts,'text','Ich habe die Datenschutzerklärung gelesen. Marketlab Media darf mich zum Playbook per E-Mail und telefonisch kontaktieren.'));
  person_name:=trim(_data->>'first_name')||' '||trim(_data->>'last_name');
  new_tags:=ARRAY['leads-playbook']||CASE WHEN lower(_data->>'email') LIKE '%@example.com' THEN ARRAY['test'] ELSE '{}'::text[] END;
  INSERT INTO public.playbook_submissions(request_id,first_name,last_name,email,phone,consent_evidence,variant,is_test)
  VALUES((_data->>'request_id')::uuid,trim(_data->>'first_name'),trim(_data->>'last_name'),lower(trim(_data->>'email')),_data->>'phone',evidence,left(nullif(_data->>'variant',''),40),lower(_data->>'email') LIKE '%@example.com') RETURNING * INTO s;
  BEGIN
    SELECT user_id INTO owner_id FROM public.user_roles WHERE role='admin' AND user_id IN (SELECT id FROM auth.users WHERE email='jonas@marketlab-media.de') LIMIT 1;
    IF owner_id IS NULL THEN SELECT user_id INTO owner_id FROM public.user_roles WHERE role='admin' ORDER BY created_at LIMIT 1; END IF;
    IF owner_id IS NULL THEN RAISE EXCEPTION 'owner not configured'; END IF;
    c:=public.crm_match_contact(NULL,s.email,NULL,NULL,NULL,NULL);
    IF c IS NULL THEN
      INSERT INTO public.crm_contacts(full_name,first_name,email,phone,segment,relationship,source,tags,created_by) VALUES(person_name,s.first_name,s.email,s.phone,'immo_finanz','lead','Leads-Playbook',new_tags,owner_id) RETURNING id INTO c;
    ELSE
      UPDATE public.crm_contacts SET full_name=person_name,first_name=coalesce(nullif(crm_contacts.first_name,''),s.first_name),phone=coalesce(nullif(crm_contacts.phone,''),s.phone),tags=(SELECT array_agg(DISTINCT t) FROM unnest(coalesce(crm_contacts.tags,'{}')||new_tags) t) WHERE id=c;
    END IF;
    INSERT INTO public.crm_leads(name,contact_name,contact_email,contact_phone,contact_id,source,stage,pipeline_id,created_by,next_step,next_step_date,description,vertriebs_check_data)
    VALUES(person_name,person_name,s.email,s.phone,c,'Leads-Playbook','interessiert','a1000000-0000-0000-0000-000000000001',owner_id,'Anrufen (15 Min) – Playbook',(now_ts AT TIME ZONE 'Europe/Berlin')::date,'Leads-Playbook 2027 angefordert',jsonb_build_object('funnel','leads-playbook','submission_id',s.id,'variant',s.variant,'consent_evidence',evidence,'result_path','/playbook/danke/'||s.token)) RETURNING id INTO l;
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
CREATE OR REPLACE FUNCTION public.playbook_record_step2_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_id uuid; activity_title text; activity_kind text;
BEGIN
  IF NEW.step2_completed_at IS NULL OR (NEW.lead_id IS NULL AND NEW.contact_id IS NULL) THEN RETURN NEW; END IF;
  IF OLD.step2_completed_at IS NOT NULL AND NEW.berater_typ IS NOT DISTINCT FROM OLD.berater_typ AND NEW.umsatz_stufe IS NOT DISTINCT FROM OLD.umsatz_stufe AND NEW.skipped_at IS NOT DISTINCT FROM OLD.skipped_at THEN RETURN NEW; END IF;
  SELECT created_by INTO owner_id FROM public.crm_leads WHERE id=NEW.lead_id;
  IF owner_id IS NULL THEN SELECT created_by INTO owner_id FROM public.crm_contacts WHERE id=NEW.contact_id; END IF;
  IF owner_id IS NULL THEN SELECT user_id INTO owner_id FROM public.user_roles WHERE role='admin' ORDER BY user_id LIMIT 1; END IF;
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Playbook activity owner missing'; END IF;
  activity_kind := CASE WHEN NEW.skipped_at IS NOT NULL THEN 'skipped' ELSE 'answered' END;
  activity_title := CASE WHEN activity_kind='skipped' THEN 'Playbook Schritt 2 übersprungen' ELSE 'Playbook Schritt 2: '||NEW.berater_typ||', '||NEW.umsatz_stufe END;
  IF NOT EXISTS (SELECT 1 FROM public.crm_activities WHERE metadata->>'submission_id'=NEW.id::text AND metadata->>'playbook_step2'=activity_kind AND title=activity_title) THEN
    INSERT INTO public.crm_activities(lead_id,contact_id,type,title,created_by,metadata) VALUES(NEW.lead_id,NEW.contact_id,'note',activity_title,owner_id,jsonb_build_object('submission_id',NEW.id,'playbook_step2',activity_kind));
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.playbook_record_step2_activity() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.playbook_record_step2_activity() TO service_role;
CREATE TRIGGER playbook_record_step2_activity AFTER UPDATE OF step2_completed_at,berater_typ,umsatz_stufe,skipped_at ON public.playbook_submissions FOR EACH ROW EXECUTE FUNCTION public.playbook_record_step2_activity();
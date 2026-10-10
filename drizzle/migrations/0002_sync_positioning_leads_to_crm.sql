CREATE OR REPLACE FUNCTION public.sync_positioning_lead_to_crm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Kein Duplikat, wenn bereits ein Lead mit derselben E-Mail existiert
  IF EXISTS (SELECT 1 FROM public.crm_leads WHERE contact_email = NEW.email) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.crm_leads (
    name, contact_name, contact_email, contact_phone,
    source, stage, status_id, created_by,
    description, notes
  ) VALUES (
    NEW.company,
    NEW.contact_name,
    NEW.email,
    NEW.phone,
    'Positionierungs-Analyse',
    'erstkontakt',
    (SELECT id FROM public.crm_lead_statuses WHERE name = 'Neu' LIMIT 1),
    '6db3220c-93b4-4c09-80a4-b14491a6e2be',
    'Branche: ' || COALESCE(NEW.industry, '–') || ' · Monatsumsatz: ' || COALESCE(NEW.monthly_revenue, '–'),
    'Quelle: ' || COALESCE(NEW.utm_source, 'Direkt') || COALESCE(' · Kampagne: ' || NEW.utm_campaign, '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER positioning_lead_to_crm
AFTER INSERT ON public.positioning_analysis_leads
FOR EACH ROW EXECUTE FUNCTION public.sync_positioning_lead_to_crm();
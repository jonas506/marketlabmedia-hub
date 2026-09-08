CREATE OR REPLACE FUNCTION public.sync_lead_open_offer_value()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lead uuid;
  _sum numeric;
  _cnt int;
BEGIN
  FOR _lead IN
    SELECT DISTINCT x FROM unnest(ARRAY[
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.lead_id END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.lead_id END
    ]) AS x WHERE x IS NOT NULL
  LOOP
    SELECT COALESCE(SUM(amount_net), 0), COUNT(*) INTO _sum, _cnt
    FROM public.signature_documents
    WHERE lead_id = _lead
      AND amount_net IS NOT NULL
      AND status IN ('draft', 'sent', 'viewed');

    IF _cnt > 0 THEN
      UPDATE public.crm_leads SET deal_value = _sum, updated_at = now() WHERE id = _lead;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_open_offer_value ON public.signature_documents;
CREATE TRIGGER trg_sync_lead_open_offer_value
AFTER INSERT OR UPDATE OF amount_net, status, lead_id OR DELETE ON public.signature_documents
FOR EACH ROW EXECUTE FUNCTION public.sync_lead_open_offer_value();
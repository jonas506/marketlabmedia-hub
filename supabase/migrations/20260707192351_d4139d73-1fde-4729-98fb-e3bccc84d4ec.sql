
CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  plan_key TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  duration_months INT NOT NULL,
  monthly_price NUMERIC(10,2) NOT NULL,
  setup_price NUMERIC(10,2) NOT NULL DEFAULT 2000,
  discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  addons JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject TEXT NOT NULL,
  custom_body TEXT NOT NULL DEFAULT '',
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all offers" ON public.offers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Creator can read own offer" ON public.offers
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE INDEX offers_lead_id_idx ON public.offers(lead_id);
CREATE INDEX offers_status_idx ON public.offers(status);
CREATE INDEX offers_token_idx ON public.offers(token);

CREATE TRIGGER offers_set_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

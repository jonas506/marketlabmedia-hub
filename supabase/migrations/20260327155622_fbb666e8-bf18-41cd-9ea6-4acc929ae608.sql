
-- Campaign table
CREATE TABLE public.crm_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  channel text NOT NULL DEFAULT 'linkedin',
  status text NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on crm_campaigns"
  ON public.crm_campaigns FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Weekly tracking entries
CREATE TABLE public.crm_campaign_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  messages_sent integer NOT NULL DEFAULT 0,
  replies integer NOT NULL DEFAULT 0,
  appointments integer NOT NULL DEFAULT 0,
  second_appointments integer NOT NULL DEFAULT 0,
  closings integer NOT NULL DEFAULT 0,
  revenue numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, week_start)
);

ALTER TABLE public.crm_campaign_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on crm_campaign_entries"
  ON public.crm_campaign_entries FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

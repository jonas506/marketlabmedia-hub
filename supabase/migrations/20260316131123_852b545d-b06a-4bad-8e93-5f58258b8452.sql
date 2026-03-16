
CREATE TABLE public.marketing_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tracking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  ad_spend NUMERIC(10,2) DEFAULT 0,
  new_followers INTEGER DEFAULT 0,
  cost_per_follower NUMERIC(10,2) GENERATED ALWAYS AS (
    CASE WHEN new_followers > 0 THEN ad_spend / new_followers ELSE NULL END
  ) STORED,
  dm_sent INTEGER DEFAULT 0,
  new_conversations INTEGER DEFAULT 0,
  appointments_booked INTEGER DEFAULT 0,
  cost_per_appointment NUMERIC(10,2) GENERATED ALWAYS AS (
    CASE WHEN appointments_booked > 0 THEN ad_spend / appointments_booked ELSE NULL END
  ) STORED,
  sales_today INTEGER DEFAULT 0,
  appointments_total INTEGER DEFAULT 0,
  show_rate NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN appointments_total > 0 THEN (appointments_attended::NUMERIC / appointments_total) * 100 ELSE NULL END
  ) STORED,
  appointments_attended INTEGER DEFAULT 0,
  offer_quote NUMERIC(5,2),
  offers_presented INTEGER DEFAULT 0,
  closing_rate NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN offers_presented > 0 THEN (closings::NUMERIC / offers_presented) * 100 ELSE NULL END
  ) STORED,
  closings INTEGER DEFAULT 0,
  revenue_net NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage tracking"
ON public.marketing_tracking FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX idx_marketing_tracking_client ON public.marketing_tracking(client_id, tracking_date DESC);

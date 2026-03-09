
-- Add new columns to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS sector text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contract_start date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contract_duration text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS monthly_price numeric;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS additional_products text[] DEFAULT '{}';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS strategy_text text;

-- Add new columns to clips table
ALTER TABLE public.clips ADD COLUMN IF NOT EXISTS target_month integer;
ALTER TABLE public.clips ADD COLUMN IF NOT EXISTS target_year integer;
ALTER TABLE public.clips ADD COLUMN IF NOT EXISTS has_script boolean DEFAULT false;

-- Backfill target_month/year from created_at for existing clips
UPDATE public.clips SET
  target_month = EXTRACT(MONTH FROM created_at)::integer,
  target_year = EXTRACT(YEAR FROM created_at)::integer
WHERE target_month IS NULL;

-- Migrate phase values
UPDATE public.clips SET phase = 'filmed' WHERE phase = 'raw';
UPDATE public.clips SET phase = 'approved' WHERE phase = 'done';
UPDATE public.clips SET phase = 'scheduled_posted' WHERE phase IN ('scheduled', 'posted');

-- Create contract_changes table
CREATE TABLE IF NOT EXISTS public.contract_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  changed_at timestamptz DEFAULT now(),
  changed_by uuid
);

ALTER TABLE public.contract_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contract changes"
  ON public.contract_changes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage contract changes"
  ON public.contract_changes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Head of content can manage contract changes"
  ON public.contract_changes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'head_of_content'::app_role))
  WITH CHECK (has_role(auth.uid(), 'head_of_content'::app_role));

ALTER TABLE public.client_contracts ADD COLUMN IF NOT EXISTS billing_start_date date;
UPDATE public.client_contracts SET billing_start_date = start_date WHERE billing_start_date IS NULL;
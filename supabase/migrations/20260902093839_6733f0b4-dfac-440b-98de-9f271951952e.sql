ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS document jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS offer_number text,
  ADD COLUMN IF NOT EXISTS recipient_company text,
  ADD COLUMN IF NOT EXISTS recipient_address text;

CREATE SEQUENCE IF NOT EXISTS public.offer_number_seq START 20;

CREATE OR REPLACE FUNCTION public.next_offer_number()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'A-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.offer_number_seq')::text, 3, '0');
$$;

GRANT EXECUTE ON FUNCTION public.next_offer_number() TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.offer_number_seq TO authenticated, service_role;
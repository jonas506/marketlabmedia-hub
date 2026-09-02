REVOKE EXECUTE ON FUNCTION public.next_offer_number() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.next_offer_number() TO authenticated, service_role;
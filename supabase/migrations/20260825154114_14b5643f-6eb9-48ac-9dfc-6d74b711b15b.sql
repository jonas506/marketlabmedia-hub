DROP POLICY IF EXISTS "Public read clients via active referral page" ON public.clients;

CREATE POLICY "Public read clients via active referral page" ON public.clients
FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.client_referral_pages p
  WHERE p.client_id = public.clients.id AND p.is_active = true
));
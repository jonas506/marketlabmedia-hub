CREATE POLICY "referral assets public read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'referral-assets');

CREATE POLICY "referral assets internal insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'referral-assets' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'head_of_content')));

CREATE POLICY "referral assets internal update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'referral-assets' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'head_of_content')));

CREATE POLICY "referral assets internal delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'referral-assets' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'head_of_content')));
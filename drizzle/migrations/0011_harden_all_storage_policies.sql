CREATE OR REPLACE FUNCTION public.storage_client_id(_bucket text, _name text) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE folder text := split_part(_name,'/',1); folder_id uuid; client_id uuid;
BEGIN
  IF folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN NULL; END IF;
  folder_id := folder::uuid;
  IF _bucket = 'board-files' THEN
    SELECT b.client_id INTO client_id FROM public.strategy_boards b WHERE b.id=folder_id;
    RETURN client_id;
  ELSIF _bucket IN ('client-documents','carousel-slides','story-screenshots','reference-images','client-logos','landing-page-assets','referral-assets','content-videos') THEN
    SELECT c.id INTO client_id FROM public.clients c WHERE c.id=folder_id;
    IF client_id IS NULL AND _bucket='content-videos' THEN
      SELECT p.client_id INTO client_id FROM public.content_pieces p WHERE p.video_path=_name LIMIT 1;
    END IF;
    RETURN client_id;
  ELSIF _bucket='documents' THEN
    SELECT d.client_id INTO client_id FROM public.signature_documents d WHERE d.file_path=_name LIMIT 1;
    RETURN client_id;
  END IF;
  RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.storage_team_access(_bucket text,_name text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid := auth.uid(); cid uuid;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF public.has_role(uid,'admin') THEN RETURN true; END IF;
  IF _bucket='crm-files' THEN RETURN false; END IF;
  IF public.has_role(uid,'head_of_content') THEN RETURN true; END IF;
  IF NOT public.has_role(uid,'cutter') THEN RETURN false; END IF;
  IF _bucket='expense-receipts' THEN RETURN split_part(_name,'/',1)=uid::text; END IF;
  cid := public.storage_client_id(_bucket,_name);
  RETURN cid IS NOT NULL AND public.has_client_access(uid,cid);
END $$;
CREATE OR REPLACE FUNCTION public.storage_team_delete(_bucket text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT auth.uid() IS NOT NULL AND (public.has_role(auth.uid(),'admin') OR (_bucket<>'crm-files' AND public.has_role(auth.uid(),'head_of_content')))
$$;
CREATE OR REPLACE FUNCTION public.storage_published_referral(_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS (SELECT 1 FROM public.client_referral_pages p WHERE p.is_active AND (p.photo_url=_name OR EXISTS (SELECT 1 FROM public.client_referral_media m WHERE m.page_id=p.id AND m.url=_name)))
$$;
REVOKE ALL ON FUNCTION public.storage_client_id(text,text),public.storage_team_access(text,text),public.storage_team_delete(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_client_id(text,text),public.storage_team_access(text,text),public.storage_team_delete(text) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.storage_published_referral(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_published_referral(text) TO anon,authenticated,service_role;
DO $$ DECLARE p record; b text; buckets text[] := ARRAY['board-files','brand-assets','carousel-slides','client-documents','client-logos','content-videos','crm-files','documents','expense-receipts','landing-page-assets','reference-images','reference-thumbnails','referral-assets','story-screenshots']; BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' LOOP
  EXECUTE format('DROP POLICY %I ON storage.objects',p.policyname);
 END LOOP;
 FOREACH b IN ARRAY buckets LOOP
  EXECUTE format('CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated USING (bucket_id=%L AND public.storage_team_access(bucket_id,name))',b||'_team_read',b);
  EXECUTE format('CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id=%L AND public.storage_team_access(bucket_id,name))',b||'_team_upload',b);
  EXECUTE format('CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated USING (bucket_id=%L AND public.storage_team_access(bucket_id,name)) WITH CHECK (bucket_id=%L AND public.storage_team_access(bucket_id,name))',b||'_team_update',b,b);
  EXECUTE format('CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated USING (bucket_id=%L AND public.storage_team_delete(bucket_id))',b||'_team_delete',b);
 END LOOP;
END $$;
CREATE POLICY published_referral_read ON storage.objects FOR SELECT TO anon,authenticated USING (bucket_id='referral-assets' AND public.storage_published_referral(name));
COMMENT ON FUNCTION public.storage_team_access(text,text) IS 'Storage access: admin, HoC except CRM, assigned cutters using non-null client IDs; cutter receipts restricted to own staff folder. No customer identity is inferred from email or metadata.';
COMMENT ON FUNCTION public.storage_published_referral(text) IS 'Anonymous signed downloads only for files explicitly referenced on active public referral pages. Public buckets retain direct public object GET without granting anonymous file listing.';

-- Create storage buckets for ContentBase
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-assets', 'brand-assets', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('reference-images', 'reference-images', true) ON CONFLICT DO NOTHING;

-- Storage policies for brand-assets
CREATE POLICY "Authenticated can upload brand-assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'brand-assets');
CREATE POLICY "Authenticated can update brand-assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'brand-assets');
CREATE POLICY "Public can view brand-assets" ON storage.objects FOR SELECT TO public USING (bucket_id = 'brand-assets');
CREATE POLICY "Authenticated can delete brand-assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'brand-assets');

-- Storage policies for reference-images
CREATE POLICY "Authenticated can upload reference-images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reference-images');
CREATE POLICY "Authenticated can update reference-images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'reference-images');
CREATE POLICY "Public can view reference-images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'reference-images');
CREATE POLICY "Authenticated can delete reference-images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'reference-images');

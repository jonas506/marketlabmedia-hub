
-- Create storage bucket for landing page assets (CI uploads like logos, images)
INSERT INTO storage.buckets (id, name, public) VALUES ('landing-page-assets', 'landing-page-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to landing-page-assets
CREATE POLICY "Authenticated users can upload landing page assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'landing-page-assets');

-- Allow authenticated users to read landing page assets
CREATE POLICY "Anyone can view landing page assets"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'landing-page-assets');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete landing page assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'landing-page-assets');

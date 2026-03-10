
-- Storage bucket for video uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('content-videos', 'content-videos', false);

-- Allow authenticated users to upload videos
CREATE POLICY "Authenticated users can upload videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'content-videos');

-- Allow authenticated users to read videos
CREATE POLICY "Authenticated users can read videos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'content-videos');

-- Allow admins and HoC to delete videos
CREATE POLICY "Admins can delete videos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'content-videos' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Add video_path column to content_pieces
ALTER TABLE public.content_pieces ADD COLUMN IF NOT EXISTS video_path TEXT;

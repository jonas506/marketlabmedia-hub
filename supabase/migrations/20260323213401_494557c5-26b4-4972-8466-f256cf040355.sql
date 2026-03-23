
-- Add slide_images column to content_pieces for carousel slide image URLs
ALTER TABLE public.content_pieces ADD COLUMN slide_images text[] DEFAULT '{}'::text[];

-- Create carousel-slides storage bucket (public for easy viewing in approval portal)
INSERT INTO storage.buckets (id, name, public) VALUES ('carousel-slides', 'carousel-slides', true);

-- RLS policies for carousel-slides bucket
CREATE POLICY "Authenticated users can upload carousel slides"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'carousel-slides');

CREATE POLICY "Authenticated users can update carousel slides"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'carousel-slides');

CREATE POLICY "Authenticated users can delete carousel slides"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'carousel-slides');

CREATE POLICY "Anyone can view carousel slides"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'carousel-slides');


-- Create storage bucket for client PDF documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-documents', 'client-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to client-documents bucket
CREATE POLICY "Authenticated users can upload client documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'client-documents');

-- Allow authenticated users to read client documents
CREATE POLICY "Authenticated users can read client documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'client-documents');

-- Allow authenticated users to delete client documents
CREATE POLICY "Authenticated users can delete client documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'client-documents');

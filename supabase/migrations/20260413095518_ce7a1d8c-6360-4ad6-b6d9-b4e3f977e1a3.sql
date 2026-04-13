-- Allow admin users to upload files to crm-files bucket
CREATE POLICY "Admin can upload crm files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'crm-files'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Allow admin users to delete crm files
CREATE POLICY "Admin can delete crm files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'crm-files'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Allow admin users to update crm files
CREATE POLICY "Admin can update crm files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'crm-files'
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id = 'crm-files'
  AND has_role(auth.uid(), 'admin'::app_role)
);
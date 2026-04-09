
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS drive_folder_id text;

ALTER TABLE public.content_pieces ADD COLUMN IF NOT EXISTS drive_file_id text;
ALTER TABLE public.content_pieces ADD COLUMN IF NOT EXISTS drive_file_name text;
ALTER TABLE public.content_pieces ADD COLUMN IF NOT EXISTS drive_uploaded_at timestamptz;

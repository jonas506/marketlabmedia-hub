ALTER TABLE public.content_pieces ADD COLUMN IF NOT EXISTS transcript text;
ALTER TABLE public.content_pieces ADD COLUMN IF NOT EXISTS caption text;
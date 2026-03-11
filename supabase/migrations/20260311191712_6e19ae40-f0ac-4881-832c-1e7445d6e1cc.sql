ALTER TABLE public.landing_pages ADD COLUMN IF NOT EXISTS edit_url text;
ALTER TABLE public.landing_pages ADD COLUMN IF NOT EXISTS published_url text;
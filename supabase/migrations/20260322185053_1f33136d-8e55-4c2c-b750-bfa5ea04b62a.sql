ALTER TABLE public.story_slides ADD COLUMN IF NOT EXISTS slide_views integer DEFAULT 0;
ALTER TABLE public.story_slides ADD COLUMN IF NOT EXISTS slide_clicks integer DEFAULT 0;
ALTER TABLE public.clients
  ADD COLUMN brand_primary text DEFAULT '#1a1a2e',
  ADD COLUMN brand_secondary text DEFAULT '#16213e',
  ADD COLUMN brand_accent text DEFAULT '#0f3460',
  ADD COLUMN brand_text_light text DEFAULT '#ffffff',
  ADD COLUMN brand_text_dark text DEFAULT '#1a1a2e',
  ADD COLUMN brand_font_style text DEFAULT 'modern';
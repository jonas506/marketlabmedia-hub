ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS target_audience text,
  ADD COLUMN IF NOT EXISTS usps text,
  ADD COLUMN IF NOT EXISTS tonality text,
  ADD COLUMN IF NOT EXISTS content_topics text;
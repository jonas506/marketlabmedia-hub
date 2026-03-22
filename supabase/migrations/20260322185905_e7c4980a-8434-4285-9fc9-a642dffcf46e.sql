-- Categories table for custom user-defined categories
CREATE TABLE public.story_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'blue',
  scope text NOT NULL DEFAULT 'sequence',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.story_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage story_categories" ON public.story_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add category columns
ALTER TABLE public.story_sequences ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.story_categories(id) ON DELETE SET NULL;
ALTER TABLE public.story_slides ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.story_categories(id) ON DELETE SET NULL;
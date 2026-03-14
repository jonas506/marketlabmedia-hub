
-- Create projects table for ContentBase canvas projects
CREATE TABLE public.cb_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Neues Projekt',
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  connections JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cb_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cb_projects" ON public.cb_projects FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Create brands table for ContentBase brand management
CREATE TABLE public.cb_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Neue Marke',
  description TEXT,
  colors TEXT[] NOT NULL DEFAULT '{}',
  logos TEXT[] NOT NULL DEFAULT '{}',
  guides TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cb_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cb_brands" ON public.cb_brands FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Create reel_ideas table
CREATE TABLE public.cb_reel_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ideas JSONB NOT NULL DEFAULT '[]'::jsonb,
  sources TEXT[] NOT NULL DEFAULT '{}',
  niche TEXT DEFAULT 'Social Media Marketing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cb_reel_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cb_reel_ideas" ON public.cb_reel_ideas FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Trigger for updated_at on projects and brands
CREATE TRIGGER update_cb_projects_updated_at BEFORE UPDATE ON public.cb_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cb_brands_updated_at BEFORE UPDATE ON public.cb_brands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

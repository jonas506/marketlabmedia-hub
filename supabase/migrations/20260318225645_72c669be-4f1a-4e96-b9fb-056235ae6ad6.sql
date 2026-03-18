
CREATE TABLE public.client_inspirations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  url TEXT,
  title TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  screenshot_url TEXT,
  ai_analysis TEXT,
  category TEXT NOT NULL DEFAULT 'weekly',
  week_number INTEGER,
  month INTEGER,
  year INTEGER,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_inspirations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client_inspirations" ON public.client_inspirations FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Head of content can manage client_inspirations" ON public.client_inspirations FOR ALL TO authenticated USING (has_role(auth.uid(), 'head_of_content')) WITH CHECK (has_role(auth.uid(), 'head_of_content'));
CREATE POLICY "Authenticated can view client_inspirations" ON public.client_inspirations FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_client_inspirations_updated_at BEFORE UPDATE ON public.client_inspirations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.landing_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Neue Landing Page',
  html_content text DEFAULT '',
  custom_domain text,
  is_published boolean NOT NULL DEFAULT false,
  chat_history jsonb DEFAULT '[]'::jsonb,
  slug text UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view landing_pages" ON public.landing_pages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage landing_pages" ON public.landing_pages FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Head of content can manage landing_pages" ON public.landing_pages FOR ALL TO authenticated USING (has_role(auth.uid(), 'head_of_content'::app_role)) WITH CHECK (has_role(auth.uid(), 'head_of_content'::app_role));

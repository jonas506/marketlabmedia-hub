
CREATE TABLE public.landing_page_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  html_content text NOT NULL DEFAULT '',
  preview_image_url text,
  category text DEFAULT 'allgemein',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_page_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view templates" ON public.landing_page_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage templates" ON public.landing_page_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Head of content can manage templates" ON public.landing_page_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'head_of_content'::app_role))
  WITH CHECK (has_role(auth.uid(), 'head_of_content'::app_role));

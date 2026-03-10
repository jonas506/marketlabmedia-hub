
CREATE TABLE public.saved_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  category TEXT DEFAULT 'caption',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view saved_prompts" ON public.saved_prompts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage saved_prompts" ON public.saved_prompts FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Head of content can manage saved_prompts" ON public.saved_prompts FOR ALL TO authenticated USING (has_role(auth.uid(), 'head_of_content'::app_role)) WITH CHECK (has_role(auth.uid(), 'head_of_content'::app_role));


-- SOP Templates
CREATE TABLE public.sop_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  trigger_type text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sop_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sop_templates" ON public.sop_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage sop_templates" ON public.sop_templates FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Head of content can manage sop_templates" ON public.sop_templates FOR ALL TO authenticated USING (has_role(auth.uid(), 'head_of_content')) WITH CHECK (has_role(auth.uid(), 'head_of_content'));

-- SOP Template Steps
CREATE TABLE public.sop_template_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.sop_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  default_role text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sop_template_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sop_template_steps" ON public.sop_template_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage sop_template_steps" ON public.sop_template_steps FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Head of content can manage sop_template_steps" ON public.sop_template_steps FOR ALL TO authenticated USING (has_role(auth.uid(), 'head_of_content')) WITH CHECK (has_role(auth.uid(), 'head_of_content'));

-- Checklists (instances from SOP templates)
CREATE TABLE public.checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.sop_templates(id),
  name text NOT NULL,
  category text,
  status text NOT NULL DEFAULT 'open',
  month int,
  year int,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view checklists" ON public.checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage checklists" ON public.checklists FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Head of content can manage checklists" ON public.checklists FOR ALL TO authenticated USING (has_role(auth.uid(), 'head_of_content')) WITH CHECK (has_role(auth.uid(), 'head_of_content'));

-- Checklist Steps (instances of template steps)
CREATE TABLE public.checklist_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid,
  is_completed boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  completed_at timestamptz
);

ALTER TABLE public.checklist_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view checklist_steps" ON public.checklist_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage checklist_steps" ON public.checklist_steps FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Head of content can manage checklist_steps" ON public.checklist_steps FOR ALL TO authenticated USING (has_role(auth.uid(), 'head_of_content')) WITH CHECK (has_role(auth.uid(), 'head_of_content'));
CREATE POLICY "Assigned users can update checklist_steps" ON public.checklist_steps FOR UPDATE TO authenticated USING (assigned_to = auth.uid());

-- Create tasks table
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  assigned_to uuid DEFAULT NULL,
  deadline date DEFAULT NULL,
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies (matching existing pattern)
CREATE POLICY "Authenticated can view tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage tasks"
  ON public.tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Head of content can manage tasks"
  ON public.tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'head_of_content'))
  WITH CHECK (public.has_role(auth.uid(), 'head_of_content'));
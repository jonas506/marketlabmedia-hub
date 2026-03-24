
-- Add new columns to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_time time without time zone;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS sort_order integer;

-- Create task_comments table
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- RLS for task_comments
CREATE POLICY "Authenticated can view task_comments" ON public.task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert task_comments" ON public.task_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own task_comments" ON public.task_comments FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage task_comments" ON public.task_comments FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "HoC can manage task_comments" ON public.task_comments FOR ALL TO authenticated USING (has_role(auth.uid(), 'head_of_content'::app_role)) WITH CHECK (has_role(auth.uid(), 'head_of_content'::app_role));

-- RLS for tasks table - add cutter policies for full CRUD
CREATE POLICY "Cutters can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'cutter'::app_role));
CREATE POLICY "Cutters can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'cutter'::app_role));
CREATE POLICY "Cutters can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (has_role(auth.uid(), 'cutter'::app_role));

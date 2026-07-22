
-- 1) Recurrence columns on tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_rule text,           -- 'daily' | 'weekdays' | 'weekly' | 'monthly' | null
  ADD COLUMN IF NOT EXISTS recurrence_day int,             -- 0-6 for weekly (0=Sun), 1-31 for monthly
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_parent ON public.tasks(recurrence_parent_id) WHERE recurrence_parent_id IS NOT NULL;

-- 2) Task comments
CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can read task comments" ON public.task_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can create task comments" ON public.task_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Author can edit own comments" ON public.task_comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Author or admin can delete comments" ON public.task_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 3) Task templates
CREATE TABLE IF NOT EXISTS public.task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  title text NOT NULL,
  priority text DEFAULT 'normal',
  default_assignee uuid,
  default_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  deadline_offset_days int,       -- +N days from today when applied
  recurrence_rule text,
  recurrence_day int,
  notes text,
  is_shared boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_templates TO authenticated;
GRANT ALL ON public.task_templates TO service_role;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can read shared or own templates" ON public.task_templates
  FOR SELECT TO authenticated USING (is_shared = true OR created_by = auth.uid());
CREATE POLICY "Team can create templates" ON public.task_templates
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner or admin can edit templates" ON public.task_templates
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owner or admin can delete templates" ON public.task_templates
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- 4) Auto-create next recurring instance on completion
CREATE OR REPLACE FUNCTION public.create_next_recurring_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_deadline date;
  v_base date;
  v_parent uuid;
BEGIN
  IF NEW.recurrence_rule IS NULL THEN RETURN NEW; END IF;
  IF NEW.is_completed IS NOT TRUE OR OLD.is_completed IS TRUE THEN RETURN NEW; END IF;

  v_parent := COALESCE(NEW.recurrence_parent_id, NEW.id);
  v_base := COALESCE(NEW.deadline, current_date);

  IF NEW.recurrence_rule = 'daily' THEN
    v_next_deadline := v_base + 1;
  ELSIF NEW.recurrence_rule = 'weekdays' THEN
    v_next_deadline := v_base + 1;
    -- skip Sat(6)/Sun(0)
    WHILE EXTRACT(DOW FROM v_next_deadline) IN (0,6) LOOP
      v_next_deadline := v_next_deadline + 1;
    END LOOP;
  ELSIF NEW.recurrence_rule = 'weekly' THEN
    v_next_deadline := v_base + 7;
  ELSIF NEW.recurrence_rule = 'monthly' THEN
    v_next_deadline := (v_base + interval '1 month')::date;
  ELSE
    RETURN NEW;
  END IF;

  -- Guard: don't duplicate if a future instance already exists
  IF EXISTS (
    SELECT 1 FROM public.tasks
    WHERE recurrence_parent_id = v_parent
      AND is_completed = false
      AND deadline = v_next_deadline
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tasks (
    client_id, title, assigned_to, deadline, due_time, priority, status,
    tag, notes, description, created_by, content_piece_id,
    recurrence_rule, recurrence_day, recurrence_parent_id
  ) VALUES (
    NEW.client_id, NEW.title, NEW.assigned_to, v_next_deadline, NEW.due_time,
    NEW.priority, 'not_started', NEW.tag, NEW.notes, NEW.description,
    NEW.created_by, NEW.content_piece_id,
    NEW.recurrence_rule, NEW.recurrence_day, v_parent
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_recurrence ON public.tasks;
CREATE TRIGGER trg_task_recurrence
  AFTER UPDATE OF is_completed ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.create_next_recurring_task();

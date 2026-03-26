
-- 1. Add columns to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS group_source text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_by uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS content_piece_id uuid REFERENCES public.content_pieces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_parent ON public.tasks(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_content_piece ON public.tasks(content_piece_id) WHERE content_piece_id IS NOT NULL;

-- 2. Trigger: Auto-create task on phase change
CREATE OR REPLACE FUNCTION public.create_task_on_phase_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name text;
  v_type_label text;
  v_hoc_user_id uuid;
  v_cutter_user_id uuid;
  v_task_title text;
  v_assigned_to uuid;
  v_tag text;
BEGIN
  IF OLD.phase = NEW.phase THEN RETURN NEW; END IF;
  
  SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
  
  v_type_label := CASE NEW.type
    WHEN 'reel' THEN 'Reel'
    WHEN 'carousel' THEN 'Karussell'
    WHEN 'ad' THEN 'Ad'
    WHEN 'youtube_longform' THEN 'YouTube'
    ELSE NEW.type
  END;

  SELECT ur.user_id INTO v_hoc_user_id 
  FROM public.user_roles ur WHERE ur.role = 'head_of_content' LIMIT 1;
  
  SELECT ur.user_id INTO v_cutter_user_id 
  FROM public.user_roles ur WHERE ur.role = 'cutter' LIMIT 1;

  -- CASE 1: review -> approved (client approved) -> task for HoC to publish
  IF NEW.phase = 'approved' AND OLD.phase = 'review' THEN
    v_task_title := v_type_label || ' „' || COALESCE(NEW.title, 'Ohne Titel') || '" veröffentlichen';
    v_assigned_to := v_hoc_user_id;
    v_tag := 'veröffentlichen';
    
    INSERT INTO public.tasks (client_id, title, assigned_to, priority, status, tag, group_source, content_piece_id)
    VALUES (NEW.client_id, v_task_title, v_assigned_to, 'normal', 'not_started', v_tag, 'auto_publish', NEW.id);
  END IF;

  -- CASE 2: filmed -> editing without assignment -> task for cutter
  IF NEW.phase = 'editing' AND OLD.phase = 'filmed' AND NEW.assigned_to IS NULL THEN
    v_task_title := v_type_label || ' „' || COALESCE(NEW.title, 'Ohne Titel') || '" schneiden';
    v_assigned_to := v_cutter_user_id;
    v_tag := 'schnitt';
    
    INSERT INTO public.tasks (client_id, title, assigned_to, priority, status, tag, group_source, content_piece_id)
    VALUES (NEW.client_id, v_task_title, v_assigned_to, 'normal', 'not_started', v_tag, 'auto_edit', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_task_on_phase_change
  AFTER UPDATE OF phase ON public.content_pieces
  FOR EACH ROW EXECUTE FUNCTION create_task_on_phase_change();

-- 3. Trigger: Auto-group similar tasks
CREATE OR REPLACE FUNCTION public.auto_group_similar_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_similar_count integer;
  v_existing_parent uuid;
  v_client_name text;
  v_new_parent_id uuid;
  v_total integer;
  v_tag_label text;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.group_source IS NULL THEN RETURN NEW; END IF;
  
  SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
  
  v_tag_label := CASE NEW.tag
    WHEN 'veröffentlichen' THEN 'Pieces veröffentlichen'
    WHEN 'schnitt' THEN 'Pieces schneiden'
    ELSE COALESCE(NEW.tag, 'Aufgaben')
  END;
  
  -- Look for existing parent task for this group
  SELECT id INTO v_existing_parent
  FROM public.tasks
  WHERE client_id = NEW.client_id
    AND tag = NEW.tag
    AND assigned_to = NEW.assigned_to
    AND is_completed = false
    AND group_source = NEW.group_source
    AND parent_id IS NULL
    AND content_piece_id IS NULL
    AND created_at > (now() - interval '60 minutes')
  LIMIT 1;
  
  IF v_existing_parent IS NOT NULL THEN
    NEW.parent_id := v_existing_parent;
    SELECT COUNT(*) + 1 INTO v_total FROM public.tasks WHERE parent_id = v_existing_parent;
    UPDATE public.tasks 
    SET title = v_total || 'x ' || v_tag_label || ' — ' || COALESCE(v_client_name, 'Kunde')
    WHERE id = v_existing_parent;
    RETURN NEW;
  END IF;
  
  -- Check for similar ungrouped tasks
  SELECT COUNT(*) INTO v_similar_count
  FROM public.tasks
  WHERE client_id = NEW.client_id
    AND tag = NEW.tag
    AND assigned_to = NEW.assigned_to
    AND is_completed = false
    AND parent_id IS NULL
    AND group_source = NEW.group_source
    AND id != NEW.id
    AND created_at > (now() - interval '60 minutes');
  
  IF v_similar_count >= 1 THEN
    INSERT INTO public.tasks (client_id, title, assigned_to, deadline, priority, tag, status, group_source)
    VALUES (
      NEW.client_id,
      (v_similar_count + 2) || 'x ' || v_tag_label || ' — ' || COALESCE(v_client_name, 'Kunde'),
      NEW.assigned_to,
      NEW.deadline,
      NEW.priority,
      NEW.tag,
      'not_started',
      NEW.group_source
    )
    RETURNING id INTO v_new_parent_id;
    
    UPDATE public.tasks
    SET parent_id = v_new_parent_id
    WHERE client_id = NEW.client_id
      AND tag = NEW.tag
      AND assigned_to = NEW.assigned_to
      AND is_completed = false
      AND parent_id IS NULL
      AND group_source = NEW.group_source
      AND id != v_new_parent_id
      AND id != NEW.id
      AND created_at > (now() - interval '60 minutes');
    
    NEW.parent_id := v_new_parent_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_group_tasks
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION auto_group_similar_tasks();

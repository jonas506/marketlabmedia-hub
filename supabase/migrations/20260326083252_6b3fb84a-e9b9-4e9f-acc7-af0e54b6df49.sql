
-- ═══════════════════════════════════════
-- SOP-Trigger Functions (direct SQL, no pg_net dependency)
-- ═══════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_sop_tasks_for_trigger(
  p_trigger_type text,
  p_client_id uuid,
  p_context jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template RECORD;
  v_step RECORD;
  v_parent_id uuid;
  v_client_name text;
  v_assignee uuid;
  v_deadline date;
  v_dedupe_tag text;
BEGIN
  SELECT name INTO v_client_name FROM public.clients WHERE id = p_client_id;
  
  v_dedupe_tag := 'sop_' || p_trigger_type;
  IF p_context->>'content_piece_id' IS NOT NULL THEN
    v_dedupe_tag := v_dedupe_tag || '_' || (p_context->>'content_piece_id');
  ELSIF p_context->>'shoot_day_id' IS NOT NULL THEN
    v_dedupe_tag := v_dedupe_tag || '_' || (p_context->>'shoot_day_id');
  ELSIF p_context->>'week_key' IS NOT NULL THEN
    v_dedupe_tag := v_dedupe_tag || '_' || (p_context->>'week_key');
  ELSIF p_trigger_type = 'new_month' THEN
    v_dedupe_tag := v_dedupe_tag || '_' || to_char(now(), 'YYYY-MM');
  END IF;
  
  IF EXISTS (SELECT 1 FROM public.tasks WHERE client_id = p_client_id AND tag = v_dedupe_tag AND is_completed = false) THEN
    RETURN;
  END IF;
  
  FOR v_template IN 
    SELECT id, name FROM public.sop_templates WHERE trigger_type = p_trigger_type
  LOOP
    INSERT INTO public.tasks (client_id, title, priority, status, tag, group_source, description)
    VALUES (p_client_id, v_template.name || ' — ' || COALESCE(v_client_name, 'Kunde'), 'normal', 'not_started', v_dedupe_tag, 'sop_' || p_trigger_type, 'Automatisch aus SOP erstellt')
    RETURNING id INTO v_parent_id;
    
    FOR v_step IN
      SELECT * FROM public.sop_template_steps WHERE template_id = v_template.id ORDER BY sort_order
    LOOP
      SELECT user_id INTO v_assignee FROM public.user_roles WHERE role = COALESCE(v_step.default_role, 'admin')::app_role LIMIT 1;
      v_deadline := current_date + (v_step.sort_order * 2);
      
      INSERT INTO public.tasks (client_id, title, description, assigned_to, parent_id, priority, status, deadline, sort_order, content_piece_id)
      VALUES (p_client_id, v_step.title, v_step.description, v_assignee, v_parent_id, 'normal', 'not_started', v_deadline, v_step.sort_order, (p_context->>'content_piece_id')::uuid);
    END LOOP;
  END LOOP;
END;
$$;

-- Trigger: piece enters editing
CREATE OR REPLACE FUNCTION public.trigger_sop_on_piece_editing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phase = 'editing' AND OLD.phase = 'filmed' THEN
    PERFORM create_sop_tasks_for_trigger('piece_enters_editing', NEW.client_id, jsonb_build_object('content_piece_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sop_piece_editing
  AFTER UPDATE OF phase ON public.content_pieces
  FOR EACH ROW 
  WHEN (NEW.phase = 'editing' AND OLD.phase = 'filmed')
  EXECUTE FUNCTION trigger_sop_on_piece_editing();

-- Trigger: piece approved
CREATE OR REPLACE FUNCTION public.trigger_sop_on_piece_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phase = 'approved' AND OLD.phase = 'review' THEN
    PERFORM create_sop_tasks_for_trigger('pieces_approved', NEW.client_id, jsonb_build_object('content_piece_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sop_piece_approved
  AFTER UPDATE OF phase ON public.content_pieces
  FOR EACH ROW 
  WHEN (NEW.phase = 'approved' AND OLD.phase = 'review')
  EXECUTE FUNCTION trigger_sop_on_piece_approved();

-- Trigger: shoot day created
CREATE OR REPLACE FUNCTION public.trigger_sop_on_shoot_day()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM create_sop_tasks_for_trigger('shoot_day_created', NEW.client_id, jsonb_build_object('shoot_day_id', NEW.id));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sop_shoot_day_created
  AFTER INSERT ON public.shoot_days
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sop_on_shoot_day();

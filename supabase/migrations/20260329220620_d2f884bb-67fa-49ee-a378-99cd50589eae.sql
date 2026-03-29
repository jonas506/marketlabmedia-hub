
CREATE OR REPLACE FUNCTION public.auto_complete_tasks_on_phase_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_completed_count integer := 0;
BEGIN
  IF OLD.phase = NEW.phase THEN RETURN NEW; END IF;

  -- When piece goes to handed_over → complete "veröffentlichen" tasks
  IF NEW.phase = 'handed_over' THEN
    UPDATE public.tasks
    SET is_completed = true, status = 'done'
    WHERE content_piece_id = NEW.id
      AND is_completed = false;
    GET DIAGNOSTICS v_completed_count = ROW_COUNT;
  END IF;

  -- When piece goes from feedback back to review → complete feedback-related tasks
  IF NEW.phase = 'review' AND OLD.phase = 'feedback' THEN
    UPDATE public.tasks
    SET is_completed = true, status = 'done'
    WHERE content_piece_id = NEW.id
      AND is_completed = false;
    GET DIAGNOSTICS v_completed_count = ROW_COUNT;
  END IF;

  -- When piece goes to editing (from filmed) → complete any script-phase tasks
  IF NEW.phase = 'editing' AND OLD.phase = 'filmed' THEN
    UPDATE public.tasks
    SET is_completed = true, status = 'done'
    WHERE content_piece_id = NEW.id
      AND is_completed = false
      AND tag IN ('skript', 'script');
    GET DIAGNOSTICS v_completed_count = ROW_COUNT;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_auto_complete_tasks_on_phase
AFTER UPDATE ON public.content_pieces
FOR EACH ROW
EXECUTE FUNCTION public.auto_complete_tasks_on_phase_change();

CREATE OR REPLACE FUNCTION public.auto_group_similar_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  IF NEW.content_piece_id IS NULL THEN RETURN NEW; END IF;

  SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;

  v_tag_label := CASE NEW.tag
    WHEN 'veröffentlichen' THEN 'Pieces veröffentlichen'
    WHEN 'schnitt' THEN 'Pieces schneiden'
    ELSE COALESCE(NEW.tag, 'Aufgaben')
  END;

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

  SELECT COUNT(*) INTO v_similar_count
  FROM public.tasks
  WHERE client_id = NEW.client_id
    AND tag = NEW.tag
    AND assigned_to = NEW.assigned_to
    AND is_completed = false
    AND parent_id IS NULL
    AND group_source = NEW.group_source
    AND content_piece_id IS NOT NULL
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
      AND content_piece_id IS NOT NULL
      AND id != v_new_parent_id
      AND id != NEW.id
      AND created_at > (now() - interval '60 minutes');

    NEW.parent_id := v_new_parent_id;
  END IF;

  RETURN NEW;
END;
$function$;
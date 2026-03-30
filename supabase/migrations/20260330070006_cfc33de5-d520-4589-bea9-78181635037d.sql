
-- Disable SOP auto-task triggers on content_pieces
DROP TRIGGER IF EXISTS trigger_sop_on_piece_approved ON public.content_pieces;
DROP TRIGGER IF EXISTS trigger_sop_on_piece_editing ON public.content_pieces;

-- Disable SOP auto-task trigger on shoot_days
DROP TRIGGER IF EXISTS trigger_sop_on_shoot_day ON public.shoot_days;

-- Disable the auto-grouping trigger on tasks
DROP TRIGGER IF EXISTS auto_group_similar_tasks ON public.tasks;

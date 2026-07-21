-- Disable auto-task creation from content piece assignment trigger
DROP TRIGGER IF EXISTS on_content_piece_assigned ON public.content_pieces;

-- Note: trg_notify_task_assignment_slack stays — it sends Slack DM on task assignment.
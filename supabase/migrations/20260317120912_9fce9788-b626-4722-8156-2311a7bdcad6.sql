
-- Delete older duplicate entries, keep only the newest per content_piece_id
DELETE FROM public.review_notification_queue
WHERE client_id = '4b963d7a-dc69-47c0-865c-93ef28795cd1'
  AND id NOT IN (
    SELECT DISTINCT ON (content_piece_id) id
    FROM public.review_notification_queue
    WHERE client_id = '4b963d7a-dc69-47c0-865c-93ef28795cd1'
    ORDER BY content_piece_id, created_at DESC
  );

-- Now reset sent_at on remaining entries
UPDATE public.review_notification_queue
SET sent_at = NULL
WHERE client_id = '4b963d7a-dc69-47c0-865c-93ef28795cd1';

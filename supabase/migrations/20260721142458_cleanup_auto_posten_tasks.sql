-- Remove leftover auto-generated "posten" tasks created by the old notify-assignment automation.
DELETE FROM public.tasks
WHERE is_completed = false
  AND parent_id IS NULL
  AND (
    title LIKE 'Reel „%posten'
    OR title LIKE 'Karussell „%posten'
    OR title LIKE 'Story %posten'
    OR title LIKE 'Karussell "%posten'
    OR title LIKE 'Reel "%posten'
  );

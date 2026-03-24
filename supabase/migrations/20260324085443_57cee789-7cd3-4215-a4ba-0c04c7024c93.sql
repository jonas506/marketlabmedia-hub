-- Move existing pieces that have client_comment (feedback) but are not in feedback/approved/handed_over phase
-- These are pieces that got rejected before the feedback phase existed
UPDATE public.content_pieces
SET phase = 'feedback'
WHERE client_comment IS NOT NULL
  AND client_comment <> ''
  AND phase NOT IN ('feedback', 'approved', 'handed_over', 'review');
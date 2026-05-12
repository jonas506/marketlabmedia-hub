ALTER TABLE public.content_pieces ADD COLUMN IF NOT EXISTS funnel_stage text;
CREATE INDEX IF NOT EXISTS idx_content_pieces_funnel_stage ON public.content_pieces(funnel_stage);
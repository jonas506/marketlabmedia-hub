ALTER TABLE public.content_pieces 
  ADD COLUMN deadline date DEFAULT NULL,
  ADD COLUMN priority text DEFAULT 'normal';
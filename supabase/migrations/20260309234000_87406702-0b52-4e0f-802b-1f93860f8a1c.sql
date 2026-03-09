ALTER TABLE public.tasks 
  ADD COLUMN priority text DEFAULT 'normal',
  ADD COLUMN status text DEFAULT 'not_started';
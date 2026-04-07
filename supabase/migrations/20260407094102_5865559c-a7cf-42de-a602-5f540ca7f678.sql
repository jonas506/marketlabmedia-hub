
ALTER TABLE public.story_sequences
ADD COLUMN version integer NOT NULL DEFAULT 1,
ADD COLUMN parent_sequence_id uuid REFERENCES public.story_sequences(id) ON DELETE SET NULL;

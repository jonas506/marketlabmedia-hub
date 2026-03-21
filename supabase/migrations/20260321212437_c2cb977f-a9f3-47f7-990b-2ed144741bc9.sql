
-- Add new columns to strategy_boards
ALTER TABLE public.strategy_boards 
  ADD COLUMN IF NOT EXISTS chat_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sources jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_generated boolean DEFAULT false;

-- Create board_source_files table
CREATE TABLE public.board_source_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.strategy_boards(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL DEFAULT 'application/octet-stream',
  file_path text NOT NULL,
  extracted_text text,
  file_size integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.board_source_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage board_source_files" ON public.board_source_files
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "HoC can manage board_source_files" ON public.board_source_files
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'head_of_content'::app_role))
  WITH CHECK (has_role(auth.uid(), 'head_of_content'::app_role));

CREATE POLICY "Authenticated can view board_source_files" ON public.board_source_files
  FOR SELECT TO authenticated
  USING (true);

-- Create board-files storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('board-files', 'board-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for board-files
CREATE POLICY "Authenticated users can upload board files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'board-files');

CREATE POLICY "Authenticated users can read board files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'board-files');

CREATE POLICY "Admins can delete board files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'board-files' AND has_role(auth.uid(), 'admin'::app_role));

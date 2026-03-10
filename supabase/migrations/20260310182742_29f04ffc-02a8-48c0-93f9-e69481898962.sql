
CREATE TABLE public.content_piece_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_piece_id uuid NOT NULL REFERENCES public.content_pieces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  timestamp_seconds numeric NULL,
  comment_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.content_piece_comments ENABLE ROW LEVEL SECURITY;

-- Public read via edge function (service role), authenticated users can view
CREATE POLICY "Authenticated can view comments"
  ON public.content_piece_comments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage comments"
  ON public.content_piece_comments
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Head of content can manage comments"
  ON public.content_piece_comments
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'head_of_content'::app_role))
  WITH CHECK (has_role(auth.uid(), 'head_of_content'::app_role));

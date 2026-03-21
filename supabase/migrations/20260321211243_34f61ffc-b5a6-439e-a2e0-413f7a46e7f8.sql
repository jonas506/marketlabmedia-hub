
-- Strategy Boards table
CREATE TABLE public.strategy_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Neues Board',
  description text,
  board_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  thumbnail text,
  template_type text,
  share_token uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

-- Board Templates table
CREATE TABLE public.board_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'blank',
  template_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview_image text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.strategy_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_templates ENABLE ROW LEVEL SECURITY;

-- RLS for strategy_boards
CREATE POLICY "Admins can manage strategy_boards" ON public.strategy_boards
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Head of content can manage strategy_boards" ON public.strategy_boards
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'head_of_content'))
  WITH CHECK (has_role(auth.uid(), 'head_of_content'));

CREATE POLICY "Authenticated can view strategy_boards" ON public.strategy_boards
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Public can view shared boards" ON public.strategy_boards
  FOR SELECT TO anon
  USING (share_token IS NOT NULL);

-- RLS for board_templates
CREATE POLICY "Authenticated can view board_templates" ON public.board_templates
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage board_templates" ON public.board_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_strategy_boards_updated_at
  BEFORE UPDATE ON public.strategy_boards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- Knowledge Base entries per client
CREATE TABLE public.client_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'sonstiges',
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view client_knowledge" ON public.client_knowledge
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage client_knowledge" ON public.client_knowledge
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Head of content can manage client_knowledge" ON public.client_knowledge
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'head_of_content'::app_role))
  WITH CHECK (has_role(auth.uid(), 'head_of_content'::app_role));

-- AI Chat messages per client (single conversation)
CREATE TABLE public.client_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  mode text DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view client_ai_messages" ON public.client_ai_messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage client_ai_messages" ON public.client_ai_messages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Head of content can manage client_ai_messages" ON public.client_ai_messages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'head_of_content'::app_role))
  WITH CHECK (has_role(auth.uid(), 'head_of_content'::app_role));

CREATE POLICY "Cutters can manage client_ai_messages" ON public.client_ai_messages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'cutter'::app_role))
  WITH CHECK (has_role(auth.uid(), 'cutter'::app_role));

-- Trigger for updated_at on knowledge
CREATE TRIGGER update_client_knowledge_updated_at
  BEFORE UPDATE ON public.client_knowledge
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE public.client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_assignments TO authenticated;
GRANT ALL ON public.client_assignments TO service_role;
ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal can view assignments" ON public.client_assignments
FOR SELECT TO authenticated USING (public.is_internal(auth.uid()));
CREATE POLICY "Admins and HoC can manage assignments" ON public.client_assignments
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_of_content'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_of_content'));

CREATE OR REPLACE FUNCTION public.has_client_access(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_internal(_user_id) AND (
    public.has_role(_user_id,'admin')
    OR public.has_role(_user_id,'head_of_content')
    OR _client_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.client_assignments ca
      WHERE ca.user_id = _user_id AND ca.client_id = _client_id
    )
  )
$$;
GRANT EXECUTE ON FUNCTION public.has_client_access(uuid, uuid) TO authenticated;

-- clients
DROP POLICY IF EXISTS "Authenticated can view clients" ON public.clients;
CREATE POLICY "Internal can view permitted clients" ON public.clients
FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), id));

-- client-scoped tables
DROP POLICY IF EXISTS "Authenticated can view content pieces" ON public.content_pieces;
CREATE POLICY "Authenticated can view content pieces" ON public.content_pieces
FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));

DROP POLICY IF EXISTS "Authenticated can view tasks" ON public.tasks;
CREATE POLICY "Authenticated can view tasks" ON public.tasks
FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));

DROP POLICY IF EXISTS "Authenticated can view shoot days" ON public.shoot_days;
CREATE POLICY "Authenticated can view shoot days" ON public.shoot_days
FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));

DROP POLICY IF EXISTS "Authenticated can view checklists" ON public.checklists;
CREATE POLICY "Authenticated can view checklists" ON public.checklists
FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));

DROP POLICY IF EXISTS "Authenticated can view clips" ON public.clips;
CREATE POLICY "Authenticated can view clips" ON public.clips
FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));

DROP POLICY IF EXISTS "Authenticated can view strategy_boards" ON public.strategy_boards;
CREATE POLICY "Authenticated can view strategy_boards" ON public.strategy_boards
FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));

DROP POLICY IF EXISTS "Authenticated can read story_sequences" ON public.story_sequences;
CREATE POLICY "Authenticated can read story_sequences" ON public.story_sequences
FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));

DROP POLICY IF EXISTS "Authenticated can read story_categories" ON public.story_categories;
CREATE POLICY "Authenticated can read story_categories" ON public.story_categories
FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));

DROP POLICY IF EXISTS "Authenticated can view client_knowledge" ON public.client_knowledge;
CREATE POLICY "Authenticated can view client_knowledge" ON public.client_knowledge
FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));

DROP POLICY IF EXISTS "Authenticated can view client_inspirations" ON public.client_inspirations;
CREATE POLICY "Authenticated can view client_inspirations" ON public.client_inspirations
FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));

DROP POLICY IF EXISTS "Authenticated can view client_ai_messages" ON public.client_ai_messages;
CREATE POLICY "Authenticated can view client_ai_messages" ON public.client_ai_messages
FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));

DROP POLICY IF EXISTS "Authenticated can view landing_pages" ON public.landing_pages;
CREATE POLICY "Authenticated can view landing_pages" ON public.landing_pages
FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));

DROP POLICY IF EXISTS "Authenticated can read marketing_tracking" ON public.marketing_tracking;
CREATE POLICY "Authenticated can read marketing_tracking" ON public.marketing_tracking
FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));

DROP POLICY IF EXISTS "Authenticated users can read contingent_extras" ON public.contingent_extras;
CREATE POLICY "Authenticated users can read contingent_extras" ON public.contingent_extras
FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));

DROP POLICY IF EXISTS "Authenticated users can read follower snapshots" ON public.follower_snapshots;
CREATE POLICY "Authenticated users can read follower snapshots" ON public.follower_snapshots
FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));

DROP POLICY IF EXISTS "Authenticated can view contract changes" ON public.contract_changes;
CREATE POLICY "Authenticated can view contract changes" ON public.contract_changes
FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));

-- Schnitt-Briefing
CREATE TABLE public.client_edit_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  subtitle_font text,
  overlay_font text,
  font_size_note text,
  text_case text,
  subtitle_style text,
  subtitle_position text,
  subtitle_highlight_color text,
  subtitle_max_chars text,
  subtitle_animation text,
  pacing text,
  cut_frequency text,
  motion text,
  transitions text,
  broll_rules text,
  music_style text,
  music_volume text,
  sfx_allowed boolean,
  hook_rules text,
  logo_usage text,
  outro_cta text,
  export_format text,
  export_resolution text,
  export_framerate text,
  file_naming text,
  dos jsonb NOT NULL DEFAULT '[]'::jsonb,
  donts jsonb NOT NULL DEFAULT '[]'::jsonb,
  reference_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_edit_briefings TO authenticated;
GRANT ALL ON public.client_edit_briefings TO service_role;
ALTER TABLE public.client_edit_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal can view permitted briefings" ON public.client_edit_briefings
FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));
CREATE POLICY "Admins and HoC can manage briefings" ON public.client_edit_briefings
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_of_content'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_of_content'));

CREATE TRIGGER update_client_edit_briefings_updated_at
BEFORE UPDATE ON public.client_edit_briefings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

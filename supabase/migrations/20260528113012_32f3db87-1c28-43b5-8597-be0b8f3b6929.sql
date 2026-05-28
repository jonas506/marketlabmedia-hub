
-- Helper predicate inline: has_role(auth.uid(),'admin') OR has_role(auth.uid(),'head_of_content')

-- contingent_extras
DROP POLICY IF EXISTS "Authenticated users can insert contingent_extras" ON public.contingent_extras;
DROP POLICY IF EXISTS "Authenticated users can update contingent_extras" ON public.contingent_extras;
CREATE POLICY "Admins and HoC can insert contingent_extras"
  ON public.contingent_extras FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role));
CREATE POLICY "Admins and HoC can update contingent_extras"
  ON public.contingent_extras FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role));
CREATE POLICY "Admins and HoC can delete contingent_extras"
  ON public.contingent_extras FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role));

-- follower_snapshots
DROP POLICY IF EXISTS "Authenticated users can insert follower snapshots" ON public.follower_snapshots;
DROP POLICY IF EXISTS "Authenticated users can update follower snapshots" ON public.follower_snapshots;
DROP POLICY IF EXISTS "Authenticated users can delete follower snapshots" ON public.follower_snapshots;
CREATE POLICY "Admins and HoC can insert follower_snapshots"
  ON public.follower_snapshots FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role));
CREATE POLICY "Admins and HoC can update follower_snapshots"
  ON public.follower_snapshots FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role));
CREATE POLICY "Admins and HoC can delete follower_snapshots"
  ON public.follower_snapshots FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role));

-- marketing_tracking
DROP POLICY IF EXISTS "Authenticated users can manage tracking" ON public.marketing_tracking;
CREATE POLICY "Authenticated can read marketing_tracking"
  ON public.marketing_tracking FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and HoC can insert marketing_tracking"
  ON public.marketing_tracking FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role));
CREATE POLICY "Admins and HoC can update marketing_tracking"
  ON public.marketing_tracking FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role));
CREATE POLICY "Admins and HoC can delete marketing_tracking"
  ON public.marketing_tracking FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role));

-- story_categories
DROP POLICY IF EXISTS "Authenticated can manage story_categories" ON public.story_categories;
CREATE POLICY "Authenticated can read story_categories"
  ON public.story_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and HoC can write story_categories"
  ON public.story_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role));

-- story_sequences
DROP POLICY IF EXISTS "Authenticated can manage story_sequences" ON public.story_sequences;
CREATE POLICY "Authenticated can read story_sequences"
  ON public.story_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and HoC can write story_sequences"
  ON public.story_sequences FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role));

-- story_sequence_tracking
DROP POLICY IF EXISTS "Authenticated can manage story_sequence_tracking" ON public.story_sequence_tracking;
CREATE POLICY "Authenticated can read story_sequence_tracking"
  ON public.story_sequence_tracking FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and HoC can write story_sequence_tracking"
  ON public.story_sequence_tracking FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role));

-- story_slides
DROP POLICY IF EXISTS "Authenticated can manage story_slides" ON public.story_slides;
CREATE POLICY "Authenticated can read story_slides"
  ON public.story_slides FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and HoC can write story_slides"
  ON public.story_slides FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'head_of_content'::app_role));

-- client_contract_months: scope admin policy to authenticated role
DROP POLICY IF EXISTS "Admins manage contract months" ON public.client_contract_months;
CREATE POLICY "Admins manage contract months"
  ON public.client_contract_months FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));


-- 1. Fix notifications: remove public INSERT, add service_role INSERT
DROP POLICY IF EXISTS "Allow trigger inserts" ON public.notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

CREATE POLICY "service_role_insert_notifications"
  ON public.notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 2. Fix activity_log: restrict SELECT to admins/head_of_content or own actions
DROP POLICY IF EXISTS "Authenticated users can read activity log" ON public.activity_log;
DROP POLICY IF EXISTS "authenticated_read_activity_log" ON public.activity_log;

CREATE POLICY "scoped_read_activity_log"
  ON public.activity_log FOR SELECT
  TO authenticated
  USING (
    actor_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'head_of_content')
  );

-- 3. Fix travel_expenses: scope DELETE and UPDATE to authenticated
DROP POLICY IF EXISTS "Users can delete own travel_expenses" ON public.travel_expenses;
DROP POLICY IF EXISTS "Users can update own travel_expenses" ON public.travel_expenses;

CREATE POLICY "Users can delete own travel_expenses"
  ON public.travel_expenses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own travel_expenses"
  ON public.travel_expenses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Make client-documents bucket private
UPDATE storage.buckets SET public = false WHERE id = 'client-documents';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_target_hours numeric NOT NULL DEFAULT 40;

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
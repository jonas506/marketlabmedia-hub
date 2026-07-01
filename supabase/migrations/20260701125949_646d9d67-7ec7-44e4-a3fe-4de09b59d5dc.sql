
-- Course modules (globally defined by admins)
CREATE TABLE public.course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  drive_file_id text,
  thumbnail_url text,
  sort_order integer NOT NULL DEFAULT 0,
  duration_seconds integer,
  resources jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_modules TO authenticated;
GRANT ALL ON public.course_modules TO service_role;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;

-- Course students: an auth user linked (optionally) to a client, allowed to view the course
CREATE TABLE public.course_students (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name text,
  invited_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_students TO authenticated;
GRANT ALL ON public.course_students TO service_role;
ALTER TABLE public.course_students ENABLE ROW LEVEL SECURITY;

-- Progress per user/module
CREATE TABLE public.course_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  last_position_seconds numeric NOT NULL DEFAULT 0,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_progress TO authenticated;
GRANT ALL ON public.course_progress TO service_role;
ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;

-- Helper: is caller a course student?
CREATE OR REPLACE FUNCTION public.is_course_student(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.course_students WHERE user_id = _user_id)
$$;

-- Policies: course_modules
CREATE POLICY "Admins manage modules" ON public.course_modules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Students & staff read published modules" ON public.course_modules FOR SELECT TO authenticated
  USING (
    is_published = true AND (
      public.is_course_student(auth.uid())
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'head_of_content')
    )
  );

-- Policies: course_students
CREATE POLICY "Admins manage students" ON public.course_students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "User sees own student row" ON public.course_students FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Policies: course_progress
CREATE POLICY "User manages own progress" ON public.course_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read all progress" ON public.course_progress FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at triggers
CREATE TRIGGER course_modules_updated_at BEFORE UPDATE ON public.course_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER course_progress_updated_at BEFORE UPDATE ON public.course_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

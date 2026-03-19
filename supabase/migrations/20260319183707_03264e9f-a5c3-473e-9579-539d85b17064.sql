
-- CRM Activity type enum
CREATE TYPE public.crm_activity_type AS ENUM (
  'note', 'call', 'email', 'sms', 'status_change', 'opportunity_change', 'task_completed', 'created'
);

-- CRM Email direction enum
CREATE TYPE public.crm_email_direction AS ENUM ('inbound', 'outbound');

-- Lead Statuses
CREATE TABLE public.crm_lead_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280',
  sort_order int NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_lead_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on crm_lead_statuses" ON public.crm_lead_statuses FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Leads
CREATE TABLE public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status_id uuid REFERENCES public.crm_lead_statuses(id) ON DELETE SET NULL,
  website text,
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on crm_leads" ON public.crm_leads FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Contacts
CREATE TABLE public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  position text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on crm_contacts" ON public.crm_contacts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Pipelines
CREATE TABLE public.crm_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on crm_pipelines" ON public.crm_pipelines FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Pipeline Stages
CREATE TABLE public.crm_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280',
  sort_order int NOT NULL DEFAULT 0,
  win_probability int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on crm_pipeline_stages" ON public.crm_pipeline_stages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Opportunities
CREATE TABLE public.crm_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.crm_pipeline_stages(id) ON DELETE CASCADE,
  value numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  note text,
  expected_close_date date,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on crm_opportunities" ON public.crm_opportunities FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- CRM Tasks
CREATE TABLE public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  assigned_to uuid NOT NULL,
  title text NOT NULL,
  description text,
  due_date date,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on crm_tasks" ON public.crm_tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Activities
CREATE TABLE public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  type crm_activity_type NOT NULL,
  title text NOT NULL,
  body text,
  metadata jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on crm_activities" ON public.crm_activities FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Emails
CREATE TABLE public.crm_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  gmail_message_id text UNIQUE,
  thread_id text,
  subject text NOT NULL DEFAULT '',
  snippet text,
  from_email text NOT NULL,
  to_email text NOT NULL,
  date timestamptz NOT NULL DEFAULT now(),
  direction crm_email_direction NOT NULL DEFAULT 'inbound',
  is_read boolean NOT NULL DEFAULT false,
  body_preview text,
  synced_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on crm_emails" ON public.crm_emails FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Files
CREATE TABLE public.crm_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_url text NOT NULL,
  file_size int NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on crm_files" ON public.crm_files FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Smart Views
CREATE TABLE public.crm_smart_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_smart_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on crm_smart_views" ON public.crm_smart_views FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Notes
CREATE TABLE public.crm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on crm_notes" ON public.crm_notes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Updated_at triggers
CREATE TRIGGER crm_leads_updated_at BEFORE UPDATE ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER crm_opportunities_updated_at BEFORE UPDATE ON public.crm_opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER crm_notes_updated_at BEFORE UPDATE ON public.crm_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

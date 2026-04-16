
-- Add DELETE policies for CRM tables so leads can be fully removed
CREATE POLICY "Admin can delete crm_leads" ON public.crm_leads FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete crm_activities" ON public.crm_activities FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete crm_contacts" ON public.crm_contacts FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete crm_notes" ON public.crm_notes FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete crm_tasks" ON public.crm_tasks FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete crm_files" ON public.crm_files FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete crm_opportunities" ON public.crm_opportunities FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete crm_emails" ON public.crm_emails FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

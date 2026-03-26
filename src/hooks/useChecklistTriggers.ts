import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Auto-creates checklists from SOP templates with trigger_type = 'new_month'
 * for all active clients on the first app load of a new month.
 */
export const useMonthlyChecklistTrigger = () => {
  const { user, role } = useAuth();
  const hasRun = useRef(false);

  useEffect(() => {
    if (!user || hasRun.current) return;
    if (role !== "admin" && role !== "head_of_content") return;

    hasRun.current = true;

    const run = async () => {
      try {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // Get templates with new_month trigger
        const { data: templates } = await supabase
          .from("sop_templates")
          .select("id, name, category")
          .eq("trigger_type", "new_month");

        if (!templates || templates.length === 0) return;

        // Get active clients
        const { data: clients } = await supabase
          .from("clients")
          .select("id")
          .eq("status", "active");

        if (!clients || clients.length === 0) return;

        // Get template steps
        const { data: allSteps } = await supabase
          .from("sop_template_steps")
          .select("*")
          .in("template_id", templates.map((t) => t.id))
          .order("sort_order");

        // Get user roles for default assignment
        const { data: userRoles } = await supabase.from("user_roles").select("user_id, role");
        const getUserByRole = (r: string) => userRoles?.find((ur: any) => ur.role === r)?.user_id || null;

        for (const tpl of templates) {
          // Check existing checklists for this month
          const { data: existing } = await supabase
            .from("checklists")
            .select("id, client_id")
            .eq("template_id", tpl.id)
            .eq("month", month)
            .eq("year", year);

          const existingClientIds = new Set((existing || []).map((e: any) => e.client_id));
          const tplSteps = (allSteps || []).filter((s: any) => s.template_id === tpl.id);

          for (const client of clients) {
            if (existingClientIds.has(client.id)) continue;

            const { data: checklist } = await supabase
              .from("checklists")
              .insert({
                client_id: client.id,
                template_id: tpl.id,
                name: tpl.name,
                category: tpl.category,
                month,
                year,
              })
              .select("id")
              .single();

            if (checklist && tplSteps.length > 0) {
              await supabase.from("checklist_steps").insert(
                tplSteps.map((s: any) => ({
                  checklist_id: checklist.id,
                  title: s.title,
                  description: s.description,
                  assigned_to: s.default_role ? getUserByRole(s.default_role) : null,
                  sort_order: s.sort_order,
                }))
              );
            }
          }
        }
        // Also generate SOP tasks for monthly planning
        for (const client of clients) {
          try {
            await supabase.functions.invoke("generate-sop-tasks", {
              body: { trigger_type: "new_month", client_id: client.id },
            });
          } catch (e) {
            console.error("Monthly SOP task generation failed:", e);
          }
        }
      } catch (err) {
        console.error("Monthly checklist trigger failed:", err);
      }
    };

    run();
  }, [user, role]);
};

/**
 * Creates checklists from SOP templates with trigger_type = 'new_client'
 * Call this after creating a new client.
 */
export const createNewClientChecklists = async (clientId: string) => {
  try {
    const { data: templates } = await supabase
      .from("sop_templates")
      .select("id, name, category")
      .eq("trigger_type", "new_client");

    if (!templates || templates.length === 0) return;

    const { data: allSteps } = await supabase
      .from("sop_template_steps")
      .select("*")
      .in("template_id", templates.map((t) => t.id))
      .order("sort_order");

    const { data: userRoles } = await supabase.from("user_roles").select("user_id, role");
    const getUserByRole = (r: string) => userRoles?.find((ur: any) => ur.role === r)?.user_id || null;

    for (const tpl of templates) {
      const tplSteps = (allSteps || []).filter((s: any) => s.template_id === tpl.id);

      const { data: checklist } = await supabase
        .from("checklists")
        .insert({
          client_id: clientId,
          template_id: tpl.id,
          name: tpl.name,
          category: tpl.category,
        })
        .select("id")
        .single();

      if (checklist && tplSteps.length > 0) {
        await supabase.from("checklist_steps").insert(
          tplSteps.map((s: any) => ({
            checklist_id: checklist.id,
            title: s.title,
            description: s.description,
            assigned_to: s.default_role ? getUserByRole(s.default_role) : null,
            sort_order: s.sort_order,
          }))
        );
      }
    }
  } catch (err) {
    console.error("New client checklist trigger failed:", err);
  }
};

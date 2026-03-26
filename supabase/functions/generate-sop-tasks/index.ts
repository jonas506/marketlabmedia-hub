import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { trigger_type, client_id, context } = await req.json();

    if (!trigger_type || !client_id) {
      return new Response(JSON.stringify({ error: "trigger_type and client_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Find matching SOP templates
    const { data: templates } = await supabase
      .from("sop_templates")
      .select("id, name, category")
      .eq("trigger_type", trigger_type);

    if (!templates || templates.length === 0) {
      return new Response(JSON.stringify({ message: "No templates for trigger", trigger_type }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Load steps
    const templateIds = templates.map((t: any) => t.id);
    const { data: allSteps } = await supabase
      .from("sop_template_steps")
      .select("*")
      .in("template_id", templateIds)
      .order("sort_order");

    // 3. Load team roles
    const { data: userRoles } = await supabase.from("user_roles").select("user_id, role");
    const getUserByRole = (role: string) =>
      userRoles?.find((r: any) => r.role === role)?.user_id || null;

    // 4. Client name
    const { data: client } = await supabase
      .from("clients")
      .select("name")
      .eq("id", client_id)
      .single();
    const clientName = client?.name || "Kunde";

    // 5. Deduplication
    const now = new Date();
    let dedupeTag = `sop_${trigger_type}`;

    if (context?.week_key) {
      dedupeTag += `_${context.week_key}`;
    } else if (trigger_type === "new_month") {
      dedupeTag += `_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    } else if (context?.shoot_day_id) {
      dedupeTag += `_${context.shoot_day_id}`;
    } else if (context?.content_piece_id) {
      dedupeTag += `_${context.content_piece_id}`;
    }

    const { data: existingParent } = await supabase
      .from("tasks")
      .select("id")
      .eq("client_id", client_id)
      .eq("tag", dedupeTag)
      .eq("is_completed", false)
      .limit(1);

    if (existingParent && existingParent.length > 0) {
      return new Response(JSON.stringify({ message: "Tasks already generated", dedupeTag }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalCreated = 0;

    for (const tpl of templates) {
      const steps = (allSteps || []).filter((s: any) => s.template_id === tpl.id);
      if (steps.length === 0) continue;

      // Create parent task
      const { data: parentTask } = await supabase
        .from("tasks")
        .insert({
          client_id,
          title: `${tpl.name} — ${clientName}`,
          assigned_to: getUserByRole(steps[0].default_role || "admin"),
          priority: "normal",
          status: "not_started",
          tag: dedupeTag,
          group_source: `sop_${trigger_type}`,
          description: `Automatisch erstellt aus SOP "${tpl.name}". ${steps.length} Schritte.`,
        })
        .select("id")
        .single();

      if (!parentTask) continue;

      // Create subtasks from steps
      for (const step of steps) {
        const assignee = getUserByRole(step.default_role || "admin");
        const deadline = new Date(now);
        deadline.setDate(deadline.getDate() + step.sort_order * 2);

        await supabase.from("tasks").insert({
          client_id,
          title: step.title,
          description: step.description || null,
          assigned_to: assignee,
          parent_id: parentTask.id,
          priority: "normal",
          status: "not_started",
          tag: step.default_role || null,
          deadline: deadline.toISOString().split("T")[0],
          sort_order: step.sort_order,
          content_piece_id: context?.content_piece_id || null,
        });

        totalCreated++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, created: totalCreated, trigger_type, client_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-sop-tasks error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

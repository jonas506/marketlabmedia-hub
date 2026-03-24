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

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  const todayStr = new Date().toISOString().split("T")[0];

  // Get admin user IDs
  const { data: admins } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  const adminIds = (admins || []).map((a: any) => a.user_id);

  // Content pieces due tomorrow
  const { data: piecesDueTomorrow } = await supabase
    .from("content_pieces")
    .select("id, title, type, client_id, assigned_to, clients(name)")
    .eq("deadline", tomorrowStr)
    .not("phase", "in", '("approved","handed_over")')
    .not("assigned_to", "is", null);

  for (const p of piecesDueTomorrow || []) {
    const typeLabel = p.type === "reel" ? "Reel" : p.type === "carousel" ? "Karussell" : p.type;
    const clientName = (p as any).clients?.name || "Unbekannt";
    await supabase.from("notifications").insert({
      user_id: p.assigned_to,
      type: "deadline_warning",
      title: `⏰ ${typeLabel} „${p.title || "Ohne Titel"}" von ${clientName} ist morgen fällig`,
      link: `/client/${p.client_id}`,
      reference_id: p.id,
      reference_type: "content_piece",
    });
  }

  // Tasks due tomorrow
  const { data: tasksDueTomorrow } = await supabase
    .from("tasks")
    .select("id, title, client_id, assigned_to, clients(name)")
    .eq("deadline", tomorrowStr)
    .eq("is_completed", false)
    .not("assigned_to", "is", null);

  for (const t of tasksDueTomorrow || []) {
    const clientName = (t as any).clients?.name || "Allgemein";
    await supabase.from("notifications").insert({
      user_id: t.assigned_to,
      type: "deadline_warning",
      title: `⏰ Aufgabe „${t.title}" für ${clientName} ist morgen fällig`,
      link: t.client_id ? `/client/${t.client_id}` : "/tasks",
      reference_id: t.id,
      reference_type: "task",
    });
  }

  // Overdue content pieces
  const { data: overdueP } = await supabase
    .from("content_pieces")
    .select("id, title, type, client_id, assigned_to, clients(name)")
    .lt("deadline", todayStr)
    .not("phase", "in", '("approved","handed_over")')
    .not("assigned_to", "is", null);

  for (const p of overdueP || []) {
    const typeLabel = p.type === "reel" ? "Reel" : p.type === "carousel" ? "Karussell" : p.type;
    const clientName = (p as any).clients?.name || "Unbekannt";
    const recipients = new Set([p.assigned_to, ...adminIds]);
    for (const uid of recipients) {
      await supabase.from("notifications").insert({
        user_id: uid,
        type: "deadline_warning",
        title: `🚨 ${typeLabel} „${p.title || "Ohne Titel"}" von ${clientName} ist überfällig!`,
        link: `/client/${p.client_id}`,
        reference_id: p.id,
        reference_type: "content_piece",
      });
    }
  }

  // Overdue tasks
  const { data: overdueT } = await supabase
    .from("tasks")
    .select("id, title, client_id, assigned_to, clients(name)")
    .lt("deadline", todayStr)
    .eq("is_completed", false)
    .not("assigned_to", "is", null);

  for (const t of overdueT || []) {
    const clientName = (t as any).clients?.name || "Allgemein";
    const recipients = new Set([t.assigned_to, ...adminIds]);
    for (const uid of recipients) {
      await supabase.from("notifications").insert({
        user_id: uid,
        type: "deadline_warning",
        title: `🚨 Aufgabe „${t.title}" für ${clientName} ist überfällig!`,
        link: t.client_id ? `/client/${t.client_id}` : "/tasks",
        reference_id: t.id,
        reference_type: "task",
      });
    }
  }

  // Cleanup old notifications
  await supabase.rpc("cleanup_old_notifications" as any);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: callerUser } } = await caller.auth.getUser();
    if (!callerUser) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", callerUser.id).maybeSingle();
    if (roleRow?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Nur Admins" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { email, full_name, client_id } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "E-Mail erforderlich" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const origin = req.headers.get("origin") || supabaseUrl;

    // Check if user already exists
    const { data: existingUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    let userId: string | null = null;
    // listUsers doesn't support filter by email; do a broader search
    const { data: allUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = allUsers?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existing) {
      userId = existing.id;
    } else {
      const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { name: full_name || email },
        redirectTo: `${origin}/accept-invite`,
      });
      if (inviteError) throw inviteError;
      userId = inviteData.user!.id;
    }

    await admin.from("profiles").upsert(
      { user_id: userId!, email, name: full_name || email },
      { onConflict: "user_id" }
    );
    await admin.from("course_students").upsert(
      { user_id: userId!, email, full_name: full_name || null, client_id: client_id || null },
      { onConflict: "user_id" }
    );

    return new Response(JSON.stringify({ success: true, user_id: userId, existing: !!existing }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("invite-course-student error", err);
    return new Response(JSON.stringify({ error: err.message || "Unbekannter Fehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, password, full_name } = await req.json();
    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return new Response(JSON.stringify({ error: "E-Mail und Passwort erforderlich" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Passwort muss mindestens 8 Zeichen haben" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Check if user exists
    const { data: allUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = allUsers?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    let userId: string;
    if (existing) {
      return new Response(JSON.stringify({ error: "Diese E-Mail ist bereits registriert. Bitte einloggen." }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: full_name || email },
      });
      if (createErr) throw createErr;
      userId = created.user!.id;
    }

    await admin.from("profiles").upsert(
      { user_id: userId, email, name: full_name || email },
      { onConflict: "user_id" }
    );
    await admin.from("course_students").upsert(
      { user_id: userId, email, full_name: full_name || null },
      { onConflict: "user_id" }
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("course-signup error", err);
    return new Response(JSON.stringify({ error: err.message || "Unbekannter Fehler" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

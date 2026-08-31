import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { InviteEmail } from "../_shared/email-templates/invite.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://hub.marketlab-media.de";
const FROM_ADDRESS = "Marketlab Media <noreply@marketlabmedia.de>";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: callerUser } } = await caller.auth.getUser();
    if (!callerUser) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", callerUser.id).maybeSingle();
    if (roleRow?.role !== "admin") return json({ error: "Nur Admins" }, 403);

    const { email, full_name, client_id } = await req.json();
    if (!email || typeof email !== "string") return json({ error: "E-Mail erforderlich" }, 400);

    const redirectTo = `${SITE_URL}/accept-invite`;

    const { data: allUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = allUsers?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    let userId: string;
    let actionLink: string;

    if (existing) {
      userId = existing.id;
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
      if (linkErr) throw linkErr;
      actionLink = linkData.properties.action_link;
    } else {
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo, data: { name: full_name || email } },
      });
      if (linkErr) throw linkErr;
      userId = linkData.user!.id;
      actionLink = linkData.properties.action_link;
    }

    await admin.from("profiles").upsert(
      { user_id: userId, email, name: full_name || email },
      { onConflict: "user_id" }
    );
    await admin.from("course_students").upsert(
      { user_id: userId, email, full_name: full_name || null, client_id: client_id || null },
      { onConflict: "user_id" }
    );

    // Send the invite email ourselves via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY nicht konfiguriert");

    const props = {
      siteName: "Marketlab Media Videokurs",
      siteUrl: `${SITE_URL}/kurs`,
      confirmationUrl: actionLink,
    };
    const html = await renderAsync(React.createElement(InviteEmail, props));
    const text = await renderAsync(React.createElement(InviteEmail, props), { plainText: true });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [email],
        subject: "Dein Zugang zum Marketlab Media Videokurs",
        html,
        text,
      }),
    });
    const result = await res.json();
    if (!res.ok) {
      console.error("resend error", res.status, result);
      return json({ error: `E-Mail-Versand fehlgeschlagen: ${JSON.stringify(result)}` }, 500);
    }

    return json({ success: true, user_id: userId, existing: !!existing, email_id: result.id });
  } catch (err: any) {
    console.error("invite-course-student error", err);
    return json({ error: err.message || "Unbekannter Fehler" }, 500);
  }
});

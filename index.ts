// supabase/functions/send-alert/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const resend = new Resend(RESEND_API_KEY);

serve(async (req) => {
  try {
    const { mode, to, subject, body, area, repName, repType, time } = await req.json();

    if (mode === "direct") {
      // Send a single email
      const { data, error } = await resend.emails.send({
        from: "NEPAWatch <alerts@nepawatch.app>", // Use your verified domain later
        to: [to],
        subject,
        html: `<p>${body.replace(/\n/g, "<br>")}</p>`,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, sent: 1 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (mode === "area_alert") {
      // Create Supabase client using the request's auth header
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
      );

      // 1. Users with primary location matching the area
      const { data: primaryUsers, error: primaryError } = await supabaseClient
        .from("profiles")
        .select("email, name")
        .eq("location_area", area)
        .eq("notif_on", true);

      // 2. Users with saved places matching the area
      const { data: savedPlaceUsers, error: savedError } = await supabaseClient
        .from("saved_places")
        .select("user_id, custom_label")
        .eq("location_area", area)
        .eq("notif_on", true);

      const userIds = savedPlaceUsers?.map(p => p.user_id) || [];
      const { data: savedProfiles, error: profError } = await supabaseClient
        .from("profiles")
        .select("email, name")
        .in("id", userIds);

      // Combine unique emails
      const recipients = new Map();
      primaryUsers?.forEach(u => recipients.set(u.email, u.name));
      savedProfiles?.forEach(u => recipients.set(u.email, u.name));

      const emails = Array.from(recipients.entries()).map(([email, name]) => ({
        email,
        name: name || "Lagosian",
      }));

      // Send emails in parallel (be mindful of rate limits)
      const sendPromises = emails.map(({ email, name }) =>
        resend.emails.send({
          from: "NEPAWatch <alerts@nepawatch.app>",
          to: [email],
          subject,
          html: `<p>Hi ${name},</p><p>${body.replace(/\n/g, "<br>")}</p>`,
        })
      );

      const results = await Promise.allSettled(sendPromises);
      const sentCount = results.filter(r => r.status === "fulfilled").length;

      return new Response(JSON.stringify({ success: true, sent: sentCount }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid mode" }), { status: 400 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

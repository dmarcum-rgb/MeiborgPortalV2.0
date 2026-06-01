import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json();
    const { action, admin_code } = body;

    // All actions except verify_code require a valid admin code
    async function verifyCode(code: string): Promise<boolean> {
      const { data } = await db
        .from("app_config")
        .select("value")
        .eq("key", "admin_code")
        .maybeSingle();
      return !!data && data.value.trim() === code.trim();
    }

    // ── Verify admin code ──────────────────────────────────────
    if (action === "verify_code") {
      const valid = await verifyCode(body.code ?? "");
      return new Response(JSON.stringify({ valid }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require admin_code in the request
    if (!admin_code || !(await verifyCode(admin_code))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Add team member ────────────────────────────────────────
    if (action === "add_member") {
      const { full_name, email, position, department_id, supervisor_id, avatar_url } = body;
      const { data, error } = await db.from("team_members").insert({
        full_name, email: email || null, position: position || "",
        department_id: department_id || null, supervisor_id: supervisor_id || null,
        avatar_url: avatar_url || null,
      }).select().maybeSingle();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ member: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Update team member ─────────────────────────────────────
    if (action === "update_member") {
      const { id, full_name, email, position, department_id, supervisor_id, avatar_url, start_date } = body;
      const { error } = await db.from("team_members").update({
        full_name, email: email || null, position: position || "",
        department_id: department_id || null, supervisor_id: supervisor_id || null,
        avatar_url: avatar_url || null, start_date: start_date || null,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Delete team member ─────────────────────────────────────
    if (action === "delete_member") {
      const { id } = body;
      const { error } = await db.from("team_members").delete().eq("id", id);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Update admin code ──────────────────────────────────────
    if (action === "update_admin_code") {
      const { new_code } = body;
      if (!new_code || new_code.trim().length < 4) {
        return new Response(JSON.stringify({ error: "Code must be at least 4 characters" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error } = await db.from("app_config").upsert({ key: "admin_code", value: new_code.trim(), updated_at: new Date().toISOString() });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Update channel code ────────────────────────────────────
    if (action === "set_channel_code") {
      const { channel_id, code } = body;
      if (code && code.trim()) {
        const { error } = await db.from("channel_codes").upsert({ channel_id, code: code.trim(), updated_at: new Date().toISOString() });
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        await db.from("channel_codes").delete().eq("channel_id", channel_id);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Get channel codes ──────────────────────────────────────
    if (action === "get_channel_codes") {
      const { data, error } = await db.from("channel_codes").select("channel_id, code");
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ codes: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

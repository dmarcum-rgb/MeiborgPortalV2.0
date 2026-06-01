import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MemberContext {
  full_name?: string;
  position?: string | null;
  department?: string | null;
}

const FORM_TABS: Record<string, { label: string; fields: Array<{ key: string; label: string }> }> = {
  "Dental Cards": {
    label: "Dental Card Request",
    fields: [
      { key: "full_name", label: "Full Name" },
      { key: "company", label: "Company (MBI, Logistics, ENT, Ware, or SAE)" },
      { key: "dob", label: "Date of Birth" },
      { key: "dependents", label: "Dependents to add (names + DOBs, or 'none')" },
    ],
  },
  "Daycare Waiver": {
    label: "Drop-In Daycare Waiver",
    fields: [
      { key: "child_name", label: "Child's Full Name" },
      { key: "child_dob", label: "Child's Date of Birth" },
      { key: "parent_name", label: "Parent / Guardian Full Name" },
      { key: "parent_phone", label: "Parent / Guardian Phone Number" },
      { key: "emergency_contact", label: "Emergency Contact Name & Phone" },
      { key: "allergies", label: "Allergies or Medical Notes (or 'none')" },
      { key: "signature_name", label: "Your name as signature" },
    ],
  },
  "Direct Deposit": {
    label: "Direct Deposit Authorization",
    fields: [
      { key: "full_name", label: "Employee Full Name" },
      { key: "employee_id", label: "Employee ID (or 'N/A')" },
      { key: "bank_name", label: "Bank Name" },
      { key: "account_type", label: "Account Type (Checking or Savings)" },
      { key: "routing_number", label: "Routing Number (9 digits)" },
      { key: "account_number", label: "Account Number" },
      { key: "amount_or_percent", label: "Amount or % to deposit (or 'Full amount')" },
    ],
  },
  "MeiCares": {
    label: "Mei-Cares Payroll Deduction Authorization",
    fields: [
      { key: "full_name", label: "Employee Full Name" },
      { key: "department", label: "Department / Company" },
      { key: "deduction_amount", label: "Monthly Deduction Amount ($)" },
      { key: "start_date", label: "Start Date (MM/YYYY)" },
      { key: "signature_name", label: "Your name as signature" },
    ],
  },
};

interface PortalDoc {
  name: string;
  content: string;
}

async function fetchCompanyDocs(): Promise<PortalDoc[]> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return [];

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: companyFolder } = await supabase
    .from("portal_folders")
    .select("id")
    .ilike("label", "Company Docs")
    .maybeSingle();

  if (!companyFolder?.id) return [];

  const { data: tabs } = await supabase
    .from("portal_tabs")
    .select("id")
    .eq("folder_id", companyFolder.id);

  const tabIds = (tabs ?? []).map((t: { id: string }) => t.id);
  if (tabIds.length === 0) return [];

  const { data: files } = await supabase
    .from("portal_tab_files")
    .select("file_name, file_url, file_type, tab_id, portal_tabs(label, portal_folders(label))")
    .in("tab_id", tabIds)
    .not("file_type", "eq", "text/uri-list")
    .order("created_at");

  if (!files || files.length === 0) return [];

  const docs: PortalDoc[] = [];

  for (const file of files) {
    const isText =
      file.file_type?.includes("text") ||
      file.file_type?.includes("word") ||
      file.file_type?.includes("document");

    if (!isText) continue;

    try {
      const res = await fetch(file.file_url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;

      const tab = file.portal_tabs as { label: string; portal_folders: { label: string } | null } | null;
      const tabLabel = tab?.label ?? "Portal";
      const folderLabel = tab?.portal_folders?.label ?? null;
      const docName = folderLabel ? `${folderLabel} / ${tabLabel} / ${file.file_name}` : `${tabLabel} / ${file.file_name}`;

      const text = await res.text();
      docs.push({ name: docName, content: text.slice(0, 30000) });
    } catch {
      // skip unreadable files
    }
  }

  return docs;
}

function buildSystemPrompt(member: MemberContext, docs: PortalDoc[], formContext?: string, formFields?: Record<string, string>): string {
  const name = member.full_name ?? "there";
  const firstName = name.split(" ")[0];
  const pos = member.position ?? "team member";
  const dept = member.department ?? "Meiborg";

  let prompt = `You are MeiGuy, a helpful HR and company assistant for ${firstName} at Meiborg Companies. ${firstName} works as ${pos} in the ${dept} department.

You specialize in answering questions from the Employee Handbook and Company Docs, and helping employees fill out HR forms. Be warm, clear, and concise. Use plain language.

## What You Can Help With
1. Answer Employee Handbook and company policy questions (PTO, FMLA, dress code, benefits, etc.)
2. Help fill out HR forms: Direct Deposit, Dental Cards, Daycare Waiver, MeiCares
3. Explain payroll, benefits, and leave policies
4. Guide through company procedures

## HR Forms
When helping with a form, ask fields one or two at a time. Once all fields are collected, present a summary and ask for confirmation. When confirmed, respond with a form submission confirmation and include the text FORM_SUBMIT: followed by a JSON object with the fields.

## Company Context
Meiborg Companies is a logistics and transportation company with divisions: MBI, Logistics, ENT, Ware, SAE, Orbit Fuels, and 3PL.
${firstName}'s role: ${pos} in ${dept}.

Keep answers focused on HR policies and company information. Be genuinely helpful and friendly.`;

  if (docs.length > 0) {
    prompt += "\n\n## COMPANY DOCUMENTS\n";
    for (const d of docs) {
      prompt += `\n### ${d.name}\n${d.content}\n`;
    }
  }

  if (formContext) {
    const tabName = formContext.includes(" > ") ? formContext.split(" > ")[1].trim() : formContext;
    const formDef = FORM_TABS[tabName];
    if (formDef) {
      prompt += `\n\nCurrently helping with the "${formDef.label}" form. Required fields: ${JSON.stringify(formDef.fields)}.`;
    }
  }

  if (formFields && Object.keys(formFields).length > 0) {
    prompt += `\n\nFields already collected: ${JSON.stringify(formFields)}.`;
  }

  return prompt;
}

async function sendFormEmail(formType: string, fields: Record<string, string>, employeeName: string): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const fieldRows = Object.entries(fields)
    .map(([k, v]) => `<tr><td style="padding:6px 12px;font-weight:600;color:#4a4844;background:#f5f3ee;border-bottom:1px solid #e4e2dc;">${k.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</td><td style="padding:6px 12px;color:#2c2a27;border-bottom:1px solid #e4e2dc;">${v}</td></tr>`)
    .join("");

  const html = `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;"><div style="background:#2c2a27;padding:24px 32px;"><h1 style="color:#f5f3ee;margin:0;font-size:20px;font-weight:600;">Meiborg Companies</h1><p style="color:#9a9690;margin:4px 0 0;font-size:14px;">HR Form Submission</p></div><div style="padding:32px;"><h2 style="color:#2c2a27;margin:0 0 4px;">${formType}</h2><p style="color:#6b6865;margin:0 0 24px;font-size:14px;">Submitted by <strong>${employeeName}</strong> on ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p><table style="width:100%;border-collapse:collapse;">${fieldRows}</table><p style="color:#9a9690;font-size:12px;margin-top:24px;">Submitted via MeiGuy · Meiborg Employee Portal</p></div></div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "MeiGuy <onboarding@resend.dev>",
      to: ["dmarcum@meiborginc.com"],
      subject: `[Form Submission] ${formType} — ${employeeName}`,
      html,
    }),
  });

  return res.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { messages, formContext, formFields, memberContext } = await req.json() as {
      messages: Array<{ role: string; content: string }>;
      formContext?: string;
      formFields?: Record<string, string>;
      memberContext?: MemberContext;
    };

    const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const member = memberContext ?? {};
    const docs = await fetchCompanyDocs();
    const systemPrompt = buildSystemPrompt(member, docs, formContext, formFields);

    // Build Gemini contents array — system instruction + conversation history
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const geminiBody = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      },
    };

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      throw new Error(`Gemini API error: ${err}`);
    }

    const geminiData = await geminiRes.json();
    const reply: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Sorry, I couldn't generate a response.";

    // Detect form submission pattern in reply
    let emailSent = false;
    const submitMatch = reply.match(/FORM_SUBMIT:\s*(\{[\s\S]*?\})/);
    if (submitMatch) {
      try {
        const parsed = JSON.parse(submitMatch[1]);
        const tabName = formContext?.includes(" > ") ? formContext.split(" > ")[1].trim() : (formContext ?? "HR Form");
        emailSent = await sendFormEmail(tabName, parsed, member.full_name ?? "Employee");
      } catch {
        // form parsing failed, skip email
      }
    }

    // Strip the FORM_SUBMIT marker from the visible reply
    const cleanReply = reply.replace(/FORM_SUBMIT:\s*\{[\s\S]*?\}/, "").trim();

    return new Response(JSON.stringify({ reply: cleanReply || reply, emailSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

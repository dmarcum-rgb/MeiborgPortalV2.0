import Anthropic from "npm:@anthropic-ai/sdk@0.30.1";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Access tiers ──────────────────────────────────────────────────────────────

const EXECUTIVE_NAMES = ["james cooper", "zach meiborg", "megan dierks", "tony askins", "dallas marcum"];

function isExecutive(fullName: string): boolean {
  return EXECUTIVE_NAMES.includes(fullName.toLowerCase().trim());
}

// ── Role profiles ─────────────────────────────────────────────────────────────

interface MemberContext {
  full_name?: string;
  position?: string | null;
  department?: string | null;
}

interface RoleProfile {
  persona: string;
  capabilities: string[];
  tone: string;
}

function buildRoleProfile(member: MemberContext): RoleProfile {
  const name = member.full_name ?? "there";
  const firstName = name.split(" ")[0];
  const pos = (member.position ?? "").toLowerCase();
  const dept = (member.department ?? "").toLowerCase();

  // ── Individual executive profiles ──
  if (name.toLowerCase().includes("zach meiborg")) {
    return {
      persona: `You are MeiGuy, a senior strategic AI advisor built specifically for ${name}, CEO of Meiborg Companies. You think at the executive level. You can build financial reports, analyze company data, model scenarios, and answer anything about operations, people, strategy, or market positioning. You have access to all company documents and data.`,
      capabilities: [
        "Build custom financial reports and P&L summaries",
        "Analyze operational metrics across all divisions",
        "Model strategic scenarios and growth projections",
        "Summarize documents, handbooks, and company data",
        "Provide executive briefings on any company topic",
      ],
      tone: "Direct, strategic, and data-driven. Speak peer-to-peer with a CEO. Lead with insight, not explanation.",
    };
  }

  if (name.toLowerCase().includes("james cooper")) {
    return {
      persona: `You are MeiGuy, a senior operational AI advisor built specifically for ${name}, COO of Meiborg Companies. You have full access to all company data, documents, and operational details. You excel at financial reporting, operational analysis, process optimization, and cross-departmental coordination.`,
      capabilities: [
        "Build operational and financial reports",
        "Analyze fleet, dispatch, and logistics performance",
        "Cross-departmental process optimization",
        "Budget and cost analysis",
        "Strategic operational planning",
      ],
      tone: "Precise, operational, and analytical. COO mindset — focus on execution and efficiency.",
    };
  }

  if (name.toLowerCase().includes("megan dierks")) {
    return {
      persona: `You are MeiGuy, an HR-specialized AI assistant built specifically for ${name}, HR Director at Meiborg Companies. You have full access to all company documents, employee data, policies, and HR processes. You are an expert in Meiborg's HR policies, benefits, compliance, onboarding, and workforce management. You can draft HR documents, policy summaries, and help manage HR workflows.`,
      capabilities: [
        "Answer any HR policy or benefit question in depth",
        "Draft HR documents, offer letters, and policy memos",
        "Guide form submissions (Direct Deposit, Dental Cards, Daycare Waiver, MeiCares)",
        "Summarize the Employee Handbook by section",
        "Build reports on headcount, departments, and roles",
        "Help with compliance, FMLA, and onboarding checklists",
      ],
      tone: "Warm, professional, and thorough. HR mindset — compassionate but precise and policy-aware.",
    };
  }

  if (name.toLowerCase().includes("tony askins")) {
    return {
      persona: `You are MeiGuy, a creative and marketing-focused AI assistant built specifically for ${name}, CMO of Meiborg Companies. You have full access to all company documents and data. You specialize in marketing strategy, brand voice, content creation, and creative direction. You are exceptional at generating detailed image prompts for marketing visuals, campaign concepts, and copy — bring big creative energy.`,
      capabilities: [
        "Generate detailed image generation prompts for marketing visuals and designs",
        "Draft marketing copy, ads, social posts, and full campaigns",
        "Build brand messaging frameworks and creative briefs",
        "Brainstorm campaign concepts and market positioning",
        "Summarize company data to support marketing narratives",
        "Create content calendars, launch plans, and creative direction docs",
      ],
      tone: "Creative, energetic, and brand-focused. Think like a CMO — big picture creative meets strategic execution. Be bold with ideas.",
    };
  }

  if (name.toLowerCase().includes("dallas marcum")) {
    return {
      persona: `You are MeiGuy, an advanced AI system built and operated by ${name}, AI Execution Lead at Meiborg. You have full admin access to all company data, documents, portal content, and technical systems. You are a technical co-pilot for AI development, automation, system architecture, and anything else Dallas needs.`,
      capabilities: [
        "Technical AI and system architecture discussions",
        "Full access to all portal documents and company data",
        "Help build and debug AI workflows and prompts",
        "Financial and operational reporting",
        "Any HR, marketing, or operational task across all departments",
      ],
      tone: "Technical, peer-level, and efficient. Dallas built this — speak accordingly.",
    };
  }

  // ── Department-based profiles (manager vs. individual contributor) ──

  const isMgr = pos.includes("manager") || pos.includes("director") || pos.includes("supervisor") ||
    pos.includes("general manager") || pos.includes("controller") || pos.includes("lead") ||
    pos.includes("senior") || pos.includes("coordinator");

  if (dept === "accounting" || pos.includes("accounting") || pos.includes("billing") || pos.includes("payroll") || pos.includes("controller") || pos.includes("accounts")) {
    return isMgr ? {
      persona: `You are MeiGuy, a knowledgeable assistant for ${firstName}, ${member.position} in the Accounting department at Meiborg. You support both ${firstName}'s personal HR needs and their role overseeing the accounting team — policy questions, payroll procedures, benefits administration, and team-level guidance. You have access to the Company Docs folder.`,
      capabilities: [
        "Answer detailed payroll, billing, and accounting policy questions",
        "Help fill out and explain HR forms for self and team members",
        "Draft policy summaries and procedure memos",
        "Explain benefits, deductions, and PTO policies in depth",
        "Provide team-level guidance on HR procedures",
      ],
      tone: "Professional, precise, and managerial. Speak to a department leader who needs accurate, actionable answers.",
    } : {
      persona: `You are MeiGuy, a helpful assistant for ${firstName} in the Accounting department at Meiborg. You focus on HR support: company policies, benefits, payroll questions, PTO, and form assistance. You have access to the Company Docs folder.`,
      capabilities: [
        "Answer Employee Handbook and Company Docs questions",
        "Help fill out HR forms (Direct Deposit, Dental Cards, Daycare Waiver, MeiCares)",
        "Explain benefit and payroll policies",
        "Guide through PTO and leave procedures",
      ],
      tone: "Friendly, clear, and accurate. Detail-oriented and thorough.",
    };
  }

  if (dept === "dispatch" || pos.includes("dispatch") || pos.includes("driver leader") || pos.includes("network") || pos.includes("planner")) {
    return isMgr ? {
      persona: `You are MeiGuy, a helpful assistant for ${firstName}, ${member.position} on the Dispatch team at Meiborg. You support ${firstName}'s team-level responsibilities — overtime policies, reimbursement procedures, team benefits, and HR guidance for a fast-moving operation. You have access to the Company Docs folder.`,
      capabilities: [
        "Answer Company Docs questions with team-management context",
        "Explain overtime, PTO, and shift-based leave policies",
        "Help with travel reimbursement procedures for self and team",
        "Guide through HR forms and benefits",
      ],
      tone: "Fast, direct, and leadership-focused. Efficiency matters.",
    } : {
      persona: `You are MeiGuy, a helpful assistant for ${firstName} on the Dispatch team at Meiborg. You have access to the Company Docs folder. You understand dispatch work is fast-paced, so you keep answers clear and to the point.`,
      capabilities: [
        "Answer Company Docs questions quickly and clearly",
        "Help fill out HR forms",
        "Explain PTO, leave, and benefits policies",
        "Reference travel reimbursement and expense procedures",
      ],
      tone: "Fast and direct. Efficiency matters, no fluff.",
    };
  }

  if (dept === "csr" || pos.includes("customer service") || pos.includes("receptionist")) {
    return isMgr ? {
      persona: `You are MeiGuy, a helpful assistant for ${firstName}, ${member.position} on the Customer Service team at Meiborg. You support ${firstName}'s leadership role — conduct policies, team onboarding, benefits, and HR guidance. You have access to the Company Docs folder.`,
      capabilities: [
        "Answer handbook and HR policy questions with leadership context",
        "Help explain benefits and policies to team members",
        "Guide through HR forms",
        "Provide policy summaries for team management",
      ],
      tone: "Professional and warm. Team-leadership mindset.",
    } : {
      persona: `You are MeiGuy, a friendly assistant for ${firstName} on the Customer Service team at Meiborg. You have access to the Company Docs folder — HR policies, benefits, forms, and company resources.`,
      capabilities: [
        "Answer handbook and HR policy questions",
        "Help fill out HR forms",
        "Explain benefits and MeiPerks",
        "Guide through company procedures",
      ],
      tone: "Warm and helpful. Patient and thorough.",
    };
  }

  if (dept === "it" || pos.includes("engineer") || pos.includes("network specialist") || pos.includes("systems") || pos.includes("director of it")) {
    return isMgr ? {
      persona: `You are MeiGuy, a helpful assistant for ${firstName}, ${member.position} in the IT department at Meiborg. You support both ${firstName}'s personal HR needs and their team oversight — remote work policies, equipment guidelines, benefits, and HR procedures. You have access to the Company Docs folder.`,
      capabilities: [
        "Answer IT-related policy and handbook questions",
        "Explain remote work and equipment use policies",
        "Help fill out HR forms",
        "Provide team-level HR and benefits guidance",
      ],
      tone: "Precise and efficient. Leadership mindset — clear and authoritative.",
    } : {
      persona: `You are MeiGuy, a helpful assistant for ${firstName} in the IT department at Meiborg. You have access to Company Docs and can assist with HR policies, employee benefits, forms, and company resources.`,
      capabilities: [
        "Answer handbook and company policy questions",
        "Help fill out HR forms",
        "Explain benefit and payroll procedures",
        "Reference company documents and resources",
      ],
      tone: "Precise and efficient. Clear, accurate, minimal fluff.",
    };
  }

  if (dept === "sales" || pos.includes("sales") || pos.includes("business development") || pos.includes("data analyst")) {
    return {
      persona: `You are MeiGuy, a helpful assistant for ${firstName} on the Sales team at Meiborg. You have access to Company Docs and can help with HR policies, benefits, travel reimbursement, and company resources that support your work.`,
      capabilities: [
        "Answer handbook and HR policy questions",
        "Help with travel reimbursement and expense procedures",
        "Fill out HR forms",
        "Explain benefits and MeiPerks",
      ],
      tone: "Upbeat and efficient. Results-focused and clear.",
    };
  }

  if (dept === "fleet" || pos.includes("fleet") || pos.includes("operations") || pos.includes("recruiting")) {
    return isMgr ? {
      persona: `You are MeiGuy, a helpful assistant for ${firstName}, ${member.position} in Fleet Operations at Meiborg. You support ${firstName}'s management role — team policies, HR procedures, leave management, and operations-related HR guidance. You have access to the Company Docs folder.`,
      capabilities: [
        "Answer company policy and handbook questions with fleet management context",
        "Help fill out HR forms for self and team members",
        "Explain benefits, PTO, and leave policies in depth",
        "Summarize operations-related HR documents",
      ],
      tone: "Practical, direct, and leadership-focused.",
    } : {
      persona: `You are MeiGuy, a helpful assistant for ${firstName} in Fleet Operations at Meiborg. You have access to Company Docs and can help with HR policies, benefits, forms, and company resources.`,
      capabilities: [
        "Answer company policy and handbook questions",
        "Help fill out HR forms",
        "Explain benefits, PTO, and leave procedures",
        "Reference safety and operations documents",
      ],
      tone: "Practical and direct. No-nonsense and clear.",
    };
  }

  if (dept === "logs" || dept === "3pl" || pos.includes("logistics") || pos.includes("carrier") || pos.includes("safety") || pos.includes("dot")) {
    return isMgr ? {
      persona: `You are MeiGuy, a helpful assistant for ${firstName}, ${member.position} at Meiborg. You support both ${firstName}'s HR needs and their team leadership — compliance policies, safety documentation, leave procedures, and team benefits. You have access to the Company Docs folder.`,
      capabilities: [
        "Answer safety, compliance, and handbook policy questions",
        "Help with compliance and DOT documentation questions",
        "Provide team-level guidance on HR procedures",
        "Fill out and explain HR forms",
        "Explain benefits and leave policies",
      ],
      tone: "Reliable and thorough. Compliance and accuracy matter, with a leadership perspective.",
    } : {
      persona: `You are MeiGuy, a helpful assistant for ${firstName} in the Logistics/3PL team at Meiborg. You have access to Company Docs and can help with HR policies, benefits, compliance-related forms, and company resources.`,
      capabilities: [
        "Answer handbook and HR policy questions",
        "Help with compliance and safety documentation questions",
        "Fill out HR forms",
        "Explain benefits and leave policies",
      ],
      tone: "Reliable and thorough. Compliance and accuracy matter.",
    };
  }

  // Default
  return {
    persona: `You are MeiGuy, a helpful HR and company assistant for ${firstName} at Meiborg Companies. You have access to the Company Docs folder including the Employee Handbook, benefits, HR forms, and company resources.`,
    capabilities: [
      "Answer Employee Handbook and Company Docs questions",
      "Help fill out HR forms",
      "Explain benefits, PTO, and leave policies",
      "Guide through company procedures",
    ],
    tone: "Warm, professional, and helpful.",
  };
}

// ── HR Forms ──────────────────────────────────────────────────────────────────

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

// ── Document fetching ─────────────────────────────────────────────────────────

interface PortalDoc {
  name: string;
  content: string;
  type: "pdf" | "text";
}

async function fetchPortalDocuments(execAccess: boolean, accountingAccess: boolean): Promise<PortalDoc[]> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return [];

  const supabase = createClient(supabaseUrl, serviceKey);

  let tabIds: string[] | null = null;

  if (!execAccess) {
    // Always include Company Docs folder
    const { data: companyFolder } = await supabase
      .from("portal_folders")
      .select("id")
      .ilike("label", "Company Docs")
      .maybeSingle();

    const folderIds: string[] = companyFolder?.id ? [companyFolder.id] : [];

    // Also include Accounting Projects folder if user has accounting access
    if (accountingAccess) {
      const { data: acctFolder } = await supabase
        .from("portal_folders")
        .select("id")
        .ilike("label", "Accounting Projects")
        .maybeSingle();
      if (acctFolder?.id) folderIds.push(acctFolder.id);
    }

    if (folderIds.length === 0) return [];

    const { data: tabs } = await supabase
      .from("portal_tabs")
      .select("id")
      .in("folder_id", folderIds);

    tabIds = (tabs ?? []).map((t: { id: string }) => t.id);
    if (tabIds.length === 0) return [];
  }

  let query = supabase
    .from("portal_tab_files")
    .select("file_name, file_url, file_type, tab_id, portal_tabs(label, portal_folders(label))")
    .not("file_type", "eq", "text/uri-list")
    .order("created_at");

  if (tabIds) {
    query = query.in("tab_id", tabIds);
  }

  const { data: files } = await query;
  if (!files || files.length === 0) return [];

  const docs: PortalDoc[] = [];

  for (const file of files) {
    const isSupportedType =
      file.file_type === "application/pdf" ||
      file.file_type?.includes("text") ||
      file.file_type?.includes("word") ||
      file.file_type?.includes("document");

    if (!isSupportedType) continue;

    try {
      const res = await fetch(file.file_url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;

      const tab = file.portal_tabs as { label: string; portal_folders: { label: string } | null } | null;
      const tabLabel = tab?.label ?? "Portal";
      const folderLabel = tab?.portal_folders?.label ?? null;
      const docName = folderLabel ? `${folderLabel} / ${tabLabel} / ${file.file_name}` : `${tabLabel} / ${file.file_name}`;

      if (file.file_type === "application/pdf") {
        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        docs.push({ name: docName, content: btoa(binary), type: "pdf" });
      } else {
        const text = await res.text();
        docs.push({ name: docName, content: text.slice(0, 40000), type: "text" });
      }
    } catch {
      // skip unreadable files silently
    }
  }

  return docs;
}

async function fetchAccountingData(supabaseUrl: string, serviceKey: string): Promise<string> {
  const supabase = createClient(supabaseUrl, serviceKey);

  // Get all accounting folder tabs
  const { data: acctFolder } = await supabase
    .from("portal_folders")
    .select("id")
    .ilike("label", "Accounting Projects")
    .maybeSingle();

  if (!acctFolder?.id) return "";

  const { data: tabs } = await supabase
    .from("portal_tabs")
    .select("id, label")
    .eq("folder_id", acctFolder.id)
    .order("sort_order");

  if (!tabs || tabs.length === 0) return "";

  const tabIds = tabs.map((t: { id: string }) => t.id);
  const tabMap = Object.fromEntries(tabs.map((t: { id: string; label: string }) => [t.id, t.label]));

  const sections: string[] = [];

  // Fetch portal_blocks for each tab (text content)
  const { data: blocks } = await supabase
    .from("portal_blocks")
    .select("tab_id, type, content")
    .in("tab_id", tabIds)
    .in("type", ["text", "heading", "callout"])
    .order("sort_order");

  if (blocks && blocks.length > 0) {
    const byTab: Record<string, string[]> = {};
    for (const b of blocks) {
      if (!byTab[b.tab_id]) byTab[b.tab_id] = [];
      byTab[b.tab_id].push(b.content ?? "");
    }
    for (const [tabId, lines] of Object.entries(byTab)) {
      sections.push(`### ${tabMap[tabId]} (notes)\n${lines.join("\n")}`);
    }
  }

  // Fetch live AR report data for each tab
  const { data: arReports } = await supabase
    .from("ar_reports")
    .select("tab_id, report_date, report_data, locked, uploaded_by, created_at")
    .in("tab_id", tabIds)
    .order("created_at", { ascending: false });

  if (arReports && arReports.length > 0) {
    // One report per tab (most recent)
    const seen = new Set<string>();
    for (const r of arReports) {
      if (seen.has(r.tab_id)) continue;
      seen.add(r.tab_id);

      const tabLabel = tabMap[r.tab_id] ?? "Report";
      const customers = (r.report_data ?? []) as Array<Record<string, unknown>>;
      const locked = r.locked ? "LOCKED" : "unlocked";
      const uploadedBy = r.uploaded_by ? ` · uploaded by ${r.uploaded_by}` : "";
      const reportDate = r.report_date ? ` · report date: ${r.report_date}` : "";

      let summary = `### ${tabLabel} (${locked}${reportDate}${uploadedBy})\n`;
      summary += `Total customers: ${customers.length}\n`;

      // Summarize key financial fields — data is stored with nested `totals` object per customer
      const totals = customers.reduce((acc, c) => {
        const t = (c.totals ?? c) as Record<string, unknown>;
        acc.balance += Number(t.balance ?? 0);
        acc.current += Number(t.current ?? 0);
        acc.over30 += Number(t.over30 ?? 0);
        acc.over45 += Number(t.over45 ?? 0);
        acc.over60 += Number(t.over60 ?? 0);
        acc.over90 += Number(t.over90 ?? 0);
        return acc;
      }, { balance: 0, current: 0, over30: 0, over45: 0, over60: 0, over90: 0 });

      const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      summary += `Total balance: ${fmt(totals.balance)}\n`;
      summary += `Current: ${fmt(totals.current)} | 30+: ${fmt(totals.over30)} | 45+: ${fmt(totals.over45)} | 60+: ${fmt(totals.over60)} | 90+: ${fmt(totals.over90)}\n`;

      // List each customer with their balance breakdown
      summary += "\nCustomer detail:\n";
      for (const c of customers) {
        const t = (c.totals ?? c) as Record<string, unknown>;
        const bal = Number(t.balance ?? 0);
        const o90 = Number(t.over90 ?? 0);
        const o60 = Number(t.over60 ?? 0);
        const o30 = Number(t.over30 ?? 0);
        if (bal === 0) continue; // skip zero-balance customers to keep context concise
        summary += `- ${c.name ?? c.code} (${c.code}): balance ${fmt(bal)}`;
        if (o90 > 0) summary += ` [90+ DAYS: ${fmt(o90)}]`;
        else if (o60 > 0) summary += ` [60+ days: ${fmt(o60)}]`;
        else if (o30 > 0) summary += ` [30+ days: ${fmt(o30)}]`;
        summary += "\n";
      }

      sections.push(summary);
    }
  }

  return sections.length > 0 ? sections.join("\n\n") : "";
}

// ── Manager review helpers ─────────────────────────────────────────────────────

interface TeamMemberRow {
  id: string;
  full_name: string;
  supervisor_id: string | null;
  start_date: string | null;
}

function nextAnniversary(startDate: string): string {
  const today = new Date();
  const start = new Date(startDate + "T00:00:00");
  const thisYear = new Date(today.getFullYear(), start.getMonth(), start.getDate());
  const next = thisYear <= today
    ? new Date(today.getFullYear() + 1, start.getMonth(), start.getDate())
    : thisYear;
  return next.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function daysUntil(startDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate + "T00:00:00");
  const thisYear = new Date(today.getFullYear(), start.getMonth(), start.getDate());
  const next = thisYear <= today
    ? new Date(today.getFullYear() + 1, start.getMonth(), start.getDate())
    : thisYear;
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

async function fetchManagerReviewContext(
  supabaseUrl: string,
  serviceKey: string,
  memberFullName: string
): Promise<string> {
  if (!memberFullName) return "";

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: allMembers } = await db
    .from("team_members")
    .select("id, full_name, supervisor_id, start_date")
    .order("full_name");

  if (!allMembers || allMembers.length === 0) return "";

  const members = allMembers as TeamMemberRow[];
  const me = members.find(m => m.full_name.toLowerCase() === memberFullName.toLowerCase());
  if (!me) return "";

  // Who I supervise
  const directs = members.filter(m => m.supervisor_id === me.id && m.start_date);

  // Who my supervisor is
  const myBoss = me.supervisor_id ? members.find(m => m.id === me.supervisor_id) : null;

  if (directs.length === 0 && !me.start_date) return "";

  let context = "## Manager Review Schedule\n";
  context += "Annual reviews occur on each employee's start date anniversary.\n\n";

  if (directs.length > 0) {
    // Sort by days until next review ascending
    const sorted = directs
      .filter(d => d.start_date)
      .sort((a, b) => daysUntil(a.start_date!) - daysUntil(b.start_date!));

    context += `### Reviews ${memberFullName.split(" ")[0]} Conducts (Direct Reports)\n`;
    for (const d of sorted) {
      const days = daysUntil(d.start_date!);
      const dateStr = nextAnniversary(d.start_date!);
      const urgency = days <= 30 ? ` *** UPCOMING IN ${days} DAYS ***` : ` (in ${days} days)`;
      context += `- ${d.full_name}: ${dateStr}${urgency}\n`;
    }
  }

  if (myBoss && me.start_date) {
    const days = daysUntil(me.start_date);
    const dateStr = nextAnniversary(me.start_date);
    context += `\n### ${memberFullName.split(" ")[0]}'s Own Review\n`;
    context += `- Reviewed by: ${myBoss.full_name}\n`;
    context += `- Date: ${dateStr} (in ${days} days)\n`;
  }

  return context;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { messages, formContext, formFields, memberContext, accountingAccess } = await req.json() as {
      messages: Array<{ role: string; content: string }>;
      formContext?: string;
      formFields?: Record<string, string>;
      memberContext?: MemberContext;
      accountingAccess?: boolean;
    };

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "" });

    const member = memberContext ?? {};
    const execAccess = isExecutive(member.full_name ?? "");
    const hasAccountingAccess = accountingAccess === true || execAccess;
    const roleProfile = buildRoleProfile(member);
    const firstName = (member.full_name ?? "").split(" ")[0] || "there";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const [docs, accountingData, reviewContext] = await Promise.all([
      fetchPortalDocuments(execAccess, hasAccountingAccess),
      hasAccountingAccess ? fetchAccountingData(supabaseUrl, serviceKey) : Promise.resolve(""),
      fetchManagerReviewContext(supabaseUrl, serviceKey, member.full_name ?? ""),
    ]);

    // Build system prompt
    let systemContent = `${roleProfile.persona}

## Tone
${roleProfile.tone}

## What You Can Do For ${firstName}
${roleProfile.capabilities.map((c, i) => `${i + 1}. ${c}`).join("\n")}

## HR Forms
You can guide ${firstName} through these forms conversationally:
- Dental Cards, Daycare Waiver, Direct Deposit, MeiCares
Ask fields one or two at a time. Present a summary once complete and ask them to confirm. Then call submit_form.

## Company Context
Meiborg Companies is a logistics and transportation company with divisions: MBI, Logistics, ENT, Ware, SAE, Orbit Fuels, and 3PL.
${firstName}'s role: ${member.position ?? "unknown"} in the ${member.department ?? "unknown"} department.

Be the absolute best assistant this person has ever used. Know their job, anticipate their needs, give genuinely useful answers.`;

    const textDocs = docs.filter(d => d.type === "text");
    const pdfDocs = docs.filter(d => d.type === "pdf");

    if (textDocs.length > 0) {
      systemContent += "\n\n## PORTAL DOCUMENTS\n";
      for (const d of textDocs) {
        systemContent += `\n### ${d.name}\n${d.content}\n`;
      }
    }

    if (accountingData) {
      systemContent += `\n\n## ACCOUNTING PROJECTS DATA\nThe following is live data from the Accounting Projects folder. Use it to answer questions about balances, aging, customers, and financial status.\n\n${accountingData}`;
    }

    if (reviewContext) {
      systemContent += `\n\n${reviewContext}`;
    }

    if (formContext) {
      const tabName = formContext.includes(" > ") ? formContext.split(" > ")[1].trim() : formContext;
      const folderName = formContext.includes(" > ") ? formContext.split(" > ")[0].trim() : null;
      const locationDesc = folderName ? `"${tabName}" (inside the "${folderName}" folder)` : `"${tabName}"`;
      systemContent += `\n\nCurrently viewing: ${locationDesc}. If this is a form tab, proactively offer to help fill it out. Required fields: ${JSON.stringify(FORM_TABS[tabName]?.fields ?? [])}.`;
    }
    if (formFields && Object.keys(formFields).length > 0) {
      systemContent += `\n\nFields already collected: ${JSON.stringify(formFields)}.`;
    }

    const tools: Anthropic.Tool[] = [
      {
        name: "submit_form",
        description: "Submit a completed HR form by email to HR. Only call when user has confirmed all details.",
        input_schema: {
          type: "object",
          properties: {
            form_type: { type: "string" },
            fields: { type: "object" },
            employee_name: { type: "string" },
          },
          required: ["form_type", "fields", "employee_name"],
        },
      },
    ];

    // Inject PDFs as document blocks into the last user message
    let processedMessages = [...messages];
    if (pdfDocs.length > 0 && processedMessages.length > 0) {
      const lastMsg = processedMessages[processedMessages.length - 1];
      if (lastMsg.role === "user") {
        const pdfBlocks: Anthropic.DocumentBlockParam[] = pdfDocs.map(pdf => ({
          type: "document" as const,
          source: { type: "base64" as const, media_type: "application/pdf" as const, data: pdf.content },
          title: pdf.name,
          context: `Portal document: ${pdf.name}`,
          citations: { enabled: true },
        }));
        processedMessages[processedMessages.length - 1] = {
          role: "user",
          content: [
            ...pdfBlocks,
            { type: "text", text: typeof lastMsg.content === "string" ? lastMsg.content : JSON.stringify(lastMsg.content) },
          ],
        };
      }
    }

    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: systemContent,
      messages: processedMessages,
      tools,
    });

    if (response.stop_reason === "tool_use") {
      const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (toolUse?.name === "submit_form") {
        const input = toolUse.input as { form_type: string; fields: Record<string, string>; employee_name: string };
        const emailResult = await sendFormEmail(input.form_type, input.fields, input.employee_name);

        const followUp = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 512,
          system: systemContent,
          messages: [
            ...processedMessages,
            { role: "assistant", content: response.content },
            {
              role: "user",
              content: [{ type: "tool_result", tool_use_id: toolUse.id, content: emailResult ? "Email sent successfully." : "Email sending failed." }],
            },
          ],
          tools,
        });

        const text = followUp.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
        return new Response(JSON.stringify({ reply: text, emailSent: emailResult }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
    return new Response(JSON.stringify({ reply: text, emailSent: false }), {
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

// ── Email helper ──────────────────────────────────────────────────────────────

async function sendFormEmail(formType: string, fields: Record<string, string>, employeeName: string): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const fieldRows = Object.entries(fields)
    .map(([k, v]) => `<tr><td style="padding:6px 12px;font-weight:600;color:#4a4844;background:#f5f3ee;border-bottom:1px solid #e4e2dc;">${k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</td><td style="padding:6px 12px;color:#2c2a27;border-bottom:1px solid #e4e2dc;">${v}</td></tr>`)
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

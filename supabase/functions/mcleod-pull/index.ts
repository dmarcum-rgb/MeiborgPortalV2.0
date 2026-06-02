import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BASE = "https://tms.meiborginc.com/ws";
const COMPANY = "TMS";
const AUTH = "Basic ZG1hcmN1bTpXZWxjb21lMk1laWJvcmcyMDI2IQ==";

const MCLEOD_HEADERS = {
  Authorization: AUTH,
  "X-com.mcleodsoftware.CompanyID": COMPANY,
  Accept: "application/json",
};

async function fetchAll(path: string, filters: Record<string, string>): Promise<unknown[]> {
  const rows: unknown[] = [];
  let offset = 0;
  while (true) {
    const params = new URLSearchParams({
      recordLength: "100",
      recordOffset: String(offset),
      ...filters,
    });
    const res = await fetch(`${BASE}${path}?${params}`, {
      headers: MCLEOD_HEADERS,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`McLeod ${res.status}: ${text}`);
    }
    const batch: unknown[] = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < 100) break;
    offset += 100;
  }
  return rows;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const report = url.searchParams.get("report");

    if (!report) {
      return new Response(JSON.stringify({ error: "Missing report parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data: unknown;

    if (report === "ar") {
      const rows = await fetchAll("/open_item/search", {
        "open_item.company_id": COMPANY,
        "open_item.record_type": "I",
      });
      data = { rows };
    } else if (report === "ap") {
      const rows = await fetchAll("/ap_open_item/search", {
        "ap_open_item.company_id": COMPANY,
      });
      data = { rows };
    } else if (report === "carrier") {
      const [openRows, histRows] = await Promise.all([
        fetchAll("/settlements/search", {
          "settlement.company_id": COMPANY,
          "settlement.payee_type": "C",
        }),
        fetchAll("/settlements/history/search", {
          "drs_settle_hist.company_id": COMPANY,
          "drs_settle_hist.payee_type": "C",
          "drs_settle_hist.pay_date": ">=t-90",
        }),
      ]);
      data = {
        open: openRows,
        history: histRows,
        _debug: {
          openSample: openRows[0] ?? null,
          histSample: histRows[0] ?? null,
          openCount: openRows.length,
          histCount: histRows.length,
        },
      };
    } else if (report === "unbilled") {
      const rows = await fetchAll("/orders/search", {
        "orders.company_id": COMPANY,
        "orders.ready_to_bill": "N",
        "orders.status": "D",
      });
      data = { rows };
    } else {
      return new Response(JSON.stringify({ error: "Unknown report type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

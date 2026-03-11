// Supabase Edge Function: reset-ai-usage
// Resets ai_scans_used and ai_url_imports_used for all users whose usage_period_start
// is in a previous month. Called via cron scheduler on the 1st of each month.
//
// Schedule in Supabase Dashboard: Functions > Schedules > "0 0 1 * *" (UTC)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

function currentMonthStart(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

Deno.serve(async (_req) => {
  try {
    const monthStart = currentMonthStart();

    // Only reset profiles whose period_start is before the current month
    const { data, error } = await supabase
      .from("profiles")
      .update({
        ai_scans_used: 0,
        ai_url_imports_used: 0,
        usage_period_start: monthStart,
        updated_at: new Date().toISOString(),
      })
      .lt("usage_period_start", monthStart);

    if (error) {
      console.error("reset-ai-usage error:", error.message);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const resetCount = Array.isArray(data) ? data.length : 0;
    console.log(`reset-ai-usage: reset ${resetCount} profiles for period ${monthStart}`);

    return new Response(JSON.stringify({ success: true, resetCount, period: monthStart }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("reset-ai-usage unexpected:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

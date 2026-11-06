import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

/**
 * GET /api/keep-alive
 *
 * Endpoint invocado por Vercel Cron una vez al día para evitar que Supabase
 * pause el proyecto por inactividad (plan gratuito).
 *
 * Protegido con CRON_SECRET: Vercel lo envía automáticamente en el header
 * Authorization cuando el cron lo llama. Cualquier otra petición sin el
 * secret correcto recibe 401.
 */
export async function GET(request: NextRequest) {
  // ── Verificación del secret ──────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Ping a Supabase ──────────────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Missing Supabase env vars" },
      { status: 500 },
    );
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey);

  // El RPC devuelve una constante y no consulta datos de estudiantes.
  const start = Date.now();
  const { data, error } = await supabase.rpc("keep_alive", {}, { get: true });
  const elapsed = Date.now() - start;

  if (error || data !== "ok") {
    const message = error?.message ?? "Unexpected response from keep_alive RPC";
    console.error("[keep-alive] Supabase ping failed:", message);
    return NextResponse.json(
      { ok: false, error: message, elapsed },
      { status: 500 },
    );
  }

  console.log(`[keep-alive] Supabase ping OK — ${elapsed}ms`);
  return NextResponse.json({ ok: true, elapsed, ts: new Date().toISOString() });
}

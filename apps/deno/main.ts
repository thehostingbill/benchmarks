const BOOT_ID = crypto.randomUUID();
const BOOT_AT = Date.now();

Deno.serve(() =>
  Response.json({
    platform: "deno",
    boot_id: BOOT_ID,
    uptime_ms: Date.now() - BOOT_AT,
    region: Deno.env.get("DENO_REGION") ?? null,
    now: Date.now(),
  }, { headers: { "cache-control": "no-store" } })
);

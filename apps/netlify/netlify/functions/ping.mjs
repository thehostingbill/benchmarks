const BOOT_ID = crypto.randomUUID();
const BOOT_AT = Date.now();

export default async () =>
  new Response(JSON.stringify({
    platform: "netlify",
    boot_id: BOOT_ID,
    uptime_ms: Date.now() - BOOT_AT,
    region: process.env.AWS_REGION || null,
    now: Date.now(),
  }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const config = { path: "/ping" };

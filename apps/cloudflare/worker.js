// Workers freeze the clock at global scope, so uptime_ms is not meaningful here; boot_id still
// identifies the isolate.
const BOOT_ID = crypto.randomUUID();
const BOOT_AT = Date.now();

export default {
  async fetch(request) {
    return Response.json({
      platform: "cloudflare",
      boot_id: BOOT_ID,
      uptime_ms: Date.now() - BOOT_AT,
      region: request.cf?.colo ?? null,
      now: Date.now(),
    }, { headers: { "cache-control": "no-store" } });
  },
};

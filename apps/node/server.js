import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

// A new BOOT_ID means a new instance served the request — that is what makes a request "cold".
const BOOT_ID = randomUUID();
const BOOT_AT = Date.now();
const env = process.env;

createServer((req, res) => {
  res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify({
    platform: env.BENCH_PLATFORM || "unknown",
    boot_id: BOOT_ID,
    uptime_ms: Date.now() - BOOT_AT,
    region: env.RENDER_REGION || env.FLY_REGION || env.KOYEB_REGION || env.RAILWAY_REPLICA_REGION || null,
    now: Date.now(),
  }));
}).listen(Number(env.PORT) || 3000);

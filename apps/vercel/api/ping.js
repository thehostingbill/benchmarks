import { randomUUID } from "node:crypto";

const BOOT_ID = randomUUID();
const BOOT_AT = Date.now();

export default function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  res.status(200).json({
    platform: "vercel",
    boot_id: BOOT_ID,
    uptime_ms: Date.now() - BOOT_AT,
    region: process.env.VERCEL_REGION || null,
    now: Date.now(),
  });
}

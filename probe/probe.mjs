// Usage: node probe/probe.mjs --endpoints endpoints.json --data <dir> [--rounds N]
// Default: for each endpoint, one "first" request (cold candidate) then 3 follow-ups (warm baseline).
// --rounds N: N rounds over all endpoints in a freshly shuffled order each round, so no endpoint
// always goes first.
// Appends one JSON line per request to <data>/YYYY-MM-DD.jsonl and updates <data>/last.json.
import https from "node:https";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, appendFile, mkdir } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({ options: { endpoints: { type: "string" }, data: { type: "string" }, rounds: { type: "string" } } });
const FOLLOW_UPS = 3;
const TIMEOUT_MS = 60_000;

function timedGet(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https:") ? https : http;
    const t0 = performance.now();
    const t = {};
    // a fresh agent per request: no connection reuse, so every request pays DNS + TCP + TLS like a new visitor
    const req = lib.get(url, { agent: new lib.Agent({ keepAlive: false }), headers: { "cache-control": "no-cache" } }, (res) => {
      t.ttfb = performance.now() - t0;
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        t.total = performance.now() - t0;
        let parsed = null;
        try { parsed = JSON.parse(body); } catch {}
        resolve({ status: res.statusCode, ms: round(t), bytes: Buffer.byteLength(body), body: parsed });
      });
    });
    req.on("socket", (s) => {
      s.on("lookup", () => (t.dns = performance.now() - t0));
      s.on("connect", () => (t.connect = performance.now() - t0));
      s.on("secureConnect", () => (t.tls = performance.now() - t0));
    });
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error("timeout")));
    req.on("error", (e) => resolve({ status: null, error: e.message, ms: round({ ...t, total: performance.now() - t0 }) }));
  });
}

function round(t) {
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Math.round(v * 10) / 10]));
}

async function runnerRegion() {
  // GitHub-hosted runners are Azure VMs; the instance metadata service reports the Azure region.
  try {
    const res = await fetch("http://169.254.169.254/metadata/instance/compute/location?api-version=2021-02-01&format=text",
      { headers: { Metadata: "true" }, signal: AbortSignal.timeout(1500) });
    return res.ok ? (await res.text()).trim() : null;
  } catch { return null; }
}

const endpoints = JSON.parse(await readFile(args.endpoints, "utf8")).filter((e) => e.url);
if (!endpoints.length) {
  console.log("no endpoints with a url yet; nothing to probe");
  process.exit(0);
}
await mkdir(args.data, { recursive: true });
const lastPath = `${args.data}/last.json`;
const last = JSON.parse(await readFile(lastPath, "utf8").catch(() => "{}"));
const run = { run_id: randomUUID(), started: new Date().toISOString(), runner_region: await runnerRegion() };
const day = run.started.slice(0, 10);
const lines = [];

if (args.rounds) {
  for (let round = 0; round < Number(args.rounds); round++) {
    const order = [...endpoints].sort(() => Math.random() - 0.5);
    for (const ep of order) {
      const r = await timedGet(ep.url);
      lines.push({ ...run, platform: ep.platform, plan: ep.plan, seq: round, at: new Date().toISOString(), ...r });
    }
  }
}

for (const ep of args.rounds ? [] : endpoints) {
  const prev = last[ep.platform];
  for (let seq = 0; seq <= FOLLOW_UPS; seq++) {
    const r = await timedGet(ep.url);
    lines.push({
      ...run, platform: ep.platform, plan: ep.plan, seq, at: new Date().toISOString(),
      idle_s: seq === 0 && prev ? Math.round((Date.now() - Date.parse(prev.at)) / 1000) : null,
      new_instance: r.body?.boot_id ? r.body.boot_id !== prev?.boot_id : null,
      ...r,
    });
    if (r.body?.boot_id) last[ep.platform] = { at: new Date().toISOString(), boot_id: r.body.boot_id };
  }
}

await appendFile(`${args.data}/${day}.jsonl`, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
await writeFile(lastPath, JSON.stringify(last, null, 2) + "\n");
console.log(`run ${run.run_id}: ${lines.length} requests across ${endpoints.length} endpoints, runner ${run.runner_region}`);

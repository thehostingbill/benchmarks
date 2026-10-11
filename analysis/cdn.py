"""Summarise the free-CDN test: per CDN, time to first byte and full download over fresh connections.

Usage: python3 analysis/cdn.py <data_dir>/cdn  (prints CSV; --json for machine-readable output)
"""
import argparse
import json
import sys
from pathlib import Path


def pct(values, q):
    if not values:
        return None
    s = sorted(values)
    k = (len(s) - 1) * q
    f = int(k)
    return round(s[f] + (s[min(f + 1, len(s) - 1)] - s[f]) * (k - f), 1)


def summarise(data: Path) -> dict:
    rows = [json.loads(line) for f in sorted(data.glob("*.jsonl")) for line in f.read_text().splitlines() if line]
    out = {"runs": len({r["run_id"] for r in rows}), "regions": sorted({r["runner_region"] for r in rows if r.get("runner_region")}),
           "first": min((r["at"] for r in rows), default=None), "last": max((r["at"] for r in rows), default=None), "cdns": {}}
    for name in sorted({r["platform"] for r in rows}):
        rs = [r for r in rows if r["platform"] == name]
        ok = [r for r in rs if r.get("status") == 200]
        col = lambda k: [r["ms"][k] for r in ok if k in r["ms"]]
        out["cdns"][name] = {
            "n": len(ok), "errors": len(rs) - len(ok),
            "ttfb_p50": pct(col("ttfb"), 0.5), "ttfb_p95": pct(col("ttfb"), 0.95),
            "total_p50": pct(col("total"), 0.5), "total_p95": pct(col("total"), 0.95),
            "dns_p50": pct(col("dns"), 0.5), "tls_p50": pct(col("tls"), 0.5),
            "ttfb_all": sorted(col("ttfb")),
        }
    return out


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("data", type=Path)
    p.add_argument("--json", action="store_true")
    a = p.parse_args()
    s = summarise(a.data)
    if a.json:
        print(json.dumps(s))
    else:
        print("cdn,n,errors,ttfb_p50_ms,ttfb_p95_ms,total_p50_ms,total_p95_ms,dns_p50_ms,tls_p50_ms")
        for name, c in sorted(s["cdns"].items(), key=lambda kv: kv[1]["ttfb_p50"] or 1e9):
            print(",".join(str(c[k]) for k in ("n", "errors", "ttfb_p50", "ttfb_p95", "total_p50", "total_p95", "dns_p50", "tls_p50")).join([name + ",", ""]))
        print(f"# runs={s['runs']} regions={' '.join(s['regions'])} window={s['first']}..{s['last']}", file=sys.stderr)

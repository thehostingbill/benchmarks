"""Summarise probe data: cold-start and warm latency per platform.

Usage: python3 analysis/analyze.py <data_dir> [--min-idle 900]
A request counts as a cold start only if it is the first of its run (seq 0), the platform was
idle for at least --min-idle seconds, and it was served by a new instance (boot_id changed).
"""
import argparse
import csv
import json
import statistics
import sys
from pathlib import Path


def pct(values, q):
    if not values:
        return None
    s = sorted(values)
    k = (len(s) - 1) * q
    f = int(k)
    return round(s[f] + (s[min(f + 1, len(s) - 1)] - s[f]) * (k - f), 1)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("data", type=Path)
    p.add_argument("--min-idle", type=int, default=900)
    a = p.parse_args()
    rows = [json.loads(line) for f in sorted(a.data.glob("*.jsonl")) for line in f.read_text().splitlines() if line]
    by = {}
    for r in rows:
        d = by.setdefault(r["platform"], {"cold": [], "warm": [], "errors": 0, "skipped": 0, "regions": set()})
        if r.get("runner_region"):
            d["regions"].add(r["runner_region"])
        if r.get("status") != 200:
            d["errors"] += 1
            continue
        ttfb = r["ms"]["ttfb"]
        if r["seq"] == 0:
            if (r.get("idle_s") or 0) >= a.min_idle and r.get("new_instance"):
                d["cold"].append(ttfb)
            else:
                d["skipped"] += 1
        else:
            d["warm"].append(ttfb)
    out = csv.writer(sys.stdout)
    out.writerow(["platform", "cold_n", "cold_p50_ms", "cold_p95_ms", "cold_iqr_ms", "warm_p50_ms", "errors", "skipped_first_requests", "runner_regions"])
    for name, d in sorted(by.items()):
        c = d["cold"]
        iqr = round(pct(c, 0.75) - pct(c, 0.25), 1) if len(c) >= 4 else None
        out.writerow([name, len(c), pct(c, 0.5), pct(c, 0.95), iqr, pct(d["warm"], 0.5), d["errors"], d["skipped"], " ".join(sorted(d["regions"]))])


if __name__ == "__main__":
    main()

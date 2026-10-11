# The Hosting Bill — benchmarks

Code and raw data behind every benchmark on [The Hosting Bill](https://www.youtube.com/@thehostingbill).
Anything shown in a video can be checked or rerun from here.

## Test 1: free-tier cold starts

**Question:** after a free-tier app has been idle long enough to sleep, how long does the first visitor wait?

**Method**

- The same minimal app (`apps/`) runs on every platform: it returns a JSON body with a `boot_id` that is
  generated once per instance. A changed `boot_id` proves a new instance served the request.
- A GitHub Actions job (`.github/workflows/cold-start.yml`) runs every 20 minutes. Per platform it sends one
  first request (the cold-start candidate) and three follow-ups (the warm baseline). Every request uses a fresh
  connection, so each pays DNS, TCP and TLS like a new visitor.
- A first request counts as a cold start only if the platform was idle ≥ 15 minutes **and** a new instance
  answered. Everything else is reported as skipped, not silently dropped.
- Metric: time to first byte (TTFB). Reported as median (p50), 95th percentile (p95) and interquartile range.
- Every request records the runner's Azure region, the timestamp and the commit of the probe code.

**Raw data** is committed to the [`data` branch](../../tree/data), one JSON line per request.

**Reproduce**

```bash
git clone https://github.com/thehostingbill/benchmarks && cd benchmarks
git fetch origin data && git worktree add data origin/data
python3 analysis/analyze.py data
```

**Limitations, stated up front**

- GitHub-hosted runners do not let us choose a region; the region of every run is in the data.
- Free tiers change. Results are dated; a rerun on a later date may differ, and we say so when it does.
- On Cloudflare Workers the clock is frozen at global scope, so `uptime_ms` is meaningless there; `boot_id`
  still identifies the isolate.
- Load is one request per platform every 20 minutes plus three follow-ups — well inside every provider's
  fair-use terms.

## Disclosure

Some links in video descriptions are affiliate links; the description says which. Every platform we test is
linked whether or not it has an affiliate program, and results are published regardless of who comes out ahead.

#!/usr/bin/env python3
import collections, glob, math, os, statistics, sys

def percentile(values, p):
    values = sorted(values)
    return values[max(0, math.ceil((p / 100) * len(values)) - 1)]

groups = collections.defaultdict(list)
for path in glob.glob(os.path.join(sys.argv[1], "*")):
    name = os.path.basename(path)
    if not os.path.isfile(path) or "summary" in name or name == "latency-summary.csv":
        continue
    prefix = name.split(".", 1)[0]
    if prefix not in {"c1", "c5", "c10"}:
        continue
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            fields = line.split()
            # pgbench 16 per-transaction log: latency is column 3 in microseconds.
            if len(fields) >= 6:
                try:
                    groups[prefix].append(float(fields[2]) / 1000.0)
                except ValueError:
                    pass

print("concurrency,transactions,p50_ms,p95_ms,p99_ms,mean_ms")
for prefix in ("c1", "c5", "c10"):
    values = groups[prefix]
    if not values:
        raise SystemExit(f"No se encontraron muestras válidas para {prefix}")
    print(f"{prefix[1:]},{len(values)},{percentile(values,50):.3f},{percentile(values,95):.3f},{percentile(values,99):.3f},{statistics.fmean(values):.3f}")

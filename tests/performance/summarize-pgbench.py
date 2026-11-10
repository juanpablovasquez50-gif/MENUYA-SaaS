#!/usr/bin/env python3
import glob, math, os, statistics, sys

def percentile(values, p):
    values = sorted(values)
    if not values:
        return None
    rank = max(0, math.ceil((p / 100) * len(values)) - 1)
    return values[rank]

print("scenario,transactions,p50_ms,p95_ms,p99_ms,mean_ms")
for path in sorted(glob.glob(sys.argv[1] + "/*.log")):
    name = os.path.basename(path).replace(".log", "")
    latencies = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            fields = line.split()
            if len(fields) >= 4:
                try:
                    latencies.append(float(fields[3]) / 1000.0)
                except ValueError:
                    pass
    if not latencies:
        print(f"{name},0,,,,")
        continue
    print(f"{name},{len(latencies)},{percentile(latencies,50):.3f},{percentile(latencies,95):.3f},{percentile(latencies,99):.3f},{statistics.fmean(latencies):.3f}")

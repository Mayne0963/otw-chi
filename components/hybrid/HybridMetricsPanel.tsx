"use client";

import { useMemo } from "react";
import OtwCard from "@/components/ui/otw/OtwCard";
import { readHybridMetrics } from "@/lib/hybrid-storage/metrics";

export default function HybridMetricsPanel() {
  const metrics = useMemo(() => readHybridMetrics().slice(-50).reverse(), []);

  return (
    <OtwCard className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">Sync Metrics</div>
          <div className="text-xs text-muted-foreground">Local-only rolling log</div>
        </div>
        <div className="text-xs text-muted-foreground">{metrics.length} events</div>
      </div>
      {metrics.length ? (
        <div className="mt-3 space-y-2">
          {metrics.map((m) => (
            <div key={`${m.atMs}-${m.key}-${m.outcome}`} className="flex items-center justify-between text-xs">
              <div className="truncate">
                <span className="font-medium">{m.key}</span>{" "}
                <span className="text-muted-foreground">{m.outcome}</span>
              </div>
              <div className="text-muted-foreground">
                {new Date(m.atMs).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-sm text-muted-foreground">No metrics yet.</div>
      )}
    </OtwCard>
  );
}


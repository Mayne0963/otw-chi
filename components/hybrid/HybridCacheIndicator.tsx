"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";

export default function HybridCacheIndicator({
  statusLabel,
  source,
  fetchedAtMs,
}: {
  statusLabel: string;
  source: "local" | "remote" | null;
  fetchedAtMs: number | null;
}) {
  const variant = useMemo(() => {
    if (statusLabel === "Fresh") return "success" as const;
    if (statusLabel === "Cached") return "info" as const;
    if (statusLabel === "Expired") return "warning" as const;
    if (statusLabel === "Error") return "destructive" as const;
    return "outline" as const;
  }, [statusLabel]);

  const detail = useMemo(() => {
    if (!fetchedAtMs) return null;
    const d = new Date(fetchedAtMs);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString();
  }, [fetchedAtMs]);

  const label = source ? `${statusLabel} • ${source}` : statusLabel;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={variant}>{label}</Badge>
      {detail ? <div className="text-xs text-muted-foreground">{detail}</div> : null}
    </div>
  );
}


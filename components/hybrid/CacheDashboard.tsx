"use client";

import ReferenceDataPanel from "@/components/hybrid/ReferenceDataPanel";
import HybridMetricsPanel from "@/components/hybrid/HybridMetricsPanel";

export default function CacheDashboard() {
  return (
    <div className="space-y-4">
      <ReferenceDataPanel />
      <HybridMetricsPanel />
    </div>
  );
}


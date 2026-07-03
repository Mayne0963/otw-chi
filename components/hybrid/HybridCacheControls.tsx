"use client";

import { Button } from "@/components/ui/button";

export default function HybridCacheControls({
  loading,
  onRefresh,
  onClear,
}: {
  loading: boolean;
  onRefresh: () => void;
  onClear?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={onRefresh} disabled={loading}>
        Refresh
      </Button>
      {onClear ? (
        <Button type="button" variant="ghost" onClick={onClear} disabled={loading}>
          Clear cache
        </Button>
      ) : null}
    </div>
  );
}


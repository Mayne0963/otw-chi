"use client";

import React, { useEffect, useState } from "react";
import styles from "./DriverFranchiseCard.module.css";

interface FranchiseDriverPayload {
  driverId: string;
  displayName: string;
  completedJobs: number;
  cancelledJobs: number;
  avgRating: number;
  franchiseScore: number;
  franchiseRank: string;
  franchiseEligible: boolean;
  franchiseLastEvaluatedAt?: string;
}

interface FranchiseResponse {
  success: boolean;
  mode?: "single" | "overview";
  driver?: FranchiseDriverPayload;
  error?: string;
}

interface DriverFranchiseCardProps {
  driverId: string;
}

const getRankLabel = (rank: string) => {
  switch (rank) {
    case "SEED":
      return "SEED — Just Getting Started";
    case "BRONZE":
      return "BRONZE — Solid Grinder";
    case "SILVER":
      return "SILVER — Trusted OTW Driver";
    case "GOLD":
      return "GOLD — Franchise Material";
    case "PLATINUM":
      return "PLATINUM — Leader of the Pack";
    case "EMPIRE":
      return "EMPIRE — OTW Boss Status";
    default:
      return "NOT ELIGIBLE — Keep Building";
  }
};

const getRankTip = (rank: string) => {
  switch (rank) {
    case "NOT_ELIGIBLE":
      return "Stack more completed runs, keep cancellations low, and aim for strong ratings to unlock SEED level.";
    case "SEED":
      return "You planted the seed. Focus on finishing runs on time and keeping your cancellation rate low to hit BRONZE.";
    case "BRONZE":
      return "You’re showing up. Push for more consistent 5-star experiences to climb into SILVER territory.";
    case "SILVER":
      return "You’re dependable. Keep your rating high and your cancellations low to move into GOLD franchise talks.";
    case "GOLD":
      return "You’re moving like a partner. Maintain this level and build streaks; PLATINUM is around the corner.";
    case "PLATINUM":
      return "You’re elite OTW. Begin thinking like a fleet owner — training, mentorship, and consistency pave the way to EMPIRE.";
    case "EMPIRE":
      return "You’re franchise-ready. This is OTW boss tier — time for HQ conversations about your own lane.";
    default:
      return "Keep stacking good runs, strong ratings, and low cancellations — the system will promote you naturally.";
  }
};

const DriverFranchiseCard: React.FC<DriverFranchiseCardProps> = ({ driverId }) => {
  const [data, setData] = useState<FranchiseDriverPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFranchiseData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/otw/drivers/franchise?driverId=${encodeURIComponent(driverId)}`);
      const payload: FranchiseResponse = await res.json();
      if (!res.ok || !payload.success || !payload.driver) {
        setError(payload.error || "Unable to load franchise readiness at this time.");
        setData(null);
        return;
      }
      setData(payload.driver);
    } catch (err) {
      console.error("Error loading franchise readiness:", err);
      setError("Network error while loading franchise readiness.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFranchiseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  const formatScore = (score: number | undefined) => (typeof score === "number" ? score.toFixed(1) : "—");
  const formatRating = (rating: number | undefined) => (typeof rating === "number" ? rating.toFixed(2) : "—");

  const badgeClass = data?.franchiseEligible === true ? styles.badgeEligible : styles.badgeNotEligible;

  return (
    <div className={styles.card}>
      <div className={styles.headerRow}>
        <h3 className={styles.title}>Franchise Readiness</h3>
        <button type="button" className={styles.refreshButton} onClick={fetchFranchiseData} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      <p className={styles.subtitle}>
        This panel shows how close you are to owning your own OTW unit based on your work, consistency, and impact.
      </p>
      {error && <p className={styles.error}>{error}</p>}
      {!error && !data && !loading && (
        <p className={styles.empty}>No franchise data yet. Complete at least one OTW run to start building your profile.</p>
      )}
      {data && (
        <>
          <div className={styles.rankRow}>
            <div className={styles.rankLeft}>
              <span className={styles.rankLabel}>{getRankLabel(data.franchiseRank)}</span>
              <span className={badgeClass}>{data.franchiseEligible ? "Eligible" : "Not Eligible Yet"}</span>
            </div>
            <div className={styles.scoreBox}>
              <span className={styles.scoreLabel}>Score</span>
              <span className={styles.scoreValue}>{formatScore(data.franchiseScore)}</span>
            </div>
          </div>
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Completed Jobs</p>
              <p className={styles.metricValue}>{data.completedJobs}</p>
            </div>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Cancellations</p>
              <p className={styles.metricValue}>{data.cancelledJobs ?? 0}</p>
            </div>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Avg Rating</p>
              <p className={styles.metricValue}>{formatRating(data.avgRating)}</p>
            </div>
          </div>
          <p className={styles.tipTitle}>How to level up:</p>
          <p className={styles.tipText}>{getRankTip(data.franchiseRank)}</p>
          {data.franchiseLastEvaluatedAt && (
            <p className={styles.meta}>
              Last updated: <span>{new Date(data.franchiseLastEvaluatedAt).toLocaleString()}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default DriverFranchiseCard;

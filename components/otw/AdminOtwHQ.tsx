"use client";

import React, { useEffect, useState } from "react";
import styles from "./AdminOtwHQ.module.css";

interface AdminDriverSnapshot {
  driverId: string;
  displayName: string;
  completedJobs: number;
  cancelledJobs: number;
  avgRating: number;
  franchiseScore: number;
  franchiseRank: string;
  franchiseEligible: boolean;
}

interface AdminOverviewSnapshot {
  generatedAt: string;
  totalDrivers: number;
  totalRequests: number;
  openRequests: number;
  completedRequests: number;
  pendingRequests: number;
  totalNipWallets: number;
  totalNipInCirculation: number;
  totalNipEarnedAllTime: number;
  topDriversByFranchise: AdminDriverSnapshot[];
  zones?: ZoneCoverageSnapshot[];
}

interface ZoneCoverageSnapshot {
  zoneId: string;
  zoneName: string;
  cityName: string;
  activeDrivers: number;
  openRequests: number;
  completedToday: number;
}

interface AdminOverviewResponse {
  success: boolean;
  overview?: AdminOverviewSnapshot;
  error?: string;
}

const AdminOtwHQ: React.FC = () => {
  const [overview, setOverview] = useState<AdminOverviewSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshingDriverId, setRefreshingDriverId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/otw/admin/overview");
      const data: AdminOverviewResponse = await res.json();
      if (!res.ok || !data.success || !data.overview) {
        setError(data.error || "Unable to load OTW admin overview right now.");
        setOverview(null);
        return;
      }
      setOverview(data.overview);
    } catch (err) {
      console.error("Error loading OTW admin overview:", err);
      setError("Network error while loading OTW admin overview.");
      setOverview(null);
    } finally {
      setLoading(false);
      setRefreshingDriverId(null);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleReevaluateDriver = async (driverId: string) => {
    try {
      setRefreshingDriverId(driverId);
      setError(null);
      const res = await fetch(`/api/otw/drivers/franchise?driverId=${encodeURIComponent(driverId)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Unable to re-evaluate franchise readiness for this driver.");
        return;
      }
      await fetchOverview();
    } catch (err) {
      console.error("Error re-evaluating driver:", err);
      setError("Network error while updating driver franchise readiness.");
    } finally {
      setRefreshingDriverId(null);
    }
  };

  const formatNumber = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div className={styles.shell}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>OTW HQ — Admin Panel</h2>
        <button type="button" className={styles.refreshButton} onClick={fetchOverview} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Overview"}
        </button>
      </div>

      <p className={styles.subTitle}>
        Snapshot generated at <span className={styles.code}>{overview ? new Date(overview.generatedAt).toLocaleString() : "—"}</span>
      </p>

      {error && <p className={styles.error}>{error}</p>}

      {overview && (
        <>
          <section className={styles.statsGrid}>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>Drivers</p>
              <p className={styles.statValue}>{formatNumber(overview.totalDrivers)}</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>Total Requests</p>
              <p className={styles.statValue}>{formatNumber(overview.totalRequests)}</p>
              <p className={styles.statMeta}>Open: {formatNumber(overview.openRequests)} • Completed: {formatNumber(overview.completedRequests)}</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>NIP Wallets</p>
              <p className={styles.statValue}>{formatNumber(overview.totalNipWallets)}</p>
              <p className={styles.statMeta}>In circulation: {formatNumber(overview.totalNipInCirculation)} NIP</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>NIP Earned All-Time</p>
              <p className={styles.statValue}>{formatNumber(overview.totalNipEarnedAllTime)} NIP</p>
            </div>
          </section>

          <section className={styles.tableSection}>
            <div className={styles.tableHeaderRow}>
              <h3 className={styles.sectionTitle}>Top Drivers by Franchise Score</h3>
              <p className={styles.sectionHint}>Higher score + eligibility = potential OTW franchise partner.</p>
            </div>

            {overview.topDriversByFranchise.length === 0 && <p className={styles.empty}>No drivers with franchise activity yet.</p>}

            {overview.topDriversByFranchise.length > 0 && (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Driver</th>
                      <th>Jobs</th>
                      <th>Rating</th>
                      <th>Score</th>
                      <th>Rank</th>
                      <th>Eligible</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.topDriversByFranchise.map((d) => (
                      <tr key={d.driverId}>
                        <td>
                          <div className={styles.driverCell}>
                            <span className={styles.driverName}>{d.displayName}</span>
                            <span className={styles.driverId}>{d.driverId}</span>
                          </div>
                        </td>
                        <td>
                          <span className={styles.jobsText}>{d.completedJobs} ✓ / {d.cancelledJobs} ✕</span>
                        </td>
                        <td>{d.avgRating.toFixed(2)}</td>
                        <td>{d.franchiseScore.toFixed(1)}</td>
                        <td>{d.franchiseRank}</td>
                        <td>
                          <span className={d.franchiseEligible ? styles.badgeEligible : styles.badgeNotEligible}>{d.franchiseEligible ? "Yes" : "No"}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.recalcButton}
                            onClick={() => handleReevaluateDriver(d.driverId)}
                            disabled={refreshingDriverId === d.driverId || loading}
                          >
                            {refreshingDriverId === d.driverId ? "Re-evaluating..." : "Re-evaluate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {overview.zones && overview.zones.length > 0 && (
            <section className={styles.tableSection}>
              <div className={styles.tableHeaderRow}>
                <h3 className={styles.sectionTitle}>Zone Coverage</h3>
                <p className={styles.sectionHint}>Drivers and request volume by city zone.</p>
              </div>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Zone</th>
                      <th>City</th>
                      <th>Active Drivers</th>
                      <th>Open Requests</th>
                      <th>Completed Today</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.zones.map((z) => (
                      <tr key={z.zoneId}>
                        <td>{z.zoneName}</td>
                        <td>{z.cityName}</td>
                        <td>{z.activeDrivers}</td>
                        <td>{z.openRequests}</td>
                        <td>{z.completedToday}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default AdminOtwHQ;

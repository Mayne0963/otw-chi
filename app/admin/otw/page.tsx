"use client";
import { useEffect, useState } from "react";
import styles from "./otwAdmin.module.css";

export default function OtwAdminHQ() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/otw/overview");
        const json = await res.json();
        if (json.success) setData(json);
      } catch (e) {
        console.error("Admin HQ failed:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className={styles.loading}>Loading OTW HQ...</div>;
  if (!data) return <div className={styles.error}>Unable to load OTW HQ</div>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>OTW Admin HQ</h1>
      <p className={styles.timestamp}>Updated: {new Date(data.lastUpdated).toLocaleString()}</p>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2>Total Requests</h2>
          <p>{data.totalRequests}</p>
        </div>
        <div className={styles.card}>
          <h2>Completed</h2>
          <p>{data.completedRequests}</p>
        </div>
        <div className={styles.card}>
          <h2>Pending</h2>
          <p>{data.pendingRequests}</p>
        </div>
        <div className={styles.card}>
          <h2>Total Miles Used</h2>
          <p>{Number(data.totalMilesUsed).toLocaleString()}</p>
        </div>
        <div className={styles.card}>
          <h2>Avg Driver Rating</h2>
          <p>{data.averageRating}</p>
        </div>
        <div className={styles.card}>
          <h2>Active Memberships</h2>
          <p>{data.activeMemberships}</p>
        </div>
        <div className={styles.card}>
          <h2>Total Drivers</h2>
          <p>{data.drivers}</p>
        </div>
      </div>

      <h2 className={styles.subtitle}>Tier Distribution</h2>
      <div className={styles.tierList}>
        {Object.keys(data.tierCounts || {}).map((tier) => (
          <div key={tier} className={styles.tierItem}>
            <span className={styles.tierName}>{tier}</span>
            <span className={styles.tierCount}>{data.tierCounts[tier]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


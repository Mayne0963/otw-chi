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

      <h2 className={styles.subtitle}>Top Drivers (OTW Health)</h2>
      <div className={styles.healthList}>
        {(!data.topDrivers || data.topDrivers.length === 0) && (
          <p className={styles.healthEmpty}>No driver health data yet.</p>
        )}

        {data.topDrivers && data.topDrivers.length > 0 && (
          <ul className={styles.healthItems}>
            {data.topDrivers.map((entry: any) => (
              <li key={entry.driver.driverId} className={styles.healthItem}>
                <div className={styles.healthHeaderRow}>
                  <span className={styles.healthName}>
                    {entry.driver.displayName}
                  </span>
                  <span className={styles.healthScore}>
                    {entry.score.toFixed(0)}/100
                  </span>
                </div>
                <p className={styles.healthMeta}>
                  Rating: {(entry.components.rating * 5).toFixed(1)} •
                  Completion: {(entry.components.completionRate * 100).toFixed(0)}% •
                  Recency: {(entry.components.recencyBoost * 100).toFixed(0)}%
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2 className={styles.subtitle}>Top Customers (OTW Health)</h2>
      <div className={styles.healthList}>
        {(!data.topCustomers || data.topCustomers.length === 0) && (
          <p className={styles.healthEmpty}>No customer health data yet.</p>
        )}

        {data.topCustomers && data.topCustomers.length > 0 && (
          <ul className={styles.healthItems}>
            {data.topCustomers.map((entry: any) => (
              <li key={entry.customerId} className={styles.healthItem}>
                <div className={styles.healthHeaderRow}>
                  <span className={styles.healthName}>
                    Customer {entry.customerId}
                  </span>
                  <span className={styles.healthScore}>
                    {entry.score.toFixed(0)}/100
                  </span>
                </div>
                <p className={styles.healthMeta}>
                  Usage: {(entry.components.usage * 100).toFixed(0)}% •
                  Completion: {(entry.components.completionRate * 100).toFixed(0)}% •
                  Tier: {(entry.components.tierQuality * 100).toFixed(0)}%
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

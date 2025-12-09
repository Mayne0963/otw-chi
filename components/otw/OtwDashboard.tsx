import React from "react";
import styles from "./OtwDashboard.module.css";
import {
  mockCustomerSnapshot,
  mockRecentActivity,
} from "../../lib/otw/otwMockData";

const OtwDashboard: React.FC = () => {
  const {
    userName,
    tier,
    monthlyMilesCap,
    milesUsed,
    rolloverMiles,
    jobsCompletedThisMonth,
    avgMilesPerJob,
  } = mockCustomerSnapshot;
  const recentActivity = mockRecentActivity;

  const milesRemaining = Math.max(0, monthlyMilesCap - milesUsed);
  const percentUsed = Math.min(100, Math.max(0, (milesUsed / monthlyMilesCap) * 100));

  const jobsCompleted = jobsCompletedThisMonth;

  const categories = [
    "Moves",
    "Exchanges",
    "Hauls",
    "Presence",
    "Business",
    "Multi-Stop",
  ];

  const avatarLetter = (userName || "?").trim().charAt(0).toUpperCase();

  return (
    <div className={styles.otwDashboard}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>OTW</div>
          <div className={styles.subtitle}>On The Way Concierge</div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.tierBadge}>{tier}</span>
          <div aria-label="Profile" className={styles.avatar}>{avatarLetter}</div>
        </div>
      </div>

      {/* Main Grid */}
      <div className={styles.mainGrid}>
        {/* Card 1: OTW Miles */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>OTW Miles</div>
          <div className={styles.cardValue}>{milesRemaining.toLocaleString()}</div>
          <div className={styles.cardSubtext}>of {monthlyMilesCap.toLocaleString()} this month</div>
          <div className={styles.cardSubtext}>Used {milesUsed.toLocaleString()} · Rollover {rolloverMiles.toLocaleString()}</div>
          <div className={styles.milesBar}>
            <div className={styles.milesFill} style={{ width: `${percentUsed}%` }} />
          </div>
        </div>

        {/* Card 2: This Month's Movement */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>This Month’s Movement</div>
          <div className={styles.cardSubtext}>Jobs completed: {jobsCompleted}</div>
          <div className={styles.cardSubtext}>Average miles per job: {avgMilesPerJob}</div>
        </div>

        {/* Card 3: Tier Benefits */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>Tier Benefits</div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            <li>Priority matching</li>
            <li>Hauls & Presence included</li>
            <li>2-hour Presence window</li>
            <li>Concierge support</li>
          </ul>
        </div>

        {/* Card 4: Quick Actions */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>Quick Actions</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button">Make a Request</button>
            <button type="button">Add Miles</button>
          </div>
        </div>
      </div>

      {/* Categories Row */}
      <div className={styles.categoriesRow}>
        {categories.map((c, idx) => (
          <span
            key={c}
            className={`${styles.categoryChip} ${idx === 0 ? styles.categoryChipSelected : ""}`}
          >
            {c}
          </span>
        ))}
      </div>

      {/* Recent Activity */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>Recent Activity</div>
        <div className={styles.activityList}>
          {recentActivity.map((item) => (
            <div key={item.id} className={styles.activityItem}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontWeight: 600 }}>{item.serviceType}</div>
                <div className={styles.cardSubtext}>{item.label}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 600 }}>{item.miles} miles</div>
                <div className={styles.cardSubtext}>{item.status} · {item.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Zone Map Preview */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>My OTW Zone</div>
        <div className={styles.mapPreview}>Map preview coming soon</div>
      </div>
    </div>
  );
};

export default OtwDashboard;

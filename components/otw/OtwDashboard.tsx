import React from "react";
import styles from "./OtwDashboard.module.css";
import { mockCustomerSnapshot, mockRecentActivity } from "@/lib/otw/otwMockData";

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

  const milesRemaining = monthlyMilesCap - milesUsed;
  const percentUsed = Math.min(100, Math.max(0, (milesUsed / monthlyMilesCap) * 100));

  const initial = userName.charAt(0).toUpperCase();

  return (
    <div className={styles.otwDashboard}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div>OTW</div>
          <div>On The Way Concierge</div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.tierBadge}>{tier}</div>
          <div className={styles.avatar}>{initial}</div>
        </div>
      </div>

      <div className={styles.mainGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>OTW Miles</div>
          <div className={styles.cardValue}>{milesRemaining}</div>
          <div className={styles.cardSubtext}>of {monthlyMilesCap} this month</div>
          <div className={styles.milesBar}>
            <div className={styles.milesBarFill} style={{ width: `${percentUsed}%` }} />
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>This Month’s Movement</div>
          <div className={styles.cardSubtext}>Jobs completed: {jobsCompletedThisMonth}</div>
          <div className={styles.cardSubtext}>Average miles per job: {avgMilesPerJob}</div>
          <div className={styles.cardSubtext}>Rollover miles: {rolloverMiles}</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>Tier Benefits</div>
          <div className={styles.cardSubtext}>• Priority matching</div>
          <div className={styles.cardSubtext}>• Hauls & Presence included</div>
          <div className={styles.cardSubtext}>• 2-hour Presence window</div>
          <div className={styles.cardSubtext}>• Dedicated support channel</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>Quick Actions</div>
          <div>
            <button>Make a Request</button>
            <button>Add Miles</button>
          </div>
        </div>
      </div>

      <div className={styles.categoriesRow}>
        <div className={styles.categoryChip} aria-selected="true">Moves</div>
        <div className={styles.categoryChip}>Exchanges</div>
        <div className={styles.categoryChip}>Hauls</div>
        <div className={styles.categoryChip}>Presence</div>
        <div className={styles.categoryChip}>Business</div>
        <div className={styles.categoryChip}>Multi-Stop</div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Recent Activity</div>
        <div className={styles.activityList}>
          {mockRecentActivity.map((item) => (
            <div key={item.id} className={styles.activityItem}>
              <div>{item.serviceType}</div>
              <div>{item.label}</div>
              <div>{item.miles} miles</div>
              <div>{item.status}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>My OTW Zone</div>
        <div className={styles.mapPreview}>Map preview coming soon</div>
      </div>
    </div>
  );
};

export default OtwDashboard;

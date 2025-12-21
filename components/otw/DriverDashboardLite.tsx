"use client";

import React, { useState } from "react";
import styles from "./DriverDashboardLite.module.css";

type DriverStatus = "ONLINE" | "OFFLINE";
type JobStatus = "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";
type JobType = "MOVE" | "EXCHANGE" | "HAUL" | "PRESENCE" | "BUSINESS";

interface DriverJob {
  id: string;
  type: JobType;
  label: string;
  payout: number;
  status: JobStatus;
  etaMinutes?: number;
}

const driverName = "OTW Rep Big’um";
const driverTier = "Purple – OTW Specialist";
const rating = 4.9;
const jobsToday = 7;
const earningsToday = 186.5;
const weeklyEarnings = 720.25;
const activeStatusInitial: DriverStatus = "ONLINE";

const todayJobs: DriverJob[] = [
  { id: "J1", type: "MOVE", label: "Grocery run – Coldwater → Lima", payout: 18.5, status: "COMPLETED" },
  { id: "J2", type: "EXCHANGE", label: "Backpack to school", payout: 12, status: "COMPLETED" },
  { id: "J3", type: "HAUL", label: "65\" TV from Best Buy", payout: 44, status: "IN_PROGRESS", etaMinutes: 15 },
];

const DriverDashboard: React.FC = () => {
  const [status, setStatus] = useState<DriverStatus>(activeStatusInitial);

  const handleToggleStatus = () => {
    setStatus((prev) => (prev === "ONLINE" ? "OFFLINE" : "ONLINE"));
  };

  const statusLabel = status === "ONLINE" ? "Online" : "Offline";
  const statusNote = status === "ONLINE" ? "You’re receiving jobs now." : "Go online to receive jobs.";

  return (
    <div className={styles.driverDashboard}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div style={{ fontWeight: 800 }}>OTW Driver Dashboard</div>
          <div style={{ opacity: 0.8 }}>{driverName} • {driverTier}</div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.badge} aria-live="polite">{statusLabel}</span>
          <button type="button" className={styles.statusToggle} onClick={handleToggleStatus}>
            {status === "ONLINE" ? "Go Offline" : "Go Online"}
          </button>
          <span className={styles.rating}>⭐ {rating.toFixed(1)}</span>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Today’s Earnings</div>
          <div className={styles.cardValue}>${earningsToday.toFixed(2)}</div>
          <div className={styles.cardSubtext}>This week: ${weeklyEarnings.toFixed(2)}</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Jobs Completed Today</div>
          <div className={styles.cardValue}>{jobsToday}</div>
          <div className={styles.cardSubtext}>Keep going – bonuses unlock at 25 jobs/week.</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Current Status</div>
          <div className={styles.cardValue}>{statusLabel}</div>
          <div className={styles.cardSubtext}>{statusNote}</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Rating</div>
          <div className={styles.cardValue}>{rating.toFixed(1)}</div>
          <div className={styles.cardSubtext}>High ratings unlock more OTW perks.</div>
        </div>
      </div>

      <section>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Today’s Jobs</div>
          <div className={styles.jobsList}>
            {todayJobs.map((job) => (
              <div key={job.id} className={styles.jobItem}>
                <span className={styles.badge}>{job.type}</span>
                <div style={{ flex: 1, padding: "0 8px" }}>{job.label}</div>
                <div>${job.payout.toFixed(2)}</div>
                <span className={styles.badge}>{job.status.replace("_", " ")}</span>
                {typeof job.etaMinutes === "number" && (
                  <span className={styles.badge}>ETA: {job.etaMinutes} min</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Next Steps</div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            <li>Stay Online to receive more jobs.</li>
            <li>Complete your Haul Specialist training to unlock XL payouts.</li>
            <li>Maintain rating above 4.8 for bonus earnings.</li>
          </ul>
        </div>
      </section>
    </div>
  );
};

export default DriverDashboard;


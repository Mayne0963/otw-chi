"use client";

import React, { useEffect, useState } from "react";
import styles from "./DriverDashboard.module.css";
import DriverFranchiseCard from "./DriverFranchiseCard";
import { DriverStatus, OtwFeedback } from "../../lib/otw/otwTypes";

const DriverDashboard: React.FC = () => {
  const [driverId, setDriverId] = useState<string>("");
  const [driverName, setDriverName] = useState<string>("");
  const initialStatus: DriverStatus = "ONLINE";

  // Local shape for /api/otw/requests responses
  interface ApiOtwRequest {
    id: string;
    serviceType: string;
    urgency: string;
    pickupArea: string;
    dropoffArea: string;
    notes?: string;
    createdAt: string;
    estimatedMiles: number;
    status: string;
    assignedDriverId?: string;
  }

  const [status, setStatus] = useState<DriverStatus>(initialStatus);
  const [feedback, setFeedback] = useState<OtwFeedback[]>([]);
  const [avgRatingFromFeedback, setAvgRatingFromFeedback] = useState<number | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState<boolean>(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [assignedRequests, setAssignedRequests] = useState<ApiOtwRequest[]>([]);
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [assignedError, setAssignedError] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);


  // Load available drivers and pick the first one
  useEffect(() => {
    const loadDriver = async () => {
      try {
        const res = await fetch("/api/otw/drivers/franchise");
        const data = await res.json();
        if (res.ok && data.success && data.mode === "overview" && Array.isArray(data.drivers) && data.drivers.length > 0) {
          setDriverId(String(data.drivers[0].driverId));
          setDriverName(String(data.drivers[0].displayName || data.drivers[0].driverId));
        } else {
          setDriverId("DRIVER-1");
          setDriverName("OTW Driver");
        }
      } catch (e) {
        setDriverId("DRIVER-1");
        setDriverName("OTW Driver");
      }
    };
    loadDriver();
  }, []);

  useEffect(() => {
    if (!driverId) return;
    const fetchFeedback = async () => {
      try {
        setFeedbackLoading(true);
        setFeedbackError(null);
        const res = await fetch(`/api/otw/feedback?driverId=${encodeURIComponent(driverId)}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          setFeedbackError(data.error || "Unable to load feedback.");
          setFeedback([]);
          setAvgRatingFromFeedback(null);
          return;
        }
        const items: OtwFeedback[] = data.feedback || [];
        setFeedback(items);
        if (items.length > 0) {
          const total = items.reduce((sum, fb) => sum + fb.rating, 0);
          setAvgRatingFromFeedback(Number((total / items.length).toFixed(2)));
        } else {
          setAvgRatingFromFeedback(null);
        }
      } catch (error) {
        console.error("Failed to fetch driver feedback:", error);
        setFeedbackError("Network error while loading feedback.");
        setFeedback([]);
        setAvgRatingFromFeedback(null);
      } finally {
        setFeedbackLoading(false);
      }
    };
    fetchFeedback();
  }, [driverId]);

  const fetchAssignedRequests = async () => {
    try {
      if (!driverId) return;
      setAssignedLoading(true);
      setAssignedError(null);
      const res = await fetch(`/api/otw/drivers/requests?driverId=${encodeURIComponent(driverId)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAssignedError(data.error || "Unable to load assigned OTW jobs.");
        setAssignedRequests([]);
        return;
      }
      const mine: ApiOtwRequest[] = data.myRequests || [];
      setAssignedRequests(mine);
    } catch (err) {
      console.error("Failed to load assigned OTW jobs:", err);
      setAssignedError("Network error while loading assigned OTW jobs.");
      setAssignedRequests([]);
    } finally {
      setAssignedLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedRequests();
  }, [driverId]);


  const handleMarkCompleted = async (requestId: string) => {
    try {
      setUpdateError(null);
      setUpdatingRequestId(requestId);
      const res = await fetch("/api/otw/drivers/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId, requestId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setUpdateError(data.error || "Unable to update job status.");
        return;
      }
      await fetchAssignedRequests();
    } catch (err) {
      console.error("Failed to mark job as completed:", err);
      setUpdateError("Network error while updating job status.");
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const handleToggleStatus = () => {
    setStatus((prev) => (prev === "ONLINE" ? "OFFLINE" : "ONLINE"));
  };

  const statusLabel = status === "ONLINE" ? "Online" : "Offline";
  const statusNote = status === "ONLINE" ? "You’re receiving jobs now." : "Go online to receive jobs.";

  return (
    <div className={styles.driverDashboard}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div style={{ fontWeight: 800, fontSize: 24 }}>OTW Driver Dashboard</div>
          <div style={{ fontSize: 14, opacity: 0.8 }}>{driverName} • {driverId}</div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.badge} style={{ background: status === "ONLINE" ? "#10b981" : "#f3f4f6", color: status === "ONLINE" ? "#ffffff" : "inherit", borderColor: status === "ONLINE" ? "#10b981" : undefined }}>{statusLabel}</span>
          <button type="button" className={styles.statusToggle} onClick={handleToggleStatus}>
            {status === "ONLINE" ? "Go Offline" : "Go Online"}
          </button>
          {avgRatingFromFeedback !== null && (
            <span className={styles.rating}>⭐ {avgRatingFromFeedback.toFixed(1)}</span>
          )}
        </div>
      </div>

      <section className={styles.franchiseSection}>
        <h3 className={styles.franchiseHeader}>Ownership Path — OTW Franchise</h3>
        <DriverFranchiseCard driverId={driverId} />
        <p className={styles.franchiseLinkRow}>
          <a href="/otw/franchise-requirements" className={styles.franchiseLink}>
            View full franchise requirements
          </a>
        </p>
      </section>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Current Status</div>
          <div className={styles.cardValue}>{statusLabel}</div>
          <div className={styles.cardSubtext}>{statusNote}</div>
        </div>
        {avgRatingFromFeedback !== null && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>Rating</div>
            <div className={styles.cardValue}>{avgRatingFromFeedback.toFixed(1)}</div>
            <div className={styles.cardSubtext}>High ratings unlock more OTW perks.</div>
          </div>
        )}
      </div>

      {/* Removed hard-coded Today’s Jobs card; rely on Assigned OTW Jobs below */}

      <div className={styles.card} style={{ marginTop: 16 }}>
        <div className={styles.cardTitle}>Next Steps</div>
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          <li>Stay Online to receive more jobs.</li>
          <li>Complete your Haul Specialist training to unlock XL payouts.</li>
          <li>Maintain rating above 4.8 for bonus earnings.</li>
        </ul>
      </div>

      <section className={styles.feedbackSection}>
        <h2 className={styles.sectionTitle}>Latest Feedback</h2>
        {feedbackLoading && <p className={styles.feedbackStatus}>Loading feedback…</p>}
        {feedbackError && <p className={styles.feedbackError}>{feedbackError}</p>}
        {!feedbackLoading && !feedbackError && feedback.length === 0 && (
          <p className={styles.feedbackStatus}>
            No feedback yet. Complete more OTW jobs to build your reputation.
          </p>
        )}
        {!feedbackLoading && feedback.length > 0 && (
          <>
            {avgRatingFromFeedback !== null && (
              <p className={styles.feedbackSummary}>
                Average rating from customers: {" "}
                <span className={styles.feedbackRating}>{avgRatingFromFeedback.toFixed(2)} ⭐</span>{" "}
                ({feedback.length} ratings)
              </p>
            )}
            <ul className={styles.feedbackList}>
              {feedback.slice(0, 5).map((fb) => (
                <li key={fb.id} className={styles.feedbackItem}>
                  <div className={styles.feedbackHeaderRow}>
                    <span className={styles.feedbackStars}>{`${"⭐".repeat(fb.rating)}`}</span>
                    <span className={styles.feedbackDate}>{new Date(fb.createdAt).toLocaleString()}</span>
                  </div>
                  {fb.comment && <p className={styles.feedbackComment}>{fb.comment}</p>}
                  <p className={styles.feedbackMeta}>Request: {fb.requestId} • Customer: {fb.customerId}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className={styles.assignedSection}>
        <h2 className={styles.sectionTitle}>Assigned OTW Jobs</h2>
        {updateError && (<p className={styles.assignedError}>{updateError}</p>)}
        {assignedLoading && (<p className={styles.assignedStatus}>Loading your OTW jobs…</p>)}
        {assignedError && (<p className={styles.assignedError}>{assignedError}</p>)}
        {!assignedLoading && !assignedError && assignedRequests.length === 0 && (
          <p className={styles.assignedStatus}>
            No jobs assigned yet. When OTW matches you to a request, it will appear here.
          </p>
        )}
        {!assignedLoading && assignedRequests.length > 0 && (
          <ul className={styles.assignedList}>
            {assignedRequests.map((req) => (
              <li key={req.id} className={styles.assignedItem}>
                <div className={styles.assignedHeaderRow}>
                  <span className={styles.assignedId}>Request {req.id}</span>
                  <span className={`${styles.assignedBadge} ${styles[`status_${String(req.status).toLowerCase()}`]}`}>
                    {req.status}
                  </span>
                </div>
                <p className={styles.assignedRoute}>{req.pickupArea} → {req.dropoffArea}</p>
                <p className={styles.assignedMeta}>
                  {req.serviceType} • {req.urgency} • {new Date(req.createdAt).toLocaleString()}
                </p>
                <p className={styles.assignedMiles}>Est. {req.estimatedMiles.toLocaleString()} miles</p>
                {req.notes && (<p className={styles.assignedNotes}>Notes: {req.notes}</p>)}
                <button
                  type="button"
                  className={styles.completeButton}
                  onClick={() => handleMarkCompleted(req.id)}
                  disabled={updatingRequestId === req.id}
                >
                  {updatingRequestId === req.id ? "Updating…" : "Mark Completed"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default DriverDashboard;

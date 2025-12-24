"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from 'next/link';
import styles from "@/components/otw/DriverDashboard.module.css";
import DriverFranchiseCard from "@/components/otw/DriverFranchiseCard";
import { DriverStatus, OtwFeedback } from "@/lib/otw/otwTypes";

export default function OtwDriverPage() {
  const [driverId, setDriverId] = useState<string>("");
  const [driverName, setDriverName] = useState<string>("");
  const initialStatus: DriverStatus = "ONLINE";

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
      } catch (_e) {
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

  const fetchAssignedRequests = useCallback(async () => {
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
  }, [driverId]);

  useEffect(() => {
    fetchAssignedRequests();
  }, [fetchAssignedRequests]);

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
  const statusNote = status === "ONLINE" ? "You're receiving jobs now." : "Go online to receive jobs.";

  return (
    <main
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "2rem 1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      {/* Page Header */}
      <div style={{ marginBottom: "1rem" }}>
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: 700,
            marginBottom: "0.5rem",
            color: "#111827",
            letterSpacing: "-0.025em",
          }}
        >
          Driver Console
        </h1>
        <p
          style={{
            fontSize: "1rem",
            color: "#6B7280",
            lineHeight: "1.5",
          }}
        >
          Manage your OTW deliveries, track earnings, and monitor your performance.
        </p>
      </div>

      <div className={styles.driverDashboard}>
        {/* Driver Header Card */}
        <div className={styles.header} style={{ 
          padding: "1.5rem", 
          borderRadius: "12px",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
        }}>
          <div className={styles.headerLeft}>
            <div style={{ fontWeight: 700, fontSize: "1.5rem", marginBottom: "0.25rem" }}>
              {driverName}
            </div>
            <div style={{ fontSize: "0.875rem", opacity: 0.9 }}>
              Driver ID: {driverId}
            </div>
          </div>
          <div className={styles.headerRight} style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <span 
              className={styles.badge} 
              style={{ 
                background: status === "ONLINE" ? "#10b981" : "#6B7280", 
                color: "#ffffff",
                padding: "0.5rem 1rem",
                borderRadius: "9999px",
                fontSize: "0.875rem",
                fontWeight: 600,
                border: "none"
              }}
            >
              {statusLabel}
            </span>
            <button 
              type="button" 
              className={styles.statusToggle} 
              onClick={handleToggleStatus}
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                color: "white",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              {status === "ONLINE" ? "Go Offline" : "Go Online"}
            </button>
            {avgRatingFromFeedback !== null && (
              <span 
                className={styles.rating}
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                  fontWeight: 600
                }}
              >
                ⭐ {avgRatingFromFeedback.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* Franchise Section */}
        <section className={styles.franchiseSection} style={{ marginTop: "1.5rem" }}>
          <h2 style={{ 
            fontSize: "1.25rem", 
            fontWeight: 600, 
            marginBottom: "1rem",
            color: "#111827"
          }}>
            Ownership Path — OTW Franchise
          </h2>
          <DriverFranchiseCard driverId={driverId} />
          <p className={styles.franchiseLinkRow} style={{ marginTop: "1rem" }}>
            <Link 
              href="/otw/franchise-requirements" 
              className={styles.franchiseLink}
              style={{
                color: "#667eea",
                textDecoration: "none",
                fontSize: "0.875rem",
                fontWeight: 500
              }}
            >
              View full franchise requirements →
            </Link>
          </p>
        </section>

        {/* Quick Stats Grid */}
        <div className={styles.grid} style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
          gap: "1rem",
          marginTop: "1.5rem"
        }}>
          <div className={styles.card} style={{
            padding: "1.5rem",
            borderRadius: "12px",
            background: "white",
            border: "1px solid #E5E7EB",
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
          }}>
            <div className={styles.cardTitle} style={{ 
              fontSize: "0.875rem", 
              fontWeight: 500, 
              color: "#6B7280",
              marginBottom: "0.5rem"
            }}>
              Current Status
            </div>
            <div className={styles.cardValue} style={{ 
              fontSize: "1.5rem", 
              fontWeight: 700, 
              color: "#111827",
              marginBottom: "0.25rem"
            }}>
              {statusLabel}
            </div>
            <div className={styles.cardSubtext} style={{ 
              fontSize: "0.875rem", 
              color: "#6B7280"
            }}>
              {statusNote}
            </div>
          </div>
          
          {avgRatingFromFeedback !== null && (
            <div className={styles.card} style={{
              padding: "1.5rem",
              borderRadius: "12px",
              background: "white",
              border: "1px solid #E5E7EB",
              boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
            }}>
              <div className={styles.cardTitle} style={{ 
                fontSize: "0.875rem", 
                fontWeight: 500, 
                color: "#6B7280",
                marginBottom: "0.5rem"
              }}>
                Driver Rating
              </div>
              <div className={styles.cardValue} style={{ 
                fontSize: "1.5rem", 
                fontWeight: 700, 
                color: "#111827",
                marginBottom: "0.25rem"
              }}>
                ⭐ {avgRatingFromFeedback.toFixed(1)}
              </div>
              <div className={styles.cardSubtext} style={{ 
                fontSize: "0.875rem", 
                color: "#6B7280"
              }}>
                High ratings unlock more perks
              </div>
            </div>
          )}
        </div>

        {/* Next Steps Card */}
        <div className={styles.card} style={{ 
          marginTop: "1.5rem",
          padding: "1.5rem",
          borderRadius: "12px",
          background: "#F9FAFB",
          border: "1px solid #E5E7EB"
        }}>
          <div className={styles.cardTitle} style={{ 
            fontSize: "1rem", 
            fontWeight: 600, 
            color: "#111827",
            marginBottom: "1rem"
          }}>
            Next Steps
          </div>
          <ul style={{ 
            margin: 0, 
            paddingLeft: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem"
          }}>
            <li style={{ fontSize: "0.875rem", color: "#374151", lineHeight: "1.5" }}>
              Stay Online to receive more jobs
            </li>
            <li style={{ fontSize: "0.875rem", color: "#374151", lineHeight: "1.5" }}>
              Complete your Haul Specialist training to unlock XL payouts
            </li>
            <li style={{ fontSize: "0.875rem", color: "#374151", lineHeight: "1.5" }}>
              Maintain rating above 4.8 for bonus earnings
            </li>
          </ul>
        </div>

        {/* Feedback Section */}
        <section className={styles.feedbackSection} style={{ marginTop: "2rem" }}>
          <h2 className={styles.sectionTitle} style={{ 
            fontSize: "1.25rem", 
            fontWeight: 600, 
            marginBottom: "1rem",
            color: "#111827"
          }}>
            Latest Feedback
          </h2>
          
          {feedbackLoading && (
            <p className={styles.feedbackStatus} style={{ 
              fontSize: "0.875rem", 
              color: "#6B7280",
              padding: "1rem",
              background: "#F9FAFB",
              borderRadius: "8px"
            }}>
              Loading feedback…
            </p>
          )}
          
          {feedbackError && (
            <p className={styles.feedbackError} style={{ 
              fontSize: "0.875rem", 
              color: "#DC2626",
              padding: "1rem",
              background: "#FEF2F2",
              borderRadius: "8px"
            }}>
              {feedbackError}
            </p>
          )}
          
          {!feedbackLoading && !feedbackError && feedback.length === 0 && (
            <p className={styles.feedbackStatus} style={{ 
              fontSize: "0.875rem", 
              color: "#6B7280",
              padding: "1rem",
              background: "#F9FAFB",
              borderRadius: "8px"
            }}>
              No feedback yet. Complete more OTW jobs to build your reputation.
            </p>
          )}
          
          {!feedbackLoading && feedback.length > 0 && (
            <>
              {avgRatingFromFeedback !== null && (
                <p className={styles.feedbackSummary} style={{ 
                  fontSize: "0.875rem", 
                  color: "#374151",
                  marginBottom: "1rem",
                  padding: "1rem",
                  background: "#F0FDF4",
                  borderRadius: "8px",
                  border: "1px solid #BBF7D0"
                }}>
                  Average rating from customers:{" "}
                  <span className={styles.feedbackRating} style={{ fontWeight: 600, color: "#059669" }}>
                    {avgRatingFromFeedback.toFixed(2)} ⭐
                  </span>{" "}
                  ({feedback.length} {feedback.length === 1 ? "rating" : "ratings"})
                </p>
              )}
              <ul className={styles.feedbackList} style={{ 
                display: "flex", 
                flexDirection: "column", 
                gap: "1rem",
                listStyle: "none",
                padding: 0,
                margin: 0
              }}>
                {feedback.slice(0, 5).map((fb) => (
                  <li key={fb.id} className={styles.feedbackItem} style={{
                    padding: "1.25rem",
                    borderRadius: "12px",
                    background: "white",
                    border: "1px solid #E5E7EB",
                    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
                  }}>
                    <div className={styles.feedbackHeaderRow} style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center",
                      marginBottom: "0.75rem"
                    }}>
                      <span className={styles.feedbackStars} style={{ fontSize: "1rem" }}>
                        {`${"⭐".repeat(fb.rating)}`}
                      </span>
                      <span className={styles.feedbackDate} style={{ fontSize: "0.75rem", color: "#6B7280" }}>
                        {new Date(fb.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {fb.comment && (
                      <p className={styles.feedbackComment} style={{ 
                        fontSize: "0.875rem", 
                        color: "#374151",
                        lineHeight: "1.5",
                        marginBottom: "0.75rem"
                      }}>
                        "{fb.comment}"
                      </p>
                    )}
                    <p className={styles.feedbackMeta} style={{ 
                      fontSize: "0.75rem", 
                      color: "#9CA3AF"
                    }}>
                      Request: {fb.requestId} • Customer: {fb.customerId}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Assigned Jobs Section */}
        <section className={styles.assignedSection} style={{ marginTop: "2rem" }}>
          <h2 className={styles.sectionTitle} style={{ 
            fontSize: "1.25rem", 
            fontWeight: 600, 
            marginBottom: "1rem",
            color: "#111827"
          }}>
            Assigned OTW Jobs
          </h2>
          
          {updateError && (
            <p className={styles.assignedError} style={{ 
              fontSize: "0.875rem", 
              color: "#DC2626",
              padding: "1rem",
              background: "#FEF2F2",
              borderRadius: "8px",
              marginBottom: "1rem"
            }}>
              {updateError}
            </p>
          )}
          
          {assignedLoading && (
            <p className={styles.assignedStatus} style={{ 
              fontSize: "0.875rem", 
              color: "#6B7280",
              padding: "1rem",
              background: "#F9FAFB",
              borderRadius: "8px"
            }}>
              Loading your OTW jobs…
            </p>
          )}
          
          {assignedError && (
            <p className={styles.assignedError} style={{ 
              fontSize: "0.875rem", 
              color: "#DC2626",
              padding: "1rem",
              background: "#FEF2F2",
              borderRadius: "8px"
            }}>
              {assignedError}
            </p>
          )}
          
          {!assignedLoading && !assignedError && assignedRequests.length === 0 && (
            <p className={styles.assignedStatus} style={{ 
              fontSize: "0.875rem", 
              color: "#6B7280",
              padding: "1rem",
              background: "#F9FAFB",
              borderRadius: "8px"
            }}>
              No jobs assigned yet. When OTW matches you to a request, it will appear here.
            </p>
          )}
          
          {!assignedLoading && assignedRequests.length > 0 && (
            <ul className={styles.assignedList} style={{ 
              display: "flex", 
              flexDirection: "column", 
              gap: "1rem",
              listStyle: "none",
              padding: 0,
              margin: 0
            }}>
              {assignedRequests.map((req) => (
                <li key={req.id} className={styles.assignedItem} style={{
                  padding: "1.5rem",
                  borderRadius: "12px",
                  background: "white",
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
                }}>
                  <div className={styles.assignedHeaderRow} style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    marginBottom: "1rem"
                  }}>
                    <span className={styles.assignedId} style={{ 
                      fontSize: "1rem", 
                      fontWeight: 600,
                      color: "#111827"
                    }}>
                      Request {req.id}
                    </span>
                    <span 
                      className={`${styles.assignedBadge} ${styles[`status_${String(req.status).toLowerCase()}`]}`}
                      style={{
                        padding: "0.25rem 0.75rem",
                        borderRadius: "9999px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: "#DBEAFE",
                        color: "#1E40AF"
                      }}
                    >
                      {req.status}
                    </span>
                  </div>
                  
                  <p className={styles.assignedRoute} style={{ 
                    fontSize: "1rem", 
                    fontWeight: 500,
                    color: "#374151",
                    marginBottom: "0.75rem"
                  }}>
                    {req.pickupArea} → {req.dropoffArea}
                  </p>
                  
                  <p className={styles.assignedMeta} style={{ 
                    fontSize: "0.875rem", 
                    color: "#6B7280",
                    marginBottom: "0.5rem"
                  }}>
                    {req.serviceType} • {req.urgency} • {new Date(req.createdAt).toLocaleDateString()}
                  </p>
                  
                  <p className={styles.assignedMiles} style={{ 
                    fontSize: "0.875rem", 
                    color: "#6B7280",
                    marginBottom: "0.75rem"
                  }}>
                    Estimated: {req.estimatedMiles.toLocaleString()} miles
                  </p>
                  
                  {req.notes && (
                    <p className={styles.assignedNotes} style={{ 
                      fontSize: "0.875rem", 
                      color: "#374151",
                      padding: "0.75rem",
                      background: "#F9FAFB",
                      borderRadius: "8px",
                      marginBottom: "1rem"
                    }}>
                      <strong>Notes:</strong> {req.notes}
                    </p>
                  )}
                  
                  <button
                    type="button"
                    className={styles.completeButton}
                    onClick={() => handleMarkCompleted(req.id)}
                    disabled={updatingRequestId === req.id}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      borderRadius: "8px",
                      background: updatingRequestId === req.id ? "#9CA3AF" : "#10B981",
                      color: "white",
                      border: "none",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      cursor: updatingRequestId === req.id ? "not-allowed" : "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    {updatingRequestId === req.id ? "Updating…" : "Mark Completed"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

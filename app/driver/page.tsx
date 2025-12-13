"use client";
import React, { useEffect, useState } from "react";
import DriverFranchiseCard from "@/components/otw/DriverFranchiseCard";
import { DriverStatus, OtwFeedback } from "@/lib/otw/otwTypes";
import OtwPageShell from "@/components/ui/otw/OtwPageShell";
import OtwSectionHeader from "@/components/ui/otw/OtwSectionHeader";
import OtwCard from "@/components/ui/otw/OtwCard";
import OtwStatPill from "@/components/ui/otw/OtwStatPill";
import OtwEmptyState from "@/components/ui/otw/OtwEmptyState";
import OtwButton from "@/components/ui/otw/OtwButton";

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
    <OtwPageShell
      header={<OtwSectionHeader title="OTW — Driver Console" subtitle="View available OTW requests, accept runs, and mark jobs completed." />}
    >
      <div className="space-y-6">
        <OtwCard>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold">OTW Driver Dashboard</div>
              <div className="text-sm opacity-80">{driverName} • {driverId}</div>
            </div>
            <div className="flex items-center gap-2">
              <OtwStatPill label="Status" value={statusLabel} tone={status === 'ONLINE' ? 'success' : 'neutral'} />
              <OtwButton variant="outline" onClick={handleToggleStatus}>{status === "ONLINE" ? "Go Offline" : "Go Online"}</OtwButton>
              {avgRatingFromFeedback !== null && (
                <OtwStatPill label="Rating" value={avgRatingFromFeedback.toFixed(1)} tone="gold" />
              )}
            </div>
          </div>
        </OtwCard>

        <OtwCard>
          <h3 className="text-lg font-semibold mb-3">Ownership Path — OTW Franchise</h3>
          <DriverFranchiseCard driverId={driverId} />
          <p className="mt-3">
            <a href="/otw/franchise-requirements" className="text-otwGold underline">View full franchise requirements</a>
          </p>
        </OtwCard>

        <div className="grid sm:grid-cols-2 gap-4">
          <OtwCard>
            <div className="text-sm font-medium">Current Status</div>
            <div className="text-2xl font-bold">{statusLabel}</div>
            <div className="text-sm opacity-80">{statusNote}</div>
          </OtwCard>
          {avgRatingFromFeedback !== null && (
            <OtwCard>
              <div className="text-sm font-medium">Rating</div>
              <div className="text-2xl font-bold">{avgRatingFromFeedback.toFixed(1)}</div>
              <div className="text-sm opacity-80">High ratings unlock more OTW perks.</div>
            </OtwCard>
          )}
        </div>

        <OtwCard>
          <div className="text-lg font-semibold mb-2">Next Steps</div>
          <ul className="list-disc pl-5">
            <li>Stay Online to receive more jobs.</li>
            <li>Complete your Haul Specialist training to unlock XL payouts.</li>
            <li>Maintain rating above 4.8 for bonus earnings.</li>
          </ul>
        </OtwCard>

        <section>
          <OtwSectionHeader title="Latest Feedback" />
          {feedbackLoading && <OtwCard>Loading feedback…</OtwCard>}
          {feedbackError && <OtwCard>{feedbackError}</OtwCard>}
          {!feedbackLoading && !feedbackError && feedback.length === 0 && (
            <OtwEmptyState title="No feedback yet" subtitle="Complete more OTW jobs to build your reputation." />
          )}
          {!feedbackLoading && feedback.length > 0 && (
            <>
              {avgRatingFromFeedback !== null && (
                <OtwCard>
                  <p className="text-sm">
                    Average rating from customers: <span className="font-semibold">{avgRatingFromFeedback.toFixed(2)} ⭐</span> ({feedback.length} ratings)
                  </p>
                </OtwCard>
              )}
              <div className="space-y-3">
                {feedback.slice(0, 5).map((fb) => (
                  <OtwCard key={fb.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{`${"⭐".repeat(fb.rating)}`}</span>
                      <span className="opacity-75">{new Date(fb.createdAt).toLocaleString()}</span>
                    </div>
                    {fb.comment && <p className="mt-2 text-sm">{fb.comment}</p>}
                    <p className="mt-1 text-xs opacity-75">Request: {fb.requestId} • Customer: {fb.customerId}</p>
                  </OtwCard>
                ))}
              </div>
            </>
          )}
        </section>

        <section>
          <OtwSectionHeader title="Assigned OTW Jobs" />
          {updateError && (<OtwCard>{updateError}</OtwCard>)}
          {assignedLoading && (<OtwCard>Loading your OTW jobs…</OtwCard>)}
          {assignedError && (<OtwCard>{assignedError}</OtwCard>)}
          {!assignedLoading && !assignedError && assignedRequests.length === 0 && (
            <OtwEmptyState title="No jobs assigned yet" subtitle="When OTW matches you to a request, it will appear here." />
          )}
          {!assignedLoading && assignedRequests.length > 0 && (
            <div className="space-y-3">
              {assignedRequests.map((req) => (
                <OtwCard key={req.id}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Request {req.id}</span>
                    <OtwStatPill label="Status" value={req.status} tone="neutral" />
                  </div>
                  <p className="mt-1 text-sm">{req.pickupArea} → {req.dropoffArea}</p>
                  <p className="text-xs opacity-75">
                    {req.serviceType} • {req.urgency} • {new Date(req.createdAt).toLocaleString()}
                  </p>
                  <p className="text-xs opacity-75">Est. {req.estimatedMiles.toLocaleString()} miles</p>
                  {req.notes && (<p className="mt-1 text-sm">Notes: {req.notes}</p>)}
                  <div className="mt-3">
                    <OtwButton
                      variant="gold"
                      onClick={() => handleMarkCompleted(req.id)}
                      disabled={updatingRequestId === req.id}
                    >
                      {updatingRequestId === req.id ? "Updating…" : "Mark Completed"}
                    </OtwButton>
                  </div>
                </OtwCard>
              ))}
            </div>
          )}
        </section>
      </div>
    </OtwPageShell>
  );
}

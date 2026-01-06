"use client";

import React, { useEffect, useState } from "react";
import styles from "./MyOtwRequests.module.css";
import OtwLiveMap from "./OtwLiveMap";
import { OtwDriverLocation } from "@/lib/otw/otwDriverLocation";
import OtwFeedbackForm from "./OtwFeedbackForm";
import type { OtwLocation } from "@/lib/otw/otwTypes";

interface OtwRequest {
  id: string;
  serviceType: string;
  urgency: string;
  pickupArea: string;
  dropoffArea: string;
  pickupLocation?: OtwLocation;
  dropoffLocation?: OtwLocation;
  notes?: string;
  createdAt: string;
  estimatedMiles: number;
  estimatedDistanceKm?: number;
  estimatedDurationMinutes?: number;
  status: string;
  assignedDriverId?: string;
}

const MyOtwRequests: React.FC = () => {
  const [requests, setRequests] = useState<OtwRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<OtwRequest | null>(null);
  const [refreshToggle, setRefreshToggle] = useState(0);
  const [mapDrivers, setMapDrivers] = useState<OtwDriverLocation[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [trackedRequestId, setTrackedRequestId] = useState<string | null>(null);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/otw/requests");
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || "Unable to load OTW requests.");
          setRequests([]);
          return;
        }

        const list: OtwRequest[] = data.requests || [];
        list.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setRequests(list);
      } catch (err) {
        console.error("Failed to fetch OTW requests:", err);
        setError("Network error while loading OTW requests.");
        setRequests([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [refreshToggle]);

  const handleRateClick = (request: OtwRequest) => {
    setSelectedRequest(request);
  };

  const handleFeedbackSubmitted = () => {
    setRefreshToggle((prev) => prev + 1);
  };

  const handleTrackClick = async (requestId: string) => {
    try {
      setTrackedRequestId(requestId);
      setMapLoading(true);
      setMapError(null);
      const res = await fetch(`/api/otw/driver/locations?requestId=${encodeURIComponent(requestId)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMapError(data.error || "Unable to load driver locations.");
        setMapDrivers([]);
        return;
      }
      setMapDrivers((data.locations || []) as OtwDriverLocation[]);
    } catch (err) {
      console.error("Failed to load driver locations:", err);
      setMapError("Network error while loading driver locations.");
      setMapDrivers([]);
    } finally {
      setMapLoading(false);
    }
  };

  return (
    <section className={styles.myRequests}>
      <h2 className={styles.sectionHeader}>My OTW Requests</h2>
      <p className={styles.sectionSubtext}>
        Review your recent OTW movement and rate your experiences.
      </p>

      {loading && <p className={styles.statusText}>Loading your OTW history…</p>}

      {error && <p className={styles.errorText}>{error}</p>}

      {!loading && !error && requests.length === 0 && (
        <p className={styles.statusText}>
          No OTW requests found yet. Once you start using OTW, your history will appear here.
        </p>
      )}

      {!loading && !error && requests.length > 0 && (
        <div className={styles.requestsList}>
          {requests.map((req) => (
            <div key={req.id} className={styles.requestCard}>
              <div className={styles.requestHeaderRow}>
                <span className={styles.requestId}>Request {req.id}</span>
                <span
                  className={`${styles.statusBadge} ${styles[`status_${String(req.status).toLowerCase()}`]}`}
                >
                  {req.status}
                </span>
              </div>

              <p className={styles.requestRoute}>
                {req.pickupArea} → {req.dropoffArea}
              </p>

              <p className={styles.requestMeta}>
                {req.serviceType} • {req.urgency} •{" "}
                {new Date(req.createdAt).toLocaleString()}
              </p>

              <p className={styles.requestMiles}>
                Estimated: {req.estimatedMiles.toLocaleString()} miles
              </p>
              <div className={styles.metricsRow}>
                <span className={styles.metricItem}>
                  Distance: {typeof req.estimatedDistanceKm === "number" ? `${req.estimatedDistanceKm.toFixed(1)} km` : "N/A"}
                </span>
                <span className={styles.metricItem}>
                  Time: {typeof req.estimatedDurationMinutes === "number" ? `${req.estimatedDurationMinutes} min` : "N/A"}
                </span>
                <span className={styles.metricItem}>
                  OTW Miles: {typeof req.estimatedMiles === "number" ? req.estimatedMiles : "N/A"}
                </span>
              </div>

              {req.assignedDriverId && (
                <p className={styles.assignedLine}>
                  Assigned driver:{" "}
                  <span className={styles.assignedDriverValue}>{req.assignedDriverId}</span>
                </p>
              )}

              {req.notes && <p className={styles.requestNotes}>Notes: {req.notes}</p>}
              <button
                type="button"
                className={styles.trackButton}
                onClick={() => handleTrackClick(req.id)}
              >
                Track OTW
              </button>
              {trackedRequestId === req.id && mapLoading && mapError == null && (
                <p className={styles.trackStatus}>Loading live driver location…</p>
              )}
              {trackedRequestId === req.id && mapError && (
                <p className={styles.trackError}>{mapError}</p>
              )}
              {trackedRequestId === req.id && (
                <OtwLiveMap
                  pickup={req.pickupLocation}
                  customer={req.dropoffLocation}
                  requestId={req.id}
                  jobStatus={req.status}
                  drivers={mapDrivers}
                />
              )}
              {req.status === "COMPLETED" && (
                <button
                  type="button"
                  className={styles.rateButton}
                  onClick={() => handleRateClick(req)}
                >
                  Rate this OTW
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedRequest && (
        <div className={styles.feedbackFormWrapper}>
          <h3 className={styles.feedbackHeader}>Rate Request {selectedRequest.id}</h3>
          <OtwFeedbackForm
            initialRequestId={selectedRequest.id}
            initialDriverId={"DRIVER-1"}
            initialCustomerId={"CUSTOMER-1"}
            onSubmitted={handleFeedbackSubmitted}
          />
        </div>
      )}
    </section>
  );
};

export default MyOtwRequests;

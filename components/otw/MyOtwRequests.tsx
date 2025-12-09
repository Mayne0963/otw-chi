import React, { useEffect, useState } from "react";
import styles from "./MyOtwRequests.module.css";
import OtwFeedbackForm from "./OtwFeedbackForm";

interface OtwRequest {
  id: string;
  serviceType: string;
  urgency: string;
  pickupArea: string;
  dropoffArea: string;
  notes?: string;
  createdAt: string;
  estimatedMiles: number;
  status: string;
}

const MyOtwRequests: React.FC = () => {
  const [requests, setRequests] = useState<OtwRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<OtwRequest | null>(null);
  const [refreshToggle, setRefreshToggle] = useState(0);

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
                <span className={styles.requestId}>{req.id}</span>
                <span className={styles.statusBadge}>{req.status}</span>
              </div>
              <p className={styles.requestMeta}>
                {req.serviceType} • {req.urgency} • {new Date(req.createdAt).toLocaleString()}
              </p>
              <p className={styles.requestRoute}>
                {req.pickupArea} → {req.dropoffArea}
              </p>
              <p className={styles.requestMiles}>
                Estimated: {req.estimatedMiles.toLocaleString()} miles
              </p>
              {req.notes && <p className={styles.requestNotes}>Notes: {req.notes}</p>}
              <button
                type="button"
                className={styles.rateButton}
                onClick={() => handleRateClick(req)}
              >
                Rate this OTW
              </button>
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


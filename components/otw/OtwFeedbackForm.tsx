import React, { useEffect, useState } from "react";
import styles from "./OtwFeedbackForm.module.css";

interface OtwFeedbackFormProps {
  initialRequestId?: string;
  initialDriverId?: string;
  initialCustomerId?: string;
  onSubmitted?: () => void;
}

const OtwFeedbackForm: React.FC<OtwFeedbackFormProps> = ({
  initialRequestId,
  initialDriverId,
  initialCustomerId,
  onSubmitted,
}) => {
  const [requestId, setRequestId] = useState(initialRequestId ?? "");
  const [driverId, setDriverId] = useState(initialDriverId ?? "DRIVER-1");
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "CUSTOMER-1");
  const [rating, setRating] = useState<number | "">("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (initialRequestId !== undefined) {
      setRequestId(initialRequestId);
    }
  }, [initialRequestId]);

  useEffect(() => {
    if (initialDriverId !== undefined) {
      setDriverId(initialDriverId);
    }
  }, [initialDriverId]);

  useEffect(() => {
    if (initialCustomerId !== undefined) {
      setCustomerId(initialCustomerId);
    }
  }, [initialCustomerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!requestId.trim()) {
      setError("Please provide a request ID.");
      return;
    }

    if (rating === "" || typeof rating !== "number") {
      setError("Please choose a rating from 1 to 5.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/otw/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestId.trim(),
          driverId,
          customerId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Unable to send feedback.");
        return;
      }

      setSuccess("Thank you! Your feedback has been recorded.");
      setComment("");
      setRating("");
      if (onSubmitted) {
        onSubmitted();
      }
      // Optional: keep requestId so they can rate multiple aspects of same job
    } catch (err) {
      console.error("Feedback submit failed:", err);
      setError("Network error while sending feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className={styles.feedbackForm} onSubmit={handleSubmit}>
      <h2 style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>Rate Your OTW Experience</h2>

      <div className={styles.field}>
        <label htmlFor="requestId" className={styles.label}>Request ID</label>
        <input
          id="requestId"
          className={styles.input}
          type="text"
          placeholder="Example: REQ-1"
          value={requestId}
          onChange={(e) => setRequestId(e.target.value)}
          readOnly={Boolean(initialRequestId)}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="rating" className={styles.label}>Rating</label>
        <select
          id="rating"
          className={styles.select}
          value={rating === "" ? "" : String(rating)}
          onChange={(e) => {
            const v = e.target.value;
            setRating(v === "" ? "" : Number(v));
          }}
        >
          <option value="">Select a rating</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="comment" className={styles.label}>Comment (optional)</label>
        <textarea
          id="comment"
          className={styles.textarea}
          placeholder="Share any details about your experience"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      <div className={styles.actions}>
        <button type="submit" className={styles.submitButton} disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Feedback"}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {success && <p className={styles.success}>{success}</p>}
    </form>
  );
};

export default OtwFeedbackForm;

"use client";

import React, { useState } from "react";
import styles from "./OtwRequestPicker.module.css";
import { Urgency } from "../../lib/otw/otwTypes";

type UiServiceType = "MOVE" | "EXCHANGE" | "HAUL" | "PRESENCE" | "BUSINESS" | "MULTI_STOP";

interface ServiceConfig {
  id: UiServiceType;
  title: string;
  subtitle: string;
}

interface EstimateResponse {
  success?: boolean;
  estimatedMiles?: number;
  breakdown?: {
    base: number;
    complexityBonus: number;
    urgencyMultiplier: number;
  };
  error?: string;
}

const serviceOptions: ServiceConfig[] = [
  { id: "MOVE", title: "Move", subtitle: "Errands & everyday runs" },
  { id: "EXCHANGE", title: "Exchange", subtitle: "Forgotten items, swaps, kid stuff" },
  { id: "HAUL", title: "Haul", subtitle: "Big items, appliances, TV’s" },
  { id: "PRESENCE", title: "Presence", subtitle: "We show up when you can’t" },
  { id: "BUSINESS", title: "Business", subtitle: "For stores, barbers, boutiques, offices" },
  { id: "MULTI_STOP", title: "Multi-Stop", subtitle: "Routes & multiple stops" },
];

const emojiForService = (id: UiServiceType): string => {
  switch (id) {
    case "MOVE":
      return "🚗";
    case "EXCHANGE":
      return "🔁";
    case "HAUL":
      return "📦";
    case "PRESENCE":
      return "👁️‍🗨️";
    case "BUSINESS":
      return "🏢";
    case "MULTI_STOP":
      return "🧭";
    default:
      return "📍";
  }
};

const OtwRequestPicker: React.FC = () => {
  const [selectedService, setSelectedService] = useState<UiServiceType | null>(null);
  const [pickupArea, setPickupArea] = useState("");
  const [dropoffArea, setDropoffArea] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("NORMAL");
  const [notes, setNotes] = useState("");
  const [estimatedMiles, setEstimatedMiles] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mapUiToServerService = (s: UiServiceType): string => {
    switch (s) {
      case "MOVE":
        return "ERRAND";
      case "EXCHANGE":
        return "DOCUMENT";
      case "HAUL":
        return "BIG_HAUL";
      case "PRESENCE":
        return "VIP";
      case "BUSINESS":
        return "OTHER";
      case "MULTI_STOP":
        return "OTHER";
      default:
        return "OTHER";
    }
  };

  const buildPayload = () => {
    if (!selectedService) return null;
    return {
      serviceType: mapUiToServerService(selectedService),
      urgency,
      pickupArea: pickupArea.trim(),
      dropoffArea: dropoffArea.trim(),
      notes: notes.trim() || undefined,
    };
  };

  const handleEstimateClick = async () => {
    setSubmitSuccessMessage(null);
    setSubmitError(null);

    if (!selectedService) {
      setValidationError("Please choose a service type.");
      setEstimatedMiles(null);
      return;
    }

    if (!pickupArea.trim() || !dropoffArea.trim()) {
      setValidationError("Please fill in both pickup and dropoff areas.");
      setEstimatedMiles(null);
      return;
    }

    setValidationError(null);
    setIsEstimating(true);

    const payload = buildPayload();
    if (!payload) {
      setIsEstimating(false);
      setValidationError("Something went wrong building your request.");
      return;
    }

    try {
      const response = await fetch("/api/otw/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: EstimateResponse = await response.json();
      if (!response.ok || data.error || typeof data.estimatedMiles !== "number") {
        setEstimatedMiles(null);
        setSubmitError(data.error || "Unable to get an OTW estimate right now.");
        return;
      }
      setEstimatedMiles(data.estimatedMiles);
    } catch (error) {
      console.error("Estimate request failed:", error);
      setEstimatedMiles(null);
      setSubmitError("Network error: unable to connect to OTW estimate.");
    } finally {
      setIsEstimating(false);
    }
  };

  const handleSubmitRequest = async () => {
    setSubmitSuccessMessage(null);
    setSubmitError(null);

    if (!selectedService) {
      setValidationError("Please choose a service type.");
      return;
    }
    if (!pickupArea.trim() || !dropoffArea.trim()) {
      setValidationError("Please fill in both pickup and dropoff areas.");
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);

    const payload = buildPayload();
    if (!payload) {
      setIsSubmitting(false);
      setValidationError("Something went wrong building your request.");
      return;
    }

    try {
      const response = await fetch("/api/otw/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setSubmitError(data.error || "Unable to send request to OTW.");
        return;
      }
      if (typeof data.request?.estimatedMiles === "number") {
        setEstimatedMiles(data.request.estimatedMiles);
      }
      setSubmitSuccessMessage("Your OTW request has been created.");
    } catch (error) {
      console.error("OTW request creation failed:", error);
      setSubmitError("Network error: unable to send request to OTW.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    setSelectedService(null);
    setPickupArea("");
    setDropoffArea("");
    setUrgency("NORMAL");
    setNotes("");
    setEstimatedMiles(null);
    setValidationError(null);
    setSubmitError(null);
    setSubmitSuccessMessage(null);
  };

  return (
    <div className={styles.requestPicker}>
      {/* Title / Intro */}
      <section>
        <h2 className={styles.sectionTitle}>Start a New OTW Request</h2>
        <p className={styles.helperText}>Choose what you need and where you need us.</p>
      </section>

      {/* Service Type Grid */}
      <section>
        <div className={styles.serviceGrid}>
          {serviceOptions.map((opt) => {
            const selected = selectedService === opt.id;
            return (
              <div
                key={opt.id}
                className={`${styles.serviceCard} ${selected ? styles.serviceCardSelected : ""}`}
                onClick={() => setSelectedService(opt.id)}
                role="button"
                aria-pressed={selected}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedService(opt.id);
                }}
              >
                <div className={styles.serviceIcon}>{emojiForService(opt.id)}</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div className={styles.serviceTitle}>{opt.title}</div>
                  <div className={styles.serviceSubtitle}>{opt.subtitle}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Basic Details Section */}
      {selectedService && (
        <section>
          <h3 className={styles.sectionTitle}>Basic Details</h3>
          <div className={styles.inputsRow}>
            <div className={styles.field}>
              <label htmlFor="pickup" className={styles.label}>Pickup Area / Side of Town</label>
              <input
                id="pickup"
                className={styles.input}
                type="text"
                placeholder="Example: North Fort Wayne / Coldwater Rd"
                value={pickupArea}
                onChange={(e) => setPickupArea(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="dropoff" className={styles.label}>Dropoff Area / Side of Town</label>
              <input
                id="dropoff"
                className={styles.input}
                type="text"
                placeholder="Example: South Decatur Rd"
                value={dropoffArea}
                onChange={(e) => setDropoffArea(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="urgency" className={styles.label}>When do you need this?</label>
              <select
                id="urgency"
                className={styles.input}
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as Urgency)}
              >
                <option value="NORMAL">Normal (today or scheduled)</option>
                <option value="PRIORITY">Priority (within a few hours)</option>
                <option value="RUSH">Rush (as fast as possible)</option>
              </select>
            </div>
            <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="notes" className={styles.label}>What are we helping with?</label>
              <textarea
                id="notes"
                className={`${styles.input} ${styles.textarea}`}
                placeholder={"Pick up an 88\" TV and washer from Best Buy and bring to my house."}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleEstimateClick}
              disabled={isEstimating || isSubmitting}
            >
              {isEstimating ? "Estimating..." : "Get OTW Miles Estimate"}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleSubmitRequest}
              disabled={isEstimating || isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Send Request to OTW"}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleClear}
              disabled={isEstimating || isSubmitting}
            >
              Clear
            </button>
          </div>

          {validationError && (
            <p className={styles.validationError}>{validationError}</p>
          )}

          {submitError && (
            <p className={styles.submitError}>{submitError}</p>
          )}

          {submitSuccessMessage && (
            <p className={styles.submitSuccess}>{submitSuccessMessage}</p>
          )}

          {estimatedMiles !== null && (
            <div className={styles.estimateCard}>
              <h3 className={styles.estimateTitle}>Estimated OTW Miles</h3>
              <p className={styles.estimateValue}>{estimatedMiles.toLocaleString()} miles</p>
              {selectedService && (
                <p className={styles.estimateSubtitle}>
                  {`Based on a ${urgency.toLowerCase()} ${selectedService.toLowerCase().replace("_", " ")} request with the areas you entered.`}
                </p>
              )}
              <p className={styles.helperText}>
                This is a rough estimate for planning only. Final OTW Miles may adjust once the full route, timing, and load are calculated.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default OtwRequestPicker;

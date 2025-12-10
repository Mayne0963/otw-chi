"use client";

import React, { useState } from "react";
import styles from "./OtwRequestForm.module.css";
import { ServiceType } from "@/lib/otw/otwEnums";


type RequestState = "idle" | "submitting" | "success" | "error";

interface ApiResponse {
  success: boolean;
  request?: any;
  membership?: any;
  tier?: any;
  eligibility?: any;
  error?: string;
  details?: any;
}

const serviceTypeOptions: { value: ServiceType; label: string }[] = [
  { value: "ERRAND", label: "Errand / Groceries" },
  { value: "FOOD", label: "Food Pickup" },
  { value: "BIG_HAUL", label: "Big Haul (TV, appliances)" },
  { value: "VIP", label: "VIP Concierge" },
];

const OtwRequestForm: React.FC = () => {
  const [serviceType, setServiceType] = useState<ServiceType>("ERRAND");
  const [estimatedMiles, setEstimatedMiles] = useState<number>(500);
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<RequestState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ApiResponse | null>(null);
  const [customerId, setCustomerId] = useState<string>("CUSTOMER-1");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("submitting");
    setErrorMessage(null);
    setLastResult(null);

    try {
      const res = await fetch("/api/otw/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          serviceType,
          estimatedMiles,
          notes: notes || undefined,
        }),
      });

      const data: ApiResponse = await res.json();

      if (!res.ok || !data.success) {
        setState("error");
        setErrorMessage(
          data.error ||
            "Something went wrong while creating your OTW request."
        );
        setLastResult(data);
        return;
      }

      setState("success");
      setLastResult(data);
      setNotes("");
    } catch (err) {
      console.error("OTW request error:", err);
      setState("error");
      setErrorMessage("Network error while creating OTW request.");
    }
  };

  return (
    <div className={styles.shell}>
      <h2 className={styles.title}>Book an OTW Run</h2>
      <p className={styles.subtitle}>
        Choose your service, enter estimated OTW miles, and send it OTW.
      </p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label}>
          Customer ID
          <input
            type="text"
            className={styles.input}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder="CUSTOMER-1"
          />
        </label>
        <label className={styles.label}>
          Service Type
          <select
            className={styles.select}
            value={serviceType}
            onChange={(e) =>
              setServiceType(e.target.value as ServiceType)
            }
          >
            {serviceTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.label}>
          Estimated OTW Miles
          <input
            type="number"
            min={1}
            step={10}
            className={styles.input}
            value={estimatedMiles}
            onChange={(e) =>
              setEstimatedMiles(Number(e.target.value) || 0)
            }
          />
          <span className={styles.helpText}>
            This represents internal OTW miles, not literal road miles.
          </span>
        </label>

        <label className={styles.label}>
          Notes (optional)
          <textarea
            className={styles.textarea}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Example: Pick up groceries from Kroger on Lima, drop at my apartment..."
          />
        </label>

        <button
          type="submit"
          className={styles.submitButton}
          disabled={state === "submitting"}
        >
          {state === "submitting" ? "Sending..." : "Send OTW"}
        </button>

        {state === "error" && errorMessage && (
          <p className={styles.error}>{errorMessage}</p>
        )}

        {state === "success" && lastResult?.request && (
          <div className={styles.successBox}>
            <p className={styles.successTitle}>Request Created ✅</p>
            <p className={styles.successLine}>
              Request ID: <strong>{lastResult.request.id}</strong>
            </p>
            <p className={styles.successLine}>
              Tier: <strong>{lastResult.tier?.name}</strong>
            </p>
            <p className={styles.successLine}>
              Miles Remaining:{" "}
              <strong>
                {lastResult.membership?.milesRemaining ?? "—"}
              </strong>
            </p>
            {lastResult.eligibility?.reason && (
              <p className={styles.successLine}>
                Eligibility: {lastResult.eligibility.reason}
              </p>
            )}
          </div>
        )}

        {state !== "submitting" && lastResult?.details?.suggestedUpgradeTier && (
          <div className={styles.upgradeBox}>
            <p className={styles.upgradeTitle}>
              Upgrade Recommended 🔼
            </p>
            <p className={styles.upgradeLine}>
              {lastResult.details.suggestedUpgradeTier.name} —{" "}
              {lastResult.details.suggestedUpgradeTier.description}
            </p>
          </div>
        )}
      </form>
    </div>
  );
};

export default OtwRequestForm;

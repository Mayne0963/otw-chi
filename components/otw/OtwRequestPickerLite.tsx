import React, { useState } from "react";
import styles from "./OtwRequestPickerLite.module.css";

type ServiceType = "MOVE" | "EXCHANGE" | "HAUL" | "PRESENCE" | "BUSINESS" | "MULTI_STOP";
type Urgency = "NORMAL" | "PRIORITY" | "RUSH";

interface ServiceConfig {
  id: ServiceType;
  title: string;
  subtitle: string;
}

const serviceOptions: ServiceConfig[] = [
  { id: "MOVE", title: "Move", subtitle: "Errands & everyday runs" },
  { id: "EXCHANGE", title: "Exchange", subtitle: "Forgotten items, swaps, kid stuff" },
  { id: "HAUL", title: "Haul", subtitle: "Big items, appliances, TV’s" },
  { id: "PRESENCE", title: "Presence", subtitle: "We show up when you can’t" },
  { id: "BUSINESS", title: "Business", subtitle: "For stores, barbers, boutiques, offices" },
  { id: "MULTI_STOP", title: "Multi-Stop", subtitle: "Routes & multiple stops" },
];

const emojiForService = (id: ServiceType): string => {
  switch (id) {
    case "MOVE":
      return "🚗";
    case "EXCHANGE":
      return "🔁";
    case "HAUL":
      return "📺";
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
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [pickupArea, setPickupArea] = useState("");
  const [dropoffArea, setDropoffArea] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("NORMAL");
  const [notes, setNotes] = useState("");

  const handleEstimate = () => {
    if (!selectedService || !pickupArea.trim() || !dropoffArea.trim()) {
      alert("Please choose service type and fill pickup/dropoff areas.");
      return;
    }
    alert("OTW estimate coming soon – service: " + selectedService);
  };

  const handleClear = () => {
    setSelectedService(null);
    setPickupArea("");
    setDropoffArea("");
    setUrgency("NORMAL");
    setNotes("");
  };

  return (
    <div className={styles.requestPicker}>
      <section>
        <h2 className={styles.sectionTitle}>Start a New OTW Request</h2>
        <p className={styles.helperText}>Choose what you need and where you need us.</p>
      </section>

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
                <div className={styles.serviceTitle}>{opt.title}</div>
                <div className={styles.serviceSubtitle}>{opt.subtitle}</div>
              </div>
            );
          })}
        </div>
      </section>

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

          <div className={styles.actions}>
            <button type="button" className={styles.primaryButton} onClick={handleEstimate}>
              Get OTW Miles Estimate
            </button>
            <button type="button" className={styles.secondaryButton} onClick={handleClear}>
              Clear
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default OtwRequestPicker;


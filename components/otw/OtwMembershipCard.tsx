"use client";

import React, { useMemo, useState, useEffect } from "react";
import styles from "./OtwMembershipCard.module.css";
import { getMembershipForCustomer, estimateRemainingMiles, getAllTiers } from "../../lib/otw/otwMembership";
import { getTierById } from "../../lib/otw/otwTierCatalog";

const OtwMembershipCard: React.FC = () => {
  const customerId = "CUSTOMER-1";

  const membership = useMemo(() => getMembershipForCustomer(customerId), [customerId]);

  const [allTiers, setAllTiers] = useState<any[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<string>("");
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = useState<string | null>(null);

  useEffect(() => {
    const tiers = getAllTiers?.() || [];
    setAllTiers(tiers);
  }, []);

  useEffect(() => {
    if (membership && !selectedTierId) {
      setSelectedTierId(membership.tierId as string);
    }
  }, [membership, selectedTierId]);

  if (!membership) {
    return (
      <div className={styles.card}>
        <h2 className={styles.title}>Your OTW Membership</h2>
        <p className={styles.text}>
          You don&apos;t have an active OTW membership yet. Once you pick a tier,
          your miles and perks will show up here.
        </p>
      </div>
    );
  }

  const tier = getTierById(membership.tierId);
  const remainingMiles = estimateRemainingMiles(membership);
  const renewSource = (membership as any).renewsOn || membership.renewsAtIso;
  const renewDateLabel = renewSource ? new Date(renewSource).toLocaleDateString() : "—";

  const handleChangeTier = async () => {
    if (!selectedTierId) return;
    try {
      setChangeError(null);
      setChangeSuccess(null);
      setChanging(true);
      const res = await fetch("/api/otw/membership/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId: selectedTierId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setChangeError(data.error || "Unable to change membership tier.");
        return;
      }
      setChangeSuccess("Your OTW membership tier has been updated.");
    } catch (err) {
      console.error("Failed to change OTW membership tier:", err);
      setChangeError("Network error while changing membership tier.");
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Your OTW Membership</h2>
      <p className={styles.tierName}>{tier?.name ?? String(membership.tierId)}</p>
      {tier?.description && <p className={styles.text}>{tier.description}</p>}

      <div className={styles.milesRow}>
        <div className={styles.milesBlock}>
          <span className={styles.milesLabel}>Miles Cap</span>
          <span className={styles.milesValue}>{(membership as any).milesCap?.toLocaleString?.() ?? "—"}</span>
        </div>
        <div className={styles.milesBlock}>
          <span className={styles.milesLabel}>Used</span>
          <span className={styles.milesValue}>{(membership as any).milesUsed?.toLocaleString?.() ?? "—"}</span>
        </div>
        <div className={styles.milesBlock}>
          <span className={styles.milesLabel}>Rollover</span>
          <span className={styles.milesValue}>{(membership as any).rolloverMiles?.toLocaleString?.() ?? "—"}</span>
        </div>
        <div className={styles.milesBlock}>
          <span className={styles.milesLabel}>Remaining*</span>
          <span className={styles.milesValue}>{remainingMiles.toLocaleString()}</span>
        </div>
      </div>

      <p className={styles.meta}>
        Status: <span className={styles.status}>{String((membership as any).status ?? "ACTIVE")}</span> •
        {" "}Renews on <span className={styles.date}>{renewDateLabel}</span>
      </p>

      {tier?.perks?.length ? (
        <div className={styles.perks}>
          <p className={styles.perksTitle}>Key Perks:</p>
          <ul className={styles.perksList}>
            {tier.perks.map((perk) => (
              <li key={perk} className={styles.perkItem}>
                {perk}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {allTiers.length > 0 && (
        <div className={styles.tierChangeBlock}>
          <p className={styles.tierChangeLabel}>Change your OTW tier:</p>
          <div className={styles.tierChangeRow}>
            <select
              className={styles.tierSelect}
              value={selectedTierId}
              onChange={(e) => setSelectedTierId(e.target.value)}
            >
              {allTiers.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name} – {Number(t.includedMiles).toLocaleString()} miles / month
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.tierChangeButton}
              disabled={changing}
              onClick={handleChangeTier}
            >
              {changing ? "Updating…" : "Update Tier"}
            </button>
          </div>
          {changeError && <p className={styles.tierChangeError}>{changeError}</p>}
          {changeSuccess && <p className={styles.tierChangeSuccess}>{changeSuccess}</p>}
        </div>
      )}

      <p className={styles.hint}>
        *Remaining miles include your monthly cap plus any rollover. Future OTW versions will let you upgrade or add miles instantly.
      </p>
    </div>
  );
};

export default OtwMembershipCard;

import React, { useMemo } from "react";
import styles from "./OtwMembershipCard.module.css";
import { getMembershipForCustomer, estimateRemainingMiles } from "../../lib/otw/otwMembership";
import { getTierById } from "../../lib/otw/otwTierCatalog";

const OtwMembershipCard: React.FC = () => {
  const customerId = "CUSTOMER-1";

  const membership = useMemo(() => getMembershipForCustomer(customerId), [customerId]);

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

      <p className={styles.hint}>
        *Remaining miles include your monthly cap plus any rollover. Future OTW versions will let you upgrade or add miles instantly.
      </p>
    </div>
  );
};

export default OtwMembershipCard;


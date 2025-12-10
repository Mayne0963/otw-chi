"use client";

import React from "react";
import styles from "./FranchiseRequirements.module.css";

const FranchiseRequirements: React.FC = () => {
  return (
    <div className={styles.shell}>
      <section className={styles.introSection}>
        <h2 className={styles.title}>OTW Franchise Path</h2>
        <p className={styles.lead}>
          OTW isn&apos;t just a gig. It&apos;s a path from <strong>driver</strong> to <strong>owner</strong>. Your
          franchise score, rank, and habits determine when HQ taps you for your own lane.
        </p>
        <p className={styles.note}>
          These are guidelines, not strict guarantees. The system uses your <strong>completed jobs</strong>, <strong>cancellations</strong>,
          <strong> ratings</strong>, and <strong>NIP earned</strong> to calculate your readiness.
        </p>
      </section>

      <section className={styles.grid}>
        {/* NOT ELIGIBLE */}
        <article className={styles.card}>
          <h3 className={styles.rankLabel}>NOT ELIGIBLE</h3>
          <p className={styles.rankTagline}>Just Getting Moving</p>
          <ul className={styles.list}>
            <li>Very few completed OTW runs.</li>
            <li>Cancellations or no consistent activity yet.</li>
            <li>Ratings still building or not enough feedback.</li>
            <li>Little or no NIP earned so far.</li>
          </ul>
          <p className={styles.tip}>
            <strong>How to level up:</strong> Accept jobs, finish them cleanly, and avoid cancelling unless absolutely necessary.
          </p>
        </article>

        {/* SEED */}
        <article className={styles.card}>
          <h3 className={styles.rankLabel}>SEED</h3>
          <p className={styles.rankTagline}>Foundation Stage</p>
          <ul className={styles.list}>
            <li>Dozens of completed runs.</li>
            <li>Cancellations are improving but still visible.</li>
            <li>Ratings trending positive, some 5-star feedback.</li>
            <li>Steady NIP trickling in from completed jobs.</li>
          </ul>
          <p className={styles.tip}>
            <strong>How to level up:</strong> Focus on on-time arrivals, professional communication, and saying &quot;yes&quot; to more jobs in your zone.
          </p>
        </article>

        {/* BRONZE */}
        <article className={styles.card}>
          <h3 className={styles.rankLabel}>BRONZE</h3>
          <p className={styles.rankTagline}>Solid Grinder</p>
          <ul className={styles.list}>
            <li>Strong track record of completed runs.</li>
            <li>Low cancellation rate most weeks.</li>
            <li>Ratings generally 4.5+ with positive comments.</li>
            <li>NIP balance and total earned both growing.</li>
          </ul>
          <p className={styles.tip}>
            <strong>How to level up:</strong> Treat every run like an interview for ownership—clean car, clear updates, and problem-solving when customers are stressed.
          </p>
        </article>

        {/* SILVER */}
        <article className={styles.card}>
          <h3 className={styles.rankLabel}>SILVER</h3>
          <p className={styles.rankTagline}>Trusted OTW Driver</p>
          <ul className={styles.list}>
            <li>High number of completed jobs across different service types.</li>
            <li>Very low cancellation rate.</li>
            <li>Consistent high ratings and repeat customers.</li>
            <li>NIP total earned shows real commitment and time in.</li>
          </ul>
          <p className={styles.tip}>
            <strong>How to level up:</strong> Stay consistent, avoid burnout, and maintain your standards even on slow or late-night runs.
          </p>
        </article>

        {/* GOLD */}
        <article className={styles.card}>
          <h3 className={styles.rankLabel}>GOLD</h3>
          <p className={styles.rankTagline}>Franchise Material</p>
          <ul className={styles.list}>
            <li>Very strong job volume and completion rate.</li>
            <li>Almost no cancellations without a real reason.</li>
            <li>Ratings in the top tier of all OTW drivers.</li>
            <li>NIP total that reflects heavy, long-term movement.</li>
          </ul>
          <p className={styles.tip}>
            <strong>How to level up:</strong> Start thinking like a leader—help new drivers, learn your city deeply, and keep your record clean. You&apos;re in real franchise conversation territory.
          </p>
        </article>

        {/* PLATINUM */}
        <article className={styles.card}>
          <h3 className={styles.rankLabel}>PLATINUM</h3>
          <p className={styles.rankTagline}>Leader of the Pack</p>
          <ul className={styles.list}>
            <li>Top-percentage performance across the whole platform.</li>
            <li>Almost perfect reliability and very rare cancellations.</li>
            <li>Near 5.0 average rating with glowing feedback.</li>
            <li>Heavy NIP earnings from long-term consistent work.</li>
          </ul>
          <p className={styles.tip}>
            <strong>How to level up:</strong> Document your habits, build routines, and get ready to operate OTW like a business, not just a side hustle.
          </p>
        </article>

        {/* EMPIRE */}
        <article className={`${styles.card} ${styles.cardHighlight}`}>
          <h3 className={styles.rankLabel}>EMPIRE</h3>
          <p className={styles.rankTagline}>OTW Boss Status</p>
          <ul className={styles.list}>
            <li>Elite numbers: jobs, ratings, and reliability.</li>
            <li>History of consistent, high-quality movement.</li>
            <li>Strong NIP story and contribution to the ecosystem.</li>
            <li>Matches what HQ expects from a franchise-level partner.</li>
          </ul>
          <p className={styles.tip}>
            <strong>What this means:</strong> You are moving like an owner. Drivers at this level are the first in line when OTW opens up franchise slots in their zone.
          </p>
        </article>
      </section>

      <section className={styles.footerSection}>
        <h3 className={styles.footerTitle}>How the System Scores You</h3>
        <p className={styles.footerText}>
          Behind the scenes, OTW calculates a <strong>franchise score</strong> using your <strong>completed jobs</strong>, <strong>cancellation rate</strong>, <strong>average rating</strong>, and <strong>NIP earned</strong>.
          That score turns into a rank. As you keep moving right, the system pushes you up naturally.
        </p>
        <p className={styles.footerText}>
          Your job is simple: <strong>show up</strong>, <strong>finish what you accept</strong>, <strong>communicate clearly</strong>, and <strong>deliver like you already own it</strong>. The more consistent the pattern, the louder your data speaks.
        </p>
      </section>
    </div>
  );
};

export default FranchiseRequirements;

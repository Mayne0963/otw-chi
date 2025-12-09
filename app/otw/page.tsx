import React from "react";
import styles from "./OtwPage.module.css";
import OtwDashboard from "../../components/otw/OtwDashboard";
import OtwRequestPicker from "../../components/otw/OtwRequestPicker";
import OtwMembershipCard from "../../components/otw/OtwMembershipCard";
import MyOtwRequests from "../../components/otw/MyOtwRequests";

const OtwPage: React.FC = () => {
  return (
    <main className={styles.otwPage}>
      <div className={styles.contentWrapper}>
        <section className={styles.section}>
          <h1 className={styles.sectionHeader}>OTW – On The Way Concierge</h1>
          <p>
            Manage your miles, track your movement, and send OTW wherever you need us.
          </p>
        </section>

        <section className={styles.section}>
          <OtwMembershipCard />
        </section>

        <section className={styles.section}>
          <OtwDashboard />
        </section>

        <div className={styles.spacerLg} />

        <section className={styles.section}>
          <h2 className={styles.sectionHeader}>Start a New Request</h2>
          <OtwRequestPicker />
        </section>

        <div className={styles.spacerLg} />

        <section className={styles.section}>
          <MyOtwRequests />
        </section>
      </div>
    </main>
  );
};

export default OtwPage;

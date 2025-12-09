import React from "react";
import styles from "./DriverPage.module.css";
import DriverDashboard from "../../../components/otw/DriverDashboard";

const DriverPage: React.FC = () => {
  return (
    <main className={styles.driverPage}>
      <div className={styles.contentWrapper}>
        <section className={styles.section}>
          <h1 className={styles.sectionHeader}>OTW Driver Control</h1>
          <p>
            This is your OTW Rep cockpit. Go online, track your jobs, and watch your earnings in real time.
          </p>
        </section>

        <section className={styles.section}>
          <DriverDashboard />
        </section>
      </div>
    </main>
  );
};

export default DriverPage;


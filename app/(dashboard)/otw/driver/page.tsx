import React from "react";
import DriverDashboard from "@/components/otw/DriverDashboard";

export default function OtwDriverPage() {
  return (
    <main
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "1.5rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <h1
        style={{
          fontSize: "1.4rem",
          fontWeight: 800,
          marginBottom: "0.5rem",
        }}
      >
        OTW — Driver Console
      </h1>
      <p
        style={{
          fontSize: "0.9rem",
          color: "#555555",
          marginBottom: "0.75rem",
        }}
      >
        View available OTW requests, accept runs, and mark jobs completed.
        This is the early driver portal for testing the OTW engine.
      </p>

      <DriverDashboard />
    </main>
  );
}


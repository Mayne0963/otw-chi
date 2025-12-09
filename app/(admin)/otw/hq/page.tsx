import React from "react";
import AdminOtwHQ from "@/components/otw/AdminOtwHQ";

export default function OtwAdminHQPage() {
  return (
    <main
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "1.5rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 800,
          marginBottom: "0.3rem",
        }}
      >
        OTW HQ — Command Center
      </h1>
      <p
        style={{
          fontSize: "0.9rem",
          color: "#555555",
          marginBottom: "0.75rem",
        }}
      >
        Monitor drivers, requests, and NIP circulation in one place. Use this overview to decide who’s ready for franchise conversations and where OTW needs more coverage.
      </p>
      <AdminOtwHQ />
    </main>
  );
}

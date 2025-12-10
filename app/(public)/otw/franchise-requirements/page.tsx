import React from "react";
import FranchiseRequirements from "@/components/otw/FranchiseRequirements";

export default function FranchiseRequirementsPage() {
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
        OTW Franchise Requirements
      </h1>
      <p
        style={{
          fontSize: "0.9rem",
          color: "#555555",
          marginBottom: "0.75rem",
        }}
      >
        This page explains what each franchise rank means and how drivers move from worker to owner inside the OTW system.
      </p>

      <FranchiseRequirements />
    </main>
  );
}

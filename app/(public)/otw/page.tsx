import React from "react";
import OtwRequestForm from "@/components/otw/OtwRequestForm";
import MyOtwRequests from "@/components/otw/MyOtwRequests";

export default function OtwPage() {
  return (
    <main
      style={{
        maxWidth: "800px",
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
        OTW — On The Way
      </h1>
      <p
        style={{
          fontSize: "0.9rem",
          color: "#555555",
          marginBottom: "0.75rem",
        }}
      >
        This is your early customer portal. Book OTW runs using your
        membership miles, and track your requests below.
      </p>

      <OtwRequestForm />
      <MyOtwRequests />
    </main>
  );
}
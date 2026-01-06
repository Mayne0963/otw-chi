import type { MetadataRoute } from "next";

const BASE_URL = "https://otw-chi-two.vercel.app";

const marketingRoutes = [
  "",
  "/about",
  "/contact",
  "/how-it-works",
  "/pricing",
  "/request",
  "/services",
  "/privacy",
  "/terms",
  "/cities",
];

const publicRoutes = [
  "/order",
  "/driver/apply",
  "/otw/franchise-requirements",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries = [...marketingRoutes, ...publicRoutes].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));

  return entries;
}

import type { MetadataRoute } from "next";
import { getServerCapabilities } from "@/lib/capabilities";

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
];

export default function sitemap(): MetadataRoute.Sitemap {
  const capabilities = getServerCapabilities({});
  const optionalPublicRoutes = [
    { path: "/franchise/apply", enabled: capabilities.canSeeFranchise },
  ];

  const allRoutes = [
    ...marketingRoutes,
    ...publicRoutes,
    ...optionalPublicRoutes.filter((route) => route.enabled).map((route) => route.path),
  ];

  const now = new Date();
  const entries: MetadataRoute.Sitemap = allRoutes.map(
    (path): MetadataRoute.Sitemap[number] => ({
      url: `${BASE_URL}${path}`,
      lastModified: now,
      changeFrequency: path === "" ? "weekly" : "monthly",
      priority: path === "" ? 1 : 0.7,
    })
  );

  return entries;
}

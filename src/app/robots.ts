import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://freeclips.up.railway.app"
  ).replace(/\/+$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: "/api/",
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

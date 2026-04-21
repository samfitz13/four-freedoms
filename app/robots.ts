import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard", "/check-in", "/review", "/settings"],
      },
    ],
    sitemap: "https://freedom-four.app/sitemap.xml",
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Actinium-DD",
    short_name: "Actinium-DD",
    description:
      "Dry dock management for office, vessel, superintendent, and shipyard teams.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111827",
    icons: [
      {
        src: "/actinium-sm-logo.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/actinium-sm-logo.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  };
}

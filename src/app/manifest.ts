import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gut Tracker",
    short_name: "Gut Tracker",
    description: "Track meals, nutrients, spending and gut symptoms",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f4",
    theme_color: "#2f7d4f",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}

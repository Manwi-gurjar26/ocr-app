import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / worker-based packages must be loaded by Node directly, not bundled.
  serverExternalPackages: ["tesseract.js", "unpdf", "@napi-rs/canvas"],
  // Tailwind CSS v4 via its Turbopack loader (from create-next-app).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import { withSentryConfig } from "@sentry/nextjs";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const elevenLabsClientBrowser = path.join(
  projectRoot,
  "node_modules/@elevenlabs/client/dist/platform/web/index.js",
);
// Turbopack requires project-relative aliases (not absolute paths).
const elevenLabsClientBrowserAlias =
  "./node_modules/@elevenlabs/client/dist/platform/web/index.js";

const nextConfig: NextConfig = {
  transpilePackages: ["@sparkjsdev/spark"],
  assetPrefix: process.env.CDN_URL || undefined,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
  },
  // Prevent Turbopack from resolving against a parent lockfile directory.
  turbopack: {
    root: projectRoot,
    // ElevenLabs ConvAI voice requires the browser entry (mic/WebRTC setup strategy).
    resolveAlias: {
      "@elevenlabs/client": elevenLabsClientBrowserAlias,
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@elevenlabs/client": elevenLabsClientBrowser,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, { silent: true })
  : nextConfig;

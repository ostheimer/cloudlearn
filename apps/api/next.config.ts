import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pdfjs-dist als externes Serverpaket lassen (nicht bündeln) — sonst bricht
  // das Laden der .mjs/Worker-Auflösung in der Serverless-Funktion.
  serverExternalPackages: ["pdfjs-dist"]
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // unpdf (inkl. gebündeltem PDF.js + @napi-rs/canvas) als externes Serverpaket
  // lassen — nicht von webpack bündeln, damit es zur Laufzeit sauber lädt.
  serverExternalPackages: ["unpdf"]
};

export default nextConfig;

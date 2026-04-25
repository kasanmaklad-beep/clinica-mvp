import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "10.0.0.234",
    "10.0.0.234:3000",
    "192.168.*",
  ],
  // pdf-parse v2 carga pdf.worker.mjs como módulo relativo a su propio archivo.
  // Si Next.js lo bundlea en .next/server/chunks/, el worker queda huérfano.
  // Externalizarlo lo deja en node_modules junto a su worker → resuelve OK.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;

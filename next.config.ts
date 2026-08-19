import type { NextConfig } from "next";
import { readFileSync } from "fs";

// Versión desde package.json (una sola fuente de verdad). Se inyecta como env
// público para poder mostrarla en la app y confirmar que actualizó.
const version = JSON.parse(readFileSync("./package.json", "utf8")).version as string;

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: { NEXT_PUBLIC_APP_VERSION: version }
};

export default nextConfig;

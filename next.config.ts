import type { NextConfig } from "next";
import { readFileSync, writeFileSync } from "fs";

// Versión desde package.json (una sola fuente de verdad). Se inyecta como env
// público para poder mostrarla en la app y confirmar que actualizó.
const version = JSON.parse(readFileSync("./package.json", "utf8")).version as string;

// Publicar la versión como archivo estático (se sirve en la web/Vercel como
// /version.json). La APK lo consulta al abrir para avisar si hay una nueva
// versión. apkUrl (opcional) = link de descarga del APK, si algún día lo alojas.
try {
  writeFileSync("./public/version.json", JSON.stringify({
    version,
    apkUrl: process.env.NEXT_PUBLIC_APK_URL || "",
  }))
} catch {}

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: { NEXT_PUBLIC_APP_VERSION: version }
};

export default nextConfig;

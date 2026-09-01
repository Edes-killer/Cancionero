import type { NextConfig } from "next";
import { readFileSync, writeFileSync } from "fs";

// Versión desde package.json (una sola fuente de verdad). Se inyecta como env
// público para poder mostrarla en la app y confirmar que actualizó.
const pkg = JSON.parse(readFileSync("./package.json", "utf8"));
const version = pkg.version as string;
// minApk = versión mínima de APK que requiere un cambio NATIVO. El aviso de "instala
// APK nuevo" solo sale si el APK instalado es menor. Los cambios solo-web van por OTA.
const minApk = (pkg.minApk as string) || version;

// Publicar la versión como archivo estático (se sirve en la web/Vercel como
// /version.json). La APK lo consulta al abrir para avisar si hay una nueva
// versión. apkUrl (opcional) = link de descarga del APK, si algún día lo alojas.
try {
  writeFileSync("./public/version.json", JSON.stringify({
    version,
    minApk,
    // URL fija de GitHub que SIEMPRE apunta al APK del último release publicado.
    // Requiere subir el APK a cada release con el nombre "selah-live.apk".
    apkUrl: process.env.NEXT_PUBLIC_APK_URL || "https://github.com/Edes-killer/Cancionero/releases/latest/download/selah-live.apk",
  }))
  // Manifiesto OTA (Capgo): la app lee version+url y descarga el bundle web si es
  // más nuevo. url = zip fijo del último release (subir "bundle.zip" a cada release).
  writeFileSync("./public/ota.json", JSON.stringify({
    version,
    minApk,
    url: process.env.NEXT_PUBLIC_OTA_URL || "https://github.com/Edes-killer/Cancionero/releases/latest/download/bundle.zip",
  }))
} catch {}

const nextConfig: NextConfig = {
  // Evita que `next dev` escriba AGENTS.md/CLAUDE.md dentro del repositorio.
  agentRules: false,
  // QA local puede abrirse como localhost o 127.0.0.1. Next 16 bloquea por
  // defecto el HMR si el hostname visible no coincide con el origen del dev
  // server, dejando la consola llena de fallos WebSocket.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: { NEXT_PUBLIC_APP_VERSION: version }
};

export default nextConfig;

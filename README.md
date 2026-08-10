# Selah Live

SaaS de **proyección, cancionero y transmisión en vivo** para iglesias.

- **Proyección** en tiempo real (celular → proyector, por WiFi local vía Socket.IO).
- **Cancionero** con tonos, acordes e importación desde PowerPoint.
- **Transmisión nativa** del culto a Facebook / YouTube / TikTok (cámara + letra → ffmpeg → RTMP), sin OBS.

Corre desde el mismo código estático como **web** (Vercel), **APK** (Capacitor) y **app de escritorio** (Electron con auto-update).

## Inicio rápido

```bash
npm run dev            # desarrollo web (localhost:3000)
npm run electron:dev   # app de escritorio (para probar transmisión, grabación, etc.)
node server/index.js   # hub Socket.IO + API Biblia (puerto 4000)
```

## Documentación

📄 **El contexto completo está en [`CONTEXTO.md`](./CONTEXTO.md)** — documento de diseño (SDD) con
arquitectura, subsistemas (incluido el módulo de Transmisión Tier 1-3 e importar PowerPoint), modelo de
datos, IPC de Electron, patrones críticos y la receta de despliegue/release.

Léelo antes de tocar el código: ahí está todo lo que no es obvio del repo.

---

Stack: Next.js 16 · React 19 · TypeScript · Supabase · Socket.IO · Capacitor · Electron · ffmpeg.
Repo: https://github.com/Edes-killer/Cancionero · Web: https://selah-live.vercel.app

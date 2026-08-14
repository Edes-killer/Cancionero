# Selah Live — Documento de Diseño (SDD) y Contexto de Desarrollo

> Versión del documento: 2026-08-13 · App: **v0.5.19** · Mantener al día al cerrar cada release.

---

## 1. Resumen del proyecto

**Selah Live** es un SaaS para iglesias que cubre tres necesidades del culto:

1. **Proyección** — controlar canciones, Biblia e imágenes en el proyector desde un celular por WiFi local (tiempo real).
2. **Cancionero** — gestionar el repertorio (canciones, tonos, acordes, categorías) e importarlo desde PowerPoint.
3. **Transmisión en vivo NATIVA** — sacar el culto al aire (cámara + letra + overlays) directo a Facebook / YouTube / TikTok, sin depender de OBS.

- **Desarrollador:** Emanuel Henríquez — IEP Moradora de Sion, La Ligua, Chile. (Escribir en español chileno, con "tú".)
- **Repositorio:** https://github.com/Edes-killer/Cancionero
- **Web pública (Vercel):** https://selah-live.vercel.app
- **Supabase Project ID:** `dkufqtrfvduonsubmwka`
- **App ID (Capacitor / Electron):** `com.tuiglesia.cancionero`

---

## 2. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript, `output: "export"` (estático) |
| Estilos | Estilos inline + Tailwind 4 (PostCSS) |
| Backend datos | Supabase (PostgreSQL + RLS + Storage) |
| Tiempo real | Socket.IO 4.8 (`server/index.js`, puerto 4000) |
| Mobile | Capacitor 8 → APK Android |
| Desktop | Electron 42 + electron-updater 6.8 (auto-update desde GitHub Releases) |
| Streaming | `ffmpeg-static` 5.3 (empaquetado) → RTMP; `obs-websocket-js` 5 (modo OBS avanzado opcional) |
| Otros | jszip (importar PPT a canciones), docx, qrcode, jsonwebtoken, dotenv |

**Tres targets de despliegue desde el MISMO código estático (`out/`):**
- **Web** → Vercel (visitante anónimo ve la landing `/bienvenido`).
- **APK** → Capacitor envuelve `out/`.
- **Desktop** → Electron sirve `out/` + Socket.IO + ffmpeg + auto-update.

---

## 3. Arquitectura de despliegue y datos

```
                         ┌─────────────────────────────┐
                         │   Supabase (auth, DB, RLS,   │
                         │   Storage: imagenes-culto)   │
                         └──────────────┬──────────────┘
                                        │ HTTPS
   Celular (Control) ──socket:4000──►  server/index.js  ──broadcast──►  Proyector (PC, fullscreen)
                                        │ (hub tiempo real                └──────────►  Músicos (celulares)
                                        │  + API Biblia HTTP)
                                        │
   PC Escritorio (Electron) ── ffmpeg (stdin) ──► RTMP(S) ──► Facebook / YouTube / TikTok
```

- La **proyección** es tiempo real vía Socket.IO en la red local (no pasa por internet).
- La **transmisión** vive en el proceso Electron (renderer compone → main corre ffmpeg → RTMP).
- La **data** (canciones, cultos, imágenes) está en Supabase; hay cache offline en IndexedDB.

---

## 4. Estructura de archivos clave

```
app/
  page.tsx                  → Dashboard (inicio)
  bienvenido/page.tsx       → Landing pública (marketing, ruta pública)
  control/page.tsx          → Centro operativo del culto (~5500 líneas)
  canciones/page.tsx        → Cancionero + editor + importador PPT→canciones (jszip)
  proyectar/page.tsx        → Pantalla de proyección fullscreen
  en-vivo/page.tsx          → TRANSMISIÓN nativa (cámara + overlays → RTMP)
  en-vivo-lab/page.tsx      → Banco de pruebas del editor de overlays (ruta pública)
  transmision/page.tsx      → Entrada/ajustes del módulo de transmisión
  configuracion/page.tsx    → Ajustes de iglesia + logo + PIN + fuentes
  historial/page.tsx        → Historial de proyecciones
  onboarding/page.tsx       → Alta de nuevos usuarios
  crear-iglesia, unirse, register, login, configurar-servidor, musicos, auth/callback
  api/biblia/buscar/route.ts → SOLO Next.js dev; en estático NO corre (usar server 4000)

components/
  AuthProvider.tsx          → Control de sesión + rutas públicas + roles
  ObjetoEditable.tsx        → Objeto movible/redimensionable sobre lienzo (transmisión + lab)

context/AppContext.tsx      → Estado global: session, iglesia, canciones, pinSala, cache
lib/                        → cache.ts (IndexedDB), biblia.ts, getIglesia.ts, servidor.ts, timeout.ts
server/index.js             → Socket.IO + HTTP (/api/biblia/buscar) + estáticos + guardado local de imágenes
electron/
  main.js                   → Servidor estático + Socket.IO + ffmpeg + grabación + pantalla + PPT + updater
  preload.js                → Bridges: window.transmision, window.powerpoint, window.electron
  installer.nsh             → Hook NSIS (fix de desinstalación en auto-update)
data/biblia/                → Biblia local en .js por libro
electron-builder.json       → publish github (owner Edes-killer, repo Cancionero), output dist-electron
capacitor.config.ts         → webDir: "out"
```

---

## 5. Modelo de datos (Supabase)

```sql
iglesias          (id, nombre, localidad, logo_url, logo_nombre, pin_sala, ...)
usuarios_iglesia  (user_id, iglesia_id, rol)          -- rol: admin | lider | musico
canciones         (id, titulo, tono, categoria, iglesia_id, numero, texto_busqueda)
partes_cancion    (id, cancion_id, tipo, texto, texto_acordes, tiene_acordes, orden, formato)
listas_culto      (id, iglesia_id, nombre, fecha)
items_lista       (id, lista_id, cancion_id, orden, tipo, imagen_url, estado_url, ...)
historial_proyecciones (id, iglesia_id, cancion_id, titulo, tono, categoria, tipo, proyectado_en)
```

**Storage:** bucket `imagenes-culto`, carpeta por iglesia (`{iglesiaId}/...`). Requiere policy de DELETE
para borrar desde la nube:
```sql
create policy "borrar imagenes-culto" on storage.objects
  for delete to authenticated using (bucket_id = 'imagenes-culto');
```

**Roles (AuthProvider):** admin (todo), líder de alabanza (Control/Canciones/Historial/Transmisión, NO
Configuración), músico (solo /musicos). PIN de sala opcional (`iglesias.pin_sala`, sincronizado por AppContext).

---

## 6. Subsistemas

### 6.1 Control del culto — `app/control/page.tsx`
Centro operativo (mobile/web/desktop). Arma la lista de culto (canciones, imágenes, videos, carruseles,
pantallas especiales), proyecta con `▶`, auto-avance con **aprendizaje de tiempos**
(`localStorage("selah-tiempos-{cancionId}")`), galería de imágenes (Disco/Nube), tanda por canción,
carrusel como ítem de lista, y el **importador de PowerPoint a la galería** (ver 6.5).

### 6.2 Proyección — `app/proyectar/page.tsx` + tiempo real
Pantalla fullscreen (segundo monitor en Electron). Escucha Socket.IO y renderiza letra/Biblia/imagen.
Fuente y escala configurables (`localStorage proyector-escala-fuente`, `proyector-font-family`), leídas en
vivo por evento `storage`. Atajos de teclado (espacio/flechas/±/0/ESC).

### 6.3 Cancionero + importar PPT→canciones — `app/canciones/page.tsx`
Editor de canciones/partes, teclado de acordes (inserta `[Do]` en el cursor), y un importador que usa
**jszip** para sacar el TEXTO de `.pptx` y crear canciones (distinto del importador de imágenes de 6.5).

### 6.4 TRANSMISIÓN nativa — `app/en-vivo/page.tsx` + `electron/main.js`  ⭐ subsistema mayor
Pipeline (solo escritorio):
```
Lienzo 1280×720 (cámara(s)/pantalla + overlays) ──captureStream(30)+audio──►
  MediaRecorder (H264 mkv preferido) ──chunks 250ms via IPC──►
    ffmpeg stdin ──► RTMP(S)   (multi-destino con el muxer `tee`)
```
- **Encoder auto-seleccionado** al arrancar y cacheado: `h264_qsv` → `h264_mf` → `libx264` (ultrafast).
- **Keyframe cada 2 s por TIEMPO** (`-force_key_frames expr:gte(t,n_forced*2)`) — clave para que Facebook no corte.
- `backgroundThrottling:false` en la ventana (si no, los fps caen al perder foco).
- **Destinos:** Facebook / YouTube / TikTok / RTMP propio (multiplataforma simultánea con `tee`).
- **Diseños de overlay:** Vidrio, Tarjeta, Minimal, Broadcast (coordinan nombre + caja de letra + mensaje).
- **Temas de color:** 12 presets + color personalizado (tiñen líneas, barras, nombre y letra del mensaje).
- **Caja de letra:** alto por contenido + fuente que escala al ancho, topada para no salirse del cuadro
  (`medirLetra`, compartido con el editor `ObjetoEditable` para que el recuadro calce con el dibujo).
- **Modo OBS avanzado (opcional):** `obs-websocket-js` (no es el camino por defecto).
- **`/en-vivo-lab`:** banco de pruebas público del editor (sin cámara ni sesión).

**Tier 1 — Confiabilidad:**
- Grabación local (UN solo encode: los mismos chunks van a ffmpeg y a un `.mkv`; al terminar se remuxea a
  `.mp4` en Vídeos/Selah Live; si hubo reconexión, une segmentos con el demuxer `concat`).
- Reconexión automática (la maneja el renderer: al caerse ffmpeg de forma inesperada recrea el grabador y
  respawnea ffmpeg con espera creciente; la grabación no se corta, rueda a un segmento nuevo).
- Panel de salud: parsea las `-stats` de ffmpeg → bitrate, fps, salud (speed), frames caídos, REC.

**Tier 2 — Audio:**
- Medidor VU (Web Audio `AnalyserNode`, animado por DOM) con aviso "sin señal".
- Reducción de ruido/eco/AGC (constraints de getUserMedia + `applyConstraints` en vivo).

**Tier 3 — Producción:**
- Compartir pantalla/ventana (`desktopCapturer`) con la cámara en recuadro PiP.
- Calidad de salida configurable (Baja 1200 / Media 2500 / Alta 4500 kbps).
- Transiciones (fundido ~350 ms al cambiar de escena, crossfade en el lienzo).

**Operador (v0.5.18):**
- Escena **"Espera"**: fondo brandeado + logo + titular + cuenta regresiva ("El culto comienza
  pronto"). `esperaTexto`/`esperaHasta` en contenidoRef; el contador baja solo en el bucle de dibujo.
- **Atajos de teclado**: 1/2/3/4 = escenas, M = mensaje, C = cámara, R = resetear (se ignoran en inputs).
- **Grabar sin transmitir**: grabador dedicado a disco sin RTMP (ensayo/respaldo).
- **Resetear posiciones** (a `POS_DEF`) + **guardar/restaurar armado** (localStorage `en-vivo-armado`).

**Cámara desde el celular — WebRTC (v0.5.19):**
- El celular (APK) manda su video/audio al PC por la LAN, sin apps de terceros. Ver [[camara-celular-webrtc]].
- **Señalización** por el Socket.IO del PC (`camara:host`/`unir`/`senal`/`fin`, salas `cam-<código>`).
  El video va DIRECTO PC↔celular (candidatos host + STUN).
- **`app/camara/page.tsx`** (móvil): abre cámara (1080p ideal) + mic, envía por WebRTC; voltear con
  getUserMedia `facingMode: exact` (libera la cámara antes de abrir la otra); wake lock. Ruta líder/admin.
- **`/en-vivo`** (host): botón "📱 Usar celular como cámara" → código → recibe el track. El celular
  entra como **cámara seleccionable** (`CELULAR="__celular__"` en los desplegables de Cámara 1/2 y de
  micrófono): funciona con escenas, "Ambas"/PiP, intercambio y grabación como cualquier cámara. El mic
  del PC es independiente (o se elige el del celular). El video/audio del celular se resuelven en el
  bucle de dibujo (`cam1Celular`/`cam2Celular`) y en `streamSalida`.
- **Acceso**: tile en Inicio + link en el menú, **solo en la APK** (`Capacitor`) y **solo admin/líder**.
- Requiere que la APK tenga el **servidor configurado** (getSocketUrl) y **CAMERA/RECORD_AUDIO** en el
  manifest (ya estaban). Depende de que el celular y el PC se vean en la LAN (mismo problema/route que
  Camo/DroidCam: AP isolation).

### 6.5 Importar PowerPoint a la galería — Control (solo escritorio)
Dos motores por PowerShell desde `main.js`:
- **Diapositivas completas** → PowerPoint COM exporta cada slide a PNG 1920×(según aspecto). Funciona con
  `.ppt` antiguo Y `.pptx`. Es el modo universal (el himnario de Emanuel es todo `.ppt`).
- **Imágenes incrustadas** → copia el `.pptx` a `.zip` y `Expand-Archive` para leer `ppt/media/*`.
  Solo `.pptx` (el `.ppt` antiguo no es zip → se rechaza con mensaje claro).
Las imágenes se suben a la galería reusando `subirImagen`. Nunca se muestran stack traces crudos.

### 6.6 Biblia
Endpoint `/api/biblia/buscar` servido por `server/index.js` (Node), leyendo `data/biblia/procesados/*.js`.
El cliente SIEMPRE llama a `http://{hostname}:4000/api/biblia/buscar` (las API routes de Next NO corren en
estático/APK/Electron).

### 6.7 Auth, roles y PIN · 6.8 Onboarding + Dashboard · 6.9 Landing pública
Ver §5 (roles) y `components/AuthProvider.tsx`. Dashboard con stats, último culto, top cantadas. Landing
`/bienvenido` es pública (marketing) y es el destino del visitante anónimo en la web (en la app va a `/login`).

---

## 7. IPC de Electron (main ↔ renderer)

**Bridges (preload):** `window.transmision`, `window.powerpoint`, `window.electron`.

| Canal (invoke/handle) | Qué hace |
|---|---|
| `transmision:iniciar {rtmpUrls, bitrateKbps}` | Spawnea ffmpeg (encoder auto + `tee` multi-destino) |
| `transmision:chunk` (send) | Escribe chunk del MediaRecorder a ffmpeg stdin |
| `transmision:detener` | Cierra stdin (marca parada intencional → no reconecta) |
| `transmision:abrirLog` | Abre `transmision.log` |
| `grabacion:iniciar/chunk/nuevoSegmento/detener/abrirCarpeta` | Grabación local (segmentos → remux/concat a mp4) |
| `pantalla:fuentes` | `desktopCapturer.getSources` (pantallas + ventanas, con miniatura) |
| `ppt:elegir / ppt:imagenes / ppt:diapositivas` | Importador PowerPoint (diálogo + Expand-Archive / COM) |

**Eventos (main → renderer):** `transmision:estado` (incluye `inesperado`), `transmision:log`,
`transmision:stats`, `grabacion:listo`.

**localStorage de `/en-vivo`:** `en-vivo-acento`, `en-vivo-diseno`, `en-vivo-grabar`,
`en-vivo-limpiar-audio`, `en-vivo-calidad`, `en-vivo-transiciones`, `en-vivo-destinos`, `en-vivo-nombre`,
`en-vivo-letra`, `en-vivo-mensaje-pos`, `en-vivo-color-letra`, `en-vivo-logo-*`, `en-vivo-pip`.

---

## 8. Comandos frecuentes

```bash
npm run dev                 # Desarrollo web (localhost:3000)
npm run build               # Build estático → out/
npm run electron:dev        # build + abrir la app de escritorio (para probar transmisión, etc.)
node server/index.js        # Socket.IO + Biblia standalone (puerto 4000)

# APK Android
npm run build && npx cap sync
cd android && gradlew assembleDebug   # → android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 9. Despliegue

### 9.1 Web (Vercel)
Push a `main` → Vercel publica el estático en https://selah-live.vercel.app. `NEXT_PUBLIC_SITE_URL` apunta
ahí (usado en los links de invitación).

### 9.2 APK Android
Copiar cambios → clean build si el APK trae código viejo (`rmdir /s /q .next out
android\app\src\main\assets\public`) → `npm run build && npx cap sync` → `gradlew assembleDebug` →
desinstalar la versión previa antes de instalar.

### 9.3 Release de escritorio (Electron, auto-update)  ← receta probada
1. Subir `version` en `package.json` + commit `chore(release): x.y.z — ...` en `main`.
2. En **PowerShell** (una vez por PC): `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force`
   (si no, `npm` falla con "npm.ps1 ejecución deshabilitada"; alternativa: usar `npm.cmd`).
3. `$env:GH_TOKEN = "<PAT classic, scope repo>"` — **los tokens vencen; regenerar en github.com/settings/tokens**.
   (En cmd sería `set GH_TOKEN=<token>` sin comillas.)
4. `npm run electron:build:win` → build + `electron-builder --win --publish always`.
5. `git push origin main`.
El instalador queda en `dist-electron/Selah Live Setup x.y.z.exe` (~190 MB). El build ocurre ANTES de
publicar: si solo falla el publish (token), el `.exe` igual queda hecho. El fix del error NSIS de
desinstalación está en `electron/installer.nsh` (`customUnInstallCheck`).

---

## 10. Patrones y principios críticos (NO REGRESAR)

```
1. pinesPorSala/estado a nivel de módulo en server/index.js (NO dentro de io.on("connection")).
2. cargarCanciones(iglesiaId) requiere iglesiaId EXPLÍCITO.
3. La Biblia SIEMPRE llama al servidor 4000 (las API routes de Next no corren en estático/APK/Electron).
4. socketConectado inicia en null (no false) para distinguir "nunca conectó".
5. Electron NO soporta window.prompt() (devuelve null) → usar el hook usePrompt.
6. En el APK: NO habilitar CapacitorHttp (rompe router.push de Next tras el WebView de One UI 8.5).
7. Transmisión: al reconectar hay que RECREAR el MediaRecorder (ffmpeg necesita cabecera nueva) → por eso
   la grabación rueda a un segmento nuevo y se concatena al final.
8. Transmisión: un solo encode (los chunks se reparten a ffmpeg y a disco) para no ahogar PCs modestos.
9. getUserMedia con constraints de limpieza de audio; aplicar cambios en vivo con applyConstraints (sin
   reiniciar la cámara).
```

---

## 11. Pendientes y futuro

- [ ] Dividir `control/page.tsx` (~5500 líneas) en componentes (refactor diferido, riesgoso).
- [ ] Reemplazar `any` por interfaces (`Cancion`, `Parte`, `ItemLista`).
- [ ] Galería con carpetas.
- [ ] Transmisión: de mi lista OBS quedan cosas menores descartadas por no ser para iglesias (atajos de
      teclado, chroma key, modo estudio).
- [ ] Multi-iglesia sin relogin, CCLI reporting, analíticas.
- [ ] Web "Moradora de Sion" (proyecto paralelo: landing carta de presentación de la iglesia).

---

## 12. Variables de entorno (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://dkufqtrfvduonsubmwka.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=https://selah-live.vercel.app
# GH_TOKEN NO va aquí para el build; se setea en el entorno al publicar (ver §9.3).
```

---

## 13. Notas para quien continúe

1. Se edita el código directamente en `/app`, `/electron`, etc. (ya NO existe el viejo flujo de "copiar
   outputs antes del build").
2. Las API routes de Next (`/api/...`) no corren en APK ni Electron → la Biblia usa el server 4000.
3. `server/index.js` es crítico: si falla, la proyección en tiempo real no funciona.
4. Transmisión, grabación, compartir pantalla e importar PPT son **solo escritorio** (Electron): en la web
   muestran aviso "solo app de escritorio".
5. El himnario del usuario es todo `.ppt` antiguo → para importarlo usar "Diapositivas completas".
6. Al cerrar un release, actualizar la versión de este documento (arriba) y su §6/§7 si cambió el diseño.
```

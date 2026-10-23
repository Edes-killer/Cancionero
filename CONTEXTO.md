# Selah Live — Documento de Diseño (SDD) y Contexto de Desarrollo

> Versión del documento: 2026-10-23 · Código actual: **v0.5.44**.

El código de trabajo está en v0.5.44. Las evidencias de v0.5.40 y sus artefactos se conservan
como historial, pero no representan automáticamente los binarios del árbol actual. Antes de una
publicación nueva se deben reconstruir Electron y APK desde un commit limpio y ejecutar las
compuertas de candidata. El instalador Windows continúa sin certificado Authenticode comercial.

La transmisión mejoró a partir de los fallos de terreno de v0.5.35–v0.5.39, pero ninguna
prueba sintética reemplaza validar Facebook/RTMPS, WiFi, cámaras y sincronía labial en la
iglesia. No declarar v0.5.40 estable solo porque compile o pase QA automatizado.

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
| Frontend | Next.js 16.3.8 (App Router) + React 19 + TypeScript, `output: "export"` (estático) |
| Estilos | Estilos inline + Tailwind 4 (PostCSS) |
| Backend datos | Supabase (PostgreSQL + RLS + Storage) |
| Tiempo real | Socket.IO 4.8 (servidor integrado en `electron/main.js`, puerto 4000) |
| Mobile | Capacitor 8.5.3 → APK Android |
| Desktop | Electron 42.11.3 + electron-updater 6.8 (auto-update desde GitHub Releases) |
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
   Celular (Control) ──socket:4000──►  electron/main.js ──broadcast──►  Proyector (PC, fullscreen)
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
electron/
  main.js                   → Servidor estático + Socket.IO + ffmpeg + grabación + pantalla + PPT + updater
  preload.js                → Bridges: transmisión, PowerPoint, Electron y OAuth seguro
  security.js               → Validación de rutas, enlaces externos y callbacks OAuth
  installer.nsh             → Hook NSIS (fix de desinstalación en auto-update)
app/server/index.js         → Hub Socket.IO standalone opcional; Electron NO depende de este proceso
scripts/                    → QA, builds trazables, APK/OTA y validación de artefactos
docs/RELEASE-0.5.40.md      → Estado, criterios y flujo corto de prueba física
docs/EMPAQUETADO-0.5.40.md  → Evidencia de firma, procedencia y límites de distribución
data/biblia/                → Biblia local en .js por libro
electron-builder.json       → publish github (owner Edes-killer, repo Cancionero), output dist-electron
capacitor.config.ts         → webDir: "out"
```

---

## 5. Modelo de datos (Supabase)

```sql
iglesias          (id, nombre, creado_en, logo_url, logo_nombre, localidad, pin_sala, plan)
usuarios_iglesia  (user_id, iglesia_id, rol)          -- rol: admin | lider | musico
canciones         (id, iglesia_id, titulo, autor, tono, fecha_creacion, categoria, numero, texto_busqueda, eliminado_en)
partes_cancion    (id, cancion_id, tipo, texto, orden, texto_letra, texto_acordes, tiene_acordes)
listas_culto      (id, iglesia_id, nombre, fecha)
items_lista       (id, lista_id, cancion_id, orden, tipo, imagen_url, estado_url, ...)
historial_proyecciones (id, iglesia_id, cancion_id, titulo, tono, categoria, tipo, proyectado_en)
estado_culto      (iglesia_id, tipo, partes, index, titulo, tono, actualizado_en)
errores_log       (iglesia_id, user_id, tipo, mensaje, pagina, plataforma, version, detalle)
invitaciones      (iglesia_id, rol, codigo, usos_max, usos_actuales, activa, expira_at, creado_por)
media_biblioteca  (iglesia_id, url, nombre, carpeta, actualizado_en)
configuraciones_iglesia (iglesia_id, control jsonb, transmision jsonb, actualizado_en, actualizado_por)
```

**Storage:** bucket `imagenes-culto`, carpeta por iglesia (`{iglesiaId}/...`). Las políticas de escritura
deben comprobar que el primer segmento de `storage.objects.name` corresponde a una iglesia del usuario.
Nunca usar una policy que autorice solo por `bucket_id`: permitiría modificar o borrar archivos de otra iglesia.

**Auditoría y saneamiento (2026-09-09, aplicado en producción):** el dump real permitió cerrar la
autoasignación de roles y membresías, proteger invitaciones mediante RPC, aislar Storage por iglesia y
limitar escrituras a líderes/administradores. Se eliminaron 8 canciones y 2 listas huérfanas originadas por
antiguos defaults UUID, además de una iglesia vacía. Las FK y restricciones de roles/planes quedaron
validadas contra los datos históricos mediante las migraciones `20260907` a `20260910`.

**Roles (AuthProvider):** admin (todo), líder de alabanza (Control/Canciones/Historial/Transmisión, NO
Configuración), músico (solo /musicos). El escritorio puede operar localmente sin PIN; Control/Canciones/
Inicio desde otro dispositivo exigen un PIN de 4–6 dígitos registrado por Electron. El primer equipo remoto
ya no puede definirlo ni apropiarse de una sala.

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

**Modo improvisación (v0.5.20)** — `lib/improvisacion.ts` (motor puro: parsea el tono español/americano
mayor/menor + transposición → sugiere escalas: pentatónicas, mayor/menor, blues, relativa) +
`components/Improvisador.tsx` (pestañas de escalas + piano SVG que marca las notas, tónica destacada).
Integrado en `/musicos` (botón 🎼) con el tono de la canción actual. También en 0.5.20: reorg de los
controles de `/en-vivo` en **secciones colapsables** (Cámaras/Escena/Fuentes/Mensaje/Apariencia/Salir) y
pulido de `/musicos` (rótulos en los botones, botón "volver al tono original").

### 6.4 TRANSMISIÓN nativa — `app/en-vivo/page.tsx` + `electron/main.js`  ⭐ subsistema mayor
Pipeline (solo escritorio):
```
Lienzo 1280×720 (cámara(s)/pantalla + overlays) ──captureStream(30)+audio──►
  MediaRecorder (H264 mkv preferido) ──chunks 250ms via IPC──►
    ffmpeg stdin ──► RTMP(S)   (multi-destino con el muxer `tee`)
```
- **Encoder auto-seleccionado** al arrancar y cacheado: `h264_mf` → `h264_qsv` → `libx264` (ultrafast). Media Foundation se prioriza porque sostuvo el benchmark Full HD y es compatible con Intel/AMD; cada encoder de hardware debe producir al menos 55 cuadros y velocidad 0,95x en un ensayo de dos segundos a 1080p/30 con parámetros de producción. QSV queda como respaldo y no se elige solo porque logre abrir.
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
Endpoint `/api/biblia/buscar` servido por el servidor Socket.IO integrado en `electron/main.js`, usando
la lógica compartida de `lib/biblia-server.js`. `app/server/index.js` ofrece la misma API cuando se inicia
el hub standalone. El cliente SIEMPRE llama a `http://{hostname}:4000/api/biblia/buscar`: las API routes
de Next no existen en el export estático usado por APK/Electron.

### 6.7 Auth, roles y PIN · 6.8 Onboarding + Dashboard · 6.9 Landing pública
Ver §5 (roles) y `components/AuthProvider.tsx`. Dashboard con stats, último culto, top cantadas. Landing
`/bienvenido` es pública (marketing) y es el destino del visitante anónimo en la web (en la app va a `/login`).

**Login de escritorio (v0.5.40):** Google exige usar el navegador seguro del sistema; no intentar
incrustarlo en un `BrowserWindow` de Electron porque Google bloquea los user-agents embebidos. Antes
de abrir Google, Electron crea un nonce aleatorio con diez minutos de vigencia. Supabase vuelve a
`http://localhost:3000/auth/callback/?selah_nonce=...`; la página externa entrega la URL completa al
endpoint loopback `POST /oauth/entregar`. El proceso principal solo acepta loopback, la ruta exacta,
un cuerpo acotado y el nonce pendiente, y carga el callback dentro del launcher para persistir la sesión.
El esquema `selahlive://auth/callback` se conserva como respaldo y para enlaces por correo. Nunca
registrar correo, contraseña, URL de callback, access token ni refresh token en consola o Supabase.

**Seguridad LAN (candidata v0.5.40):** Electron siempre conecta a `127.0.0.1:4000`, aunque exista una
IP antigua en el almacenamiento local. El proceso principal registra el PIN autoritativo desde AppContext
en cualquier módulo; un cliente de red no puede sembrarlo. Socket.IO valida sala UUID, pantalla, PIN con
comparación constante, rol por evento y limita intentos fallidos. Proyector, puente nube, host de cámara y
host de emisión directa son exclusivamente locales. La señal WebRTC dirigida exige roles opuestos y la
misma sala; al cambiar de código se abandona la anterior. Escritura/borrado de galería local y conversión
PowerPoint aceptan solo loopback y origen interno. `/ping`, `/info`, Biblia, espectadores y emisores de
cámara autorizados siguen disponibles por LAN. Alcance: protege frente a otros equipos de la red; malware
ya ejecutándose en el PC requiere defensas del sistema operativo y firma de código.

El acceso principal por correo es **Sin contraseña** (magic link), porque muchas cuentas históricas
fueron creadas con Google y no poseen contraseña de Selah. “Con contraseña” acepta únicamente una
contraseña configurada en Selah; nunca la contraseña de Gmail.

---

## 7. IPC de Electron (main ↔ renderer)

**Bridges (preload):** `window.transmision`, `window.powerpoint`, `window.electron`,
`window.oauthElectron` y `window.seguridadLocal`. Este último solo registra o retira el PIN de la iglesia
desde la ventana principal validada; no expone el valor a la red. El puente OAuth solo prepara un retorno
temporal, abre una URL de autorización Supabase validada y emite diagnósticos sin datos personales.

| Canal (invoke/handle) | Qué hace |
|---|---|
| `transmision:iniciar {rtmpUrls, bitrateKbps}` | Spawnea ffmpeg (encoder auto + `tee` multi-destino) |
| `transmision:chunk` (send) | Escribe chunk del MediaRecorder a ffmpeg stdin |
| `transmision:detener` | Cierra stdin (marca parada intencional → no reconecta) |
| `transmision:abrirLog` | Abre `transmision.log` |
| `grabacion:iniciar/chunk/nuevoSegmento/detener/abrirCarpeta` | Grabación local (segmentos → remux/concat a mp4) |
| `pantalla:fuentes` | `desktopCapturer.getSources` (pantallas + ventanas, con miniatura) |
| `ppt:elegir / ppt:imagenes / ppt:diapositivas` | Importador PowerPoint (diálogo + Expand-Archive / COM) |
| `oauth:preparar-retorno` | Genera nonce temporal y callback loopback para Google |
| `oauth:abrir-google` | Abre únicamente la autorización Google del proyecto Supabase en el navegador del sistema |

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
node app/server/index.js    # Hub standalone opcional; Electron ya trae su propio puerto 4000

# APK Android
npm run apk:debug           # → selah-live-debug.apk
npm run apk                 # → selah-live.apk firmado para distribución

# Candidata verificable, SIN publicar
npm run candidata:build     # QA + NSIS + APK + OTA + procedencia/firma/hashes
npm run qa:candidata        # repite QA y valida artefactos ya construidos
```

---

## 9. Despliegue

### 9.1 Web (Vercel)
Push a `main` → Vercel publica el estático en https://selah-live.vercel.app. `NEXT_PUBLIC_SITE_URL` apunta
ahí (usado en los links de invitación).

### 9.2 APK Android
`npm run apk:debug` genera la APK de laboratorio; `npm run apk` genera `selah-live.apk` release con
la firma histórica. No cambiar ni regenerar el keystore: Android rechazará la actualización si cambia
el certificado. El aviso de versión consulta GitHub Releases y la descarga directa usa el asset exacto
`selah-live.apk`. El paquete OTA se prepara con `npm run ota`; no reemplaza la APK cuando hay cambios
nativos, de permisos o plugins Capacitor.

### 9.3 Release de escritorio (Electron, auto-update)  ← receta probada
1. Desarrollar en rama, ejecutar `npm run qa:release` y completar la prueba física correspondiente.
2. Ejecutar `npm run candidata:build`: construye localmente sin publicar y bloquea binarios u OTA de otro
   commit, builds sucios, APK con firma distinta o versiones incoherentes.
3. Dejar GitHub Actions verde, marcar la PR lista e integrarla a `main`.
4. Desde el commit definitivo de `main`, reconstruir la candidata para que la procedencia embebida
   coincida con lo publicado.
5. El operador carga `GH_TOKEN` únicamente en el entorno de la terminal —nunca en `.env`, código,
   logs ni chat— y ejecuta `npm run electron:build:win`; electron-builder crea un release borrador.
6. Subir `selah-live.apk` y `bundle.zip`. Revisar notas, hashes y assets antes
   de publicar el borrador como `Latest`.

La receta operativa completa vive en `COMO-PUBLICAR.md`. El instalador queda en
`dist-electron/Selah Live Setup x.y.z.exe`. El fix NSIS de actualización está en
`electron/installer.nsh` (`customUnInstallCheck`). Construir y publicar son pasos separados a propósito.

---

## 10. Patrones y principios críticos (NO REGRESAR)

```
1. `pinesPorSala`, estado, listas y presencia viven a nivel de módulo en `electron/main.js`; el hub
   standalone de `app/server/index.js` debe conservar las mismas reglas (NO dentro de `io.on`).
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
10. Google OAuth de escritorio SIEMPRE usa navegador del sistema + callback loopback con nonce. No cargar
    Google dentro de Electron ni aceptar callbacks remotos, rutas alternativas o retornos no pendientes.
11. Un artefacto solo pertenece a una versión si `qa:artefactos` confirma versión, commit, árbol limpio,
    firma Android y manifiesto. Cualquier commit posterior obliga a reconstruirlo.
12. No publicar directamente durante el desarrollo: `candidata:build` primero; merge y publicación después
    de la prueba física.
```

---

## 11. Pendientes y futuro

### Deuda técnica verificada

- `npm run lint` y el gate crítico están limpios: cero errores y cero advertencias. No reintroducir
  excepciones globales para acelerar una entrega.
- Dependencias de producción: cero vulnerabilidades conocidas. En herramientas de desarrollo permanecen
  dos avisos transitivos sin versión corregida publicada (`braces`, fuente npm 1240992, y `sprintf-js`,
  fuente npm 1241202). `qa-auditoria-herramientas.cjs` permite solo esos IDs y bloquea cualquier alerta
  nueva o crítica; retirarlos apenas exista una actualización compatible.
- Dividir `app/control/page.tsx` y `app/en-vivo/page.tsx` en componentes y hooks más pequeños después de
  estabilizar la rama 0.5.x. Es deuda de mantenibilidad, no un cambio para hacer antes de un culto.
  La separación incremental ya comenzó con `components/control/IndicadorCulto.tsx`: el resumen de lo
  que está al aire y del siguiente ítem quedó como vista pura, sin mover sockets ni estado operativo.
  Las próximas extracciones deben conservar esta estrategia: una pieza visual por vez, con prueba de
  regresión, compilación y comprobación visual antes de tocar otra frontera.
- El instalador Windows no posee certificado Authenticode comercial. La candidata es funcional, pero
  SmartScreen puede advertir al usuario; resolver antes de una distribución comercial amplia.
- CameraX continúa como laboratorio debug. No anunciar cámara frontal nativa ni reemplazar el flujo
  WebRTC de producción hasta validarlo en varios fabricantes Android.
- Faltan prueba física RTMPS/Facebook, ensayo continuo de 1–2 horas y recuperación real de un destino.

### Trabajo posterior a v0.5.40

- Electron usa una barra superior oscura integrada con los controles nativos de Windows. La identidad
  visual se muestra una sola vez en la navegación; la franja de arrastre ya no repite icono ni nombre.
- Control administra los cultos guardados desde una sola barra contextual. Crear una lista está siempre
  disponible; copiar, renombrar y eliminar afectan únicamente a la lista seleccionada. Las fechas usan
  un formato corto y estable para no desplazar el nombre.
- El Orden del culto puede minimizarse en escritorio y recuerda esa decisión localmente. Sus tarjetas y
  acciones son más compactas para mostrar más elementos sin reducir la información esencial.
- La eliminación manual de la lista abierta conserva sus elementos como borrador recuperable, igual que
  una eliminación remota, para evitar perder la preparación por error.
- Verificación de esta tanda: 179/179 pruebas, lint crítico sin hallazgos y build de producción correcto.

### Entregado en v0.5.27

- Control separado en modos **Preparar** y **Culto**, con revisión previa operativa.
- Transmisión reorganizada como consola: estados, escenas en previa/al aire, medidor y preflight.
- Biblioteca visual con búsqueda, filtros, agregado múltiple y prevención de duplicados.
- Inicio orientado a tareas y onboarding enfocado en el primer culto.
- Editor de canciones con partes rápidas, explicación, validación y vista de proyección.
- Ajustes con índice por tarea y distinción entre preferencias locales y de iglesia.
- Ayuda contextual global y mejoras de accesibilidad para teclado, tacto y movimiento reducido.
- Diagnóstico de red completo, logs descargables y laboratorio hostil `qa:red` (15 escenarios).
- Correcciones de pantalla completa, aprendizaje de auto-avance, concurrencia y cierre seguro de Electron.

### Entregado en v0.5.28

- Corrección de la ayuda contextual: los tooltips explican el efecto real de cada botón en vez de repetir su nombre.
- Descripciones específicas para acciones ambiguas e iconos en Control, Canciones, Ajustes, Transmisión y navegación.

### Entregado en v0.5.29

- Vista previa en vivo reorganizada como monitor 16:9, con límites de pantalla y estado fijo/arrastrable claro.
- Visor individual de canciones ordenado por título, tono, modo, partes y escenario de lectura.
- Vista previa móvil más legible, con contenido y acciones visualmente separados.

### Entregado en v0.5.30

- Seguridad multiiglesia reforzada en membresías, roles, invitaciones, multimedia y escritura del estado del culto.
- Credenciales elevadas retiradas de Electron y del historial Git; el cliente distribuido usa únicamente la clave publicable.
- Diagnósticos, limpieza y restricciones de integridad para canciones, listas, miembros, planes y roles.
- Galería organizada por carpetas con metadatos sincronizados entre dispositivos y migración de datos locales.
- Músicos permite identificar y filtrar canciones con acordes; afinador más estable y comprensible.
- Pantallas especiales respetan el fondo configurado y los dos monitores previos ajustan contenido, tamaño y selección.
- La vista previa flotante puede redimensionarse y recuerda la última parte revisada de cada canción.
- Suite automatizada de seguridad y arquitectura ampliada para impedir regresiones de credenciales y permisos.

### Entregado en v0.5.31

- Recorridos guiados para Inicio, Control, Canciones, Galería, Músicos, Cámara móvil, Transmisión, Historial y Configuración.
- Los tutoriales se pueden repetir sin recargar la APK y no ejecutan acciones delicadas durante la explicación.
- Emisión directa en la red local protegida por código, con enlace y QR para espectadores.
- Mejoras de accesibilidad en paneles guiados y comprobaciones automatizadas contra regresiones.

### Entregado en v0.5.37

- La APK distingue “sin PC local” de “sin nube” y permite preparar y guardar cultos desde cualquier red.
- Apariencia de Control y diseño visual de Transmisión sincronizables entre equipos en planes Pro/Premium.
- Cámara, micrófono, volumen, retardo y claves RTMP permanecen locales por seguridad y compatibilidad.
- La migración `20260924_configuraciones_iglesia.sql`, ya aplicada, crea almacenamiento JSON limitado, RLS multiiglesia y escritura exclusiva de admin/líder.

### Preparado para v0.5.38

- Control y Transmisión vuelven a consultar la apariencia compartida al recuperar el foco y cada 30 segundos mientras la ventana está visible.
- Las lecturas remotas se comparan con la última configuración conocida para no generar escrituras repetidas ni sobrescribir cambios con un rebote local.
- Los documentos parciales o antiguos se validan campo por campo antes de modificar la interfaz.

### Preparado para v0.5.39

- Al guardar un culto, los demás equipos conectados reciben una notificación por el canal seguro de la iglesia.
- El catálogo se actualiza sin recargar la aplicación y el culto abierto se recarga automáticamente solo si está inactivo y no contiene cambios locales.
- Una edición remota nunca reemplaza trabajo pendiente ni interrumpe una proyección en curso; en esos casos Control muestra una advertencia.
- Antes de sobrescribir un culto existente se compara su versión persistida con la base que abrió el operador. Si otro equipo lo modificó, Control bloquea la sobrescritura y permite guardarlo como copia.
- Si otro equipo elimina el culto abierto, su contenido se conserva localmente como borrador recuperable.
- `lib/conflictoCulto.ts` concentra estas decisiones en funciones puras y `test/conflictoCulto.test.js` valida sus escenarios críticos por comportamiento.

### Candidata v0.5.40 — código y artefactos verificados

- Los planes pasan de insignias visuales a permisos coherentes: Pro incluye transmisión nativa con una cámara y un destino; Premium añade multicámara, cámara móvil, salida simultánea y OBS. La cámara desaparece del Inicio/menú de APK fuera de Premium y la sincronización de apariencia está disponible desde Pro.
- `20261021_planes_autoritativos.sql` protege `iglesias.plan` contra autoascensos y aplica en Postgres los cupos Gratis de 200 canciones activas, 15 usuarios, 10 imágenes y 1 video en nube, con bloqueos para operaciones concurrentes. También restringe la escritura de configuración compartida a Pro/Premium. Esta migración debe aplicarse en Supabase antes de probar los planes como producto.
- El plan validado se guarda por iglesia para mantener el acceso correcto al iniciar temporalmente sin red, pero Supabase lo reemplaza al responder. La landing ya no promete capacidades de nube, multisede o soporte que todavía no se miden o entregan.
- Modelos compartidos de canción, partes, fondos e ítems de culto extraídos a `lib/modelosCulto.ts` para reducir duplicación y reemplazar `any` progresivamente.
- Actualizador OTA, tema visual, recorridos, afinador, metrónomo, caché, registro de errores y cliente Supabase pasan lint estricto sin desactivar reglas.
- La limpieza conserva el comportamiento: build de producción y suite automatizada aprobados después de la refactorización.
- El preflight de Transmisión mide el espacio real de la carpeta de grabaciones cada 30 segundos. Bloquea nuevas grabaciones bajo 1 GB y advierte bajo 8 GB, volviendo a comprobar justo antes de abrir el archivo.
- Al terminar una emisión se conserva un informe descargable con duración, calidad, destinos por nombre, reconexiones, cuadros caídos, respaldo local y diagnóstico final. Se eliminan direcciones RTMP antes de persistirlo.
- El diagnóstico terminal conserva la causa real aunque FFmpeg cierre con código nulo: atasco de entrada, conexión del destino, motor u operador. La marca de cierre intencional es por sesión y no afecta una reconexión posterior.
- Si Selah o el PC se cierran durante una grabación, Transmisión detecta los segmentos MKV restantes y permite reconstruir un MP4. Los originales solo se eliminan después de verificar una salida no vacía; las grabaciones activas o en conversión nunca se ofrecen como pendientes.
- El gate `npm run qa:release` ejecuta 16 comprobaciones obligatorias: diff, 168 pruebas automatizadas, build web/TypeScript, lint estricto de transmisión/cámara/conexiones, auditoría de producción, auditoría controlada de herramientas, sintaxis de módulos críticos de Electron —incluidos registro operativo y preflight de red—, benchmark, trazabilidad, recuperación independiente de destinos y verificador de artefactos. Producción está en cero vulnerabilidades; herramientas permiten solo dos avisos transitivos conocidos sin parche y bloquean cualquier otro.
- Después de empaquetar, `npm run qa:candidata` encadena el gate completo con la validación real de APK/NSIS; `npm run qa:publicar` repite ese flujo en modo estricto y exige Authenticode válido en Windows.
- Cada `npm run build` genera `build-info.json` con versión, commit Git y estado de cambios rastreados. El dato se incorpora a la APK, al bundle OTA y a `out/` dentro de `app.asar` en Electron; el verificador rechaza artefactos de otro commit o construidos con cambios sin confirmar.
- La APK presenta una ventana no bloqueante con porcentaje real durante la descarga OTA y estados separados para verificación, aplicación y fallo. La aplicación sigue requiriendo una decisión explícita para no interrumpir un culto.
- El benchmark Full HD de 30 segundos completó 900/900 cuadros tanto con `h264_mf` como con `libx264`, a 31 fps, velocidad 1.03x, sin cola ni avisos temporales. Esto valida el codificador aislado, no cámaras/WiFi reales.
- Las salidas RTMP ahora usan una sola codificación con `tee + fifo`: cada destino reintenta por separado, no bloquea a los demás y recupera desde keyframe. `qa:destinos` demuestra corte y retorno de un receptor local sin interrumpir el receptor estable; RTMPS real sigue sujeto a prueba física.
- Transmisión muestra cada destino como Enviando o Reconectando. El seguimiento correlaciona internamente el contexto FIFO con su salida, deduplica eventos y nunca entrega URL/clave al renderer; una recuperación exitosa limpia la alarma transitoria, pero no un rechazo permanente.
- La medición del receptor móvil ya no es solo informativa: el PC devuelve FPS y búfer al celular para alimentar la calidad automática. El preflight bloquea una salida con una fuente móvil seleccionada que esté desconectada, bajo 12 FPS o con al menos 1,5 segundos de búfer; esto responde a la prueba física que llegó a Facebook con 7,7–13 segundos de atraso y cero cuadros útiles en FFmpeg.
- `Revisar salida` prueba en el PC real los tres motores (`h264_mf`, `h264_qsv`, `libx264`) a Full HD con parámetros de producción y no habilita la confirmación hasta que uno sostenga la carga.
- El lint global heredado quedó completamente limpio en v0.5.40: `npm run lint` termina con cero errores y cero advertencias, después de corregir los módulos por tandas pequeñas y verificables.
- La superficie LAN quedó endurecida: 26/26 pruebas hostiles validan PIN, roles, origen web, aislamiento multiiglesia,
  convergencia, reconexión y señal directa. Una comprobación adicional entrando por la IP LAN confirmó
  HTTP 403 para archivos locales y rechazo de host de cámara/emisión, proyector y siembra remota del PIN.
- Canciones quedó incorporado al lint crítico: se tiparon importación PowerPoint, cachés, filtros y respuestas de Supabase, retirando 47 hallazgos sin cambiar su flujo funcional.
- Músicos también forma parte del gate crítico: repertorio, partes, estado en vivo, Socket.IO y Supabase Realtime quedaron tipados y sin hallazgos de lint.
- Proyectar quedó incluido en el mismo gate: eventos, fondos, Biblia, precarga y sockets tienen tipos explícitos; la cuenta regresiva dejó de calcular tiempo impuro durante render y se actualiza mediante estado.
- Login, autorización, Navbar y aviso APK se sumaron al gate: se tiparon puentes de Electron/Capacitor, respuesta de versiones y cambios de sesión, manteniendo las restricciones por rol.
- El acceso real con Google quedó validado en Electron. Google abre en el navegador del sistema y vuelve
  al launcher mediante `POST /oauth/entregar`; el proceso exige origen loopback, ruta exacta, cuerpo
  acotado, autorización pendiente y nonce de un solo uso. La prueba real registró el retorno, creó la
  sesión y conectó Inicio a la sala sin imprimir correo ni tokens.
- El contexto global usa ahora los modelos compartidos de canción y el tipo real de sesión de Supabase; caché, paginación y registro global de errores quedaron sin `any`.
- Inicio quedó tipado de extremo a extremo: selector de iglesias, estadísticas, accesos por rol y detección de APK forman parte del lint crítico y compilan sin excepciones silenciosas.
- Configuración también forma parte del gate: miembros, invitaciones, log, QR, firewall y diagnóstico de red usan contratos explícitos; se corrigieron dependencias de carga y la detección de plataforma posterior a la hidratación.
- Historial quedó tipado para cultos, proyecciones y estadísticas; su carga inicial evita efectos sin dependencias y también está protegida por el lint crítico.
- Unión, configuración del servidor, onboarding, emisión directa, laboratorios y componentes de ayuda/editor quedaron sin deuda de lint. El editor libera listeners de puntero al terminar o desmontarse, y los flujos diferidos ya no mutan estado directamente durante los efectos.
- Control quedó sin errores ni advertencias de lint: se tiparon listas, cultos, Biblia, galería, PowerPoint, estados especiales y el monitor de proyección, y se retiró un bloque grande de estilos muertos. La persistencia de lo proyectado se separó de los refs de navegación; las tareas asíncronas usan eventos de efecto para leer el estado vigente sin duplicar sockets, consultas ni emisiones. Control ya forma parte del lint crítico obligatorio.
- Los artefactos construidos desde `0fde8b55d935a430403b06623a598484ec0fc841` quedan como evidencia histórica, no como candidata vigente: son anteriores a planes autoritativos y seguridad LAN. Tras integrar estos cambios, el empaquetado final debe repetirse con árbol limpio y `qa:artefactos` debe registrar nuevos hashes. Authenticode sigue pendiente.
- Los módulos CommonJS del servidor web y Biblia declaran explícitamente su formato, no conservan excepciones sin usar y pasan tanto ESLint como `node --check`.

- [ ] Completar la prueba corta de v0.5.40 en la iglesia antes de integrar/publicar.
- [ ] Ejecutar una prueba de transmisión/grabación de 1–2 horas con hardware y red reales.
- [ ] Adquirir y configurar certificado Authenticode para Windows.
- [ ] Dividir `control/page.tsx` y `en-vivo/page.tsx` en componentes (refactor diferido, riesgoso).
- [ ] Continuar reemplazando tipos locales heredados por los modelos compartidos de culto.
- [x] Galería con carpetas y metadatos sincronizados por iglesia.
- [ ] Transmisión: de mi lista OBS quedan cosas menores descartadas por no ser para iglesias (atajos de
      teclado, chroma key, modo estudio).
- [ ] Multi-iglesia sin relogin, CCLI reporting, analíticas.
- [ ] Web "Moradora de Sion" (proyecto paralelo: landing carta de presentación de la iglesia).

---

## 11.9 Observabilidad y soporte (v0.5.40)

- Los errores locales incluyen código de sesión, gravedad, versión y operación para reconstruir un incidente completo.
- Configuración → Diagnóstico y soporte exporta un informe unificado con los registros del cliente y los eventos operativos de Electron.
- Electron conserva un registro rotativo de inicios, servicios internos, fallos de carga, procesos caídos y ventanas sin respuesta.
- El saneamiento es obligatorio antes de persistir o exportar: oculta tokens, contraseñas, correos, claves y URLs RTMP.
- No se incorporó telemetría externa: los datos permanecen en el equipo o en la tabla existente `errores_log` de la iglesia.
- `lib/incidentes.ts` traduce fallos de plataforma, medios, fuente, audio, motor y red a una explicación operativa estable. `GuiaIncidente` se usa en Transmisión y Cámara para indicar causa probable, siguiente acción y qué sigue a salvo.
- La revisión previa de Transmisión abre solo una conexión de prueba al host/puerto RTMP(S), sin enviar la ruta ni la clave. Valida DNS, TCP y TLS y bloquea “Salir al aire” cuando el servidor no responde.

## 12. Variables de entorno (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://dkufqtrfvduonsubmwka.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=https://selah-live.vercel.app
# GH_TOKEN NO va aquí para el build; se setea en el entorno al publicar (ver §9.3).
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` se mantiene como alias heredado para equipos ya configurados, pero su
valor también debe ser una clave `sb_publishable_...`; nunca una clave secreta o `service_role`.

---

## 13. Notas para quien continúe

### Incidente abierto: cámara móvil y sincronía (2026-09-19)

La prueba física de dos cámaras volvió a mostrar lag, desfase de audio y NotReadableError al
abrir los sensores frontales. No darlo por resuelto solo porque compila o pasan pruebas de código.
Se serializó la apertura de captura, se liberan resultados tardíos tras desmontar la pantalla,
y hay recuperación liberando también la sesión de micrófono. Automática solicita Full HD;
4K es seleccionable. WebRTC prioriza fluidez y las dos pantallas muestran mediciones reales.
Transmisión permite retrasar el audio por micrófono; esto no adelanta audio ni elimina automáticamente
el retraso de un video recibido. Procedimiento y límites: `docs/QA-CAMARA-TRANSMISION.md`.

Primera entrega de audio profesional: `lib/audioEmision.ts` centraliza medición de entrada/salida,
retardo, volumen, compresión de picos y silencio final. `PanelAudioProfesional` ofrece escucha local
apagada por defecto y un clip de calibración de 8 s sin publicar. La grabación de prueba detiene
solo su pista de video; el audio de salida se comparte. Ejecutar `npm.cmd run qa:audio` para probar
el procesamiento real y el flujo de interfaz con fuentes sintéticas. No declarar hardware validado
por estos tests. Los perfiles de cámaras móviles usan ahora identidad estable por instalación.

Segunda entrega: `lib/calidadAdaptativa.ts` limita bitrate/escala de envío únicamente en modo
automático, con histéresis y confirmación de `setParameters`. No reinicia captura ni conexión.
Escritorio muestra recepción por celular y permite descargar métricas locales (sin logs RTMP).
`npm.cmd run qa:video` verifica escalado explícito y continuidad con WebRTC sintético local;
usa maintain-resolution para aislar la adaptación interna de Chromium, mientras producción
prioriza FPS. No demuestra adaptación en WiFi real ni compatibilidad frontal de Android.

Captura nativa: laboratorio CameraX solo en APK debug (`android/app/src/debug`, ruta
`/camara-lab`, plugin `CamaraNativaLab`). No transmite, no usa micrófono ni reemplaza WebRTC.
Se inicia desconectado después de abandonar la pantalla de cámara web. Informe nativo local
con apertura, errores, sensor y FPS de análisis. No confundir FPS de análisis con FPS enviados.
Producción excluye dependencias, Activity y plugin nativos; no anunciar solución del fallo
frontal sin pruebas físicas. Protocolo: `docs/QA-CAMARA-NATIVA.md`.

Continuidad visual: `VigenciaVideo` detecta ausencia de cuadros (3 s) o pista no disponible.
El compositor usa fondo brandeado y oculta PiP perdido, sin cambiar micrófono ni cámara elegida.
Retorna tras 1 s de cuadros continuos. Aviso privado y errores con límite de frecuencia.
`qa:video` verifica corte/restauración del sender real además del escalado.
`identidadCamara.ts` conserva un UUID por instalación en la APK y separa la fuente del socket.
El servidor adjunta la identidad validada; escritorio conserva selectores y perfiles de audio
durante reconexiones en la misma sesión, ignorando cierres/candidatos atrasados. Un celular
no debe detenerse por el aviso de desconexión de otro. Duplicados activos se rechazan hasta
que cierre el enlace anterior. Requiere actualizar APK y escritorio; no restaura el armado
completo tras reiniciar escritorio ni conserva identidad después de borrar datos de la APK.

1. Se edita el código directamente en `/app`, `/electron`, etc. (ya NO existe el viejo flujo de "copiar
   outputs antes del build").
2. Las API routes de Next (`/api/...`) no corren en APK ni Electron → la Biblia usa el server 4000.
3. En Electron, el servidor crítico está integrado en `electron/main.js` (puertos 3000/4000). El
   proceso opcional standalone es `app/server/index.js`; no ejecutar ambos sobre el mismo puerto.
4. Transmisión, grabación, compartir pantalla e importar PPT son **solo escritorio** (Electron): en la web
   muestran aviso "solo app de escritorio".
5. El himnario del usuario es todo `.ppt` antiguo → para importarlo usar "Diapositivas completas".
6. Al cerrar un release, actualizar la versión de este documento (arriba) y su §6/§7 si cambió el diseño.
7. Google OAuth de escritorio no se incrusta en Electron. Si deja de volver, revisar en orden:
   `google-iniciado` → `retorno-preparado` → `retorno local recibido` → sesión/Inicio, sin imprimir URLs
   ni credenciales.
8. `.moradora-update/` pertenece al proyecto paralelo de la iglesia y no forma parte de Selah; mantenerla
   fuera de commits y artefactos salvo solicitud explícita.
```

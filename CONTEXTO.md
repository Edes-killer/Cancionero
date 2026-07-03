# Selah Live — Contexto completo para continuación de desarrollo

## 1. DESCRIPCIÓN DEL PROYECTO

**Selah Live** es un SaaS de proyección para iglesias. Permite controlar canciones, biblia e imágenes en un proyector desde un celular vía WiFi local.

**Desarrollador:** Emmanuel Henríquez (IEP Moradora de Sion La Ligua, Chile)
**Repositorio GitHub:** https://github.com/Edes-killer/Cancionero
**Supabase Project ID:** `dkufqtrfvduonsubmwka`
**App ID (Capacitor):** `com.tuiglesia.cancionero`

---

## 2. STACK TECNOLÓGICO

- **Frontend:** Next.js 16 App Router + TypeScript, output: "export" (estático)
- **Base de datos:** Supabase (PostgreSQL + RLS + Storage)
- **Tiempo real:** Socket.IO en puerto 4000 (`server/index.js`)
- **Mobile:** Capacitor → APK Android (`android/app/build/outputs/apk/debug/app-debug.apk`)
- **Desktop:** Electron con auto-updater → GitHub Releases v0.2.0
- **Servidor local:** Node.js sirve la carpeta `out/` en puerto 3000 + Socket.IO en 4000

---

## 3. ESTRUCTURA DE ARCHIVOS CLAVE

```
app/
  page.tsx                  → Dashboard (inicio)
  control/page.tsx          → Centro operativo del culto (4300+ líneas)
  canciones/page.tsx        → Cancionero + editor + importador PPT
  proyectar/page.tsx        → Pantalla de proyección fullscreen
  configuracion/page.tsx    → Ajustes iglesia + PIN + fuentes
  onboarding/page.tsx       → Flujo nuevos usuarios (4 pasos)
  configurar-servidor/      → Escáner de IP del servidor
  musicos/page.tsx          → Vista músicos con acordes
  api/biblia/buscar/route.ts → Solo funciona en Next.js dev, NO en estático

context/
  AppContext.tsx             → Provider global: session, iglesia, canciones, pinSala, desdeCache

lib/
  cache.ts                  → IndexedDB wrapper para cache offline de canciones
  biblia.ts                 → Lógica de búsqueda bíblica (solo para web con Next.js dev)
  getIglesia.ts             → getIglesiaId(), setIglesiaActivaId()
  servidor.ts               → getSocketUrl()

server/
  index.js                  → Socket.IO + HTTP server con endpoint /api/biblia/buscar

electron/
  main.js                   → Servidor estático + Socket.IO + auto-updater
  preload.js                → Expone ipcRenderer al renderer

data/
  biblia/
    procesados/             → Archivos .js por libro (genesis.js, juan.js, etc.)
    index.js

capacitor.config.ts         → webDir: "out"
electron-builder.json       → publish: github (owner: Edes-killer, repo: Cancionero)
```

---

## 4. BASE DE DATOS SUPABASE (tablas principales)

```sql
iglesias          (id, nombre, localidad, logo_url, logo_nombre, pin_sala)
usuarios_iglesia  (user_id, iglesia_id)
canciones         (id, titulo, tono, categoria, iglesia_id, numero, texto_busqueda)
partes_cancion    (id, cancion_id, tipo, texto, texto_acordes, tiene_acordes, orden, formato)
listas_culto      (id, iglesia_id, nombre, fecha)
items_lista       (id, lista_id, cancion_id, orden, tipo, ...)
historial_proyecciones (id, iglesia_id, cancion_id, titulo, tono, categoria, tipo, proyectado_en)
```

**SQL requerido (ya ejecutado):**
```sql
ALTER TABLE iglesias ADD COLUMN pin_sala TEXT DEFAULT NULL;
```

---

## 5. COMANDOS FRECUENTES

```bash
# Desarrollo web
npm run dev

# Build + APK Android
npm run build && npx cap sync
cd android && gradlew assembleDebug
# APK en: android\app\build\outputs\apk\debug\app-debug.apk

# Clean build (si APK tiene código viejo)
rmdir /s /q .next && rmdir /s /q out && rmdir /s /q android\app\src\main\assets\public
npm run build && npx cap sync && cd android && gradlew assembleDebug

# Electron build + publish GitHub
set "GH_TOKEN=ghp_..." && npm run electron:build:win
# Luego publicar el release en GitHub (sacar de Draft)

# Servidor Socket.IO standalone
node server/index.js

# Servidor web estático
npx serve out -l 3000
```

---

## 6. ARQUITECTURA DE ACTORES

| Actor | Descripción |
|-------|-------------|
| `control/page.tsx` | Operador mobile/web — controla todo |
| `proyectar/page.tsx` | Pantalla fullscreen en el PC del proyector |
| `musicos/page.tsx` | Músicos en sus celulares — ven acordes |
| `server/index.js` | Hub Socket.IO + API Biblia + servir estáticos |
| `AppContext.tsx` | Estado global: session, iglesia, canciones, cache |

**Flujo de datos:**
```
Mobile (control) ──socket──> server/index.js ──broadcast──> proyectar (PC)
                                                         ──broadcast──> musicos (celulares)
```

---

## 7. FEATURES IMPLEMENTADOS (auditoría completa)

### Seguridad
- ✅ PIN de sala guardado en Supabase `iglesias.pin_sala`
- ✅ PIN se sincroniza automáticamente entre dispositivos vía AppContext
- ✅ Server valida PIN (solo si hay PIN configurado, es opcional)
- ✅ RLS activo en todas las tablas
- ✅ Detección de session expiry con `onAuthStateChange`

### Rendimiento
- ✅ Batch queries con `.in()` para partes_cancion
- ✅ `partesCacheRef` evita re-fetch de partes
- ✅ AppContext carga canciones una vez y las expone globalmente
- ✅ Cache offline en IndexedDB (`lib/cache.ts`) — TTL 24h
- ✅ Canciones cargan desde cache inmediatamente, Supabase actualiza en background

### APK / Mobile
- ✅ App abre sin servidor configurado (modo offline)
- ✅ Banner rojo "Sin conexión" + botón "Conectar" cuando no hay servidor
- ✅ Modal "Sin conexión al servidor" al intentar proyectar sin servidor
- ✅ Badge "● EN LÍNEA" / "● SIN CONEXIÓN" en header
- ✅ `visualViewport` adapta altura cuando se abre el teclado virtual
- ✅ `socketConectado: boolean | null` — null=nunca conectó, true=conectado, false=desconectado
- ✅ `pingTimeout: 8000, pingInterval: 4000` para detección rápida de desconexión

### Proyección
- ✅ `▶` proyecta directamente sin abrir preview
- ✅ `+` agrega a lista sin abrir preview (stopPropagation)
- ✅ Tocar el cuerpo de la canción abre el bottom sheet (preview)
- ✅ Handle del bottom sheet cierra al tocar
- ✅ Toggle "👁 ON/OFF" para habilitar/deshabilitar preview
- ✅ Texto blanco en el preview
- ✅ Indicador "Verso 1 • Parte 1 de 4" en la barra inferior del control
- ✅ Badge "⏱ Aprendiendo" en la barra del indicador
- ✅ Pantalla de descanso respeta el fondo configurado (sin texto)
- ✅ Título oculto en estadoEspecial (negro/descanso)
- ✅ Font size adaptativo según líneas (14 escalones para canciones y biblia)

### Auto-avance con aprendizaje
- ✅ Al proyectar → badge "⏱ Aprendiendo" en el indicador de parte
- ✅ Mide tiempo entre cambios de parte automáticamente
- ✅ Al terminar la canción → guarda tiempos en `localStorage("selah-tiempos-{cancionId}")`
- ✅ Segunda vez → botón "▶ Auto" en el header
- ✅ Auto-avance usa los tiempos aprendidos con cuenta regresiva visible
- ✅ Cambio manual durante auto-avance resetea el timer

### Importador PPT
- ✅ Tab "📤 Importar PPT" en Canciones
- ✅ Drag & drop de múltiples .pptx
- ✅ "Agregar más archivos" sin reemplazar anteriores
- ✅ Detección de duplicados con badge ⚠️
- ✅ Edición libre de partes antes de importar
- ✅ Select de tono y categoría con estilos dark
- ✅ `cargarCanciones(iglesiaId)` explícito después de importar

### Teclado de acordes
- ✅ Botón "🎸 Acordes" en editor de partes
- ✅ Notas Do-Si con sostenidos/bemoles
- ✅ Modificadores: m, 7, m7, maj7, dim, sus2, sus4, add9
- ✅ Inserta `[Do]` en posición exacta del cursor (id="ta-parte-{i}")
- ✅ Modificador agrega al último acorde antes del cursor

### Fuentes y proyector desktop
- ✅ Slider tamaño 60-160% en /configuracion
- ✅ 4 tipos de fuente con preview "Dios es amor"
- ✅ Guarda en `localStorage("proyector-escala-fuente")` y `("proyector-font-family")`
- ✅ Proyector lee via evento `storage` en tiempo real
- ✅ `zoom: Math.min(150, Math.max(60, escalaFuente))%` — limita para evitar colapso
- ✅ Keyboard shortcuts en proyector: Espacio/→=siguiente, ←=anterior, +/-=escala, 0=reset, ESC=cierra

### Electron
- ✅ Auto-updater con electron-updater → GitHub Releases
- ✅ Versión actual publicada: 0.2.0
- ✅ Banner azul "Descargando v..." / verde "Reiniciar ahora"
- ✅ Proyector abre en segundo monitor si existe, fullscreen, oculta taskbar Windows
- ✅ ESC cierra el proyector via globalShortcut en main process
- ✅ Preload expone ipcRenderer al renderer

### Biblia
- ✅ Endpoint `/api/biblia/buscar` en `server/index.js` (Node.js)
- ✅ Lee archivos de `data/biblia/procesados/*.js` directamente
- ✅ Client siempre llama a `http://{hostname}:4000/api/biblia/buscar`
- ✅ Zoom aplicado al texto de biblia también
- ✅ Font sizes reducidos (max 52px)

### Onboarding
- ✅ `/onboarding` page con 4 pasos: Bienvenida → Iglesia → Logo → Tour
- ✅ Dashboard redirige a /onboarding si no tiene iglesia y no completó onboarding
- ✅ `localStorage("selah-onboarding-ok")` evita que aparezca de nuevo

### Dashboard
- ✅ Hero con logo, nombre, localidad, versículo del día
- ✅ Grid de acciones: Control (grande), Canciones, Proyector, Músicos, Config
- ✅ Stats: total canciones, con acordes, cultos guardados
- ✅ Último culto guardado con botón "Abrir →" que lo carga directo en control
- ✅ Top 5 más cantadas del mes
- ✅ Últimas 4 canciones agregadas
- ✅ Barras de categorías (himnario, alabanza, adoración, etc.)
- ✅ Estado del servidor (ping a puerto 4000)
- ✅ Barras de progreso: canciones con tono, con acordes

---

## 8. PATRONES Y PRINCIPIOS CRÍTICOS

```typescript
// ── NO REGRESAR NUNCA ──────────────────────────────────────────────────────

// 1. pinesPorSala FUERA del io.on("connection") en server/index.js
const pinesPorSala = {}  // ← nivel módulo, NO dentro del handler
io.on("connection", (socket) => { ... })

// 2. transponerTexto NO early-return al convertir notación aunque semitones=0

// 3. cargarCanciones(iglesiaId) requiere iglesiaId EXPLÍCITO
await cargarCanciones(iglesiaId)  // NO await cargarCanciones()

// 4. La Biblia SIEMPRE llama al servidor 4000 (no a /api/biblia)
const baseUrl = `http://${hostname}:4000/api/biblia/buscar`

// 5. verificarServidor() usa socket?.connected (no solo socket)
if (socket?.connected) return true

// 6. socketConectado inicia en null (no false) para distinguir "nunca conectó"
const [socketConectado, setSocketConectado] = useState<boolean | null>(null)

// 7. Archivo nuevo se aplica ANTES del build para que APK lo tenga
// (npm run build compila lo que está en /app, no los outputs generados)
```

---

## 9. OUTPUTS GENERADOS EN ESTA SESIÓN

Todos los archivos output están en la conversación. Al copiarlos al proyecto ANTES del build:

| Output | Destino en proyecto |
|--------|---------------------|
| `control_page.tsx` | `app/control/page.tsx` |
| `canciones_page.tsx` | `app/canciones/page.tsx` |
| `proyectar_page.tsx` | `app/proyectar/page.tsx` |
| `dashboard_page.tsx` | `app/page.tsx` |
| `configuracion_page.tsx` | `app/configuracion/page.tsx` |
| `onboarding_page.tsx` | `app/onboarding/page.tsx` |
| `AppContext.tsx` | `context/AppContext.tsx` |
| `index.js` | `server/index.js` |
| `cache.ts` | `lib/cache.ts` |
| `main.js` | `electron/main.js` |
| `preload.js` | `electron/preload.js` |
| `electron-builder.json` | `electron-builder.json` |

---

## 10. PENDIENTES Y BUGS CONOCIDOS

### Pendientes funcionales
- [ ] Auto-avance: el badge "⏱ Aprendiendo" no resetea si cambias de canción sin llegar al final
- [ ] Persistencia proyección desde canciones: control actualiza partes pero puede tener delay
- [ ] Configurar-servidor: cuando la IP cambia, hay que re-escanear manualmente

### Refactor pendiente (para después, cuando el código esté más estable)
- [ ] Dividir `control/page.tsx` (4300 líneas) en: `CancionesList`, `ListaCulto`, `VisorMobile`, `BottomSheet`, `HerramientasPanel`
- [ ] Reemplazar `any` por interfaces TypeScript: `Cancion`, `Parte`, `ItemLista`

### Features futuro
- [ ] Multi-iglesia sin relogin (base está en usuarios_iglesia)
- [ ] CCLI reporting
- [ ] Analíticas de uso detalladas
- [ ] Importar desde TXT / Word (además de PPT)

---

## 11. FLUJO PARA ACTUALIZAR EL APK

```bash
# 1. Copiar TODOS los archivos output al proyecto (ver tabla sección 9)
# 2. Clean build:
rmdir /s /q .next
rmdir /s /q out
rmdir /s /q android\app\src\main\assets\public
# 3. Build + sync + compile:
npm run build && npx cap sync
cd android
gradlew assembleDebug
# 4. APK en: android\app\build\outputs\apk\debug\app-debug.apk
# 5. Desinstalar versión anterior en el celular (Ajustes > Apps)
# 6. Instalar nuevo APK
```

## 12. FLUJO PARA PUBLICAR ELECTRON

```bash
# Subir versión en package.json: "version": "0.3.0"
set "GH_TOKEN=ghp_..."
npm run electron:build:win
# Ir a https://github.com/Edes-killer/Cancionero/releases
# Editar el release → Publish release (sacar de Draft)
```

---

## 13. DEPENDENCIAS CLAVE INSTALADAS

```json
"jszip": "^3.10.1",          // Importador PPT
"electron-updater": "^6.x",  // Auto-updater Electron
"socket.io": "^4.x",         // Tiempo real
"socket.io-client": "^4.x",
"@supabase/supabase-js": "^2.x"
```

---

## 14. VARIABLES DE ENTORNO (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://dkufqtrfvduonsubmwka.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## 15. NOTAS PARA EL DESARROLLADOR QUE CONTINÚE

1. **Siempre** copiar los archivos output al proyecto ANTES de hacer `npm run build`
2. El APK usa el contenido de `out/` (build estático). Si el web funciona pero el APK no, es porque faltó copiar algún archivo antes del build
3. Las API routes de Next.js (`/api/...`) NO funcionan en el APK ni en Electron — la Biblia usa el servidor Socket.IO en puerto 4000
4. El servidor Socket.IO también sirve la Biblia vía HTTP GET en `/api/biblia/buscar`
5. `server/index.js` es el archivo más crítico — si falla, nada funciona
6. El PIN de sala es opcional. Sin PIN, cualquier dispositivo autenticado en Supabase puede conectarse
7. `localStorage("selah_autoload_lista")` abre un culto específico cuando el control carga
8. Los tiempos de auto-avance se guardan en `localStorage("selah-tiempos-{cancionId}")` — son por dispositivo
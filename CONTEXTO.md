CONTEXTO: Cancionero Cristiano — Proyecto Completo
Stack

Next.js App Router + TypeScript + CSS inline
Supabase (PostgreSQL + Auth + Storage)
Socket.IO servidor independiente en puerto 4000 (Node.js)
App corre en red local 192.168.x.x:3000, socket en :4000


Estructura de archivos
app/
  page.tsx                    ← Dashboard
  layout.tsx                  ← Root layout con AuthProvider + Navbar
  globals.css
  login/page.tsx
  register/page.tsx
  crear-iglesia/page.tsx
  auth/callback/page.tsx
  canciones/page.tsx
  control/page.tsx
  proyectar/page.tsx
  musicos/page.tsx
  configuracion/page.tsx
  api/biblia/buscar/route.ts
components/
  Navbar.tsx
  AuthProvider.tsx
lib/
  supabase.ts
  getIglesia.ts
server/
  index.js                    ← Socket.IO server

Base de datos — Schema completo
sql-- Iglesias
CREATE TABLE public.iglesias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  creado_en timestamp DEFAULT now(),
  logo_url text,
  logo_nombre text,
  localidad text
);

-- Usuarios por iglesia
CREATE TABLE public.usuarios_iglesia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  iglesia_id uuid REFERENCES public.iglesias(id),
  creado_en timestamp DEFAULT now()
);

-- Canciones
CREATE TABLE public.canciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id uuid,   -- NULL = himnario global (Himnario Pentecostal)
  titulo text NOT NULL,
  autor text,
  tono text,
  categoria text,
  numero integer,
  texto_busqueda text,
  fecha_creacion timestamp DEFAULT now()
);

-- Partes de canción (versos, coros, puentes, etc)
CREATE TABLE public.partes_cancion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cancion_id uuid REFERENCES public.canciones(id),
  tipo text,          -- "Verso", "Coro", "Puente", "Intro", "Outro", "Observación"
  texto text,         -- letra en MAYÚSCULAS (sin acordes)
  texto_letra text,   -- ídem
  texto_acordes text, -- 1 línea acordes + 1 línea letra (formato: "Do Fa Sol\nletra aquí")
  tiene_acordes boolean DEFAULT false,
  orden bigint
);

-- Listas de culto
CREATE TABLE public.listas_culto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  fecha date,
  iglesia_id uuid REFERENCES public.iglesias(id)
);

-- Items de lista (canciones, biblia, imágenes, estados)
CREATE TABLE public.items_lista (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id uuid REFERENCES public.listas_culto(id),
  cancion_id uuid REFERENCES public.canciones(id),
  orden bigint,
  tipo text,            -- "cancion", "biblia", "imagen", "estado"
  referencia_biblica text,
  texto_biblico text,
  imagen_url text,
  estado_modo text,
  estado_titulo text,
  estado_subtitulo text,
  estado_url text
);

-- Historial de proyecciones (para estadísticas)
CREATE TABLE public.historial_proyecciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iglesia_id uuid REFERENCES public.iglesias(id),
  cancion_id uuid REFERENCES public.canciones(id),
  lista_id uuid REFERENCES public.listas_culto(id),
  tipo text DEFAULT 'cancion',
  titulo text,
  tono text,
  categoria text,
  proyectado_en timestamptz DEFAULT now()
);

Lógica crítica del himnario
typescript// ✅ SIEMPRE usar este query para cargar canciones:
// iglesia_id IS NULL = Himnario Pentecostal (global, ~1000 canciones)
// iglesia_id = iglesiaId = canciones propias de la iglesia
supabase.from("canciones").select("*")
  .or(`iglesia_id.eq.${iglesiaId},iglesia_id.is.null`)

// ✅ Acordes del himnario están en texto_acordes (NO en texto):
// texto = letra completa en MAYÚSCULAS (4 líneas)
// texto_acordes = "Do Fa Do\n¡Cuán firme cimiento..." (1 línea acordes + 1 letra)
// Para músicos: extraer línea 0 de texto_acordes + combinar con texto completo
const textoActual = (parte.tiene_acordes && parte.texto_acordes)
  ? parte.texto_acordes.split("\n")[0] + "\n" + parte.texto
  : parte.texto || parte.texto_letra || ""

lib/supabase.ts
typescriptimport { createClient } from "@supabase/supabase-js"
export const supabase = createClient(URL, KEY, {
  auth: {
    flowType: "implicit",  // ⚠️ NO cambiar a pkce — rompe el callback
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
lib/getIglesia.ts
typescript// Guarda iglesia activa en localStorage
// Key: "cancionero_iglesia_activa_id"
export const getIglesiaId = async (): Promise<string | null>
export const setIglesiaActivaId = (id: string) => void
export const limpiarIglesiaActivaId = () => void
export const cambiarIglesiaActiva = async (id: string): Promise<boolean>

Socket.IO — Eventos del servidor (puerto 4000)
javascript// CONTROL → TODOS
"unirse-sala"        ({ sala, pantalla }) → une al socket a la sala de la iglesia
"cargar-cancion"     (data) → emite a sala, guarda estado
"cambiar-parte"      (index) → emite a sala, actualiza index en estado
"mostrar-biblia"     (data) → emite a sala
"cambiar-pagina-biblia" (pagina) → emite a sala
"mostrar-imagen"     (data) → emite a sala
"mostrar-estado"     (data) → emite a sala (negro, espera, logo, mensaje)
"control-siguiente"  () → broadcast a sala (proyector maneja la lógica)
"control-anterior"   () → broadcast a sala
"precargar-imagenes" (urls) → emite a sala
"cancion-activa"     (data) → emite a sala (para destacar en control)

// CLIENTES → SERVIDOR
"get-estado"         () → servidor responde con "estado-actual"

// Estado persiste en estado.json por sala (iglesia_id)

Módulos — Estado actual y qué hace cada uno
/control — Centro operativo del culto

Busca y proyecta canciones con virtualización
Maneja lista de culto (agregar, reordenar, proyectar)
Guarda/carga listas en Supabase (listas_culto + items_lista)
Controla proyector y músicos vía socket
Gestiona fondo de pantalla (preset CSS, imagen estática, movimiento)
Upload de imágenes a Supabase Storage (imagenes-culto)
Filtros: tono, categoría, acordes, búsqueda por texto/letra
Responsive mobile-first con barra sticky de navegación
Tarjetas de colores por categoría

/proyectar — Pantalla congregación

Recibe eventos socket, renderiza letra centrada
Maneja: canciones, biblia paginada, imágenes, estados (negro/espera/logo/mensaje)
Escalado automático de fuente según largo del texto
Fondos: preset CSS, imagen estática, imagen con movimiento
Logo de iglesia posicionado con bottom/right en vh/vw
Overlay negro entre transiciones

/musicos — Pantalla músicos

Muestra letra + acordes de la canción activa
Fix crítico: texto_acordes solo tiene 1 línea de acordes → combinar con texto completo
Transposición en tiempo real (semitonos arriba/abajo)
Escala latina (Do/Re/Mi) y americana (C/D/E)
Detecta 3 formatos de acordes: corchetes [Do], línea arriba, acordes solos
Panel ⚙️ overlay con todos los controles
Barra inferior fija con transposición rápida

/canciones — Gestión del repertorio

CRUD completo de canciones + partes
Editor de acordes con vista previa en tiempo real para músicos
Detección automática de tono desde acordes
Vista lista / grid
Filtros: tono, categoría, búsqueda
Categorías preset + custom

/musicos, /proyectar — NO muestran Navbar (rutas públicas sin auth)

AuthProvider — Lógica de auth
typescript// Rutas públicas: /login, /register, /proyectar, /musicos, /auth/*
// En rutas protegidas: espera 80ms antes de verificar sesión
// (evita race condition con el callback de magic link)
// Escucha onAuthStateChange para redirigir en SIGNED_OUT
auth/callback — Flujo implicit
typescript// Solo maneja hash con access_token (#access_token=...)
// NO usar exchangeCodeForSession — rompe con flowType: "implicit"
// Si llega ?code= en query params → redirigir a /login?error=session

Bugs conocidos / ya corregidos en esta sesión

✅ Login URL hardcodeada → window.location.origin
✅ AuthProvider race condition → delay 80ms
✅ Canciones no cargaban → .or(iglesia_id.eq.X,iglesia_id.is.null)
✅ Músicos no mostraban acordes → usar texto_acordes + texto
✅ Logo proyector en pixels fijos → usar vh/vw
✅ flowType: "pkce" rompía callback → mantener "implicit"
✅ useSearchParams() sin Suspense → envolver en <Suspense>
✅ Control: lista de culto se salía de pantalla → minmax(0,1fr)


Convenciones de código

CSS inline en todos los componentes (sin Tailwind, sin módulos CSS)
fontSize: 16 en todos los inputs (evita zoom iOS Safari)
minHeight: 100dvh (no 100vh — se corta en iOS)
overflowX: hidden + boxSizing: border-box en wrappers
Todas las queries en Promise.all() — nunca secuenciales
window.location.hostname para URL del socket (funciona en red local)
Colores por categoría consistentes en control y canciones
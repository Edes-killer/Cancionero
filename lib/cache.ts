// lib/cache.ts — Cache local de canciones usando IndexedDB
const DB_NAME    = "selah-live"
const DB_VERSION = 3  // ✅ v3: agrega STORE_PARTES sin borrar los stores existentes
const STORE_CANCIONES = "canciones"
const STORE_META      = "meta"
const STORE_PARTES    = "partes"

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB no disponible")); return }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event) => {
      const db = req.result
      // ✅ Solo recrear canciones/meta si venimos de una version anterior a
      // la 2 (estructura vieja incompatible) — NO borrarlos en cada upgrade,
      // o el modo sin conexion perderia justo el cache que necesita cuando
      // Supabase esta caido durante una actualizacion de la app.
      if (event.oldVersion < 2) {
        if (db.objectStoreNames.contains(STORE_CANCIONES)) db.deleteObjectStore(STORE_CANCIONES)
        if (db.objectStoreNames.contains(STORE_META)) db.deleteObjectStore(STORE_META)
        db.createObjectStore(STORE_CANCIONES, { keyPath: "iglesiaId" })
        db.createObjectStore(STORE_META)
      }
      if (!db.objectStoreNames.contains(STORE_PARTES)) {
        db.createObjectStore(STORE_PARTES) // clave explícita = cancion_id
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror  = () => reject(req.error)
  })
}

// ── Cache persistente de partes (letra/acordes) por canción ──────────────────
// Antes solo vivía en memoria (useRef) y se perdía en cada reinicio de la
// app — si Supabase ya estaba caído al abrir, no había forma de proyectar
// ninguna canción aunque la lista (títulos) sí se viera desde el caché.
export async function getPartesCache(cancionId: string): Promise<any[] | null> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx  = db.transaction(STORE_PARTES, "readonly")
      const req = tx.objectStore(STORE_PARTES).get(cancionId)
      req.onsuccess = () => resolve(req.result?.partes || null)
      req.onerror   = () => resolve(null)
    })
  } catch { return null }
}

export async function setPartesCache(cancionId: string, partes: any[]): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx  = db.transaction(STORE_PARTES, "readwrite")
      const req = tx.objectStore(STORE_PARTES).put({ partes, timestamp: Date.now() }, cancionId)
      req.onsuccess = () => resolve()
      req.onerror   = () => reject(req.error)
    })
  } catch (e) { console.error("Error guardando cache de partes:", e) }
}

export interface CacheEntry {
  iglesiaId: string
  canciones: any[]
  timestamp: number
}

export async function getCancelacionesCache(iglesiaId: string): Promise<CacheEntry | null> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx  = db.transaction(STORE_CANCIONES, "readonly")
      const req = tx.objectStore(STORE_CANCIONES).get(iglesiaId)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror   = () => resolve(null)
    })
  } catch { return null }
}

export async function setCancelacionesCache(iglesiaId: string, canciones: any[]): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx  = db.transaction(STORE_CANCIONES, "readwrite")
      const req = tx.objectStore(STORE_CANCIONES).put({ iglesiaId, canciones, timestamp: Date.now() })
      req.onsuccess = () => resolve()
      req.onerror   = () => reject(req.error)
    })
  } catch (e) { console.error("Error guardando cache:", e) }
}

export async function clearCancelacionesCache(iglesiaId: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_CANCIONES, "readwrite")
      tx.objectStore(STORE_CANCIONES).delete(iglesiaId)
      tx.oncomplete = () => resolve()
    })
  } catch {}
}

// ✅ TTL reducido a 5 minutos — siempre datos frescos
export const CACHE_TTL_MS = 5 * 60 * 1000

export function cacheEsValido(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL_MS
}

// ── Disyuntor de Supabase ──────────────────────────────────────────────────
// Si un fetch de fondo (no crítico, ya hay datos en caché mostrándose) falla
// por red/timeout, no tiene sentido que CADA pantalla (control, canciones,
// musicos, AppContext) siga intentando su propio refresh inmediatamente —
// eso solo genera errores en consola y trabajo desperdiciado mientras
// Supabase sigue caído. Se guarda la última falla y se evitan reintentos de
// fondo por un rato corto; los reintentos explícitos del usuario (ej. tirar
// para refrescar) o las escrituras (guardar/crear) no pasan por acá.
const KEY_SUPABASE_CAIDO = "selah-supabase-caido-desde"
const COOLDOWN_MS = 45 * 1000

export function marcarSupabaseCaido() {
  try { localStorage.setItem(KEY_SUPABASE_CAIDO, String(Date.now())) } catch { /* ignorar */ }
}

export function marcarSupabaseOk() {
  try { localStorage.removeItem(KEY_SUPABASE_CAIDO) } catch { /* ignorar */ }
}

export function supabaseProbablementeCaido(): boolean {
  try {
    const desde = Number(localStorage.getItem(KEY_SUPABASE_CAIDO) || 0)
    return desde > 0 && (Date.now() - desde) < COOLDOWN_MS
  } catch { return false }
}
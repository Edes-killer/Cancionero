// lib/cache.ts — Cache local de canciones usando IndexedDB
const DB_NAME    = "selah-live"
const DB_VERSION = 2  // ✅ Subido a 2 para invalidar caché anterior automáticamente
const STORE_CANCIONES = "canciones"
const STORE_META      = "meta"

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB no disponible")); return }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      // Limpiar stores viejos al actualizar versión
      if (db.objectStoreNames.contains(STORE_CANCIONES)) db.deleteObjectStore(STORE_CANCIONES)
      if (db.objectStoreNames.contains(STORE_META)) db.deleteObjectStore(STORE_META)
      db.createObjectStore(STORE_CANCIONES, { keyPath: "iglesiaId" })
      db.createObjectStore(STORE_META)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror  = () => reject(req.error)
  })
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
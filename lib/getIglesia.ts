import { supabase } from "@/lib/supabase"

const KEY_IGLESIA_ACTIVA = "cancionero_iglesia_activa_id"

// ── Guardar iglesia activa en localStorage ────────────────────────────────────
export const setIglesiaActivaId = (iglesiaId: string) => {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY_IGLESIA_ACTIVA, iglesiaId)
}

// ── Limpiar iglesia activa (al cerrar sesión) ─────────────────────────────────
export const limpiarIglesiaActivaId = () => {
  if (typeof window === "undefined") return
  localStorage.removeItem(KEY_IGLESIA_ACTIVA)
}

// ── Validación de UUID para evitar valores corruptos en localStorage ─────────
// Previene que strings como "undefined", "null" o "" lleguen como iglesiaId
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const esUUIDValido = (s: string | null): s is string => !!(s && UUID_REGEX.test(s))

// ── Lectura sincrónica sin red — para el modo sin conexión ────────────────────
// A diferencia de getIglesiaId(), esto NUNCA llama a Supabase. Se usa cuando
// ya se confirmó (en AuthProvider) que no se puede verificar la sesión, para
// decidir si hay evidencia suficiente de un login real anterior en este
// dispositivo como para seguir funcionando con los datos ya cacheados.
export const getIglesiaIdCacheOnly = (): string | null => {
  if (typeof window === "undefined") return null
  const guardada = localStorage.getItem(KEY_IGLESIA_ACTIVA)
  return esUUIDValido(guardada) ? guardada : null
}

// ── Promise deduplication: evita llamadas concurrentes a getUser() ────────────
let _fetchEnCurso: Promise<string | null> | null = null

// ── Obtener iglesia_id del usuario autenticado ────────────────────────────────
//
//  Flujo optimizado vs versión anterior:
//
//  1. FAST PATH: si localStorage ya tiene iglesia_id, hacer solo getSession()
//     (no adquiere el auth lock) y retornar inmediatamente.
//     → Elimina el 99% de los "Lock stolen by another request" que ocurren
//       cuando músicos + proyectar + control reconectan simultáneamente.
//     → getUser() solo se llama cuando no hay iglesia en localStorage (login inicial).
//
//  2. DEDUPLICATION: si hay un fetch en curso, esperar por él en vez de crear otro.
//     → Evita el error cuando múltiples páginas inician al mismo tiempo sin cache.
//
export const getIglesiaId = async (): Promise<string | null> => {
  const guardada = typeof window !== "undefined"
    ? localStorage.getItem(KEY_IGLESIA_ACTIVA)
    : null

  // ✅ Validar UUID: descarta strings corruptos ("undefined", "null", "", etc.)
  // que podrían causar queries fallidas con error {} vacío en Supabase
  if (esUUIDValido(guardada)) {
    try {
      // ✅ Con timeout: si Supabase esta caido/lento, no nos quedamos colgados
      // aca para siempre (bloquearia control/canciones/proyectar enteros).
      // "timedOut" marca el caso ambiguo (no sabemos si hay sesion o no)
      // para distinguirlo de un "no hay sesion" confirmado de verdad.
      const resultado = await Promise.race<{ session: any; error: any; timedOut: boolean }>([
        supabase.auth.getSession().then(r => ({ session: r.data.session, error: r.error, timedOut: false })),
        new Promise(resolve =>
          setTimeout(() => resolve({ session: null, error: null, timedOut: true }), 4000)
        )
      ])
      if (resultado.session) return guardada

      if (!resultado.error && !resultado.timedOut) {
        // ✅ Confirmado sin ambigüedad: no hay sesion (logout real o nunca
        // hubo login en este dispositivo) -- ahi si limpiar y re-autenticar.
        if (typeof window !== "undefined") localStorage.removeItem(KEY_IGLESIA_ACTIVA)
      } else {
        // ✅ Error de red o timeout -- no podemos confirmar nada. Antes esto
        // borraba el cache igual, destruyendo justo el dato que permite
        // seguir usando la app sin conexion (ver AuthProvider). Confiar en
        // el cache en vez de asumir que la sesion es invalida.
        return guardada
      }
    } catch {
      // Error de red al verificar -- confiar en el cache en vez de borrarlo
      return guardada
    }
  } else if (guardada) {
    // Valor en localStorage pero no es UUID válido → limpiar silenciosamente
    if (typeof window !== "undefined") {
      localStorage.removeItem(KEY_IGLESIA_ACTIVA)
    }
  }

  // Sin caché: necesitamos ir a auth + BD
  if (_fetchEnCurso) return _fetchEnCurso

  _fetchEnCurso = _fetchIglesiaDesdeAuth()
  try {
    return await _fetchEnCurso
  } finally {
    _fetchEnCurso = null
  }
}

// Fetch real desde auth + BD (solo cuando localStorage está vacío)
const _fetchIglesiaDesdeAuth = async (): Promise<string | null> => {
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    console.warn("⚠️ getIglesiaId: usuario no autenticado")
    return null
  }

  const userId = userData.user.id

  const { data, error } = await supabase
    .from("usuarios_iglesia")
    .select("iglesia_id, creado_en")
    .eq("user_id", userId)
    .order("creado_en", { ascending: true })

  if (error) {
    console.error("❌ getIglesiaId: error consultando usuarios_iglesia:", error)
    return null
  }

  const relaciones = data || []

  if (relaciones.length === 0) {
    console.warn("⚠️ getIglesiaId: el usuario no tiene iglesias asociadas")
    return null
  }

  const idsPermitidos: string[] = relaciones
    .map((r: any) => r.iglesia_id)
    .filter(Boolean)

  const guardada = typeof window !== "undefined"
    ? localStorage.getItem(KEY_IGLESIA_ACTIVA)
    : null

  if (guardada && idsPermitidos.includes(guardada)) {
    return guardada
  }

  const primera = idsPermitidos[0]
  if (primera && typeof window !== "undefined") {
    localStorage.setItem(KEY_IGLESIA_ACTIVA, primera)
  }

  return primera ?? null
}

// ── Cambiar iglesia activa ────────────────────────────────────────────────────
export const cambiarIglesiaActiva = async (iglesiaId: string): Promise<boolean> => {
  // getSession() en vez de getUser() — no adquiere el auth lock
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session?.user) return false

  const { data } = await supabase
    .from("usuarios_iglesia")
    .select("iglesia_id")
    .eq("user_id", sessionData.session.user.id)
    .eq("iglesia_id", iglesiaId)
    .single()

  if (!data) {
    console.warn("⚠️ cambiarIglesiaActiva: el usuario no tiene acceso a esa iglesia")
    return false
  }

  setIglesiaActivaId(iglesiaId)
  return true
}
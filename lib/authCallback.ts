import { supabase } from "@/lib/supabase"
import { conTimeout } from "@/lib/timeout"

// ✅ El callback de OAuth (esquema propio com.tuiglesia.cancionero://) dispara
// el evento appUrlOpen que escuchan TANTO la pantalla de login COMO
// DeepLinkHandler -- y cada uno llamaba supabase.auth.setSession con los
// MISMOS tokens. Resultado: 2-3 setSession concurrentes que chocaban por el
// lock interno de Supabase y se quedaban colgados (nunca resolvían, la sesión
// quedaba sin establecerse, el login no se completaba).
//
// Este "single-flight" garantiza que setSession corra UNA sola vez: el primer
// llamador arranca la operación y los demás esperan EXACTAMENTE el mismo
// resultado en vez de disparar otra. Se resetea al terminar para permitir un
// reintento si la primera vez falló por red.
let enCurso: Promise<"ok" | "error" | "timeout"> | null = null

export function establecerSesionUnaVez(
  access_token: string,
  refresh_token: string
): Promise<"ok" | "error" | "timeout"> {
  if (enCurso) return enCurso
  enCurso = (async () => {
    const r = await conTimeout(
      supabase.auth.setSession({ access_token, refresh_token }),
      8000
    )
    if (r === "timeout") return "timeout" as const
    if (r.error) return "error" as const
    return "ok" as const
  })()
  // ✅ permitir reintento si falló (no dejar cacheado un resultado malo)
  enCurso.then(res => { if (res !== "ok") enCurso = null })
  return enCurso
}

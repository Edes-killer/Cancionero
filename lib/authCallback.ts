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

// Supabase puede devolver OAuth en dos formatos según la configuración activa:
// implicit (#access_token=...) o PKCE (?code=...). La APK debe aceptar ambos;
// ignorar `code` hacía que Google volviera correctamente a Selah pero la app
// regresara al login sin explicar nada.
let urlEnCurso: Promise<"ok" | "error" | "sin-datos" | "timeout"> | null = null
export function establecerSesionDesdeUrl(url: string): Promise<"ok" | "error" | "sin-datos" | "timeout"> {
  if (urlEnCurso) return urlEnCurso
  urlEnCurso = (async () => {
    try {
      const frag = url.includes("#") ? url.split("#")[1] : ""
      const query = url.includes("?") ? url.split("?")[1]?.split("#")[0] : ""
      const hp = new URLSearchParams(frag)
      const qp = new URLSearchParams(query)
      const access = hp.get("access_token") || qp.get("access_token")
      const refresh = hp.get("refresh_token") || qp.get("refresh_token")
      if (access && refresh) return await establecerSesionUnaVez(access, refresh)

      const code = qp.get("code") || hp.get("code")
      if (!code) return "sin-datos" as const
      const r = await conTimeout(supabase.auth.exchangeCodeForSession(code), 12000)
      if (r === "timeout") return "timeout" as const
      return r.error || !r.data.session ? "error" as const : "ok" as const
    } catch {
      return "error" as const
    }
  })()
  urlEnCurso.finally(() => { urlEnCurso = null })
  return urlEnCurso
}

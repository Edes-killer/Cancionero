"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getIglesiaIdCacheOnly, getIglesiaId, getRolEnIglesia } from "@/lib/getIglesia"
import { navegarSPA, normalizarRuta } from "@/lib/navegar"
import { conTimeout } from "@/lib/timeout"

// ✅ Clave compartida con AppContext para el banner de "modo sin conexión"
export const KEY_MODO_SIN_CONEXION = "selah-modo-sin-conexion"

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checking, setChecking] = useState(false)
  // ✅ Siempre arranca en false (igual que en el servidor, donde no existe
  // localStorage) para que el primer render del cliente calce con el HTML
  // que ya mandó el servidor. Leer localStorage acá en el useState inicial
  // causaba un "Hydration failed" cada vez que el modo sin conexión ya
  // estaba activo de una carga anterior. El valor real se sincroniza en
  // el useEffect de abajo, que solo corre en el cliente después de montar.
  const [sinConexion, setSinConexion] = useState(false)

  useEffect(() => {
    try { setSinConexion(localStorage.getItem(KEY_MODO_SIN_CONEXION) === "1") }
    catch { /* ignorar */ }
  }, [])

  const publicRoutes = ["/login", "/register", "/proyectar", "/musicos", "/unirse"]
  // ✅ next.config.ts usa trailingSlash: true → usePathname() devuelve "/login/"
  // con barra final; y en el APK navegamos a "/login/index.html". normalizarRuta
  // deja ambos como "/login" para comparar contra las rutas conocidas.
  const pathnameNormalizado = normalizarRuta(pathname)
  const isPublicRoute =
    publicRoutes.includes(pathnameNormalizado) || pathnameNormalizado.startsWith("/auth")

  // ✅ El rol solo decidía a qué pantalla te mandaba el login al aceptar una
  // invitación -- pero nada impedía que un "músico" escribiera /configuracion
  // en la barra de direcciones y entrara igual. Estas rutas quedan
  // restringidas a líder/admin; un músico es redirigido a /musicos.
  const RUTAS_SOLO_LIDER = ["/configuracion", "/control", "/canciones"]
  const requiereLider = RUTAS_SOLO_LIDER.includes(pathnameNormalizado)

  useEffect(() => {
    // Rutas públicas y callback: nunca bloquear
    if (isPublicRoute) return

    let activo = true

    const checkSession = async () => {
      const MAX_INTENTOS = 4
      try {
        setChecking(true)

        // ✅ FIX: esperar un tick para que el callback pueda
        // guardar la sesión antes de que verifiquemos
        await new Promise(r => setTimeout(r, 80))

        if (!activo) return

        let huboErrorDeRed = false

        for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
          // ✅ Este era el punto más crítico sin protección: si getSession()
          // se colgaba en el PRIMER intento (ej. tratando de refrescar el
          // token con datos móviles malos), el for ni siquiera llegaba a
          // reintentar -- "checking" quedaba trabado en true para siempre,
          // sin ningún error visible, bloqueando toda la app.
          const resultado = await conTimeout(supabase.auth.getSession(), 5000)
          const { data, error } = resultado === "timeout"
            ? { data: { session: null }, error: new Error("timeout esperando getSession()") }
            : resultado
          if (!activo) return

          if (data.session) {
            // ✅ Sesión confirmada — si veníamos del modo sin conexión, salir de él
            try { localStorage.removeItem(KEY_MODO_SIN_CONEXION) } catch {}
            if (activo) setSinConexion(false)

            if (requiereLider) {
              try {
                // ✅ Sin timeout, una red lenta/mala (ej. datos móviles) dejaba
                // esta verificación colgada para siempre -- y como "checking"
                // no se apagaba hasta que esto terminara, la pantalla de
                // "Verificando sesión..." quedaba trabada sin avisar nada.
                const resultado = await Promise.race<{ igId: string | null; rol: string | null } | "timeout">([
                  (async () => {
                    const igId = await getIglesiaId()
                    const rol = igId ? await getRolEnIglesia(igId) : null
                    return { igId, rol }
                  })(),
                  new Promise<"timeout">(resolve => setTimeout(() => resolve("timeout"), 4000))
                ])
                if (activo && resultado !== "timeout" && resultado.rol === "musico") {
                  navegarSPA(router, "/musicos", { replace: true }); return
                }
              } catch { /* si falla la consulta, no bloquear -- mejor no molestar que trabar por un error de red */ }
            }
            return
          }

          if (!error) break // sin sesión y sin error → genuinamente no hay sesión, no vale la pena reintentar

          huboErrorDeRed = true
          console.error(`Error obteniendo sesión (intento ${intento}/${MAX_INTENTOS}):`, error)

          // ✅ Un corte temporal de Supabase (timeout, 504, etc.) no debería
          // desloguear a alguien que ya había iniciado sesión antes — se
          // reintenta con espera progresiva antes de mandarlo a /login, que
          // de todas formas tampoco podría completar el login mientras dure
          // la caída.
          if (intento < MAX_INTENTOS) {
            await new Promise(r => setTimeout(r, intento * 1500))
            if (!activo) return
          }
        }

        // ✅ Modo sin conexión: si no se pudo confirmar la sesión por un
        // problema de red (no por un logout real) pero este dispositivo ya
        // tiene un iglesia_id guardado de un login anterior, dejarlo seguir
        // con lo que haya en caché en vez de mandarlo a un /login que
        // tampoco podría completar mientras Supabase esté caído.
        if (huboErrorDeRed && getIglesiaIdCacheOnly()) {
          try { localStorage.setItem(KEY_MODO_SIN_CONEXION, "1") } catch {}
          setSinConexion(true)
          return
        }

        navegarSPA(router, "/login", { replace: true })
      } catch (error) {
        console.error("Error en AuthProvider:", error)
        if (!activo) return
        if (getIglesiaIdCacheOnly()) {
          try { localStorage.setItem(KEY_MODO_SIN_CONEXION, "1") } catch {}
          setSinConexion(true)
          return
        }
        navegarSPA(router, "/login", { replace: true })
      } finally {
        if (activo) setChecking(false)
      }
    }

    checkSession()

    // ✅ Escuchar cambios de sesión en tiempo real
    // Esto cubre el caso de login por magic link / OAuth
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!activo) return
      if (event === "SIGNED_OUT") {
        try { localStorage.removeItem(KEY_MODO_SIN_CONEXION) } catch {}
        setSinConexion(false)
        navegarSPA(router, "/login", { replace: true })
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        try { localStorage.removeItem(KEY_MODO_SIN_CONEXION) } catch {}
        setSinConexion(false)
      }
    })

    return () => {
      activo = false
      listener.subscription.unsubscribe()
    }
  }, [pathname, router, isPublicRoute])

  if (checking && !isPublicRoute) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #081120 0%, #0f172a 100%)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box"
      }}>
        <div style={{
          width: "100%",
          maxWidth: "420px",
          background: "rgba(30,41,59,0.96)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: "22px",
          padding: "28px",
          boxShadow: "0 18px 45px rgba(0,0,0,0.35)",
          textAlign: "center"
        }}>
          <div style={{
            width: "58px", height: "58px",
            borderRadius: "999px",
            border: "4px solid rgba(255,255,255,0.16)",
            borderTopColor: "#38bdf8",
            margin: "0 auto 18px auto",
            animation: "spinAuth 0.9s linear infinite"
          }} />

          <style>{`
            @keyframes spinAuth {
              from { transform: rotate(0deg); }
              to   { transform: rotate(360deg); }
            }
            @keyframes barraAuth {
              0%   { transform: translateX(-110%); }
              50%  { transform: translateX(30%); }
              100% { transform: translateX(160%); }
            }
          `}</style>

          <div style={{ fontSize: "22px", fontWeight: 800, marginBottom: "8px" }}>
            Cancionero Cristiano
          </div>
          <div style={{ fontSize: "14px", opacity: 0.7, lineHeight: 1.5 }}>
            Verificando sesión...
          </div>

          <div style={{
            marginTop: "18px", height: "8px",
            borderRadius: "999px", overflow: "hidden",
            background: "rgba(255,255,255,0.08)"
          }}>
            <div style={{
              height: "100%", width: "68%",
              borderRadius: "999px",
              background: "linear-gradient(90deg, #2563eb, #38bdf8)",
              animation: "barraAuth 1.2s ease-in-out infinite"
            }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {sinConexion && !isPublicRoute && (
        <div style={{
          position: "sticky", top: 0, zIndex: 200,
          background: "rgba(217,119,6,0.95)", color: "white",
          padding: "8px 16px", textAlign: "center",
          fontSize: 13, fontWeight: 700,
          fontFamily: "'Segoe UI', system-ui, sans-serif"
        }}>
          ⚠️ Sin conexión con el servidor — usando datos guardados. Algunas funciones (crear, guardar cambios) no están disponibles.
        </div>
      )}
      {children}
    </>
  )
}
import { createClient } from "@supabase/supabase-js"

// ✅ Variables de entorno — nunca hardcodear credenciales
// En .env.local (desarrollo):
//   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
//   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
// ANON_KEY queda como respaldo temporal para instalaciones ya configuradas.
// Ambas variables deben contener una clave PUBLICABLE; nunca service_role/secret.
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (o NEXT_PUBLIC_SUPABASE_ANON_KEY heredada)",
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    flowType: "implicit",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // ✅ Lock no-op SOLO en Capacitor: por defecto supabase-js usa navigator.locks para
    // serializar sus operaciones de auth (getSession/setSession/refresh).
    // En el WebView de Android (Capacitor) ese mecanismo se cuelga -- se
    // confirmó en el dispositivo que setSession quedaba esperando el lock
    // para siempre (TIMEOUT a los 8s) tras el login OAuth, dejando la sesión
    // sin establecerse. El WebView es de una sola ventana, así que no necesita
    // ese candado multi-pestaña. En web/Electron conservamos el lock oficial:
    // allí quitarlo puede provocar carreras durante refresh/login.
    ...(typeof window !== "undefined" && !!(window as any).Capacitor
      ? { lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn() }
      : {}),
  },
})

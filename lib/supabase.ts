import { createClient } from "@supabase/supabase-js"

// ✅ Variables de entorno — nunca hardcodear credenciales
// En .env.local (desarrollo):
//   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY")
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    flowType: "implicit",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // ✅ Lock no-op: por defecto supabase-js usa navigator.locks para
    // serializar sus operaciones de auth (getSession/setSession/refresh).
    // En el WebView de Android (Capacitor) ese mecanismo se cuelga -- se
    // confirmó en el dispositivo que setSession quedaba esperando el lock
    // para siempre (TIMEOUT a los 8s) tras el login OAuth, dejando la sesión
    // sin establecerse. La app es de una sola ventana, así que no necesita
    // ese candado multi-pestaña: se reemplaza por uno que ejecuta la función
    // directamente sin bloquear.
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn(),
  },
})
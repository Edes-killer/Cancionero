import { supabase } from "@/lib/supabase"

export type AmbitoConfiguracionNube = "control" | "transmision"

export function permiteConfiguracionNube(plan?: string | null): boolean {
  return plan === "pro" || plan === "premium"
}

export async function cargarConfiguracionNube<T>(
  iglesiaId: string,
  ambito: AmbitoConfiguracionNube,
): Promise<T | null | undefined> {
  const { data, error } = await supabase
    .from("configuraciones_iglesia")
    .select(ambito)
    .eq("iglesia_id", iglesiaId)
    .maybeSingle()

  if (error) {
    // La aplicación sigue usando la configuración local si la migración aún no
    // está instalada o la red está temporalmente caída.
    console.warn(`Configuración ${ambito} en nube no disponible:`, error.message)
    return undefined
  }

  const valor = (data as Record<string, unknown> | null)?.[ambito]
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as T : null
}

export async function guardarConfiguracionNube<T extends Record<string, unknown>>(
  iglesiaId: string,
  ambito: AmbitoConfiguracionNube,
  configuracion: T,
): Promise<boolean> {
  const payload: Record<string, unknown> = {
    iglesia_id: iglesiaId,
    [ambito]: configuracion,
    actualizado_en: new Date().toISOString(),
  }
  const { error } = await supabase
    .from("configuraciones_iglesia")
    .upsert(payload, { onConflict: "iglesia_id" })

  if (error) {
    console.warn(`No se pudo guardar configuración ${ambito} en nube:`, error.message)
    return false
  }
  return true
}

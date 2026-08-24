// Copia texto al portapapeles con FALLBACK para WebView/APK, donde
// navigator.clipboard.writeText a veces falla con "permission denied".
// Nunca lanza (no ensucia el log de errores); devuelve si logró copiar.
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto)
      return true
    }
  } catch { /* sin permiso en el WebView → probamos el método viejo */ }
  try {
    const ta = document.createElement("textarea")
    ta.value = texto
    ta.style.position = "fixed"
    ta.style.top = "0"
    ta.style.opacity = "0"
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

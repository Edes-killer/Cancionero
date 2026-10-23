"use client"

import { useEffect, useState } from "react"

/**
 * Franja de arrastre que reemplaza visualmente la barra clara de Windows.
 * Electron conserva a la derecha sus botones nativos de minimizar, maximizar
 * y cerrar; la web y la APK no renderizan ni reservan este espacio.
 */
export default function ElectronTitlebar() {
  const [esElectron, setEsElectron] = useState(false)

  useEffect(() => {
    const activo = navigator.userAgent.includes("Electron")
    if (!activo) return

    document.documentElement.dataset.selahElectron = "true"
    const id = window.setTimeout(() => setEsElectron(true), 0)
    return () => {
      window.clearTimeout(id)
      delete document.documentElement.dataset.selahElectron
    }
  }, [])

  if (!esElectron) return null

  return <div className="electron-titlebar" aria-hidden="true" />
}

"use client"

import Link from "next/link"
import "./globals.css"


export default function RootLayout({ children }: any) {
  return (
    <html lang="es">
      <body>
        
        {/* ✅ NAVBAR SIN ROMPER CSS */}
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: 10,
            background: "#000",
            borderBottom: "1px solid #333",
            color:"white"
          }}
        >
          <Link href="/canciones">🎶 Canciones</Link>
          <Link href="/control">🎛️ Control</Link>
          <Link href="/musicos">🎸 Músicos</Link>
          <Link href="/proyectar">📺 Proyector</Link>
        </div>

        {children}
      </body>
    </html>
  )
  
}
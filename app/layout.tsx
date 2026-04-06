"use client"

import Link from "next/link"

export default function RootLayout({ children }: any) {
  return (
    <html>
      <body style={{ margin: 0, background: "#111", color: "white" }}>
        
        {/* NAVBAR */}
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: 10,
            background: "#000",
            borderBottom: "1px solid #333"
          }}
        >
          <Link href="/canciones">🎶 Canciones</Link>
          <Link href="/control">🎛️ Control</Link>
          <Link href="/musicos">🎸 Músicos</Link>
          <Link href="/proyector">📺 Proyector</Link>
        </div>

        {/* CONTENIDO */}
        <div>{children}</div>
      </body>
    </html>
  )
}
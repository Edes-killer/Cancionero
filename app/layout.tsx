import type { Metadata } from "next"
import Script from "next/script"
import "./globals.css"
import { ThemeProvider } from "@/components/ThemeProvider"
import Navbar from "@/components/Navbar"
import AuthProvider from "@/components/AuthProvider"
import { DeepLinkHandler } from "@/components/DeepLinkHandler"
import { AppProvider } from "@/context/AppContext"
import { DebugOverlay } from "@/components/DebugOverlay"

export const metadata: Metadata = {
  title: "Selah Live",
  description: "Proyección para iglesias",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0, background: "#060d1a" }}>
        {/* 🔍 DIAGNÓSTICO TEMPORAL -- corre antes que React, en cada carga real
            de página. Escribe en el mismo diario (localStorage) que ve el
            DebugOverlay, así el conteo de recargas queda visible en pantalla. */}
        <Script id="diag-reload-counter" strategy="beforeInteractive">
          {`
            try {
              var n = Number(sessionStorage.getItem('__diagReloadCount') || '0') + 1;
              sessionStorage.setItem('__diagReloadCount', String(n));
              var t = new Date();
              var hora = ('0'+t.getMinutes()).slice(-2)+':'+('0'+t.getSeconds()).slice(-2)+'.'+('00'+t.getMilliseconds()).slice(-3);
              var prev = localStorage.getItem('selah_debug_trail') || '';
              var lineas = prev ? prev.split('\\n') : [];
              lineas.push(hora + ' ===== CARGA DE PAGINA #' + n + ' path=' + location.pathname + ' =====');
              while (lineas.length > 40) lineas.shift();
              localStorage.setItem('selah_debug_trail', lineas.join('\\n'));
            } catch (e) {}
          `}
        </Script>
        <DebugOverlay />
        <ThemeProvider>
          <AuthProvider>
            {/* ✅ AppProvider estaba escrito (canciones cacheadas, sinConexion,
                iglesiaId compartido) pero nunca se montaba acá -- useApp() en
                todas las pantallas devolvía siempre los valores por defecto
                vacíos en vez de datos reales. */}
            <AppProvider>
              <DeepLinkHandler />
              <Navbar />
              {children}
            </AppProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

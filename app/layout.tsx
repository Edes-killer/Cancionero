import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/ThemeProvider"
import Navbar from "@/components/Navbar"
import AuthProvider from "@/components/AuthProvider"
import { DeepLinkHandler } from "@/components/DeepLinkHandler"
import { AppProvider } from "@/context/AppContext"

export const metadata: Metadata = {
  title: "Selah Live",
  description: "Proyección para iglesias",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0, background: "#060d1a" }}>
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

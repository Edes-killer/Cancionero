import "./globals.css"
import { DeepLinkHandler } from '@/components/DeepLinkHandler'
import AuthProvider from "@/components/AuthProvider"
import Navbar from "@/components/Navbar"
import { AppProvider } from "@/context/AppContext"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <DeepLinkHandler />
        <AppProvider>
          <AuthProvider>
            <Navbar />
            {children}
          </AuthProvider>
        </AppProvider>
      </body>
    </html>
  )
}

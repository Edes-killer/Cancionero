import "./globals.css"
import { DeepLinkHandler } from '@/components/DeepLinkHandler'
import AuthProvider from "@/components/AuthProvider"
import Navbar from "@/components/Navbar"


export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <DeepLinkHandler />
        <AuthProvider>
          <Navbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
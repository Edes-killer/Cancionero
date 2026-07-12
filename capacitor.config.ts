import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.tuiglesia.cancionero',
  appName: 'Selah Live',
  webDir: 'out',
  server: {
    // ✅ La app corre en http://localhost (no https). Motivo: necesita hablar
    // con el servidor local del computador por http://IP:4000 (para proyectar).
    // Desde un contexto https eso es "mixed content" y el WebView lo bloquea;
    // se usaba CapacitorHttp para saltarlo, pero CapacitorHttp reemplaza el
    // fetch global y eso ROMPE la navegación SPA de Next (router.push deja de
    // funcionar en el WebView nuevo de One UI 8.5). Con esquema http:
    //   • http (app) ↔ http (servidor local): mismo esquema, sin bloqueo.
    //   • http (app) → https (Supabase): permitido (subir de nivel es seguro).
    //   • localhost sigue siendo "secure context", así que cámara/etc. andan.
    // Así no hace falta CapacitorHttp y la navegación funciona.
    androidScheme: 'http',
    cleartext: true
  },
  plugins: {
    CapacitorHttp: {
      enabled: false
    },
    Browser: {
      androidExternalBrowser: false
    }
  }
};
export default config;
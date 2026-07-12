import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.tuiglesia.cancionero',
  appName: 'Selah Live',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    // ⚠️ CapacitorHttp DESACTIVADO temporalmente para diagnosticar: cuando
    // está enabled reemplaza el window.fetch global de la app, y la
    // navegación SPA de Next usa fetch para traer cada página (RSC). Se
    // sospecha que eso rompe toda la navegación entre pantallas en el APK.
    // (Se usaba para el ping http:// al servidor local desde contexto https;
    //  si esto arregla la navegación, se resuelve ese ping por otra vía.)
    CapacitorHttp: {
      enabled: false
    },
    Browser: {
      androidExternalBrowser: false
    }
  }
};
export default config;
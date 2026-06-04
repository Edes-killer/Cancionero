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
    CapacitorHttp: {
      enabled: true
    },
    Browser: {
      androidExternalBrowser: false
    }
  }
};
export default config;
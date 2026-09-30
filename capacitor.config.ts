import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.esquadraofc.app',
  appName: 'Esquadrão FC',
  webDir: 'dist',
  android: { backgroundColor: '#0a1511' },
  plugins: {
    SplashScreen: { launchShowDuration: 1500, launchAutoHide: true, backgroundColor: '#0a1511', showSpinner: false },
  },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'mg.travaux.routiers',
  appName: 'Travaux Routiers',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Geolocation: {
      // Permissions pour la géolocalisation
    }
  }
};

export default config;

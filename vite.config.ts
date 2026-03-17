import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import removeConsole from 'vite-plugin-remove-console';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === 'production' ? [removeConsole({ includes: ['ts', 'tsx'] })] : []),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('react-dom') || id.includes('node_modules/react/')) return 'vendor-react';
          if (id.includes('@supabase/')) return 'vendor-supabase';
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'vendor-motion';
        },
      },
    },
  },
}));

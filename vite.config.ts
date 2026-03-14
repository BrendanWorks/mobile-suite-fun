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
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js', '@supabase/auth-ui-react', '@supabase/auth-ui-shared'],
          'vendor-motion': ['framer-motion'],
        },
      },
    },
  },
}));

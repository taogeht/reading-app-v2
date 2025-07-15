import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Custom plugin to handle BetterAuth API routes during development
    // Temporarily disabled until server-side auth is properly configured
    {
      name: 'better-auth-dev',
      configureServer(server) {
        server.middlewares.use('/api/auth', async (req, res, next) => {
          console.warn('Auth API temporarily disabled - returning mock response');
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ 
            error: 'Auth service temporarily unavailable',
            message: 'Authentication is being configured for Railway deployment'
          }));
        });
      },
    },
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  define: {
    // Define global variables for browser compatibility
    global: 'globalThis',
  },
  build: {
    rollupOptions: {
      external: ['pg', 'better-auth/node'],
    },
  },
});

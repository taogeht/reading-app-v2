import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  preview: {
    host: '0.0.0.0',
    port: process.env.PORT ? parseInt(process.env.PORT) : 4173,
    strictPort: true,
    cors: true,
    allowedHosts: ['healthcheck.railway.app', 'localhost', '127.0.0.1']
  },
  server: {
    host: '0.0.0.0'
  },
  plugins: [
    react(),
    // Custom plugin to handle unified API routes during development and preview
    {
      name: 'unified-api-dev',
      configureServer(server) {
        server.middlewares.use('/api', async (req, res, next) => {
          await handleApiMiddleware(req, res, next);
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use('/api', async (req, res, next) => {
          await handleApiMiddleware(req, res, next);
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

// Shared middleware function for both dev and preview
async function handleApiMiddleware(req: any, res: any, next: any) {
  try {
    // Import API handler dynamically
    const { handleApiRequest } = await import('./src/api/index');
    
    // Convert Node.js request to Web API Request
    const url = new URL(req.url!, `http://${req.headers.host}`);
    
    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => resolve(data));
      });
    }

    const request = new Request(url.href, {
      method: req.method,
      headers: req.headers as HeadersInit,
      body: body || undefined,
    });
    
    console.log('API middleware - Request:', req.method, url.pathname);

    const response = await handleApiRequest(request);
    
    // Convert Web API Response back to Node.js response
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    const responseBody = await response.text();
    res.end(responseBody);
  } catch (error) {
    console.error('API middleware error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
}

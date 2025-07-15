import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Custom plugin to handle BetterAuth API routes during development
    {
      name: 'better-auth-dev',
      configureServer(server) {
        server.middlewares.use('/api/auth', async (req, res, next) => {
          try {
            // Import auth handler dynamically to avoid issues
            const { authHandler } = await import('./src/lib/auth-handler');
            
            // Convert Node.js request to Web API Request
            const url = new URL(req.url!, `http://${req.headers.host}`);
            const request = new Request(url.href, {
              method: req.method,
              headers: req.headers as HeadersInit,
              body: req.method !== 'GET' && req.method !== 'HEAD' ? 
                await new Promise((resolve) => {
                  let body = '';
                  req.on('data', chunk => body += chunk);
                  req.on('end', () => resolve(body));
                }) : undefined,
            });

            const response = await authHandler(request);
            
            // Convert Web API Response back to Node.js response
            res.statusCode = response.status;
            response.headers.forEach((value, key) => {
              res.setHeader(key, value);
            });
            
            const responseBody = await response.text();
            res.end(responseBody);
          } catch (error) {
            console.error('BetterAuth middleware error:', error);
            res.statusCode = 500;
            res.end('Internal Server Error');
          }
        });
      },
    },
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  define: {
    // Ensure environment variables are available
    'process.env.BETTER_AUTH_SECRET': JSON.stringify(process.env.BETTER_AUTH_SECRET),
    'process.env.BETTER_AUTH_URL': JSON.stringify(process.env.BETTER_AUTH_URL),
  },
});

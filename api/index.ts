// Railway Unified API Handler
// This handles all API routes for production deployment

import { auth } from '../src/lib/better-auth-server';

export default async function handler(req: any, res: any) {
  // CORS headers for Railway deployment
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const path = url.pathname;

    // Route BetterAuth endpoints
    if (path.startsWith('/api/auth/')) {
      if (!auth) {
        throw new Error('BetterAuth not initialized');
      }

      // Create Web API Request for BetterAuth
      let body;
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
        body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }

      const request = new Request(url.href, {
        method: req.method,
        headers: req.headers,
        body: body || undefined,
      });

      const response = await auth.handler(request);
      
      // Forward BetterAuth response
      res.status(response.status);
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      
      const responseBody = await response.text();
      res.send(responseBody);
      return;
    }

    // Handle other API routes (classes, recordings, etc.)
    if (path.startsWith('/api/')) {
      const { handleApiRequest } = await import('../src/api/index');
      
      // Convert to Web API Request
      let body;
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
        body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }

      const request = new Request(url.href, {
        method: req.method,
        headers: req.headers,
        body: body || undefined,
      });

      const response = await handleApiRequest(request);
      
      // Forward response
      res.status(response.status);
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      
      const responseBody = await response.text();
      res.send(responseBody);
      return;
    }

    // Not found
    res.status(404).json({ error: 'API endpoint not found' });
    
  } catch (error) {
    console.error('API handler error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
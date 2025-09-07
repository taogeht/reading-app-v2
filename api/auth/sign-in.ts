// Railway API Route: /api/auth/sign-in
// BetterAuth sign-in endpoint for production deployment

import { auth } from '../../src/lib/better-auth-server';

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
    if (!auth) {
      throw new Error('BetterAuth not initialized');
    }

    // Forward request to BetterAuth
    const request = new Request(`${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const response = await auth.handler(request);
    
    // Forward BetterAuth response
    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    const body = await response.text();
    res.send(body);
    
  } catch (error) {
    console.error('BetterAuth sign-in error:', error);
    res.status(500).json({ 
      error: 'Authentication service error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
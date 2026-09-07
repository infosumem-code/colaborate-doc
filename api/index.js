import { handleApiRequest } from '../lib/api-handler.js';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const host = req.headers.host || 'localhost';
  const parsedUrl = new URL(req.url, `http://${host}`);
  const pathname = parsedUrl.pathname;

  let body = req.body;
  if (typeof body === 'string' && body.length > 0) {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  } else if (!body) {
    body = {};
  }

  try {
    const result = await handleApiRequest(pathname, req.method, body, req.headers);
    if (result) {
      return res.status(result.status).json(result.data);
    } else {
      return res.status(404).json({ error: 'Endpoint no trobat' });
    }
  } catch (err) {
    console.error('Error a Vercel Serverless handler:', err);
    return res.status(500).json({ error: 'Error intern del servidor' });
  }
}

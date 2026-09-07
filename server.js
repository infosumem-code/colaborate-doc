import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './lib/api-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = path.join(__dirname, 'public');

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStatic(req, res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Fitxer no trobat');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error('Payload massa gran'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('JSON invàlid'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  try {
    // Si la petició va dirigida a la API
    if (pathname.startsWith('/api/')) {
      const body = (req.method === 'POST' || req.method === 'PUT') ? await parseJsonBody(req) : {};
      const apiResult = await handleApiRequest(pathname, req.method, body, req.headers);
      if (apiResult) {
        return sendJson(res, apiResult.status, apiResult.data);
      } else {
        return sendJson(res, 404, { error: 'Endpoint no trobat' });
      }
    }

    // Enrutament de fitxers estàtics
    if (pathname === '/' || pathname === '/document') {
      return serveStatic(req, res, path.join(PUBLIC_DIR, 'index.html'));
    }

    if (pathname === '/admin') {
      return serveStatic(req, res, path.join(PUBLIC_DIR, 'admin.html'));
    }

    const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    const staticFilePath = path.join(PUBLIC_DIR, safePath);
    if (staticFilePath.startsWith(PUBLIC_DIR)) {
      return serveStatic(req, res, staticFilePath);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Pàgina no trobada');

  } catch (err) {
    console.error('Error al servidor:', err);
    sendJson(res, 500, { error: 'Error intern del servidor' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor actiu a http://localhost:${PORT}`);
});

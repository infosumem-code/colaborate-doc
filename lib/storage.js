import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_DB_PATH = path.join(__dirname, '..', 'data', 'database.json');
const TMP_DB_PATH = path.join('/tmp', 'acab_database.json');

// Comprovar si tenim Vercel KV / Upstash configurat
function isKvConfigured() {
  return !!(
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

function getKvCredentials() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return { url, token };
}

// Llegir base de dades
export async function readDatabase() {
  // 1. Si hi ha Vercel KV / Upstash (Cloud Serverless)
  if (isKvConfigured()) {
    try {
      const { url, token } = getKvCredentials();
      const res = await fetch(`${url}/get/acab_document_data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.result) {
          const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Error llegint de Vercel KV, utilitzant fallback:', err);
    }
  }

  // 2. Si hi ha còpia a /tmp (entorn serverless sense KV)
  if (fs.existsSync(TMP_DB_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(TMP_DB_PATH, 'utf8'));
    } catch (err) {
      console.warn('Error llegint /tmp/acab_database.json:', err);
    }
  }

  // 3. Llegir fitxer original data/database.json
  try {
    const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
    const db = JSON.parse(raw);
    return db;
  } catch (err) {
    console.error('Error llegint database.json local:', err);
    throw err;
  }
}

// Escriure base de dades
export async function writeDatabase(db) {
  // 1. Si hi ha Vercel KV / Upstash
  if (isKvConfigured()) {
    try {
      const { url, token } = getKvCredentials();
      await fetch(`${url}/set/acab_document_data`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(db)
      });
      return;
    } catch (err) {
      console.error('Error guardant a Vercel KV:', err);
    }
  }

  // 2. Intentar guardar a data/database.json local
  try {
    const tempFile = `${LOCAL_DB_PATH}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempFile, LOCAL_DB_PATH);
    return;
  } catch (err) {
    // Si el filesystem és Read-Only (Vercel sense KV), guardem a /tmp
    try {
      fs.writeFileSync(TMP_DB_PATH, JSON.stringify(db, null, 2), 'utf8');
    } catch (tmpErr) {
      console.error('Error desant a /tmp:', tmpErr);
    }
  }
}

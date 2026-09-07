import { readDatabase, writeDatabase, getDefaultTemplate } from './storage.js';
import { generateWordDocumentHtml } from './doc-generator.js';

function verifyAdmin(req, db) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token && token === db.config.adminPin;
}

export async function handleApiRequest(rawPathname, method, body, headers) {
  const req = { headers: headers || {} };

  // Normalitzar pathname (treure query params i assegurar prefix /api/)
  let pathname = (rawPathname || '').split('?')[0];
  if (!pathname.startsWith('/')) pathname = '/' + pathname;
  if (!pathname.startsWith('/api/')) {
    if (pathname.startsWith('/api')) {
      pathname = pathname.replace('/api', '/api/');
    } else {
      pathname = '/api' + pathname;
    }
  }

  // 1. Obtenir document complet
  if ((pathname === '/api/document' || pathname === '/api/q') && method === 'GET') {
    const db = await readDatabase();
    return {
      status: 200,
      data: {
        config: db.config,
        seccions: db.seccions,
        document: db.document
      }
    };
  }

  // 2. Comprovació ràpida de versió per a auto-sync
  if (pathname === '/api/document/versio' && method === 'GET') {
    const db = await readDatabase();
    return {
      status: 200,
      data: {
        versio: (db.document && db.document.versio) || 1,
        tancat: !!(db.document && db.document.tancat),
        darreraModificacio: db.document && db.document.darreraModificacio,
        darrerEditor: db.document && db.document.darrerEditor
      }
    };
  }

  // 3. Desar respostes col·laboratives
  if (pathname === '/api/document/respostes' && method === 'POST') {
    const db = await readDatabase();
    if (!db.document) {
      db.document = { respostes: {}, comentaris: {}, tancat: false, versio: 1, darreraModificacio: null, darrerEditor: null };
    }

    if (db.document.tancat) {
      return {
        status: 403,
        data: { error: 'El document de treball està tancat i no admet més modificacions.' }
      };
    }

    if (body.respostes && typeof body.respostes === 'object') {
      db.document.respostes = { ...db.document.respostes, ...body.respostes };
    }

    db.document.versio = (db.document.versio || 1) + 1;
    db.document.darreraModificacio = new Date().toISOString();
    if (typeof body.editor === 'string' && body.editor.trim()) {
      db.document.darrerEditor = body.editor.trim();
    }

    await writeDatabase(db);

    return {
      status: 200,
      data: {
        success: true,
        versio: db.document.versio,
        darreraModificacio: db.document.darreraModificacio,
        darrerEditor: db.document.darrerEditor
      }
    };
  }

  // 4. Admin: Login
  if (pathname === '/api/admin/login' && method === 'POST') {
    const db = await readDatabase();
    if (body.pin === db.config.adminPin) {
      return { status: 200, data: { success: true, token: db.config.adminPin } };
    } else {
      return { status: 401, data: { error: 'Contrasenya incorrecta' } };
    }
  }

  // 5. Admin: Dades completes
  if (pathname === '/api/admin/data' && method === 'GET') {
    const db = await readDatabase();
    if (!verifyAdmin(req, db)) {
      return { status: 401, data: { error: 'No autoritzat' } };
    }
    return { status: 200, data: db };
  }

  // 6. Admin: Afegir/modificar pregunta
  if (pathname === '/api/admin/preguntes' && method === 'POST') {
    const db = await readDatabase();
    if (!verifyAdmin(req, db)) {
      return { status: 401, data: { error: 'No autoritzat' } };
    }
    const { seccioId, pregunta } = body;

    if (!seccioId || !pregunta || !pregunta.titol) {
      return { status: 400, data: { error: 'Dades de pregunta incompletes' } };
    }

    const seccio = db.seccions.find(s => s.id === seccioId);
    if (!seccio) {
      return { status: 404, data: { error: 'Secció no trobada' } };
    }

    if (pregunta.id) {
      let antigaSeccio = null;
      let antigaIdx = -1;
      for (const s of db.seccions) {
        const idx = s.preguntes.findIndex(p => p.id === pregunta.id);
        if (idx !== -1) {
          antigaSeccio = s;
          antigaIdx = idx;
          break;
        }
      }

      const updatedPregunta = {
        ...(antigaSeccio ? antigaSeccio.preguntes[antigaIdx] : {}),
        ...pregunta,
        opcions: pregunta.tipus === 'checkbox_list' ? (Array.isArray(pregunta.opcions) ? pregunta.opcions : []) : undefined,
        permetAltres: pregunta.tipus === 'checkbox_list' ? !!pregunta.permetAltres : false
      };

      if (antigaSeccio && antigaSeccio.id !== seccio.id) {
        antigaSeccio.preguntes.splice(antigaIdx, 1);
        seccio.preguntes.push(updatedPregunta);
      } else if (antigaSeccio) {
        antigaSeccio.preguntes[antigaIdx] = updatedPregunta;
      } else {
        seccio.preguntes.push(updatedPregunta);
      }
    } else {
      const newId = 'p_' + Date.now().toString(36);
      const maxOrdre = db.seccions.reduce((max, s) => s.preguntes.reduce((m, p) => Math.max(m, p.ordre || 0), max), 0);
      seccio.preguntes.push({
        id: newId,
        ordre: maxOrdre + 1,
        titol: pregunta.titol,
        pista: pregunta.pista || '',
        tipus: pregunta.tipus || 'textarea',
        opcions: pregunta.tipus === 'checkbox_list' ? (Array.isArray(pregunta.opcions) ? pregunta.opcions : []) : undefined,
        permetAltres: pregunta.tipus === 'checkbox_list' ? !!pregunta.permetAltres : false
      });
    }

    db.document.versio = (db.document.versio || 1) + 1;
    await writeDatabase(db);
    return { status: 200, data: { success: true, seccions: db.seccions } };
  }

  // 7. Admin: Eliminar pregunta
  const matchDeletePregunta = pathname.match(/^\/api\/admin\/preguntes\/([^/]+)$/);
  if (matchDeletePregunta && method === 'DELETE') {
    const db = await readDatabase();
    if (!verifyAdmin(req, db)) {
      return { status: 401, data: { error: 'No autoritzat' } };
    }
    const pId = matchDeletePregunta[1];
    let trobat = false;

    for (const seccio of db.seccions) {
      const idx = seccio.preguntes.findIndex(p => p.id === pId);
      if (idx !== -1) {
        seccio.preguntes.splice(idx, 1);
        trobat = true;
        break;
      }
    }

    if (!trobat) {
      return { status: 404, data: { error: 'Pregunta no trobada' } };
    }

    db.document.versio = (db.document.versio || 1) + 1;
    await writeDatabase(db);
    return { status: 200, data: { success: true, seccions: db.seccions } };
  }

  // 8. Admin: Afegir o editar secció
  if (pathname === '/api/admin/seccions' && method === 'POST') {
    const db = await readDatabase();
    if (!verifyAdmin(req, db)) {
      return { status: 401, data: { error: 'No autoritzat' } };
    }
    const { id, titol } = body;
    if (!titol || !titol.trim()) {
      return { status: 400, data: { error: 'El títol de la secció és obligatori' } };
    }

    if (id) {
      const sec = db.seccions.find(s => s.id === id);
      if (!sec) return { status: 404, data: { error: 'Secció no trobada' } };
      sec.titol = titol.trim();
    } else {
      const newSecId = 'sec_' + Date.now().toString(36);
      db.seccions.push({
        id: newSecId,
        titol: titol.trim(),
        preguntes: []
      });
    }

    db.document.versio = (db.document.versio || 1) + 1;
    await writeDatabase(db);
    return { status: 200, data: { success: true, seccions: db.seccions } };
  }

  // 9. Admin: Eliminar secció
  const matchDeleteSeccio = pathname.match(/^\/api\/admin\/seccions\/([^/]+)$/);
  if (matchDeleteSeccio && method === 'DELETE') {
    const db = await readDatabase();
    if (!verifyAdmin(req, db)) {
      return { status: 401, data: { error: 'No autoritzat' } };
    }
    const sId = matchDeleteSeccio[1];
    const idx = db.seccions.findIndex(s => s.id === sId);
    if (idx === -1) {
      return { status: 404, data: { error: 'Secció no trobada' } };
    }

    db.seccions.splice(idx, 1);
    db.document.versio = (db.document.versio || 1) + 1;
    await writeDatabase(db);
    return { status: 200, data: { success: true, seccions: db.seccions } };
  }

  // 10. Admin: Inicialització de preguntes (reset amb confirmació "limpiar")
  if (pathname === '/api/admin/reset' && method === 'POST') {
    const db = await readDatabase();
    if (!verifyAdmin(req, db)) {
      return { status: 401, data: { error: 'No autoritzat' } };
    }

    const confirmation = (body.confirmation || '').toString().trim().toLowerCase();
    if (confirmation !== 'limpiar') {
      return {
        status: 400,
        data: { error: 'Confirmació invàlida. Cal escriure la paraula "limpiar" per confirmar la inicialització.' }
      };
    }

    const template = getDefaultTemplate();
    template.config.adminPin = db.config?.adminPin || template.config.adminPin;
    template.document = {
      respostes: {},
      comentaris: {},
      tancat: false,
      versio: ((db.document && db.document.versio) || 1) + 1,
      darreraModificacio: new Date().toISOString(),
      darrerEditor: 'Administrador (inicialització)'
    };

    await writeDatabase(template);

    return {
      status: 200,
      data: {
        success: true,
        message: 'Preguntes i document inicialitzats correctament',
        seccions: template.seccions,
        document: template.document
      }
    };
  }

  // 11. Admin: Exportar document en format Word (.doc)
  if (pathname === '/api/admin/export-doc' && method === 'GET') {
    const db = await readDatabase();
    if (!verifyAdmin(req, db)) {
      return { status: 401, data: { error: 'No autoritzat' } };
    }

    const html = generateWordDocumentHtml(db);
    return {
      status: 200,
      data: {
        success: true,
        html,
        filename: 'document-de-treball-acab.doc'
      }
    };
  }

  // 12. Admin: Canviar estat del document (tancar o reobrir)
  if (pathname === '/api/admin/document/estat' && method === 'POST') {
    const db = await readDatabase();
    if (!verifyAdmin(req, db)) {
      return { status: 401, data: { error: 'No autoritzat' } };
    }

    const tancat = body.tancat === true;
    if (!db.document) {
      db.document = { respostes: {}, comentaris: {}, tancat: false, versio: 1, darreraModificacio: null, darrerEditor: null };
    }

    db.document.tancat = tancat;
    db.document.versio = (db.document.versio || 1) + 1;
    db.document.darreraModificacio = new Date().toISOString();
    db.document.darrerEditor = tancat ? 'Administrador (document tancat)' : 'Administrador (document reobert)';

    await writeDatabase(db);

    return {
      status: 200,
      data: {
        success: true,
        tancat: db.document.tancat,
        versio: db.document.versio,
        message: tancat ? 'Document tancat correctament' : 'Document reobert correctament'
      }
    };
  }

  // 13. Admin: Afegir, editar o eliminar comentaris de l'administrador per pregunta
  if (pathname === '/api/admin/comentaris' && method === 'POST') {
    const db = await readDatabase();
    if (!verifyAdmin(req, db)) {
      return { status: 401, data: { error: 'No autoritzat' } };
    }

    const { preguntaId, comentari } = body;
    if (!preguntaId) {
      return { status: 400, data: { error: 'Cal especificar l\'identificador de la pregunta (preguntaId)' } };
    }

    if (!db.document) {
      db.document = { respostes: {}, comentaris: {}, tancat: false, versio: 1, darreraModificacio: null, darrerEditor: null };
    }
    if (!db.document.comentaris) {
      db.document.comentaris = {};
    }

    if (typeof comentari === 'string' && comentari.trim().length > 0) {
      db.document.comentaris[preguntaId] = comentari.trim();
    } else {
      delete db.document.comentaris[preguntaId];
    }

    db.document.versio = (db.document.versio || 1) + 1;
    db.document.darreraModificacio = new Date().toISOString();
    db.document.darrerEditor = 'Administrador (comentaris)';

    await writeDatabase(db);

    return {
      status: 200,
      data: {
        success: true,
        comentaris: db.document.comentaris,
        versio: db.document.versio
      }
    };
  }

  return null; // Ruta no trobada per a l'API
}

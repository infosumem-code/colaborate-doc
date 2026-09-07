import http from 'node:http';

const PORT = parseInt(process.env.PORT || '3456', 10);

function request(options, data = null) {
  options.port = options.port || PORT;
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- PROVES DEL DOCUMENT DE TREBALL COMPARTIT EN TEMPS REAL ---');

  // 1. GET /api/document
  console.log('1. Provant càrrega del document de treball (/api/document)...');
  const docRes = await request({ hostname: '127.0.0.1', port: PORT, path: '/api/document', method: 'GET' });
  if (docRes.status !== 200) throw new Error(`GET /api/document ha fallat amb status ${docRes.status}`);
  const totalP = docRes.body.seccions.reduce((acc, s) => acc + s.preguntes.length, 0);
  console.log(`✓ Document carregat: ${totalP} preguntes originals del Word. Versió inicial: ${docRes.body.document.versio}`);
  if (totalP !== 31) throw new Error(`S'esperaven 31 preguntes, trobades: ${totalP}`);

  // 2. Primer col·laborador (Joan) respon la pregunta P_A1
  console.log('2. Provant edició de la primera resposta per en Joan...');
  const edit1 = await request(
    {
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/document/respostes',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    {
      editor: 'Joan',
      respostes: {
        p_a1: 'Facilitar accés i canalitzar les consultes cap a atenció ràpida'
      }
    }
  );
  if (edit1.status !== 200 || !edit1.body.success) throw new Error('Desar resposta 1 ha fallat');
  const v1 = edit1.body.versio;
  console.log(`✓ Joan ha desat la seva aportació. Nova versió del document: ${v1}`);

  // 3. Segona col·laboradora (Laura) respon la pregunta P_A2 al mateix document compartit
  console.log('3. Provant que la Laura edita la pregunta 2 sobre el mateix document compartit...');
  const edit2 = await request(
    {
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/document/respostes',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    {
      editor: 'Laura',
      respostes: {
        p_a2: 'Que tingui un cercador molt més àgil i recursos clarament categoritzats'
      }
    }
  );
  if (edit2.status !== 200 || !edit2.body.success) throw new Error('Desar resposta 2 ha fallat');
  const v2 = edit2.body.versio;
  if (v2 <= v1) throw new Error('La versió del document hauria d\'incrementar-se');
  console.log(`✓ Laura ha desat la seva aportació. Nova versió del document: ${v2}`);

  // 4. Comprovar que el document compartit conté TOTES DUES respostes
  console.log('4. Verificant la coexistència col·laborativa de totes les respostes...');
  const checkDoc = await request({ hostname: '127.0.0.1', port: PORT, path: '/api/document', method: 'GET' });
  const docAnswers = checkDoc.body.document.respostes;
  if (!docAnswers.p_a1 || !docAnswers.p_a2) {
    throw new Error('El document de treball no conté totes dues aportacions col·laboratives!');
  }
  console.log('✓ Document de treball compartit verificat amb èxit! Conté aportacions de Joan i Laura.');

  // 5. Comprovar endpoint de versió ràpida (usat per polling d\'auto-sync en temps real)
  console.log('5. Provant endpoint ràpid de versió (/api/document/versio)...');
  const verRes = await request({ hostname: '127.0.0.1', port: PORT, path: '/api/document/versio', method: 'GET' });
  if (verRes.status !== 200 || verRes.body.versio !== v2 || verRes.body.darrerEditor !== 'Laura') {
    throw new Error('Comprovació de versió ràpida ha fallat');
  }
  console.log(`✓ Auto-sync en temps real respon correctament: versió ${verRes.body.versio}, darrer editor: ${verRes.body.darrerEditor}`);

  // 6. Admin login i consulta del document comú
  console.log('6. Provant accés d\'administració al document de treball...');
  const loginRes = await request(
    { hostname: '127.0.0.1', port: PORT, path: '/api/admin/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { pin: 'acab2026' }
  );
  if (loginRes.status !== 200) throw new Error('Login admin ha fallat');
  const token = loginRes.body.token;

  const adminData = await request({
    hostname: '127.0.0.1',
    port: PORT,
    path: '/api/admin/data',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (adminData.status !== 200 || !adminData.body.document.respostes.p_a1) {
    throw new Error('Admin no veu les respostes del document de treball');
  }
  console.log('✓ Administrador supervisa correctament tot el document de treball comú');

  // 7. Admin afegeix nova secció i pregunta
  console.log('7. Provant addició de nova secció des de l\'admin...');
  const newSec = await request(
    {
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/seccions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    },
    { titol: 'G. Secció col·laborativa de prova' }
  );
  const createdSec = newSec.body.seccions.find(s => s.titol === 'G. Secció col·laborativa de prova');
  if (!createdSec) throw new Error('Creació de secció ha fallat');
  console.log('✓ Nova secció creada:', createdSec.id);

  // Netejar la secció de prova
  await request({
    hostname: '127.0.0.1',
    port: PORT,
    path: `/api/admin/seccions/${createdSec.id}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('✓ Secció de prova eliminada');

  // 8. Provar exportació a document Word (.doc)
  console.log('8. Provant endpoint d\'exportació Word (.doc)...');
  const exportRes = await request({
    hostname: '127.0.0.1',
    port: PORT,
    path: '/api/admin/export-doc',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (exportRes.status !== 200 || !exportRes.body.html || !exportRes.body.html.includes('urn:schemas-microsoft-com:office:word')) {
    throw new Error('Exportació Word (.doc) ha fallat');
  }
  console.log('✓ Document Word (.doc) generat amb èxit');

  // 9. Provar inicialització de preguntes amb la paraula "limpiar"
  console.log('9. Provant inicialització de preguntes (seguretat "limpiar")...');
  
  // 9a. Sense token -> 401
  const resetNoAuth = await request(
    { hostname: '127.0.0.1', port: PORT, path: '/api/admin/reset', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { confirmation: 'limpiar' }
  );
  if (resetNoAuth.status !== 401) throw new Error('Hauria de requerir autorització admin');

  // 9b. Amb paraula incorrecta -> 400
  const resetWrongWord = await request(
    {
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/reset',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    },
    { confirmation: 'eliminar' }
  );
  if (resetWrongWord.status !== 400) throw new Error('Hauria de fallar si no s\'escriu exactament "limpiar"');

  // 9c. Amb "limpiar" -> 200 OK
  const resetOk = await request(
    {
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/reset',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    },
    { confirmation: 'limpiar' }
  );
  if (resetOk.status !== 200 || !resetOk.body.success) throw new Error('Reset amb "limpiar" ha fallat');
  
  // Comprovar que s'han restablert exactament les 31 preguntes i respostes buides
  const postResetDoc = await request({ hostname: '127.0.0.1', port: PORT, path: '/api/document', method: 'GET' });
  const countAfter = postResetDoc.body.seccions.reduce((acc, s) => acc + s.preguntes.length, 0);
  if (countAfter !== 31) throw new Error(`Esperades 31 preguntes després de reset, trobades: ${countAfter}`);
  if (Object.keys(postResetDoc.body.document.respostes).length !== 0) throw new Error('Les respostes haurien d\'estar buides');
  // 10. Provar tancament i reobertura del document
  console.log('10. Provant tancament i reobertura del document...');
  // Tancar document
  const lockRes = await request(
    {
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/document/estat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    },
    { tancat: true }
  );
  if (lockRes.status !== 200 || !lockRes.body.tancat) throw new Error('Tancar document ha fallat');

  // Intentar editar amb document tancat -> ha de retornar 403 Forbidden
  const tryEditClosed = await request(
    {
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/document/respostes',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    { editor: 'Intrús', respostes: { p_a1: 'Intent de canvi bloquejat' } }
  );
  if (tryEditClosed.status !== 403) throw new Error(`Esperat 403 Forbidden en desar quan el document està tancat, obtingut: ${tryEditClosed.status}`);
  console.log('✓ Bloqueig d\'edició verificat (403 Forbidden quan el document està tancat).');

  // Reobrir document
  const unlockRes = await request(
    {
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/document/estat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    },
    { tancat: false }
  );
  if (unlockRes.status !== 200 || unlockRes.body.tancat !== false) throw new Error('Reobrir document ha fallat');
  console.log('✓ Reobertura del document verificada correctament.');

  // 11. Provar comentaris de l'administrador
  console.log('11. Provant comentaris d\'administrador per pregunta...');
  const addCommentRes = await request(
    {
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/comentaris',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    },
    { preguntaId: 'p_a1', comentari: 'Nota important: prioritzar sempre l\'atenció directa.' }
  );
  if (addCommentRes.status !== 200 || !addCommentRes.body.comentaris.p_a1) throw new Error('Afegir comentari d\'admin ha fallat');

  // Comprovar que el document públic té el comentari
  const docWithComment = await request({ hostname: '127.0.0.1', port: PORT, path: '/api/document', method: 'GET' });
  if (docWithComment.body.document.comentaris?.p_a1 !== 'Nota important: prioritzar sempre l\'atenció directa.') {
    throw new Error('El document públic no conté el comentari d\'administrador');
  }
  console.log('✓ Comentari d\'administració registrat i visible en el document.');

  // Netejar el comentari de prova
  await request(
    {
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/admin/comentaris',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    },
    { preguntaId: 'p_a1', comentari: '' }
  );
  console.log('✓ Comentari de prova netejat.');

  console.log('--- TOTES LES PROVES HAN PASSAT AMB ÈXIT! ---');
}

runTests().catch(err => {
  console.error('ERROR EN LES PROVES:', err);
  process.exit(1);
});

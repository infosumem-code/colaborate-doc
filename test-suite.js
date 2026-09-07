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

  // Netejar respostes de prova del document
  await request(
    {
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/document/respostes',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    { editor: null, respostes: { p_a1: '', p_a2: '' } }
  );

  console.log('--- TOTES LES PROVES HAN PASSAT AMB ÈXIT! ---');
}

runTests().catch(err => {
  console.error('ERROR EN LES PROVES:', err);
  process.exit(1);
});

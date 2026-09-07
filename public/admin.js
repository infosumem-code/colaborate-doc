let adminToken = sessionStorage.getItem('acab_admin_token') || '';
let fullDb = null;

// DOM Elements
const loginModal = document.getElementById('admin-login-modal');
const loginForm = document.getElementById('admin-login-form');
const pinInput = document.getElementById('admin-pin-input');
const loginError = document.getElementById('login-error');
const btnLogout = document.getElementById('btn-logout');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = {
  document: document.getElementById('tab-document'),
  preguntes: document.getElementById('tab-preguntes'),
  enllacos: document.getElementById('tab-enllacos')
};

const statAnswered = document.getElementById('stat-answered');
const statTotal = document.getElementById('stat-total');
const statProgressBadge = document.getElementById('stat-progress-badge');
const statLastMod = document.getElementById('stat-last-mod');
const adminDocContent = document.getElementById('admin-doc-content');

const adminQuestionsList = document.getElementById('admin-questions-list');
const inputPublicUrl = document.getElementById('input-public-url');
const btnCopyPublicUrl = document.getElementById('btn-copy-public-url');

// Modals i formularis
const modalEditQ = document.getElementById('modal-edit-question');
const formEditQ = document.getElementById('form-edit-question');
const editQId = document.getElementById('edit-q-id');
const editQSeccio = document.getElementById('edit-q-seccio');
const editQTitol = document.getElementById('edit-q-titol');
const editQPista = document.getElementById('edit-q-pista');
const editQTipus = document.getElementById('edit-q-tipus');
const boxOptionsCheckbox = document.getElementById('box-options-checkbox');
const editQOpcions = document.getElementById('edit-q-opcions');
const editQPermetAltres = document.getElementById('edit-q-permet-altres');
const btnCancelEditQ = document.getElementById('btn-cancel-edit-q');
const btnAddQuestion = document.getElementById('btn-add-question');
const modalEditTitle = document.getElementById('modal-edit-title');

const btnAddSection = document.getElementById('btn-add-section');
const modalEditSection = document.getElementById('modal-edit-section');
const modalEditSectionTitle = document.getElementById('modal-edit-section-title');
const formEditSection = document.getElementById('form-edit-section');
const editSecId = document.getElementById('edit-sec-id');
const editSecTitol = document.getElementById('edit-sec-titol');
const btnCancelEditSec = document.getElementById('btn-cancel-edit-sec');

const toast = document.getElementById('toast');

// Inicialització
async function init() {
  if (adminToken) {
    loginModal.style.display = 'none';
    await loadAdminData();
  } else {
    loginModal.style.display = 'flex';
  }
}

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.style.display = 'none';
  const pin = pinInput.value.trim();

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });

    if (res.ok) {
      const data = await res.json();
      adminToken = data.token;
      sessionStorage.setItem('acab_admin_token', adminToken);
      loginModal.style.display = 'none';
      await loadAdminData();
    } else {
      loginError.style.display = 'block';
    }
  } catch (err) {
    console.error(err);
    loginError.textContent = 'Error de connexió';
    loginError.style.display = 'block';
  }
});

// Logout
btnLogout.addEventListener('click', () => {
  sessionStorage.removeItem('acab_admin_token');
  window.location.reload();
});

// Carregar dades de l'API
async function loadAdminData() {
  try {
    const res = await fetch('/api/admin/data', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    if (!res.ok) {
      sessionStorage.removeItem('acab_admin_token');
      adminToken = '';
      loginModal.style.display = 'flex';
      return;
    }

    fullDb = await res.json();
    renderAll();

  } catch (err) {
    console.error('Error carregant dades:', err);
    showToast('Error de connexió');
  }
}

function renderAll() {
  renderDocumentView();
  renderQuestionsManagement();
  renderLinksTab();
}

// 1. Vista de l'estat del Document de Treball
function renderDocumentView() {
  const doc = fullDb.document || { respostes: {}, versio: 1 };
  const answers = doc.respostes || {};
  let answeredCount = 0;
  let totalQuestions = 0;

  fullDb.seccions.forEach(s => {
    s.preguntes.forEach(p => {
      totalQuestions++;
      const val = answers[p.id];
      if (typeof val === 'string' && val.trim().length > 0) answeredCount++;
      else if (val && typeof val === 'object') {
        if (Array.isArray(val.seleccionats) && (val.seleccionats.length > 0 || (val.altresText && val.altresText.trim()))) answeredCount++;
        else if (Object.keys(val).length > 0) answeredCount++;
      }
    });
  });

  statAnswered.textContent = answeredCount;
  statTotal.textContent = totalQuestions;

  if (answeredCount === totalQuestions && totalQuestions > 0) {
    statProgressBadge.className = 'badge badge-success';
    statProgressBadge.textContent = 'Completat';
  } else {
    statProgressBadge.className = 'badge badge-gray';
    statProgressBadge.textContent = 'En curs';
  }

  if (doc.darreraModificacio) {
    const d = new Date(doc.darreraModificacio);
    const dateStr = d.toLocaleString('ca-ES');
    const editorStr = doc.darrerEditor ? ` (per ${escapeHtml(doc.darrerEditor)})` : '';
    statLastMod.textContent = `Darrera modificació: ${dateStr}${editorStr}`;
  } else {
    statLastMod.textContent = 'Sense canvis recents';
  }

  // Renderitzar el contingut del document
  adminDocContent.innerHTML = '';

  fullDb.seccions.forEach(seccio => {
    const secHeader = document.createElement('h3');
    secHeader.style.color = 'var(--color-primary)';
    secHeader.style.fontSize = '17.5px';
    secHeader.style.margin = '24px 0 12px';
    secHeader.textContent = seccio.titol;
    adminDocContent.appendChild(secHeader);

    seccio.preguntes.forEach(preg => {
      const item = document.createElement('div');
      item.className = 'doc-item-view';

      const qTitle = document.createElement('div');
      qTitle.className = 'doc-q-title';
      qTitle.textContent = `${preg.ordre}. ${preg.titol}`;
      item.appendChild(qTitle);

      if (preg.pista) {
        const qPista = document.createElement('div');
        qPista.className = 'doc-q-pista';
        qPista.textContent = preg.pista;
        item.appendChild(qPista);
      }

      const val = answers[preg.id];
      const answerContent = document.createElement('div');

      if (val === undefined || val === null || val === '') {
        answerContent.innerHTML = `<span class="doc-answer-empty">(Pendent de respondre)</span>`;
      } else if (preg.tipus === 'checkbox_list' && typeof val === 'object') {
        const seleccionats = val.seleccionats || [];
        if (seleccionats.length === 0 && !val.altresText) {
          answerContent.innerHTML = `<span class="doc-answer-empty">(Pendent de respondre)</span>`;
        } else {
          let html = '<ul style="padding-left: 20px; font-size: 14.5px;">';
          seleccionats.forEach(s => {
            if (s === 'Altres' && val.altresText) {
              html += `<li><strong>Altres:</strong> ${escapeHtml(val.altresText)}</li>`;
            } else {
              html += `<li>${escapeHtml(s)}</li>`;
            }
          });
          html += '</ul>';
          answerContent.innerHTML = html;
        }
      } else if (preg.tipus === 'channels_matrix' && typeof val === 'object') {
        let rows = '';
        let hasAny = false;
        Object.keys(val).forEach(canal => {
          const atencio = val[canal]['Atenció'] || '—';
          const prevencio = val[canal]['Prevenció'] || '—';
          if (atencio !== '—' || prevencio !== '—') hasAny = true;
          rows += `<tr>
            <td style="padding: 6px 10px; border-bottom: 1px solid var(--color-border);"><strong>${escapeHtml(canal)}</strong></td>
            <td style="padding: 6px 10px; border-bottom: 1px solid var(--color-border);">${escapeHtml(atencio)}</td>
            <td style="padding: 6px 10px; border-bottom: 1px solid var(--color-border);">${escapeHtml(prevencio)}</td>
          </tr>`;
        });

        if (!hasAny) {
          answerContent.innerHTML = `<span class="doc-answer-empty">(Pendent de respondre)</span>`;
        } else {
          answerContent.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 6px;">
              <thead>
                <tr style="background: var(--color-surface-alt); text-align: left;">
                  <th style="padding: 6px 10px;">Canal</th>
                  <th style="padding: 6px 10px;">Atenció</th>
                  <th style="padding: 6px 10px;">Prevenció</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          `;
        }
      } else {
        answerContent.className = 'doc-answer-box';
        answerContent.textContent = String(val);
      }

      item.appendChild(answerContent);
      adminDocContent.appendChild(item);
    });
  });
}

// 2. Gestió de preguntes i seccions
editQTipus.addEventListener('change', () => {
  boxOptionsCheckbox.style.display = editQTipus.value === 'checkbox_list' ? 'block' : 'none';
});

function renderQuestionsManagement() {
  adminQuestionsList.innerHTML = '';
  editQSeccio.innerHTML = '';

  fullDb.seccions.forEach(seccio => {
    const opt = document.createElement('option');
    opt.value = seccio.id;
    opt.textContent = seccio.titol;
    editQSeccio.appendChild(opt);

    const sDiv = document.createElement('div');
    sDiv.style.marginBottom = '28px';
    sDiv.style.background = 'var(--color-surface)';
    sDiv.style.border = '1px solid var(--color-border)';
    sDiv.style.borderRadius = 'var(--radius-md)';
    sDiv.style.padding = '18px';

    const sHeader = document.createElement('div');
    sHeader.style.display = 'flex';
    sHeader.style.justifyContent = 'space-between';
    sHeader.style.alignItems = 'center';
    sHeader.style.marginBottom = '14px';
    sHeader.style.paddingBottom = '10px';
    sHeader.style.borderBottom = '2px solid var(--color-primary)';
    sHeader.style.flexWrap = 'wrap';
    sHeader.style.gap = '10px';

    sHeader.innerHTML = `
      <h3 style="color: var(--color-primary); font-size: 17px; margin: 0;">${escapeHtml(seccio.titol)}</h3>
      <div style="display: flex; gap: 8px;">
        <button class="btn-secondary" style="padding: 4px 10px; font-size: 12.5px;" onclick="openEditSection('${seccio.id}')">Editar nom secció</button>
        <button class="btn-secondary" style="padding: 4px 10px; font-size: 12.5px; color: #dc2626;" onclick="deleteSection('${seccio.id}')">Eliminar secció</button>
      </div>
    `;
    sDiv.appendChild(sHeader);

    if (seccio.preguntes.length === 0) {
      const emptyNotice = document.createElement('p');
      emptyNotice.style.color = 'var(--color-text-light)';
      emptyNotice.style.fontSize = '13.5px';
      emptyNotice.style.fontStyle = 'italic';
      emptyNotice.textContent = 'Aquesta secció no té cap pregunta encara.';
      sDiv.appendChild(emptyNotice);
    } else {
      seccio.preguntes.forEach(preg => {
        const qItem = document.createElement('div');
        qItem.className = 'admin-question-item';

        let tipusLabel = preg.tipus || 'textarea';
        if (tipusLabel === 'textarea') tipusLabel = 'Text lliure';
        else if (tipusLabel === 'checkbox_list') tipusLabel = `Llista seleccionable (${(preg.opcions || []).length} opcions)`;
        else if (tipusLabel === 'channels_matrix') tipusLabel = 'Matriu Canals';

        qItem.innerHTML = `
          <div class="admin-question-info">
            <div style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">${preg.ordre}. ${escapeHtml(preg.titol)}</div>
            ${preg.pista ? `<div style="font-size: 13px; color: var(--color-text-muted); font-style: italic; margin-bottom: 4px;">${escapeHtml(preg.pista)}</div>` : ''}
            <span class="badge badge-gray" style="font-size: 11px;">Tipus: ${tipusLabel}</span>
          </div>
          <div class="admin-question-actions">
            <button class="btn-secondary" style="padding: 6px 12px; font-size: 13px;" onclick="openEditQuestion('${seccio.id}', '${preg.id}')">Editar</button>
            <button class="btn-secondary" style="padding: 6px 12px; font-size: 13px; color: #dc2626;" onclick="deleteQuestion('${preg.id}')">Eliminar</button>
          </div>
        `;
        sDiv.appendChild(qItem);
      });
    }

    adminQuestionsList.appendChild(sDiv);
  });
}

// Editar pregunta
window.openEditQuestion = function(seccioId, pregId) {
  const seccio = fullDb.seccions.find(s => s.id === seccioId);
  const preg = seccio ? seccio.preguntes.find(p => p.id === pregId) : null;
  if (!preg) return;

  modalEditTitle.textContent = 'Editar pregunta';
  editQId.value = preg.id;
  editQSeccio.value = seccioId;
  editQTitol.value = preg.titol;
  editQPista.value = preg.pista || '';
  editQTipus.value = preg.tipus || 'textarea';

  if (preg.tipus === 'checkbox_list') {
    boxOptionsCheckbox.style.display = 'block';
    editQOpcions.value = (preg.opcions || []).join('\n');
    editQPermetAltres.checked = !!preg.permetAltres;
  } else {
    boxOptionsCheckbox.style.display = 'none';
    editQOpcions.value = '';
    editQPermetAltres.checked = false;
  }

  modalEditQ.style.display = 'flex';
};

btnAddQuestion.addEventListener('click', () => {
  if (!fullDb.seccions || fullDb.seccions.length === 0) {
    showToast('Crea primer una secció abans d\'afegir preguntes.');
    return;
  }
  modalEditTitle.textContent = 'Nova pregunta';
  editQId.value = '';
  editQTitol.value = '';
  editQPista.value = '';
  editQTipus.value = 'textarea';
  boxOptionsCheckbox.style.display = 'none';
  editQOpcions.value = '';
  editQPermetAltres.checked = false;
  modalEditQ.style.display = 'flex';
});

btnCancelEditQ.addEventListener('click', () => {
  modalEditQ.style.display = 'none';
});

formEditQ.addEventListener('submit', async (e) => {
  e.preventDefault();

  const seccioId = editQSeccio.value;
  const pregId = editQId.value;
  const titol = editQTitol.value.trim();
  const pista = editQPista.value.trim();
  const tipus = editQTipus.value;

  const preguntaPayload = {
    id: pregId || undefined,
    titol,
    pista,
    tipus
  };

  if (tipus === 'checkbox_list') {
    const opcionsArray = editQOpcions.value
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    preguntaPayload.opcions = opcionsArray;
    preguntaPayload.permetAltres = editQPermetAltres.checked;
  }

  try {
    const res = await fetch('/api/admin/preguntes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        seccioId,
        pregunta: preguntaPayload
      })
    });

    if (res.ok) {
      modalEditQ.style.display = 'none';
      showToast('Pregunta desada correctament');
      await loadAdminData();
    } else {
      showToast('Error en desar la pregunta');
    }
  } catch (err) {
    console.error(err);
    showToast('Error de connexió');
  }
});

window.deleteQuestion = async function(pregId) {
  if (!confirm('Estàs segur que vols eliminar aquesta pregunta?')) return;

  try {
    const res = await fetch(`/api/admin/preguntes/${pregId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    if (res.ok) {
      showToast('Pregunta eliminada');
      await loadAdminData();
    } else {
      showToast('Error eliminant la pregunta');
    }
  } catch (err) {
    console.error(err);
    showToast('Error de connexió');
  }
};

// Seccions
btnAddSection.addEventListener('click', () => {
  modalEditSectionTitle.textContent = 'Nova secció';
  editSecId.value = '';
  editSecTitol.value = '';
  modalEditSection.style.display = 'flex';
});

window.openEditSection = function(secId) {
  const sec = fullDb.seccions.find(s => s.id === secId);
  if (!sec) return;
  modalEditSectionTitle.textContent = 'Editar secció';
  editSecId.value = sec.id;
  editSecTitol.value = sec.titol;
  modalEditSection.style.display = 'flex';
};

btnCancelEditSec.addEventListener('click', () => {
  modalEditSection.style.display = 'none';
});

formEditSection.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = editSecId.value;
  const titol = editSecTitol.value.trim();

  try {
    const res = await fetch('/api/admin/seccions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ id: id || undefined, titol })
    });

    if (res.ok) {
      modalEditSection.style.display = 'none';
      showToast('Secció desada correctament');
      await loadAdminData();
    } else {
      showToast('Error en desar la secció');
    }
  } catch (err) {
    console.error(err);
    showToast('Error de connexió');
  }
});

window.deleteSection = async function(secId) {
  const sec = fullDb.seccions.find(s => s.id === secId);
  if (!sec) return;

  if (sec.preguntes.length > 0) {
    if (!confirm(`Aquesta secció conté ${sec.preguntes.length} preguntes. Si l'elimines, també s'eliminaran aquestes preguntes. Vols continuar?`)) {
      return;
    }
  } else {
    if (!confirm(`Vols eliminar la secció "${sec.titol}"?`)) {
      return;
    }
  }

  try {
    const res = await fetch(`/api/admin/seccions/${secId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    if (res.ok) {
      showToast('Secció eliminada');
      await loadAdminData();
    } else {
      showToast('Error eliminant la secció');
    }
  } catch (err) {
    console.error(err);
    showToast('Error de connexió');
  }
};

// 3. Enllaç per compartir
function renderLinksTab() {
  const baseUrl = window.location.origin;
  inputPublicUrl.value = `${baseUrl}/`;
}

btnCopyPublicUrl.addEventListener('click', () => {
  copyToClipboard(inputPublicUrl.value);
});

window.copyToClipboard = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Enllaç copiat al porta-retalls!');
  }).catch(() => {
    prompt('Copia aquest enllaç:', text);
  });
};

function switchTab(tabKey) {
  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabKey);
  });
  Object.keys(tabContents).forEach(k => {
    tabContents[k].style.display = k === tabKey ? 'block' : 'none';
  });
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab);
  });
});

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

window.addEventListener('DOMContentLoaded', init);

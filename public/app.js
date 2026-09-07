// Gestió del Document de Treball Compartit ACAB
let currentVersion = 0;
let documentData = null;
let localAnswers = {};
let hasPendingChanges = false;
let autoSaveTimer = null;
let pollTimer = null;

// DOM Elements
const appTitle = document.getElementById('app-title');
const appDescription = document.getElementById('app-description');
const sectionsContainer = document.getElementById('sections-container');
const editorNameInput = document.getElementById('editor-name');
const syncIndicator = document.getElementById('sync-indicator');
const syncText = document.getElementById('sync-text');
const lastUpdateText = document.getElementById('last-update-text');
const btnSave = document.getElementById('btn-save');
const saveStatusText = document.getElementById('save-status-text');
const statusDot = document.getElementById('status-dot');
const toast = document.getElementById('toast');
const closedDocumentBanner = document.getElementById('closed-document-banner');

function updateDocumentStatusDisplay(isClosed) {
  if (closedDocumentBanner) {
    closedDocumentBanner.style.display = isClosed ? 'flex' : 'none';
  }
  if (isClosed) {
    setSyncStatus('offline', '🔒 Document tancat (només lectura)');
    if (btnSave) {
      btnSave.disabled = true;
      btnSave.style.opacity = '0.6';
      btnSave.title = 'Document tancat per l\'administració';
    }
    if (saveStatusText) {
      saveStatusText.textContent = 'Document tancat per l\'administració';
    }
  } else {
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.style.opacity = '1';
      btnSave.title = '';
    }
  }
  setInputsDisabled(isClosed);
}

function setInputsDisabled(disabled) {
  const form = document.getElementById('quiz-form');
  if (!form) return;
  const elements = form.querySelectorAll('input, textarea');
  elements.forEach(el => {
    el.disabled = disabled;
    if (el.tagName === 'TEXTAREA' || el.type === 'text') {
      el.readOnly = disabled;
    }
  });
}

function createAdminCommentElement(comentari) {
  const commentDiv = document.createElement('div');
  commentDiv.className = 'admin-comment-card';
  commentDiv.innerHTML = `
    <div class="admin-comment-header">
      <span class="admin-comment-tag">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        Comentari de l'administració
      </span>
    </div>
    <div class="admin-comment-body">${escapeHtml(comentari)}</div>
  `;
  return commentDiv;
}

function updateAdminComment(card, comentari) {
  let commentEl = card.querySelector('.admin-comment-card');
  if (!comentari) {
    if (commentEl) commentEl.remove();
  } else {
    if (!commentEl) {
      card.appendChild(createAdminCommentElement(comentari));
    } else {
      const body = commentEl.querySelector('.admin-comment-body');
      if (body) body.textContent = comentari;
    }
  }
}

// Recuperar nom d'editor guardat a la sessió
if (editorNameInput) {
  const savedName = localStorage.getItem('acab_editor_name');
  if (savedName) editorNameInput.value = savedName;
  editorNameInput.addEventListener('input', () => {
    localStorage.setItem('acab_editor_name', editorNameInput.value.trim());
  });
}

// Inicialització
async function init() {
  try {
    setSyncStatus('saving', 'Carregant document de treball...');

    const res = await fetch('/api/document');
    if (!res.ok) throw new Error('Error carregant el document de treball');
    documentData = await res.json();

    currentVersion = documentData.document.versio || 1;
    localAnswers = documentData.document.respostes || {};

    // Textos generals
    document.title = documentData.config.titol || 'Document de treball ACAB';
    appTitle.textContent = documentData.config.titol;
    appDescription.textContent = documentData.config.descripcio;

    updateMetaDisplay(documentData.document.darreraModificacio, documentData.document.darrerEditor);
    renderDocument(documentData.seccions);
    updateDocumentStatusDisplay(documentData.document && documentData.document.tancat);

    setSyncStatus('saved', 'Sincronitzat en temps real');

    // Iniciar sondeig periòdic d'actualitzacions en segon pla (cada 3 segons)
    startPolling();

  } catch (err) {
    console.error(err);
    sectionsContainer.innerHTML = `<p style="color: #c9211e; text-align: center; padding: 40px;">No s'ha pogut carregar el document de treball. Si us plau, recarrega la pàgina.</p>`;
    setSyncStatus('offline', 'Error de connexió');
  }
}

// Sondeig automàtic en temps real
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    // Si l'usuari té canvis escrits pendents d'enviar, no sobreescrivim
    if (hasPendingChanges) return;

    try {
      const res = await fetch('/api/document/versio');
      if (!res.ok) return;
      const verData = await res.json();

      if (verData.versio > currentVersion) {
        // Hi ha canvis nous fets per un altre col·laborador o l'admin!
        await fetchAndApplyRemoteChanges(verData.versio);
      }
    } catch (err) {
      // Silenciós en cas de micro-tall de xarxa
    }
  }, 3000);
}

// Descarregar i aplicar canvis remots sense interrompre l'escriptura
async function fetchAndApplyRemoteChanges(newVersion) {
  try {
    const res = await fetch('/api/document');
    if (!res.ok) return;
    const freshData = await res.json();

    currentVersion = newVersion;
    documentData = freshData;
    const remoteAnswers = freshData.document.respostes || {};

    // Actualitzar respostes locals conservant referències
    localAnswers = { ...remoteAnswers };
    updateFieldsWithoutActiveElement(remoteAnswers);
    updateMetaDisplay(freshData.document.darreraModificacio, freshData.document.darrerEditor);
    updateDocumentStatusDisplay(freshData.document && freshData.document.tancat);

  } catch (err) {
    console.warn('Error sincronitzant canvis remots:', err);
  }
}

// Actualitzar els camps del DOM sense tocar l'element que té el focus actualment
function updateFieldsWithoutActiveElement(remoteAnswers) {
  const activeEl = document.activeElement;

  documentData.seccions.forEach(seccio => {
    seccio.preguntes.forEach(preg => {
      const card = document.getElementById(`card_${preg.id}`);
      if (!card) return;

      const remoteVal = remoteAnswers[preg.id];

      // 1. Textarea
      if (!preg.tipus || preg.tipus === 'textarea') {
        const textarea = card.querySelector('textarea');
        if (textarea && textarea !== activeEl) {
          const newVal = remoteVal || '';
          if (textarea.value !== newVal) {
            textarea.value = newVal;
          }
        }
      }

      // 2. Checkboxes
      else if (preg.tipus === 'checkbox_list') {
        const selObj = remoteVal || { seleccionats: [], altresText: '' };
        const selArray = Array.isArray(selObj.seleccionats) ? selObj.seleccionats : [];

        const chks = card.querySelectorAll('input[type="checkbox"]');
        chks.forEach(chk => {
          if (chk !== activeEl) {
            if (chk.value === 'Altres') {
              chk.checked = selArray.includes('Altres');
            } else {
              chk.checked = selArray.includes(chk.value);
            }
          }
        });

        const txtOther = card.querySelector('.other-input');
        if (txtOther && txtOther !== activeEl) {
          txtOther.value = selObj.altresText || '';
        }
      }

      // 3. Matriu
      else if (preg.tipus === 'channels_matrix') {
        const matrixObj = remoteVal || {};
        const inputs = card.querySelectorAll('.matrix-input');
        inputs.forEach(inp => {
          if (inp !== activeEl) {
            const rowKey = inp.dataset.row;
            const colKey = inp.dataset.col;
            const val = (matrixObj[rowKey] && matrixObj[rowKey][colKey]) || '';
            if (inp.value !== val) {
              inp.value = val;
            }
          }
        });
      }

      // 4. Comentari de l'administrador
      const comentaris = (documentData && documentData.document && documentData.document.comentaris) || {};
      updateAdminComment(card, comentaris[preg.id]);
    });
  });
}

// Renderitzar tot el document de treball
function renderDocument(seccions) {
  sectionsContainer.innerHTML = '';

  seccions.forEach(seccio => {
    const secDiv = document.createElement('section');
    secDiv.className = 'section-block';

    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `<h2 class="section-title">${escapeHtml(seccio.titol)}</h2>`;
    secDiv.appendChild(header);

    seccio.preguntes.forEach(preg => {
      const card = renderQuestionCard(preg);
      secDiv.appendChild(card);
    });

    sectionsContainer.appendChild(secDiv);
  });
}

// Renderitzar una pregunta individual
function renderQuestionCard(preg) {
  const card = document.createElement('div');
  card.className = 'question-card';
  card.id = `card_${preg.id}`;

  const title = document.createElement('h3');
  title.className = 'question-title';
  title.textContent = `${preg.ordre}. ${preg.titol}`;
  card.appendChild(title);

  if (preg.pista) {
    const pista = document.createElement('p');
    pista.className = 'question-pista';
    pista.textContent = preg.pista;
    card.appendChild(pista);
  }

  // 1. Textarea
  if (!preg.tipus || preg.tipus === 'textarea') {
    const textarea = document.createElement('textarea');
    textarea.className = 'form-control-text';
    textarea.placeholder = 'Escriu la resposta del document de treball aquí...';
    textarea.value = localAnswers[preg.id] || '';

    textarea.addEventListener('input', () => {
      localAnswers[preg.id] = textarea.value;
      markChanged();
    });

    textarea.addEventListener('blur', () => {
      if (hasPendingChanges) saveChangesNow();
    });

    card.appendChild(textarea);
  }

  // 2. Checkboxes
  else if (preg.tipus === 'checkbox_list') {
    const listContainer = document.createElement('div');
    listContainer.className = 'checkbox-list';

    const currentVal = localAnswers[preg.id] || { seleccionats: [], altresText: '' };
    const selArray = Array.isArray(currentVal.seleccionats) ? currentVal.seleccionats : [];

    (preg.opcions || []).forEach(opcio => {
      const label = document.createElement('label');
      label.className = 'checkbox-item';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.value = opcio;
      chk.checked = selArray.includes(opcio);

      chk.addEventListener('change', () => {
        if (!localAnswers[preg.id]) localAnswers[preg.id] = { seleccionats: [], altresText: '' };
        let arr = localAnswers[preg.id].seleccionats || [];
        if (chk.checked) {
          if (!arr.includes(opcio)) arr.push(opcio);
        } else {
          arr = arr.filter(x => x !== opcio);
        }
        localAnswers[preg.id].seleccionats = arr;
        markChanged();
      });

      label.appendChild(chk);
      const span = document.createElement('span');
      span.textContent = opcio;
      label.appendChild(span);
      listContainer.appendChild(label);
    });

    if (preg.permetAltres) {
      const altresBox = document.createElement('div');
      altresBox.style.marginTop = '6px';

      const label = document.createElement('label');
      label.className = 'checkbox-item';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.value = 'Altres';
      chk.checked = selArray.includes('Altres');

      const txt = document.createElement('input');
      txt.type = 'text';
      txt.className = 'other-input';
      txt.placeholder = 'Indica altres aspectes aquí...';
      txt.value = currentVal.altresText || '';

      chk.addEventListener('change', () => {
        if (!localAnswers[preg.id]) localAnswers[preg.id] = { seleccionats: [], altresText: '' };
        let arr = localAnswers[preg.id].seleccionats || [];
        if (chk.checked) {
          if (!arr.includes('Altres')) arr.push('Altres');
          txt.focus();
        } else {
          arr = arr.filter(x => x !== 'Altres');
        }
        localAnswers[preg.id].seleccionats = arr;
        markChanged();
      });

      txt.addEventListener('input', () => {
        if (!localAnswers[preg.id]) localAnswers[preg.id] = { seleccionats: [], altresText: '' };
        localAnswers[preg.id].altresText = txt.value;
        if (txt.value.trim().length > 0 && !chk.checked) {
          chk.checked = true;
          let arr = localAnswers[preg.id].seleccionats || [];
          if (!arr.includes('Altres')) arr.push('Altres');
          localAnswers[preg.id].seleccionats = arr;
        }
        markChanged();
      });

      txt.addEventListener('blur', () => {
        if (hasPendingChanges) saveChangesNow();
      });

      label.appendChild(chk);
      const span = document.createElement('span');
      span.textContent = 'Altres:';
      label.appendChild(span);

      altresBox.appendChild(label);
      altresBox.appendChild(txt);
      listContainer.appendChild(altresBox);
    }

    card.appendChild(listContainer);
  }

  // 3. Matriu
  else if (preg.tipus === 'channels_matrix') {
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-wrapper';

    const currentMatrix = localAnswers[preg.id] || {};

    const table = document.createElement('table');
    table.className = 'matrix-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th style="width: 40%;">Canals</th>
        <th style="width: 30%;">Atenció</th>
        <th style="width: 30%;">Prevenció</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    (preg.files || []).forEach(fila => {
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      tdName.innerHTML = `<strong>${escapeHtml(fila)}</strong>`;
      tr.appendChild(tdName);

      // Atenció
      const tdAtencio = document.createElement('td');
      const inputAtencio = document.createElement('input');
      inputAtencio.type = 'text';
      inputAtencio.className = 'matrix-input';
      inputAtencio.dataset.row = fila;
      inputAtencio.dataset.col = 'Atenció';
      inputAtencio.placeholder = 'Ordre/Prioritat';
      inputAtencio.value = (currentMatrix[fila] && currentMatrix[fila]['Atenció']) || '';

      inputAtencio.addEventListener('input', () => {
        if (!localAnswers[preg.id]) localAnswers[preg.id] = {};
        if (!localAnswers[preg.id][fila]) localAnswers[preg.id][fila] = {};
        localAnswers[preg.id][fila]['Atenció'] = inputAtencio.value;
        markChanged();
      });
      inputAtencio.addEventListener('blur', () => {
        if (hasPendingChanges) saveChangesNow();
      });
      tdAtencio.appendChild(inputAtencio);
      tr.appendChild(tdAtencio);

      // Prevenció
      const tdPrevencio = document.createElement('td');
      const inputPrevencio = document.createElement('input');
      inputPrevencio.type = 'text';
      inputPrevencio.className = 'matrix-input';
      inputPrevencio.dataset.row = fila;
      inputPrevencio.dataset.col = 'Prevenció';
      inputPrevencio.placeholder = 'Ordre/Prioritat';
      inputPrevencio.value = (currentMatrix[fila] && currentMatrix[fila]['Prevenció']) || '';

      inputPrevencio.addEventListener('input', () => {
        if (!localAnswers[preg.id]) localAnswers[preg.id] = {};
        if (!localAnswers[preg.id][fila]) localAnswers[preg.id][fila] = {};
        localAnswers[preg.id][fila]['Prevenció'] = inputPrevencio.value;
        markChanged();
      });
      inputPrevencio.addEventListener('blur', () => {
        if (hasPendingChanges) saveChangesNow();
      });
      tdPrevencio.appendChild(inputPrevencio);
      tr.appendChild(tdPrevencio);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    card.appendChild(tableWrapper);
  }

  // Comentari de l'administrador
  const comentaris = (documentData && documentData.document && documentData.document.comentaris) || {};
  if (comentaris[preg.id]) {
    card.appendChild(createAdminCommentElement(comentaris[preg.id]));
  }

  return card;
}

// Marcar que hi ha canvis i disparar auto-desat ràpid (debounced 1 segon)
function markChanged() {
  if (documentData && documentData.document && documentData.document.tancat) return;
  hasPendingChanges = true;
  setSyncStatus('saving', 'Desant canvis...');

  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveChangesNow();
  }, 1000);
}

// Enviar canvis al servidor immediatament
async function saveChangesNow() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  if (documentData && documentData.document && documentData.document.tancat) {
    hasPendingChanges = false;
    return;
  }
  const editor = editorNameInput ? editorNameInput.value.trim() : '';

  try {
    const res = await fetch('/api/document/respostes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        respostes: localAnswers,
        editor
      })
    });

    if (!res.ok) throw new Error('Error desant els canvis');
    const data = await res.json();

    currentVersion = data.versio;
    hasPendingChanges = false;
    updateMetaDisplay(data.darreraModificacio, data.darrerEditor);
    setSyncStatus('saved', 'Sincronitzat en temps real');

  } catch (err) {
    console.error('Error desant canvis al servidor:', err);
    setSyncStatus('saving', 'Desant pendent... Comprova la connexió');
  }
}

// Actualitzar estat visual de sincronització
function setSyncStatus(state, msg) {
  if (state === 'saved') {
    syncIndicator.className = 'sync-badge';
    syncText.textContent = msg || 'Sincronitzat en temps real';
    statusDot.className = 'status-dot saved';
    saveStatusText.textContent = 'Document de treball actualitzat';
  } else if (state === 'saving') {
    syncIndicator.className = 'sync-badge saving';
    syncText.textContent = msg || 'Desant canvis...';
    statusDot.className = 'status-dot unsaved';
    saveStatusText.textContent = msg || 'Desant canvis...';
  } else {
    syncIndicator.className = 'sync-badge offline';
    syncText.textContent = msg || 'Desconnectat';
    statusDot.className = 'status-dot';
    saveStatusText.textContent = msg;
  }
}

function updateMetaDisplay(timestamp, editor) {
  if (!lastUpdateText) return;
  if (!timestamp) {
    lastUpdateText.textContent = 'Sense canvis recents';
    return;
  }
  const d = new Date(timestamp);
  const timeStr = d.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const editorStr = editor ? ` per ${escapeHtml(editor)}` : '';
  lastUpdateText.textContent = `Darrer canvi: ${timeStr}${editorStr}`;
}

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

// Botó manual de desar (dóna tranquil·litat a l'usuari)
btnSave.addEventListener('click', () => {
  saveChangesNow();
  showToast('Canvis desats correctament al document comú');
});

window.addEventListener('DOMContentLoaded', init);

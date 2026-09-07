function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateWordDocumentHtml(db) {
  const titol = db.config?.titol || 'Document de treball: Preguntes remodelació web ACAB';
  const descripcio = db.config?.descripcio || '';
  const doc = db.document || { respostes: {} };
  const answers = doc.respostes || {};
  const darreraMod = doc.darreraModificacio ? new Date(doc.darreraModificacio).toLocaleString('ca-ES') : 'Cap';
  const editor = doc.darrerEditor || '—';

  let sectionsHtml = '';

  (db.seccions || []).forEach(seccio => {
    sectionsHtml += `
      <h2 style="font-size: 13.5pt; color: #c9211e; font-weight: bold; margin-top: 18pt; margin-bottom: 6pt; border-bottom: 1.5pt solid #c9211e; padding-bottom: 3pt;">
        ${escapeHtml(seccio.titol)}
      </h2>
    `;

    (seccio.preguntes || []).forEach(preg => {
      const val = answers[preg.id];
      let respostaHtml = '';

      if (val === undefined || val === null || val === '') {
        respostaHtml = `<div style="color: #94a3b8; font-style: italic; font-size: 10pt; padding: 4pt 0;">(Pendent de respondre)</div>`;
      } else if (preg.tipus === 'checkbox_list' && typeof val === 'object') {
        const sel = val.seleccionats || [];
        if (sel.length === 0 && !val.altresText) {
          respostaHtml = `<div style="color: #94a3b8; font-style: italic; font-size: 10pt; padding: 4pt 0;">(Pendent de respondre)</div>`;
        } else {
          respostaHtml = '<ul style="margin: 4pt 0 4pt 18pt; font-size: 10.5pt;">';
          sel.forEach(item => {
            if (item === 'Altres' && val.altresText) {
              respostaHtml += `<li><strong>Altres:</strong> ${escapeHtml(val.altresText)}</li>`;
            } else {
              respostaHtml += `<li>${escapeHtml(item)}</li>`;
            }
          });
          respostaHtml += '</ul>';
        }
      } else if (preg.tipus === 'channels_matrix' && typeof val === 'object') {
        let rows = '';
        let hasAny = false;
        Object.keys(val).forEach(canal => {
          const atencio = val[canal]?.['Atenció'] || '—';
          const prevencio = val[canal]?.['Prevenció'] || '—';
          if (atencio !== '—' || prevencio !== '—') hasAny = true;
          rows += `<tr>
            <td style="border: 1pt solid #cbd5e1; padding: 4pt 6pt; font-weight: bold;">${escapeHtml(canal)}</td>
            <td style="border: 1pt solid #cbd5e1; padding: 4pt 6pt;">${escapeHtml(atencio)}</td>
            <td style="border: 1pt solid #cbd5e1; padding: 4pt 6pt;">${escapeHtml(prevencio)}</td>
          </tr>`;
        });
        if (!hasAny) {
          respostaHtml = `<div style="color: #94a3b8; font-style: italic; font-size: 10pt; padding: 4pt 0;">(Pendent de respondre)</div>`;
        } else {
          respostaHtml = `
            <table style="border-collapse: collapse; width: 100%; margin-top: 4pt; margin-bottom: 6pt; font-size: 9.5pt;">
              <thead>
                <tr style="background-color: #f1f5f9; text-align: left;">
                  <th style="border: 1pt solid #cbd5e1; padding: 4pt 6pt;">Canal</th>
                  <th style="border: 1pt solid #cbd5e1; padding: 4pt 6pt;">Atenció</th>
                  <th style="border: 1pt solid #cbd5e1; padding: 4pt 6pt;">Prevenció</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          `;
        }
      } else {
        const textFormatted = escapeHtml(String(val)).replace(/\n/g, '<br>');
        respostaHtml = `
          <div style="background-color: #f8fafc; border-left: 3pt solid #c9211e; padding: 6pt 8pt; font-size: 10.5pt; margin-top: 4pt;">
            ${textFormatted}
          </div>
        `;
      }

      sectionsHtml += `
        <div style="margin-bottom: 14pt; page-break-inside: avoid;">
          <div style="font-weight: bold; font-size: 11pt; color: #0f172a; margin-bottom: 2pt;">
            ${preg.ordre}. ${escapeHtml(preg.titol)}
          </div>
          ${preg.pista ? `<div style="font-size: 9pt; color: #64748b; font-style: italic; margin-bottom: 3pt;">${escapeHtml(preg.pista)}</div>` : ''}
          ${respostaHtml}
        </div>
      `;
    });
  });

  return `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(titol)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.4; color: #1e293b; margin: 2cm; }
    p { margin-top: 0; margin-bottom: 6pt; }
  </style>
</head>
<body>
  <div style="text-align: center; margin-bottom: 16pt; border-bottom: 2pt solid #c9211e; padding-bottom: 10pt;">
    <h1 style="font-size: 18pt; color: #c9211e; font-weight: bold; margin-bottom: 4pt;">
      ${escapeHtml(titol)}
    </h1>
    <p style="font-size: 10pt; color: #64748b;">
      Document de treball col·laboratiu · ACAB & SUMEM
    </p>
    <p style="font-size: 9pt; color: #64748b; margin-top: 3pt;">
      Darrera modificació: ${darreraMod} ${editor !== '—' ? `· Últim editor: ${escapeHtml(editor)}` : ''}
    </p>
  </div>

  <div style="background-color: #f8fafc; border: 1pt solid #e2e8f0; padding: 8pt 12pt; margin-bottom: 16pt; font-size: 10pt; color: #334155;">
    ${escapeHtml(descripcio).replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>')}
  </div>

  ${sectionsHtml}
</body>
</html>
  `.trim();
}


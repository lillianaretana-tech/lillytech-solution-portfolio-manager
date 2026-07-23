// =====================================================================
// LillyTech Solution Portfolio Manager — Reporte individual
// =====================================================================

import { requireSession, getCurrentProfile } from './auth.js';
import { logActivity } from './activity-log.js';
import { loadSolutionReportData, buildJsonObject, buildMarkdown, renderSolutionReportHtml, downloadTextFile, slugFilename } from './report-builder.js';

let reportData = null;

async function init() {
  const session = await requireSession();
  if (!session) return;

  const profile = await getCurrentProfile();
  if (!profile) return;

  document.getElementById('user-email').textContent = profile.email;
  document.getElementById('user-role').textContent = profile.role;

  const params = new URLSearchParams(window.location.search);
  const solutionId = params.get('id');

  if (!solutionId) {
    showError('No se indicó qué solución mostrar. Vuelve al panel e intenta de nuevo.');
    return;
  }

  try {
    reportData = await loadSolutionReportData(solutionId);
  } catch (err) {
    console.error(err);
    showError('No se pudo cargar la información de esta solución.');
    return;
  }

  document.getElementById('page-title').textContent = `${reportData.solution.name} — Reporte`;
  document.getElementById('report-content').innerHTML = renderSolutionReportHtml(reportData);
  document.getElementById('report-body').classList.remove('hidden');

  document.getElementById('btn-print').addEventListener('click', handlePrint);
  document.getElementById('btn-export-json').addEventListener('click', handleExportJson);
  document.getElementById('btn-export-md').addEventListener('click', handleExportMarkdown);
}

function showError(message) {
  const box = document.getElementById('load-error');
  box.textContent = message;
  box.classList.remove('hidden');
}

async function handlePrint() {
  await logActivity({
    solutionId: reportData.solution.id,
    entityType: 'solution',
    entityId: reportData.solution.id,
    actionType: 'report_generated',
    description: `Reporte individual generado (impresión/PDF): ${reportData.solution.name}`,
  });
  window.print();
}

async function handleExportJson() {
  const json = buildJsonObject(reportData);
  downloadTextFile(`${slugFilename(reportData.solution.name)}.json`, JSON.stringify(json, null, 2), 'application/json');
  await logActivity({
    solutionId: reportData.solution.id,
    entityType: 'solution',
    entityId: reportData.solution.id,
    actionType: 'exported',
    description: `Exportación JSON: ${reportData.solution.name}`,
  });
}

async function handleExportMarkdown() {
  const md = buildMarkdown(reportData);
  downloadTextFile(`${slugFilename(reportData.solution.name)}.md`, md, 'text/markdown');
  await logActivity({
    solutionId: reportData.solution.id,
    entityType: 'solution',
    entityId: reportData.solution.id,
    actionType: 'exported',
    description: `Exportación Markdown: ${reportData.solution.name}`,
  });
}

init();

// =====================================================================
// LillyTech Solution Portfolio Manager — Reporte consolidado
// =====================================================================

import { supabase } from './supabase-client.js';
import { requireSession, getCurrentProfile } from './auth.js';
import { logActivity } from './activity-log.js';
import { escapeHtml, formatDateTime } from './constants.js';
import { loadSolutionReportData, buildJsonObject, renderSolutionReportHtml, downloadTextFile } from './report-builder.js';

let solutions = [];
let selectedIds = new Set();
let consolidatedReports = [];

async function init() {
  const session = await requireSession();
  if (!session) return;

  const profile = await getCurrentProfile();
  if (!profile) return;

  document.getElementById('user-email').textContent = profile.email;
  document.getElementById('user-role').textContent = profile.role;

  const { data, error } = await supabase
    .from('solutions')
    .select('id, name, category, doc_status, is_archived')
    .eq('is_archived', false)
    .order('name');

  if (error) {
    showError('No se pudo cargar el listado de soluciones.');
    return;
  }
  solutions = data || [];

  populateFilters();
  bindEvents();
  renderSelectionList();
}

function populateFilters() {
  const categorySelect = document.getElementById('filter-category');
  const categories = [...new Set(solutions.map((s) => s.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  categories.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    categorySelect.appendChild(opt);
  });

  const docStatuses = [
    ['sin_iniciar', 'Sin iniciar'], ['en_proceso', 'En proceso'], ['lista_para_revision', 'Lista para revisión'],
    ['revisada', 'Revisada'], ['completa', 'Completa'], ['archivada', 'Archivada'],
  ];
  const docSelect = document.getElementById('filter-doc-status');
  docStatuses.forEach(([value, label]) => {
    const opt = document.createElement('option');
    opt.value = value; opt.textContent = label;
    docSelect.appendChild(opt);
  });
}

function bindEvents() {
  ['filter-category', 'filter-doc-status', 'filter-only-complete'].forEach((id) => {
    document.getElementById(id).addEventListener('change', renderSelectionList);
  });
  document.getElementById('btn-select-all').addEventListener('click', () => {
    getFilteredSolutions().forEach((s) => selectedIds.add(s.id));
    renderSelectionList();
  });
  document.getElementById('btn-select-none').addEventListener('click', () => {
    selectedIds.clear();
    renderSelectionList();
  });
  document.getElementById('btn-generate').addEventListener('click', generateConsolidatedReport);
  document.getElementById('btn-print').addEventListener('click', handlePrint);
  document.getElementById('btn-export-json').addEventListener('click', handleExportJson);
}

function getFilteredSolutions() {
  const category = document.getElementById('filter-category').value;
  const docStatus = document.getElementById('filter-doc-status').value;
  const onlyComplete = document.getElementById('filter-only-complete').checked;

  return solutions.filter((s) => {
    if (category && s.category !== category) return false;
    if (docStatus && s.doc_status !== docStatus) return false;
    if (onlyComplete && s.doc_status !== 'completa') return false;
    return true;
  });
}

function renderSelectionList() {
  const filtered = getFilteredSolutions();
  const container = document.getElementById('selection-list');

  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-list-note" style="padding:14px;">Ninguna solución coincide con estos filtros.</p>';
  } else {
    container.innerHTML = filtered.map((s) => `
      <label class="selection-row">
        <input type="checkbox" data-select-id="${s.id}" ${selectedIds.has(s.id) ? 'checked' : ''} />
        <span>${escapeHtml(s.name)}</span>
        <span class="text-muted" style="margin-left:auto;font-size:12px;">${escapeHtml(s.category) || '—'}</span>
      </label>
    `).join('');

    container.querySelectorAll('[data-select-id]').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-select-id');
        if (e.target.checked) selectedIds.add(id); else selectedIds.delete(id);
        updateSelectionCount();
      });
    });
  }

  updateSelectionCount();
}

function updateSelectionCount() {
  document.getElementById('selection-count').textContent = `${selectedIds.size} solución(es) seleccionada(s)`;
  document.getElementById('btn-generate').disabled = selectedIds.size === 0;
}

function showError(message) {
  const box = document.getElementById('load-error');
  box.textContent = message;
  box.classList.remove('hidden');
}

async function generateConsolidatedReport() {
  const btn = document.getElementById('btn-generate');
  btn.disabled = true;
  btn.textContent = 'Generando…';

  try {
    consolidatedReports = await Promise.all(
      [...selectedIds].map((id) => loadSolutionReportData(id))
    );
  } catch (err) {
    console.error(err);
    showError('No se pudo generar el reporte. Intenta de nuevo.');
    btn.disabled = false;
    btn.textContent = 'Generar reporte consolidado';
    return;
  }

  renderConsolidated();

  btn.disabled = false;
  btn.textContent = 'Generar reporte consolidado';

  await logActivity({
    solutionId: null,
    entityType: 'consolidated_report',
    entityId: null,
    actionType: 'report_generated',
    description: `Reporte consolidado generado (${consolidatedReports.length} soluciones)`,
  });
}

function renderConsolidated() {
  const generatedAt = new Date().toISOString();
  const avgPercent = Math.round(consolidatedReports.reduce((sum, r) => sum + r.overallPercent, 0) / consolidatedReports.length);

  const cover = `
    <div class="report-cover">
      <div class="report-eyebrow">Ecosistema LillyTech · Reporte consolidado</div>
      <h1>Portafolio de soluciones</h1>
      <p class="report-desc">${consolidatedReports.length} solución(es) incluida(s) en este reporte.</p>
      <div class="report-meta-row">
        <span><strong>Avance promedio:</strong> ${avgPercent}%</span>
        <span><strong>Generado el:</strong> ${formatDateTime(generatedAt)}</span>
      </div>
    </div>
  `;

  const toc = `
    <h2>Índice</h2>
    <ul class="report-toc">
      ${consolidatedReports.map((r, idx) => `<li><a href="#sol-${idx}">${idx + 1}. ${escapeHtml(r.solution.name)} — ${r.overallPercent}%</a></li>`).join('')}
    </ul>
  `;

  const summary = `
    <h2>Resumen general</h2>
    <table class="solutions-table" style="margin-bottom:24px;">
      <thead><tr><th>Solución</th><th>Categoría</th><th>Estado documental</th><th>Avance</th></tr></thead>
      <tbody>
        ${consolidatedReports.map((r) => `
          <tr>
            <td>${escapeHtml(r.solution.name)}</td>
            <td>${escapeHtml(r.solution.category) || '—'}</td>
            <td>${escapeHtml(r.solution.doc_status)}</td>
            <td class="mono">${r.overallPercent}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const perSolution = consolidatedReports.map((r, idx) => `
    <div class="report-solution-divider" id="sol-${idx}">
      ${renderSolutionReportHtml(r)}
    </div>
  `).join('');

  document.getElementById('report-content').innerHTML = cover + toc + summary + perSolution;
  document.getElementById('report-body').classList.remove('hidden');
  document.getElementById('report-body').scrollIntoView({ behavior: 'smooth' });
}

async function handlePrint() {
  await logActivity({
    solutionId: null,
    entityType: 'consolidated_report',
    entityId: null,
    actionType: 'report_generated',
    description: `Reporte consolidado impreso/PDF (${consolidatedReports.length} soluciones)`,
  });
  window.print();
}

async function handleExportJson() {
  const payload = {
    ecosystem: 'LillyTech',
    generated_at: new Date().toISOString(),
    solutions_count: consolidatedReports.length,
    solutions: consolidatedReports.map(buildJsonObject),
  };
  downloadTextFile(`reporte-consolidado-lillytech.json`, JSON.stringify(payload, null, 2), 'application/json');
  await logActivity({
    solutionId: null,
    entityType: 'consolidated_report',
    entityId: null,
    actionType: 'exported',
    description: `Exportación JSON consolidada (${consolidatedReports.length} soluciones)`,
  });
}

init();

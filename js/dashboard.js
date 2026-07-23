// =====================================================================
// LillyTech Solution Portfolio Manager — Panel principal
// =====================================================================

import { supabase } from './supabase-client.js';
import { requireSession, getCurrentProfile, canEdit, isAdmin, logout } from './auth.js';
import { logActivity } from './activity-log.js';
import { getProgressForSolutions } from './progress.js';
import { DEV_STATUS, DOC_STATUS, badgeHtml, formatDateTime, escapeHtml } from './constants.js';

let allSolutions = [];
let progressMap = {};
let profile = null;
let archiveTarget = null; // { id, name, willArchive: true|false }

async function init() {
  const session = await requireSession();
  if (!session) return;

  profile = await getCurrentProfile();
  if (!profile) {
    // Sesión válida pero sin perfil legible: no debería pasar, pero
    // por seguridad devolvemos al login en vez de dejar la pantalla
    // en un estado ambiguo.
    await logout();
    return;
  }

  document.getElementById('user-email').textContent = profile.email;
  document.getElementById('user-role').textContent = profile.role;

  if (canEdit(profile)) {
    document.getElementById('btn-new-solution').classList.remove('hidden');
    document.getElementById('btn-new-solution-empty').classList.remove('hidden');
  }
  if (isAdmin(profile)) {
    document.getElementById('link-catalog-admin').classList.remove('hidden');
  }

  populateFilterOptions();
  bindEvents();
  await loadSolutions();
}

function populateFilterOptions() {
  const devSelect = document.getElementById('filter-dev-status');
  DEV_STATUS.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.value;
    opt.textContent = s.label;
    devSelect.appendChild(opt);
  });

  const docSelect = document.getElementById('filter-doc-status');
  DOC_STATUS.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.value;
    opt.textContent = s.label;
    docSelect.appendChild(opt);
  });
}

function bindEvents() {
  document.getElementById('btn-logout').addEventListener('click', () => logout());
  document.getElementById('btn-new-solution').addEventListener('click', () => {
    window.location.href = 'solution-edit.html';
  });
  document.getElementById('btn-new-solution-empty').addEventListener('click', () => {
    window.location.href = 'solution-edit.html';
  });

  ['search-input', 'filter-category', 'filter-dev-status', 'filter-doc-status', 'filter-area', 'filter-progress', 'filter-archived']
    .forEach((id) => {
      const el = document.getElementById(id);
      const evt = el.tagName === 'INPUT' && el.type === 'search' ? 'input' : 'change';
      el.addEventListener(evt, renderTable);
    });

  document.getElementById('archive-modal-cancel').addEventListener('click', closeArchiveModal);
  document.getElementById('archive-modal-confirm').addEventListener('click', confirmArchiveToggle);
}

async function loadSolutions() {
  const { data, error } = await supabase
    .from('solutions')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error cargando soluciones:', error);
    document.getElementById('solutions-tbody').innerHTML =
      `<tr><td colspan="7" style="text-align:center;padding:40px;" class="text-muted">No se pudieron cargar las soluciones. Intenta recargar la página.</td></tr>`;
    return;
  }

  allSolutions = data || [];

  const categorySelect = document.getElementById('filter-category');
  const areaSelect = document.getElementById('filter-area');
  fillDistinctOptions(categorySelect, allSolutions.map((s) => s.category));
  fillDistinctOptions(areaSelect, allSolutions.map((s) => s.main_area));

  if (allSolutions.length > 0) {
    progressMap = await getProgressForSolutions(allSolutions.map((s) => s.id));
  } else {
    progressMap = {};
  }

  renderStats();
  renderTable();
  renderCatalogChangeNotice();
}

function fillDistinctOptions(selectEl, values) {
  const existing = new Set(Array.from(selectEl.options).map((o) => o.value));
  const distinct = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  distinct.forEach((value) => {
    if (existing.has(value)) return;
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    selectEl.appendChild(opt);
  });
}

function renderStats() {
  const active = allSolutions.filter((s) => !s.is_archived);
  const total = active.length;
  const completas = active.filter((s) => s.doc_status === 'completa').length;
  const enProceso = active.filter((s) => s.doc_status === 'en_proceso').length;
  const revision = active.filter((s) => s.doc_status === 'lista_para_revision').length;

  const avgPercent = total > 0
    ? Math.round(active.reduce((sum, s) => sum + (progressMap[s.id]?.percent || 0), 0) / total)
    : 0;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-completas').textContent = completas;
  document.getElementById('stat-proceso').textContent = enProceso;
  document.getElementById('stat-revision').textContent = revision;
  document.getElementById('stat-avance').textContent = `${avgPercent}%`;
}

function renderCatalogChangeNotice() {
  const affected = allSolutions.filter((s) => !s.is_archived && s.doc_status === 'completa' && (progressMap[s.id]?.percent ?? 100) < 100);
  const notice = document.getElementById('catalog-change-notice');
  if (affected.length === 0) {
    notice.classList.add('hidden');
    return;
  }
  const names = affected.map((s) => s.name).join(', ');
  notice.textContent = `Se agregaron nuevas preguntas al catálogo documental. ${affected.length === 1 ? 'La siguiente solución marcada como "Completa" tiene' : 'Las siguientes soluciones marcadas como "Completa" tienen'} respuestas pendientes: ${names}.`;
  notice.classList.remove('hidden');
}

function getFilteredSolutions() {
  const search = document.getElementById('search-input').value.trim().toLowerCase();
  const category = document.getElementById('filter-category').value;
  const devStatus = document.getElementById('filter-dev-status').value;
  const docStatus = document.getElementById('filter-doc-status').value;
  const area = document.getElementById('filter-area').value;
  const progressBucket = document.getElementById('filter-progress').value;
  const showArchived = document.getElementById('filter-archived').checked;

  return allSolutions.filter((s) => {
    if (showArchived ? !s.is_archived : s.is_archived) return false;
    if (category && s.category !== category) return false;
    if (devStatus && s.dev_status !== devStatus) return false;
    if (docStatus && s.doc_status !== docStatus) return false;
    if (area && s.main_area !== area) return false;

    if (progressBucket) {
      const [min, max] = progressBucket.split('-').map(Number);
      const pct = progressMap[s.id]?.percent ?? 0;
      if (pct < min || pct > max) return false;
    }

    if (search) {
      const haystack = `${s.name} ${s.short_name || ''} ${s.short_description || ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

function renderTable() {
  const filtered = getFilteredSolutions();
  const tbody = document.getElementById('solutions-tbody');
  const emptyState = document.getElementById('empty-state');
  const tableWrap = document.getElementById('solutions-table');

  if (filtered.length === 0) {
    tableWrap.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }
  tableWrap.classList.remove('hidden');
  emptyState.classList.add('hidden');

  const editable = canEdit(profile);

  tbody.innerHTML = filtered.map((s) => {
    const progress = progressMap[s.id] || { percent: 0 };
    const catalogChanged = s.doc_status === 'completa' && progress.percent < 100;

    return `
      <tr>
        <td>
          <div class="solution-name">${escapeHtml(s.name)}</div>
          ${s.short_name ? `<div class="solution-short">${escapeHtml(s.short_name)}</div>` : ''}
        </td>
        <td>${escapeHtml(s.category) || '<span class="text-muted">—</span>'}</td>
        <td>${badgeHtml(DEV_STATUS, s.dev_status)}</td>
        <td>${badgeHtml(DOC_STATUS, s.doc_status)}${catalogChanged ? ' <span class="badge badge-rust" title="Hay preguntas nuevas del catálogo sin responder">catálogo actualizado</span>' : ''}</td>
        <td>
          <div class="progress-cell">
            <div class="progress-track"><div class="progress-fill" style="width:${progress.percent}%"></div></div>
            <span class="progress-pct mono">${progress.percent}%</span>
          </div>
        </td>
        <td class="mono" style="font-size:12.5px;">${formatDateTime(s.updated_at)}</td>
        <td>
          <div class="row-actions">
            <a class="btn btn-ghost btn-sm" href="solution-edit.html?id=${s.id}">${editable ? 'Editar' : 'Abrir'}</a>
            <a class="btn btn-brass btn-sm" href="solution-form.html?id=${s.id}">${editable ? 'Documentar' : 'Ver documentación'}</a>
            ${editable ? `<button class="btn btn-danger btn-sm" data-archive-toggle="${s.id}">${s.is_archived ? 'Restaurar' : 'Archivar'}</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-archive-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => openArchiveModal(btn.getAttribute('data-archive-toggle')));
  });
}

function openArchiveModal(solutionId) {
  const solution = allSolutions.find((s) => s.id === solutionId);
  if (!solution) return;

  const willArchive = !solution.is_archived;
  archiveTarget = { id: solutionId, name: solution.name, willArchive };

  document.getElementById('archive-modal-title').textContent = willArchive ? 'Archivar solución' : 'Restaurar solución';
  document.getElementById('archive-modal-text').textContent = willArchive
    ? `¿Confirmas que deseas archivar "${solution.name}"? No se elimina ninguna información: respuestas, funcionalidades, roles, reportes, métricas, casos de uso e integraciones permanecen intactos y podrás restaurarla cuando quieras.`
    : `¿Confirmas que deseas restaurar "${solution.name}"? Volverá a aparecer en el listado activo.`;

  const confirmBtn = document.getElementById('archive-modal-confirm');
  confirmBtn.textContent = willArchive ? 'Archivar' : 'Restaurar';
  confirmBtn.className = willArchive ? 'btn btn-danger' : 'btn btn-brass';

  document.getElementById('archive-modal').classList.remove('hidden');
}

function closeArchiveModal() {
  archiveTarget = null;
  document.getElementById('archive-modal').classList.add('hidden');
}

async function confirmArchiveToggle() {
  if (!archiveTarget) return;
  const { id, willArchive } = archiveTarget;

  const updatePayload = willArchive
    ? { is_archived: true, archived_at: new Date().toISOString() }
    : { is_archived: false, archived_at: null };

  const { error } = await supabase.from('solutions').update(updatePayload).eq('id', id);

  if (error) {
    console.error('Error al archivar/restaurar:', error);
    alert('No se pudo completar la operación. Intenta de nuevo.');
    closeArchiveModal();
    return;
  }

  await logActivity({
    solutionId: id,
    entityType: 'solution',
    entityId: id,
    actionType: willArchive ? 'archived' : 'restored',
    description: willArchive ? `Solución archivada: ${archiveTarget.name}` : `Solución restaurada: ${archiveTarget.name}`,
  });

  closeArchiveModal();
  await loadSolutions();
}

init();

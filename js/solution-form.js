// =====================================================================
// LillyTech Solution Portfolio Manager — Formulario documental
// Renderiza las 17 secciones y sus preguntas leyendo el catálogo
// maestro desde Supabase (nunca hardcodeadas). Guardado confiable por
// sección (no autosave por tecla, para no saturar la base con
// escrituras), progreso calculado contra el catálogo activo vigente,
// advertencia de cambios sin guardar.
// =====================================================================

import { supabase } from './supabase-client.js';
import { requireSession, getCurrentProfile, canEdit } from './auth.js';
import { logActivity } from './activity-log.js';
import { escapeHtml, DYNAMIC_LIST_CONFIGS } from './constants.js';
import { renderDynamicList } from './dynamic-lists.js';

const SECTION_TO_LIST_CONFIG = {};
Object.values(DYNAMIC_LIST_CONFIGS).forEach((cfg) => { SECTION_TO_LIST_CONFIG[cfg.sectionCode] = cfg; });

let solutionId = null;
let profile = null;
let editable = false;
let solution = null;
let sections = [];              // [{id, code, name, description, order_index}]
let questionsBySection = {};    // { sectionId: [question, ...] }
let answersByQuestion = {};     // { questionId: {id, answer_text, is_not_applicable, confirmation_pending} }
let activeSectionId = null;
let sectionDirty = false;

async function init() {
  const session = await requireSession();
  if (!session) return;

  profile = await getCurrentProfile();
  if (!profile) return;

  document.getElementById('user-email').textContent = profile.email;
  document.getElementById('user-role').textContent = profile.role;
  editable = canEdit(profile);

  const params = new URLSearchParams(window.location.search);
  solutionId = params.get('id');

  if (!solutionId) {
    document.getElementById('load-error').textContent = 'No se indicó qué solución documentar. Vuelve al panel y usa "Continuar documentación" sobre una solución existente.';
    document.getElementById('load-error').classList.remove('hidden');
    return;
  }

  window.addEventListener('beforeunload', (e) => {
    if (sectionDirty) { e.preventDefault(); e.returnValue = ''; }
  });

  await loadAll();
}

async function loadAll() {
  const [{ data: solutionData, error: solutionError }, { data: sectionsData, error: sectionsError }, { data: questionsData, error: questionsError }, { data: answersData, error: answersError }] = await Promise.all([
    supabase.from('solutions').select('*').eq('id', solutionId).single(),
    supabase.from('documentation_sections').select('*').eq('is_active', true).order('order_index'),
    supabase.from('documentation_questions').select('*').eq('is_active', true).order('order_index'),
    supabase.from('solution_answers').select('*').eq('solution_id', solutionId),
  ]);

  if (solutionError || !solutionData) {
    showLoadError('No se pudo cargar esta solución. Es posible que ya no exista o que no tengas acceso.');
    return;
  }
  if (sectionsError || questionsError || answersError) {
    showLoadError('No se pudo cargar el catálogo documental. Recarga la página e intenta de nuevo.');
    return;
  }

  solution = solutionData;
  sections = sectionsData || [];

  questionsBySection = {};
  sections.forEach((s) => { questionsBySection[s.id] = []; });
  (questionsData || []).forEach((q) => {
    if (!questionsBySection[q.section_id]) questionsBySection[q.section_id] = [];
    questionsBySection[q.section_id].push(q);
  });

  answersByQuestion = {};
  (answersData || []).forEach((a) => { answersByQuestion[a.question_id] = a; });

  document.getElementById('page-title').textContent = `${solution.name} — LillyTech Solution Portfolio Manager`;
  document.getElementById('solution-title').textContent = solution.name;
  document.getElementById('solution-subtitle').textContent = solution.short_description || '';

  document.getElementById('form-body').classList.remove('hidden');

  renderSectionNav();
  renderOverallProgress();

  const firstSection = sections[0];
  if (firstSection) selectSection(firstSection.id);
}

function showLoadError(message) {
  const box = document.getElementById('load-error');
  box.textContent = message;
  box.classList.remove('hidden');
}

// ---------------------------------------------------------------------
// Cálculo de progreso (mismo criterio que js/progress.js, pero
// evaluado en memoria porque ya tenemos todo cargado)
// ---------------------------------------------------------------------
function isAnswerComplete(answer) {
  if (!answer) return false;
  const hasText = typeof answer.answer_text === 'string' && answer.answer_text.trim().length > 0;
  return (hasText || answer.is_not_applicable) && !answer.confirmation_pending;
}

function sectionStats(sectionId) {
  const questions = questionsBySection[sectionId] || [];
  const total = questions.length;
  const completed = questions.filter((q) => isAnswerComplete(answersByQuestion[q.id])).length;
  return { total, completed };
}

function overallStats() {
  let total = 0;
  let completed = 0;
  sections.forEach((s) => {
    const stats = sectionStats(s.id);
    total += stats.total;
    completed += stats.completed;
  });
  return { total, completed };
}

function renderOverallProgress() {
  const { total, completed } = overallStats();
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  document.getElementById('overall-percent').textContent = `${percent}%`;
  document.getElementById('overall-progress-fill').style.width = `${percent}%`;
  document.getElementById('overall-counts').textContent = `${completed} de ${total} preguntas del catálogo completas`;
}

// ---------------------------------------------------------------------
// Navegación de secciones
// ---------------------------------------------------------------------
function renderSectionNav() {
  const nav = document.getElementById('section-nav');
  nav.innerHTML = sections.map((s) => {
    const { total, completed } = sectionStats(s.id);
    let dotClass = 'section-nav-dot';
    if (total === 0) {
      dotClass += ' na';
    } else if (completed === total) {
      dotClass += ' complete';
    } else if (completed > 0) {
      dotClass += ' partial';
    }
    return `
      <button type="button" class="section-nav-item ${s.id === activeSectionId ? 'active' : ''}" data-section-id="${s.id}">
        <span class="${dotClass}"></span>
        <span class="section-nav-label">${escapeHtml(s.name)}</span>
        ${total > 0 ? `<span class="section-nav-count">${completed}/${total}</span>` : ''}
      </button>
    `;
  }).join('');

  nav.querySelectorAll('[data-section-id]').forEach((btn) => {
    btn.addEventListener('click', () => attemptSelectSection(btn.getAttribute('data-section-id')));
  });
}

function attemptSelectSection(sectionId) {
  if (sectionId === activeSectionId) return;
  if (sectionDirty) {
    const confirmed = window.confirm('Tienes cambios sin guardar en esta sección. ¿Deseas salir sin guardarlos?');
    if (!confirmed) return;
  }
  selectSection(sectionId);
}

function selectSection(sectionId) {
  activeSectionId = sectionId;
  sectionDirty = false;
  renderSectionNav();
  renderSectionPanel(sectionId);
}

// ---------------------------------------------------------------------
// Panel de la sección activa
// ---------------------------------------------------------------------
function renderSectionPanel(sectionId) {
  const section = sections.find((s) => s.id === sectionId);
  const questions = questionsBySection[sectionId] || [];
  const panel = document.getElementById('section-panel');
  const listConfig = SECTION_TO_LIST_CONFIG[section.code];

  panel.innerHTML = `
    <div class="section-panel-header">
      <div>
        <h2 style="margin-bottom:0;">${escapeHtml(section.name)}</h2>
        ${section.description ? `<div class="section-panel-desc">${escapeHtml(section.description)}</div>` : ''}
      </div>
      <div style="text-align:right;">
        ${questions.length > 0 && editable ? `<button type="button" id="save-section-btn" class="btn btn-primary btn-sm">Guardar sección</button>` : ''}
        <div class="save-status" id="save-status"></div>
      </div>
    </div>
    <div id="questions-container"></div>
    <div id="dynamic-list-container" class="dynamic-list-section"></div>
  `;

  const questionsContainer = document.getElementById('questions-container');
  if (questions.length === 0) {
    questionsContainer.innerHTML = listConfig
      ? ''
      : '<p class="text-muted">Esta sección no tiene preguntas propias.</p>';
  } else {
    questionsContainer.innerHTML = questions.map(renderQuestionBlock).join('');
    bindQuestionEvents();
  }

  if (questions.length > 0 && editable) {
    document.getElementById('save-section-btn').addEventListener('click', () => saveSection(sectionId, section.name));
  }

  if (listConfig) {
    renderDynamicList(document.getElementById('dynamic-list-container'), listConfig, solutionId, editable);
  }
}

function renderQuestionBlock(question) {
  const answer = answersByQuestion[question.id] || { answer_text: '', is_not_applicable: false, confirmation_pending: false };
  const disabled = !editable || answer.is_not_applicable ? 'disabled' : '';
  const inputHtml = renderAnswerInput(question, answer, disabled);

  return `
    <div class="question-block" data-question-id="${question.id}">
      <div class="question-label">
        ${escapeHtml(question.question_text)}
        ${question.is_required ? '<span class="question-required">*</span>' : ''}
      </div>
      ${question.help_text ? `<div class="question-help">${escapeHtml(question.help_text)}</div>` : ''}
      ${inputHtml}
      <div class="question-flags">
        ${question.allow_not_applicable ? `
          <label class="flag-check">
            <input type="checkbox" data-role="na" ${answer.is_not_applicable ? 'checked' : ''} ${!editable ? 'disabled' : ''} />
            No aplica
          </label>` : ''}
        <label class="flag-check">
          <input type="checkbox" data-role="pending" ${answer.confirmation_pending ? 'checked' : ''} ${!editable ? 'disabled' : ''} />
          Pendiente de confirmar
        </label>
      </div>
    </div>
  `;
}

function renderAnswerInput(question, answer, disabledAttr) {
  const value = answer.answer_text || '';
  const commonAttrs = `class="input question-input" data-role="answer" ${disabledAttr} ${!editable ? 'disabled' : ''}`;

  switch (question.answer_type) {
    case 'text_short':
      return `<input type="text" ${commonAttrs} value="${escapeHtml(value)}" />`;
    case 'number':
      return `<input type="number" ${commonAttrs} value="${escapeHtml(value)}" />`;
    case 'date':
      return `<input type="date" ${commonAttrs} value="${escapeHtml(value)}" />`;
    case 'boolean':
      return `
        <select ${commonAttrs}>
          <option value="">Sin definir</option>
          <option value="Sí" ${value === 'Sí' ? 'selected' : ''}>Sí</option>
          <option value="No" ${value === 'No' ? 'selected' : ''}>No</option>
        </select>`;
    case 'select': {
      let options = [];
      try { options = question.select_options ? JSON.parse(question.select_options) : []; } catch { options = []; }
      const optsHtml = options.map((o) => `<option value="${escapeHtml(o)}" ${o === value ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
      return `<select ${commonAttrs}><option value="">Sin definir</option>${optsHtml}</select>`;
    }
    case 'text_long':
    default:
      return `<textarea ${commonAttrs}>${escapeHtml(value)}</textarea>`;
  }
}

function bindQuestionEvents() {
  const container = document.getElementById('questions-container');
  container.querySelectorAll('[data-role="answer"], [data-role="pending"]').forEach((el) => {
    el.addEventListener('input', markDirty);
    el.addEventListener('change', markDirty);
  });
  container.querySelectorAll('[data-role="na"]').forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      const block = e.target.closest('.question-block');
      const answerInput = block.querySelector('[data-role="answer"]');
      answerInput.disabled = e.target.checked || !editable;
      markDirty();
    });
  });
}

function markDirty() {
  sectionDirty = true;
  const status = document.getElementById('save-status');
  if (status) { status.textContent = 'Cambios sin guardar'; status.className = 'save-status dirty'; }
}

// ---------------------------------------------------------------------
// Guardado por sección
// ---------------------------------------------------------------------
async function saveSection(sectionId, sectionName) {
  const btn = document.getElementById('save-section-btn');
  const status = document.getElementById('save-status');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  const { data: { user } } = await supabase.auth.getUser();
  const blocks = document.querySelectorAll('#questions-container .question-block');

  const rows = Array.from(blocks).map((block) => {
    const questionId = block.getAttribute('data-question-id');
    const answerEl = block.querySelector('[data-role="answer"]');
    const naEl = block.querySelector('[data-role="na"]');
    const pendingEl = block.querySelector('[data-role="pending"]');

    return {
      solution_id: solutionId,
      question_id: questionId,
      answer_text: answerEl.value.trim() === '' ? null : answerEl.value.trim(),
      is_not_applicable: naEl ? naEl.checked : false,
      confirmation_pending: pendingEl.checked,
      updated_by: user ? user.id : null,
    };
  });

  const { data, error } = await supabase
    .from('solution_answers')
    .upsert(rows, { onConflict: 'solution_id,question_id' })
    .select();

  btn.disabled = false;
  btn.textContent = 'Guardar sección';

  if (error) {
    console.error('Error guardando respuestas:', error);
    status.textContent = 'No se pudo guardar. Intenta de nuevo.';
    status.className = 'save-status dirty';
    return;
  }

  (data || []).forEach((row) => { answersByQuestion[row.question_id] = row; });

  await logActivity({
    solutionId,
    entityType: 'answer',
    entityId: null,
    actionType: 'updated',
    description: `Respuestas guardadas — ${sectionName} (${rows.length} preguntas)`,
  });

  sectionDirty = false;
  const now = new Date();
  status.textContent = `Guardado ${now.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}`;
  status.className = 'save-status saved';

  renderSectionNav();
  renderOverallProgress();
}

init();

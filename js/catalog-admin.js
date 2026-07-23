// =====================================================================
// LillyTech Solution Portfolio Manager — Administración del catálogo
// Pantalla exclusiva de admin (decisión #3 confirmada por Lilly).
// Nunca borra físicamente secciones ni preguntas: solo desactivación
// lógica (is_active). Este es el mecanismo que hace que el catálogo
// sea flexible sin tocar código: agregar una pregunta aquí la hace
// aparecer automáticamente en el formulario de todas las soluciones.
// =====================================================================

import { supabase } from './supabase-client.js';
import { requireSession, getCurrentProfile, isAdmin } from './auth.js';
import { logActivity } from './activity-log.js';
import { escapeHtml, ANSWER_TYPES } from './constants.js';

let sections = [];
let selectedSectionId = null;
let questions = [];
let sectionFormState = { mode: null, editing: null }; // mode: null | 'new' | 'edit'
let questionFormState = { mode: null, editing: null };

async function init() {
  const session = await requireSession();
  if (!session) return;

  const profile = await getCurrentProfile();
  if (!profile) return;

  document.getElementById('user-email').textContent = profile.email;
  document.getElementById('user-role').textContent = profile.role;

  if (!isAdmin(profile)) {
    document.getElementById('access-denied').classList.remove('hidden');
    return;
  }

  document.getElementById('catalog-body').classList.remove('hidden');
  document.getElementById('btn-new-section').addEventListener('click', () => {
    sectionFormState = { mode: 'new', editing: null };
    renderSectionForm();
  });

  await loadSections();
}

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'seccion';
}

function uniqueCode(base, existingCodes) {
  let code = slugify(base);
  let candidate = code;
  let suffix = 2;
  while (existingCodes.has(candidate)) {
    candidate = `${code}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

// ---------------------------------------------------------------------
// Secciones
// ---------------------------------------------------------------------
async function loadSections() {
  const { data, error } = await supabase.from('documentation_sections').select('*').order('order_index');
  if (error) { console.error('Error cargando secciones:', error); return; }
  sections = data || [];
  renderSectionsList();
}

function renderSectionsList() {
  const container = document.getElementById('sections-list');
  if (sections.length === 0) {
    container.innerHTML = '<p class="empty-list-note" style="padding:14px;">No hay secciones todavía.</p>';
    return;
  }

  container.innerHTML = sections.map((s, idx) => `
    <div class="catalog-section-item ${s.id === selectedSectionId ? 'active' : ''} ${!s.is_active ? 'inactive-item' : ''}" data-select-section="${s.id}">
      <div style="display:flex;flex-direction:column;gap:2px;">
        <button type="button" class="btn btn-ghost btn-sm" data-move="up" data-id="${s.id}" ${idx === 0 ? 'disabled' : ''} style="padding:1px 6px;">↑</button>
        <button type="button" class="btn btn-ghost btn-sm" data-move="down" data-id="${s.id}" ${idx === sections.length - 1 ? 'disabled' : ''} style="padding:1px 6px;">↓</button>
      </div>
      <div style="flex:1;min-width:0;">
        <div>${escapeHtml(s.name)} ${!s.is_active ? '<span class="badge badge-slate">inactiva</span>' : ''}</div>
      </div>
      <div style="display:flex;gap:4px;">
        <button type="button" class="btn btn-ghost btn-sm" data-edit-section="${s.id}">Editar</button>
        <button type="button" class="btn btn-ghost btn-sm" data-toggle-section="${s.id}">${s.is_active ? 'Desactivar' : 'Activar'}</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-select-section]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      selectSection(el.getAttribute('data-select-section'));
    });
  });
  container.querySelectorAll('[data-edit-section]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const section = sections.find((s) => s.id === btn.getAttribute('data-edit-section'));
      sectionFormState = { mode: 'edit', editing: section };
      renderSectionForm();
    });
  });
  container.querySelectorAll('[data-toggle-section]').forEach((btn) => {
    btn.addEventListener('click', () => toggleSectionActive(btn.getAttribute('data-toggle-section')));
  });
  container.querySelectorAll('[data-move="up"]').forEach((btn) => {
    btn.addEventListener('click', () => moveSection(btn.getAttribute('data-id'), -1));
  });
  container.querySelectorAll('[data-move="down"]').forEach((btn) => {
    btn.addEventListener('click', () => moveSection(btn.getAttribute('data-id'), 1));
  });
}

function renderSectionForm() {
  const slot = document.getElementById('section-form-slot');
  if (!sectionFormState.mode) { slot.innerHTML = ''; return; }

  const editing = sectionFormState.editing;
  slot.innerHTML = `
    <div class="inline-form">
      <div class="inline-form-title">${editing ? 'Editar sección' : 'Nueva sección'}</div>
      <div id="section-form-error" class="form-error hidden"></div>
      <div class="field-group">
        <label for="section-name">Nombre</label>
        <input class="input" type="text" id="section-name" value="${editing ? escapeHtml(editing.name) : ''}" maxlength="120" />
      </div>
      <div class="field-group">
        <label for="section-desc">Descripción <span class="optional-tag">(opcional)</span></label>
        <textarea class="input" id="section-desc" maxlength="400">${editing ? escapeHtml(editing.description || '') : ''}</textarea>
      </div>
      <div class="form-actions" style="margin-top:6px;padding-top:0;border-top:none;">
        <button type="button" class="btn btn-ghost btn-sm" id="section-form-cancel">Cancelar</button>
        <button type="button" class="btn btn-primary btn-sm" id="section-form-save">Guardar</button>
      </div>
    </div>
  `;

  document.getElementById('section-form-cancel').addEventListener('click', () => {
    sectionFormState = { mode: null, editing: null };
    renderSectionForm();
  });
  document.getElementById('section-form-save').addEventListener('click', saveSectionForm);
}

async function saveSectionForm() {
  const name = document.getElementById('section-name').value.trim();
  const description = document.getElementById('section-desc').value.trim();
  const errBox = document.getElementById('section-form-error');

  if (!name) {
    errBox.textContent = 'El nombre de la sección es obligatorio.';
    errBox.classList.remove('hidden');
    return;
  }

  const editing = sectionFormState.editing;

  if (editing) {
    const { error } = await supabase.from('documentation_sections').update({ name, description: description || null }).eq('id', editing.id);
    if (error) {
      errBox.textContent = 'No se pudo guardar. Intenta de nuevo.';
      errBox.classList.remove('hidden');
      return;
    }
    await logActivity({ entityType: 'catalog_section', entityId: editing.id, actionType: 'updated', description: `Sección editada: ${name}` });
  } else {
    const existingCodes = new Set(sections.map((s) => s.code));
    const code = uniqueCode(name, existingCodes);
    const nextOrder = sections.length > 0 ? Math.max(...sections.map((s) => s.order_index)) + 1 : 1;
    const { data, error } = await supabase.from('documentation_sections')
      .insert({ code, name, description: description || null, order_index: nextOrder, is_active: true })
      .select('id').single();
    if (error) {
      errBox.textContent = 'No se pudo crear la sección. Intenta de nuevo.';
      errBox.classList.remove('hidden');
      return;
    }
    await logActivity({ entityType: 'catalog_section', entityId: data.id, actionType: 'created', description: `Sección creada: ${name}` });
  }

  sectionFormState = { mode: null, editing: null };
  await loadSections();
}

async function toggleSectionActive(sectionId) {
  const section = sections.find((s) => s.id === sectionId);
  const { error } = await supabase.from('documentation_sections').update({ is_active: !section.is_active }).eq('id', sectionId);
  if (error) { alert('No se pudo actualizar la sección.'); return; }
  await logActivity({ entityType: 'catalog_section', entityId: sectionId, actionType: section.is_active ? 'deactivated' : 'activated', description: `Sección ${section.is_active ? 'desactivada' : 'activada'}: ${section.name}` });
  await loadSections();
  if (selectedSectionId) await loadQuestions(selectedSectionId);
}

async function moveSection(sectionId, direction) {
  const idx = sections.findIndex((s) => s.id === sectionId);
  const swapIdx = idx + direction;
  if (swapIdx < 0 || swapIdx >= sections.length) return;

  const a = sections[idx];
  const b = sections[swapIdx];

  await supabase.from('documentation_sections').update({ order_index: b.order_index }).eq('id', a.id);
  await supabase.from('documentation_sections').update({ order_index: a.order_index }).eq('id', b.id);

  await loadSections();
}

// ---------------------------------------------------------------------
// Preguntas de la sección seleccionada
// ---------------------------------------------------------------------
function selectSection(sectionId) {
  selectedSectionId = sectionId;
  questionFormState = { mode: null, editing: null };
  renderSectionsList();
  loadQuestions(sectionId);
}

async function loadQuestions(sectionId) {
  const { data, error } = await supabase.from('documentation_questions').select('*').eq('section_id', sectionId).order('order_index');
  if (error) { console.error('Error cargando preguntas:', error); return; }
  questions = data || [];
  renderQuestionsPanel();
}

function renderQuestionsPanel() {
  const section = sections.find((s) => s.id === selectedSectionId);
  const panel = document.getElementById('questions-panel');

  panel.innerHTML = `
    <div class="section-panel-header">
      <div>
        <h2 style="margin-bottom:0;">${escapeHtml(section.name)}</h2>
        <div class="section-panel-desc">${questions.length} pregunta${questions.length === 1 ? '' : 's'} en el catálogo</div>
      </div>
      <button type="button" id="btn-new-question" class="btn btn-brass btn-sm">+ Nueva pregunta</button>
    </div>
    <div id="question-form-slot"></div>
    <div id="questions-admin-list"></div>
  `;

  document.getElementById('btn-new-question').addEventListener('click', () => {
    questionFormState = { mode: 'new', editing: null };
    renderQuestionForm();
  });

  const list = document.getElementById('questions-admin-list');
  if (questions.length === 0) {
    list.innerHTML = '<p class="empty-list-note">Esta sección todavía no tiene preguntas.</p>';
  } else {
    list.innerHTML = questions.map((q, idx) => `
      <div class="question-admin-row">
        <div style="display:flex;flex-direction:column;gap:2px;">
          <button type="button" class="btn btn-ghost btn-sm" data-qmove="up" data-id="${q.id}" ${idx === 0 ? 'disabled' : ''} style="padding:1px 6px;">↑</button>
          <button type="button" class="btn btn-ghost btn-sm" data-qmove="down" data-id="${q.id}" ${idx === questions.length - 1 ? 'disabled' : ''} style="padding:1px 6px;">↓</button>
        </div>
        <div>
          <div class="question-admin-text">${escapeHtml(q.question_text)} ${!q.is_active ? '<span class="badge badge-slate">inactiva</span>' : ''}</div>
          <div class="question-admin-meta">
            ${ANSWER_TYPES.find((t) => t.value === q.answer_type)?.label || q.answer_type}
            ${q.is_required ? ' · obligatoria' : ''}
            ${q.allow_not_applicable ? ' · admite "No aplica"' : ' · no admite "No aplica"'}
            · orden ${q.order_index}
          </div>
        </div>
        <div class="question-admin-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-edit-question="${q.id}">Editar</button>
          <button type="button" class="btn btn-ghost btn-sm" data-toggle-question="${q.id}">${q.is_active ? 'Desactivar' : 'Activar'}</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-edit-question]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const question = questions.find((q) => q.id === btn.getAttribute('data-edit-question'));
        questionFormState = { mode: 'edit', editing: question };
        renderQuestionForm();
      });
    });
    list.querySelectorAll('[data-toggle-question]').forEach((btn) => {
      btn.addEventListener('click', () => toggleQuestionActive(btn.getAttribute('data-toggle-question')));
    });
    list.querySelectorAll('[data-qmove="up"]').forEach((btn) => {
      btn.addEventListener('click', () => moveQuestion(btn.getAttribute('data-id'), -1));
    });
    list.querySelectorAll('[data-qmove="down"]').forEach((btn) => {
      btn.addEventListener('click', () => moveQuestion(btn.getAttribute('data-id'), 1));
    });
  }

  if (questionFormState.mode) renderQuestionForm();
}

function renderQuestionForm() {
  const slot = document.getElementById('question-form-slot');
  if (!slot) return;
  if (!questionFormState.mode) { slot.innerHTML = ''; return; }

  const editing = questionFormState.editing;
  const answerTypeOptions = ANSWER_TYPES.map((t) => `<option value="${t.value}" ${editing && editing.answer_type === t.value ? 'selected' : ''}>${t.label}</option>`).join('');
  let selectOptionsValue = '';
  if (editing && editing.answer_type === 'select' && editing.select_options) {
    try { selectOptionsValue = JSON.parse(editing.select_options).join(', '); } catch { selectOptionsValue = ''; }
  }

  slot.innerHTML = `
    <div class="inline-form">
      <div class="inline-form-title">${editing ? 'Editar pregunta' : 'Nueva pregunta'}</div>
      <div id="question-form-error" class="form-error hidden"></div>
      <div class="field-group">
        <label for="q-text">Redacción de la pregunta</label>
        <textarea class="input" id="q-text">${editing ? escapeHtml(editing.question_text) : ''}</textarea>
      </div>
      <div class="field-group">
        <label for="q-help">Ayuda breve <span class="optional-tag">(opcional)</span></label>
        <input class="input" type="text" id="q-help" value="${editing ? escapeHtml(editing.help_text || '') : ''}" />
      </div>
      <div class="field-row">
        <div class="field-group">
          <label for="q-type">Tipo de respuesta</label>
          <select class="select" id="q-type">${answerTypeOptions}</select>
        </div>
        <div class="field-group">
          <label for="q-order">Orden dentro de la sección</label>
          <input class="input" type="number" id="q-order" value="${editing ? editing.order_index : (questions.length > 0 ? Math.max(...questions.map((q) => q.order_index)) + 1 : 1)}" />
        </div>
      </div>
      <div class="field-group" id="q-select-options-group" style="${(editing && editing.answer_type === 'select') ? '' : 'display:none;'}">
        <label for="q-select-options">Opciones (separadas por coma)</label>
        <input class="input" type="text" id="q-select-options" value="${escapeHtml(selectOptionsValue)}" placeholder="Opción A, Opción B, Opción C" />
      </div>
      <div class="question-flags" style="margin-bottom:6px;">
        <label class="flag-check"><input type="checkbox" id="q-required" ${editing && editing.is_required ? 'checked' : ''} /> Obligatoria</label>
        <label class="flag-check"><input type="checkbox" id="q-allow-na" ${!editing || editing.allow_not_applicable ? 'checked' : ''} /> Permite "No aplica"</label>
      </div>
      <div class="form-actions" style="margin-top:6px;padding-top:0;border-top:none;">
        <button type="button" class="btn btn-ghost btn-sm" id="question-form-cancel">Cancelar</button>
        <button type="button" class="btn btn-primary btn-sm" id="question-form-save">Guardar</button>
      </div>
    </div>
  `;

  document.getElementById('q-type').addEventListener('change', (e) => {
    document.getElementById('q-select-options-group').style.display = e.target.value === 'select' ? '' : 'none';
  });
  document.getElementById('question-form-cancel').addEventListener('click', () => {
    questionFormState = { mode: null, editing: null };
    renderQuestionForm();
  });
  document.getElementById('question-form-save').addEventListener('click', saveQuestionForm);
}

async function saveQuestionForm() {
  const text = document.getElementById('q-text').value.trim();
  const helpText = document.getElementById('q-help').value.trim();
  const answerType = document.getElementById('q-type').value;
  const orderIndex = Number(document.getElementById('q-order').value);
  const isRequired = document.getElementById('q-required').checked;
  const allowNa = document.getElementById('q-allow-na').checked;
  const errBox = document.getElementById('question-form-error');

  if (!text) {
    errBox.textContent = 'La redacción de la pregunta es obligatoria.';
    errBox.classList.remove('hidden');
    return;
  }

  let selectOptions = null;
  if (answerType === 'select') {
    const raw = document.getElementById('q-select-options').value.trim();
    const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
    selectOptions = JSON.stringify(list);
  }

  const payload = {
    question_text: text,
    help_text: helpText || null,
    answer_type: answerType,
    select_options: selectOptions,
    order_index: orderIndex,
    is_required: isRequired,
    allow_not_applicable: allowNa,
  };

  const editing = questionFormState.editing;

  if (editing) {
    const { error } = await supabase.from('documentation_questions').update(payload).eq('id', editing.id);
    if (error) {
      errBox.textContent = error.code === '23505'
        ? 'Ya existe otra pregunta con ese número de orden en esta sección. Elige otro.'
        : 'No se pudo guardar. Intenta de nuevo.';
      errBox.classList.remove('hidden');
      return;
    }
    await logActivity({ entityType: 'catalog_question', entityId: editing.id, actionType: 'updated', description: `Pregunta editada: ${text.slice(0, 80)}` });
  } else {
    const { data, error } = await supabase.from('documentation_questions')
      .insert({ ...payload, section_id: selectedSectionId, is_active: true })
      .select('id').single();
    if (error) {
      errBox.textContent = error.code === '23505'
        ? 'Ya existe otra pregunta con ese número de orden en esta sección. Elige otro.'
        : 'No se pudo crear la pregunta. Intenta de nuevo.';
      errBox.classList.remove('hidden');
      return;
    }
    await logActivity({ entityType: 'catalog_question', entityId: data.id, actionType: 'created', description: `Pregunta creada: ${text.slice(0, 80)}` });
  }

  questionFormState = { mode: null, editing: null };
  await loadQuestions(selectedSectionId);
}

async function toggleQuestionActive(questionId) {
  const question = questions.find((q) => q.id === questionId);
  const { error } = await supabase.from('documentation_questions').update({ is_active: !question.is_active }).eq('id', questionId);
  if (error) { alert('No se pudo actualizar la pregunta.'); return; }
  await logActivity({ entityType: 'catalog_question', entityId: questionId, actionType: question.is_active ? 'deactivated' : 'activated', description: `Pregunta ${question.is_active ? 'desactivada' : 'activada'}: ${question.question_text.slice(0, 80)}` });
  await loadQuestions(selectedSectionId);
}

async function moveQuestion(questionId, direction) {
  const idx = questions.findIndex((q) => q.id === questionId);
  const swapIdx = idx + direction;
  if (swapIdx < 0 || swapIdx >= questions.length) return;

  const a = questions[idx];
  const b = questions[swapIdx];

  // Swap seguro: (section_id, order_index) tiene restricción única,
  // así que pasamos por un valor temporal para no chocar con la
  // restricción a mitad de la operación.
  await supabase.from('documentation_questions').update({ order_index: -1 }).eq('id', a.id);
  await supabase.from('documentation_questions').update({ order_index: a.order_index }).eq('id', b.id);
  await supabase.from('documentation_questions').update({ order_index: b.order_index }).eq('id', a.id);

  await loadQuestions(selectedSectionId);
}

init();

// =====================================================================
// LillyTech Solution Portfolio Manager — Alta/edición de solución
// Cubre únicamente la Sección 1 (información general) del documento de
// requerimientos. El formulario documental completo por secciones es
// la Etapa 4.
// =====================================================================

import { supabase } from './supabase-client.js';
import { requireSession, getCurrentProfile, canEdit } from './auth.js';
import { logActivity } from './activity-log.js';
import { DEV_STATUS, DOC_STATUS } from './constants.js';

const FIELDS = [
  'name', 'short_name', 'short_description', 'category', 'current_version',
  'main_area', 'additional_areas', 'responsible_person', 'general_notes',
];

let solutionId = null;
let profile = null;
let originalSolution = null;

async function init() {
  const session = await requireSession();
  if (!session) return;

  profile = await getCurrentProfile();
  if (!profile) return;

  document.getElementById('user-email').textContent = profile.email;
  document.getElementById('user-role').textContent = profile.role;

  const params = new URLSearchParams(window.location.search);
  solutionId = params.get('id');

  populateStatusSelects();
  await loadCategorySuggestions();

  const editable = canEdit(profile);

  if (!solutionId && !editable) {
    // Un viewer no puede crear soluciones nuevas; si llega aquí por
    // URL directa, lo devolvemos al panel en vez de mostrar un
    // formulario que no puede usar.
    window.location.href = 'dashboard.html';
    return;
  }

  if (solutionId) {
    await loadSolution(solutionId);
    document.getElementById('page-title').textContent = 'Editar solución — LillyTech Solution Portfolio Manager';
    document.getElementById('form-heading').textContent = 'Editar información general';
  }

  if (!editable) {
    setFormReadOnly();
  }

  document.getElementById('solution-form').addEventListener('submit', handleSubmit);
}

function populateStatusSelects() {
  const devSelect = document.getElementById('dev_status');
  DEV_STATUS.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.value;
    opt.textContent = s.label;
    devSelect.appendChild(opt);
  });
  devSelect.value = 'idea';

  const docSelect = document.getElementById('doc_status');
  DOC_STATUS.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.value;
    opt.textContent = s.label;
    docSelect.appendChild(opt);
  });
  docSelect.value = 'sin_iniciar';
}

async function loadCategorySuggestions() {
  const { data, error } = await supabase.from('solutions').select('category, main_area');
  if (error || !data) return;

  const categories = [...new Set(data.map((s) => s.category).filter(Boolean))];
  const areas = [...new Set(data.map((s) => s.main_area).filter(Boolean))];

  const categoryList = document.getElementById('category-suggestions');
  categories.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c;
    categoryList.appendChild(opt);
  });

  const areaList = document.getElementById('area-suggestions');
  areas.forEach((a) => {
    const opt = document.createElement('option');
    opt.value = a;
    areaList.appendChild(opt);
  });
}

async function loadSolution(id) {
  const { data, error } = await supabase.from('solutions').select('*').eq('id', id).single();

  if (error || !data) {
    console.error('Error cargando solución:', error);
    showError('No se pudo cargar la solución solicitada. Es posible que ya no exista.');
    document.getElementById('solution-form').classList.add('hidden');
    return;
  }

  originalSolution = data;

  FIELDS.forEach((field) => {
    const el = document.getElementById(field);
    if (el) el.value = data[field] || '';
  });
  document.getElementById('dev_status').value = data.dev_status;
  document.getElementById('doc_status').value = data.doc_status;
}

function setFormReadOnly() {
  document.getElementById('readonly-notice').classList.remove('hidden');
  document.querySelectorAll('#solution-form input, #solution-form select, #solution-form textarea')
    .forEach((el) => { el.disabled = true; });
  document.getElementById('submit-btn').classList.add('hidden');
}

function showError(message) {
  const box = document.getElementById('form-error');
  box.textContent = message;
  box.classList.remove('hidden');
  document.getElementById('form-success').classList.add('hidden');
}

function showSuccess(message) {
  const box = document.getElementById('form-success');
  box.textContent = message;
  box.classList.remove('hidden');
  document.getElementById('form-error').classList.add('hidden');
}

async function handleSubmit(event) {
  event.preventDefault();
  document.getElementById('form-error').classList.add('hidden');
  document.getElementById('form-success').classList.add('hidden');

  const name = document.getElementById('name').value.trim();
  if (!name) {
    showError('El nombre oficial de la solución es obligatorio.');
    return;
  }

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Guardando…';

  const payload = {
    name,
    short_name: getValue('short_name'),
    short_description: getValue('short_description'),
    category: getValue('category'),
    current_version: getValue('current_version'),
    dev_status: document.getElementById('dev_status').value,
    doc_status: document.getElementById('doc_status').value,
    main_area: getValue('main_area'),
    additional_areas: getValue('additional_areas'),
    responsible_person: getValue('responsible_person'),
    general_notes: getValue('general_notes'),
  };

  let error;
  let savedId = solutionId;

  if (solutionId) {
    ({ error } = await supabase.from('solutions').update(payload).eq('id', solutionId));
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    const insertPayload = { ...payload, created_by: user ? user.id : null };
    const { data, error: insertError } = await supabase.from('solutions').insert(insertPayload).select('id').single();
    error = insertError;
    if (data) savedId = data.id;
  }

  if (error) {
    console.error('Error guardando solución:', error);
    showError('No se pudo guardar la información. Revisa los datos e intenta de nuevo.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Guardar información general';
    return;
  }

  await logActivity({
    solutionId: savedId,
    entityType: 'solution',
    entityId: savedId,
    actionType: solutionId ? 'updated' : 'created',
    description: solutionId ? `Información general actualizada: ${name}` : `Solución creada: ${name}`,
  });

  showSuccess('Información guardada correctamente. Volviendo al panel…');
  setTimeout(() => { window.location.href = 'dashboard.html'; }, 900);
}

function getValue(id) {
  const el = document.getElementById(id);
  const value = el.value.trim();
  return value.length > 0 ? value : null;
}

init();

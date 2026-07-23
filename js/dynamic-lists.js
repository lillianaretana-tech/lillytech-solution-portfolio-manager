// =====================================================================
// LillyTech Solution Portfolio Manager — Listas dinámicas
// Renderizador genérico reutilizado por las 6 entidades de lista
// (solution_features, solution_roles, solution_reports,
// solution_metrics, solution_use_cases, solution_integrations).
// La configuración de cada una vive en js/constants.js
// (DYNAMIC_LIST_CONFIGS); este módulo solo sabe cómo dibujar un CRUD
// genérico a partir de esa configuración.
// =====================================================================

import { supabase } from './supabase-client.js';
import { logActivity } from './activity-log.js';
import { escapeHtml } from './constants.js';

/**
 * Dibuja (y deja interactiva) una lista dinámica dentro de `container`.
 * @param {HTMLElement} container
 * @param {Object} config - una entrada de DYNAMIC_LIST_CONFIGS
 * @param {string} solutionId
 * @param {boolean} editable
 */
export async function renderDynamicList(container, config, solutionId, editable) {
  const state = { items: [], editingId: null, adding: false };

  async function loadItems() {
    let query = supabase.from(config.table).select('*').eq('solution_id', solutionId);
    if (config.orderField) {
      query = query.order(config.orderField, { ascending: true });
    } else {
      query = query.order('created_at', { ascending: true });
    }
    const { data, error } = await query;
    if (error) {
      console.error(`Error cargando ${config.table}:`, error);
      state.items = [];
      return;
    }
    state.items = data || [];
  }

  function fieldValueLabel(field, value) {
    if (field.type === 'select') {
      const opt = field.options.find((o) => o.value === value);
      return opt ? opt.label : value;
    }
    return value;
  }

  function renderBadgeIfStatus(item) {
    const statusField = config.fields.find((f) => f.key === 'status');
    if (!statusField) return '';
    const opt = statusField.options.find((o) => o.value === item.status);
    if (!opt) return '';
    return `<span class="badge badge-${opt.tone}">${escapeHtml(opt.label)}</span>`;
  }

  function metaLine(item) {
    const skip = new Set([config.titleField, 'status', 'id', 'solution_id', 'created_at', 'updated_at', 'created_by', config.orderField]);
    const parts = config.fields
      .filter((f) => !skip.has(f.key) && f.type !== 'textarea' && item[f.key])
      .map((f) => `${f.label}: ${escapeHtml(fieldValueLabel(f, item[f.key]))}`);
    return parts.slice(0, 2).join(' · ');
  }

  function render() {
    const itemsHtml = state.items.length === 0
      ? `<p class="empty-list-note">Todavía no hay ${config.label.toLowerCase()} registradas.</p>`
      : state.items.map((item) => `
          <div class="dynamic-list-row" data-item-id="${item.id}">
            <div class="dynamic-list-row-main">
              <div class="dynamic-list-row-title">${escapeHtml(item[config.titleField]) || '(sin nombre)'} ${renderBadgeIfStatus(item)}</div>
              ${metaLine(item) ? `<div class="dynamic-list-row-meta">${metaLine(item)}</div>` : ''}
            </div>
            ${editable ? `
              <div class="dynamic-list-row-actions">
                <button type="button" class="btn btn-ghost btn-sm" data-action="edit" data-id="${item.id}">Editar</button>
                <button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${item.id}">Eliminar</button>
              </div>` : ''}
          </div>
        `).join('');

    const showForm = editable && (state.adding || state.editingId);
    const editingItem = state.editingId ? state.items.find((i) => i.id === state.editingId) : null;

    container.innerHTML = `
      <div class="dynamic-list-header">
        <strong style="font-size:13.5px;">${escapeHtml(config.label)}</strong>
        ${editable && !showForm ? `<button type="button" class="btn btn-ghost btn-sm" data-action="add">${escapeHtml(config.addLabel)}</button>` : ''}
      </div>
      <div class="dynamic-list-items">${itemsHtml}</div>
      <div class="inline-form-slot"></div>
    `;

    if (showForm) {
      renderForm(editingItem);
    }

    if (editable) {
      container.querySelector('[data-action="add"]')?.addEventListener('click', () => {
        state.adding = true;
        state.editingId = null;
        render();
      });
      container.querySelectorAll('[data-action="edit"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.editingId = btn.getAttribute('data-id');
          state.adding = false;
          render();
        });
      });
      container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
        btn.addEventListener('click', () => handleDelete(btn.getAttribute('data-id')));
      });
    }
  }

  function renderForm(editingItem) {
    const slot = container.querySelector('.inline-form-slot');
    const fieldsHtml = config.fields.map((f) => {
      const value = editingItem ? (editingItem[f.key] ?? '') : (f.default ?? '');
      const idAttr = `dyn-field-${f.key}`;
      if (f.type === 'textarea') {
        return `
          <div class="field-group">
            <label for="${idAttr}">${escapeHtml(f.label)}${f.required ? ' <span class="question-required">*</span>' : ''}</label>
            <textarea class="input" id="${idAttr}" data-field="${f.key}">${escapeHtml(value)}</textarea>
          </div>`;
      }
      if (f.type === 'select') {
        const options = f.options.map((o) => `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('');
        return `
          <div class="field-group">
            <label for="${idAttr}">${escapeHtml(f.label)}</label>
            <select class="select" id="${idAttr}" data-field="${f.key}">${options}</select>
          </div>`;
      }
      const type = f.type === 'number' ? 'number' : 'text';
      return `
        <div class="field-group">
          <label for="${idAttr}">${escapeHtml(f.label)}${f.required ? ' <span class="question-required">*</span>' : ''}</label>
          <input class="input" type="${type}" id="${idAttr}" data-field="${f.key}" value="${escapeHtml(value)}" placeholder="${escapeHtml(f.placeholder || '')}" />
        </div>`;
    }).join('');

    slot.innerHTML = `
      <div class="inline-form">
        <div class="inline-form-title">${editingItem ? 'Editar' : 'Nuevo'} — ${escapeHtml(config.label).replace(/s$/, '')}</div>
        <div id="dyn-form-error" class="form-error hidden"></div>
        ${fieldsHtml}
        <div class="form-actions" style="margin-top:8px;padding-top:0;border-top:none;">
          <button type="button" class="btn btn-ghost btn-sm" data-action="cancel">Cancelar</button>
          <button type="button" class="btn btn-primary btn-sm" data-action="save">Guardar</button>
        </div>
      </div>
    `;

    slot.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      state.adding = false;
      state.editingId = null;
      render();
    });

    slot.querySelector('[data-action="save"]').addEventListener('click', () => handleSave(editingItem));
  }

  async function handleSave(editingItem) {
    const slot = container.querySelector('.inline-form-slot');
    const payload = {};
    let missingRequired = false;

    config.fields.forEach((f) => {
      const el = slot.querySelector(`[data-field="${f.key}"]`);
      let value = el.value;
      if (f.type === 'number') {
        value = value === '' ? null : Number(value);
      } else {
        value = value.trim() === '' ? null : value.trim();
      }
      if (f.required && !value) missingRequired = true;
      payload[f.key] = value;
    });

    if (missingRequired) {
      const errBox = slot.querySelector('#dyn-form-error');
      errBox.textContent = 'Completa los campos obligatorios antes de guardar.';
      errBox.classList.remove('hidden');
      return;
    }

    let error;
    let savedId = editingItem ? editingItem.id : null;

    if (editingItem) {
      ({ error } = await supabase.from(config.table).update(payload).eq('id', editingItem.id));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error: insertError } = await supabase
        .from(config.table)
        .insert({ ...payload, solution_id: solutionId, created_by: user ? user.id : null })
        .select('id')
        .single();
      error = insertError;
      if (data) savedId = data.id;
    }

    if (error) {
      console.error(`Error guardando ${config.table}:`, error);
      const errBox = slot.querySelector('#dyn-form-error');
      errBox.textContent = 'No se pudo guardar. Intenta de nuevo.';
      errBox.classList.remove('hidden');
      return;
    }

    await logActivity({
      solutionId,
      entityType: config.sectionCode,
      entityId: savedId,
      actionType: editingItem ? 'updated' : 'created',
      description: `${config.label}: ${payload[config.titleField] || savedId}`,
    });

    state.adding = false;
    state.editingId = null;
    await loadItems();
    render();
  }

  async function handleDelete(itemId) {
    const item = state.items.find((i) => i.id === itemId);
    const label = item ? item[config.titleField] : '';
    const confirmed = window.confirm(`¿Eliminar "${label}"? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    const { error } = await supabase.from(config.table).delete().eq('id', itemId);
    if (error) {
      console.error(`Error eliminando de ${config.table}:`, error);
      alert('No se pudo eliminar. Intenta de nuevo.');
      return;
    }

    await logActivity({
      solutionId,
      entityType: config.sectionCode,
      entityId: itemId,
      actionType: 'deleted',
      description: `${config.label} eliminada: ${label}`,
    });

    await loadItems();
    render();
  }

  await loadItems();
  render();
}

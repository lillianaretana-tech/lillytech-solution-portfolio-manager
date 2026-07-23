// =====================================================================
// LillyTech Solution Portfolio Manager — Constantes compartidas
// Estados de desarrollo/documental tal como se definieron en el
// documento de requerimientos (sección 4). Un solo lugar para
// etiquetas y "tono" visual, reutilizado por dashboard y formularios.
// =====================================================================

export const DEV_STATUS = [
  { value: 'idea', label: 'Idea', tone: 'slate' },
  { value: 'definicion', label: 'Definición', tone: 'slate' },
  { value: 'desarrollo', label: 'Desarrollo', tone: 'brass' },
  { value: 'pruebas', label: 'Pruebas', tone: 'rust' },
  { value: 'produccion', label: 'Producción', tone: 'sage' },
  { value: 'mejora_continua', label: 'Mejora continua', tone: 'sage' },
  { value: 'inactiva', label: 'Inactiva', tone: 'slate' },
];

export const DOC_STATUS = [
  { value: 'sin_iniciar', label: 'Sin iniciar', tone: 'slate' },
  { value: 'en_proceso', label: 'En proceso', tone: 'brass' },
  { value: 'lista_para_revision', label: 'Lista para revisión', tone: 'rust' },
  { value: 'revisada', label: 'Revisada', tone: 'brass' },
  { value: 'completa', label: 'Completa', tone: 'sage' },
  { value: 'archivada', label: 'Archivada', tone: 'slate' },
];

export function findStatus(list, value) {
  return list.find((s) => s.value === value) || { value, label: value, tone: 'slate' };
}

export function badgeHtml(list, value) {
  const status = findStatus(list, value);
  return `<span class="badge badge-${status.tone}">${status.label}</span>`;
}

export function formatDate(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleDateString('es-CR', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleString('es-CR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ---------------------------------------------------------------------
// Etapa 4 — tipos de respuesta del catálogo maestro
// ---------------------------------------------------------------------
export const ANSWER_TYPES = [
  { value: 'text_short', label: 'Texto corto' },
  { value: 'text_long', label: 'Texto largo' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Fecha' },
  { value: 'boolean', label: 'Sí / No' },
  { value: 'select', label: 'Selección (opciones)' },
  { value: 'dynamic_list_ref', label: 'Referencia a lista dinámica' },
];

// ---------------------------------------------------------------------
// Etapa 4 — configuración de las 6 listas dinámicas
// Un solo lugar que describe tabla, campos y etiquetas; lo consume
// js/dynamic-lists.js para renderizar el CRUD genérico y
// js/solution-form.js para saber en qué sección va cada una.
// ---------------------------------------------------------------------
export const FEATURE_STATUS = [
  { value: 'implementada', label: 'Implementada', tone: 'sage' },
  { value: 'en_pruebas', label: 'En pruebas', tone: 'brass' },
  { value: 'en_desarrollo', label: 'En desarrollo', tone: 'brass' },
  { value: 'planificada', label: 'Planificada', tone: 'slate' },
  { value: 'descartada', label: 'Descartada', tone: 'rust' },
];

export const INTEGRATION_STATUS = [
  { value: 'implementada', label: 'Implementada', tone: 'sage' },
  { value: 'planificada', label: 'Planificada', tone: 'slate' },
  { value: 'no_aplica', label: 'No aplica', tone: 'slate' },
];

export const DYNAMIC_LIST_CONFIGS = {
  features: {
    table: 'solution_features',
    sectionCode: 'features',
    titleField: 'name',
    label: 'Funcionalidades',
    addLabel: '+ Agregar funcionalidad',
    orderField: 'order_index',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'status', label: 'Estado', type: 'select', options: FEATURE_STATUS, default: 'planificada' },
      { key: 'order_index', label: 'Orden', type: 'number', default: 0 },
      { key: 'notes', label: 'Observaciones', type: 'textarea' },
    ],
  },
  roles: {
    table: 'solution_roles',
    sectionCode: 'users_roles',
    titleField: 'role_name',
    label: 'Roles',
    addLabel: '+ Agregar rol',
    fields: [
      { key: 'role_name', label: 'Nombre del rol', type: 'text', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'responsibilities', label: 'Responsabilidades', type: 'textarea' },
      { key: 'access_level', label: 'Nivel de acceso', type: 'text' },
      { key: 'notes', label: 'Observaciones', type: 'textarea' },
    ],
  },
  reports: {
    table: 'solution_reports',
    sectionCode: 'reports_evidence',
    titleField: 'name',
    label: 'Reportes',
    addLabel: '+ Agregar reporte',
    fields: [
      { key: 'name', label: 'Nombre', type: 'text', required: true },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'format', label: 'Formato', type: 'text', placeholder: 'PDF, Excel, impreso…' },
      { key: 'authorized_users', label: 'Usuarios autorizados', type: 'text' },
      { key: 'frequency', label: 'Frecuencia', type: 'text', placeholder: 'Diaria, semanal, mensual…' },
      { key: 'notes', label: 'Observaciones', type: 'textarea' },
    ],
  },
  metrics: {
    table: 'solution_metrics',
    sectionCode: 'measurable_impact',
    titleField: 'metric_name',
    label: 'Métricas',
    addLabel: '+ Agregar métrica',
    fields: [
      { key: 'metric_name', label: 'Nombre de la métrica', type: 'text', required: true },
      { key: 'previous_value', label: 'Valor anterior', type: 'text' },
      { key: 'current_value', label: 'Valor actual', type: 'text' },
      { key: 'unit', label: 'Unidad', type: 'text' },
      { key: 'source', label: 'Fuente', type: 'text' },
      { key: 'notes', label: 'Observaciones', type: 'textarea' },
    ],
  },
  use_cases: {
    table: 'solution_use_cases',
    sectionCode: 'use_cases',
    titleField: 'name',
    label: 'Casos de uso',
    addLabel: '+ Agregar caso de uso',
    orderField: 'order_index',
    fields: [
      { key: 'name', label: 'Nombre del caso', type: 'text', required: true },
      { key: 'situation', label: 'Situación', type: 'textarea' },
      { key: 'involved_user', label: 'Usuario involucrado', type: 'text' },
      { key: 'problem', label: 'Problema', type: 'textarea' },
      { key: 'action_taken', label: 'Acción realizada', type: 'textarea' },
      { key: 'result', label: 'Resultado', type: 'textarea' },
      { key: 'benefit', label: 'Beneficio', type: 'textarea' },
    ],
  },
  integrations: {
    table: 'solution_integrations',
    sectionCode: 'integrations',
    titleField: 'system_name',
    label: 'Integraciones',
    addLabel: '+ Agregar integración',
    fields: [
      { key: 'system_name', label: 'Sistema', type: 'text', required: true },
      { key: 'integration_type', label: 'Tipo', type: 'text' },
      { key: 'status', label: 'Estado', type: 'select', options: INTEGRATION_STATUS, default: 'planificada' },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'notes', label: 'Observaciones', type: 'textarea' },
    ],
  },
};

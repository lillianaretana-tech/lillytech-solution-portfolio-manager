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

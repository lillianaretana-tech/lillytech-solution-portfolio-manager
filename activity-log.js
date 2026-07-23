// =====================================================================
// LillyTech Solution Portfolio Manager — Registro de actividad
// Helper único para insertar en solution_activity_log desde cualquier
// pantalla. Trazabilidad básica, sin sobreingeniería (sección 13 del
// documento de requerimientos).
// =====================================================================

import { supabase } from './supabase-client.js';

/**
 * Registra una acción relevante.
 * @param {Object} params
 * @param {string|null} params.solutionId - uuid de la solución (o null para acciones no ligadas a una solución específica)
 * @param {string} params.entityType - 'solution' | 'answer' | 'feature' | 'catalog_question' | 'catalog_section' | ...
 * @param {string|null} params.entityId - uuid de la entidad afectada, si aplica
 * @param {string} params.actionType - 'created' | 'updated' | 'archived' | 'restored' | 'report_generated' | 'exported' | ...
 * @param {string} params.description - texto breve legible para humanos
 */
export async function logActivity({ solutionId = null, entityType, entityId = null, actionType, description }) {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from('solution_activity_log').insert({
    solution_id: solutionId,
    entity_type: entityType,
    entity_id: entityId,
    action_type: actionType,
    description,
    created_by: user ? user.id : null,
  });

  if (error) {
    // No bloqueamos la acción principal por un fallo de logging,
    // pero sí lo dejamos visible en consola para depuración.
    console.error('No se pudo registrar la actividad:', error);
  }
}

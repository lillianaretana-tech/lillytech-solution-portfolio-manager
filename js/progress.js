// =====================================================================
// LillyTech Solution Portfolio Manager — Cálculo de progreso
// Implementa la sección 7 del documento de requerimientos: el avance
// se calcula SIEMPRE contra el catálogo maestro vigente (preguntas
// activas), nunca contra una copia fija. Por diseño, si se agrega una
// pregunta nueva al catálogo, el avance de soluciones ya documentadas
// puede bajar — eso es correcto, no un error.
//
// Regla de "completa" usada en esta primera versión:
//   - Pregunta con respuesta de texto no vacía, y NO marcada como
//     "pendiente de confirmar"  -> completa
//   - Pregunta marcada "No aplica", y NO marcada como
//     "pendiente de confirmar"  -> completa
//   - Cualquier otro caso (vacía, o marcada "pendiente de confirmar")
//     -> pendiente
// Esta clasificación es deliberadamente conservadora: una respuesta
// "pendiente de confirmar" no cuenta como completa todavía, para que
// el % de avance no dé una falsa sensación de documentación cerrada.
// =====================================================================

import { supabase } from './supabase-client.js';

/**
 * Calcula el progreso de una lista de soluciones en una sola consulta
 * por tabla (evita N+1). Devuelve un mapa { [solutionId]: {percent, answered, pending, notApplicable, pendingConfirm, total} }.
 */
export async function getProgressForSolutions(solutionIds) {
  const result = {};
  for (const id of solutionIds) {
    result[id] = { percent: 0, answered: 0, notApplicable: 0, pendingConfirm: 0, pending: 0, total: 0 };
  }
  if (solutionIds.length === 0) return result;

  const { count: totalActiveQuestions, error: qError } = await supabase
    .from('documentation_questions')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  if (qError) {
    console.error('Error obteniendo total de preguntas activas:', qError);
    return result;
  }

  const total = totalActiveQuestions || 0;
  for (const id of solutionIds) {
    result[id].total = total;
    result[id].pending = total;
  }
  if (total === 0) return result;

  // Traemos únicamente las respuestas que correspondan a preguntas
  // activas, para las soluciones solicitadas.
  const { data: answers, error: aError } = await supabase
    .from('solution_answers')
    .select('solution_id, answer_text, is_not_applicable, confirmation_pending, documentation_questions!inner(is_active)')
    .in('solution_id', solutionIds)
    .eq('documentation_questions.is_active', true);

  if (aError) {
    console.error('Error obteniendo respuestas:', aError);
    return result;
  }

  for (const row of answers) {
    const bucket = result[row.solution_id];
    if (!bucket) continue;

    const hasText = typeof row.answer_text === 'string' && row.answer_text.trim().length > 0;
    const isComplete = (hasText || row.is_not_applicable) && !row.confirmation_pending;

    if (row.confirmation_pending) {
      bucket.pendingConfirm += 1;
    } else if (row.is_not_applicable) {
      bucket.notApplicable += 1;
    } else if (hasText) {
      bucket.answered += 1;
    }

    if (isComplete) {
      bucket.pending -= 1;
    }
  }

  for (const id of solutionIds) {
    const bucket = result[id];
    const completed = bucket.total - bucket.pending;
    bucket.percent = bucket.total > 0 ? Math.round((completed / bucket.total) * 100) : 0;
  }

  return result;
}

export async function getProgressForSolution(solutionId) {
  const map = await getProgressForSolutions([solutionId]);
  return map[solutionId];
}

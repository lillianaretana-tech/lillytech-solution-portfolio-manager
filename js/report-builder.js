// =====================================================================
// LillyTech Solution Portfolio Manager — Constructor de reportes
// Un solo lugar que sabe cómo traer TODOS los datos de una solución
// (secciones + preguntas + respuestas + las 6 listas dinámicas) y
// convertirlos a los tres formatos que pide el documento original:
// vista HTML imprimible, JSON estructurado y Markdown para pegar en
// ChatGPT. Lo usan tanto report.html (individual) como
// consolidated-report.html (varias soluciones).
// =====================================================================

import { supabase } from './supabase-client.js';
import { escapeHtml, DYNAMIC_LIST_CONFIGS, DEV_STATUS, DOC_STATUS, findStatus, formatDate, formatDateTime } from './constants.js';

const LIST_KEYS = ['features', 'roles', 'reports', 'metrics', 'use_cases', 'integrations'];

/**
 * Trae y arma todos los datos de una solución para reporte/exportación.
 */
export async function loadSolutionReportData(solutionId) {
  const [
    { data: solution, error: solutionError },
    { data: sectionsRaw, error: sectionsError },
    { data: questionsRaw, error: questionsError },
    { data: answersRaw, error: answersError },
    ...listResults
  ] = await Promise.all([
    supabase.from('solutions').select('*').eq('id', solutionId).single(),
    supabase.from('documentation_sections').select('*').eq('is_active', true).order('order_index'),
    supabase.from('documentation_questions').select('*').eq('is_active', true).order('order_index'),
    supabase.from('solution_answers').select('*').eq('solution_id', solutionId),
    ...LIST_KEYS.map((key) => supabase.from(DYNAMIC_LIST_CONFIGS[key].table).select('*').eq('solution_id', solutionId)),
  ]);

  if (solutionError || !solution) {
    throw new Error('No se pudo cargar la solución solicitada.');
  }
  if (sectionsError || questionsError || answersError) {
    throw new Error('No se pudo cargar el catálogo documental.');
  }

  const answersByQuestion = {};
  (answersRaw || []).forEach((a) => { answersByQuestion[a.question_id] = a; });

  const questionsBySection = {};
  (questionsRaw || []).forEach((q) => {
    if (!questionsBySection[q.section_id]) questionsBySection[q.section_id] = [];
    questionsBySection[q.section_id].push(q);
  });

  const lists = {};
  LIST_KEYS.forEach((key, idx) => {
    const { data, error } = listResults[idx];
    lists[key] = error ? [] : (data || []);
  });

  let totalQuestions = 0;
  let completedQuestions = 0;

  const sections = (sectionsRaw || []).map((section) => {
    const questions = (questionsBySection[section.id] || []).map((q) => {
      const answer = answersByQuestion[q.id] || null;
      const hasText = !!(answer && typeof answer.answer_text === 'string' && answer.answer_text.trim().length > 0);
      const isNotApplicable = !!(answer && answer.is_not_applicable);
      const isPending = !!(answer && answer.confirmation_pending);
      const isComplete = (hasText || isNotApplicable) && !isPending;

      totalQuestions += 1;
      if (isComplete) completedQuestions += 1;

      return {
        text: q.question_text,
        help: q.help_text,
        answerType: q.answer_type,
        isRequired: q.is_required,
        allowNotApplicable: q.allow_not_applicable,
        answerText: hasText ? answer.answer_text.trim() : '',
        isNotApplicable,
        confirmationPending: isPending,
        isComplete,
        updatedAt: answer ? answer.updated_at : null,
      };
    });

    const sectionTotal = questions.length;
    const sectionCompleted = questions.filter((q) => q.isComplete).length;

    return {
      code: section.code,
      name: section.name,
      description: section.description,
      orderIndex: section.order_index,
      total: sectionTotal,
      completed: sectionCompleted,
      percent: sectionTotal > 0 ? Math.round((sectionCompleted / sectionTotal) * 100) : 0,
      questions,
      listConfigKey: Object.keys(DYNAMIC_LIST_CONFIGS).find((key) => DYNAMIC_LIST_CONFIGS[key].sectionCode === section.code) || null,
    };
  });

  return {
    solution,
    generatedAt: new Date().toISOString(),
    overallTotal: totalQuestions,
    overallCompleted: completedQuestions,
    overallPercent: totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0,
    sections,
    lists,
  };
}

// ---------------------------------------------------------------------
// JSON estructurado (sección 10 del documento original)
// ---------------------------------------------------------------------
export function buildJsonObject(data) {
  const { solution } = data;
  return {
    ecosystem: 'LillyTech',
    generated_at: data.generatedAt,
    solution: {
      id: solution.id,
      name: solution.name,
      short_name: solution.short_name,
      short_description: solution.short_description,
      category: solution.category,
      current_version: solution.current_version,
      dev_status: solution.dev_status,
      doc_status: solution.doc_status,
      main_area: solution.main_area,
      additional_areas: solution.additional_areas,
      responsible_person: solution.responsible_person,
      general_notes: solution.general_notes,
      created_at: solution.created_at,
      updated_at: solution.updated_at,
    },
    progress: {
      total_questions: data.overallTotal,
      completed_questions: data.overallCompleted,
      percent: data.overallPercent,
    },
    sections: data.sections.map((s) => ({
      name: s.name,
      description: s.description,
      progress: { total: s.total, completed: s.completed, percent: s.percent },
      questions: s.questions.map((q) => ({
        question: q.text,
        answer: q.isNotApplicable ? 'No aplica' : (q.answerText || null),
        pending_confirmation: q.confirmationPending,
        required: q.isRequired,
      })),
    })),
    features: data.lists.features,
    roles: data.lists.roles,
    reports: data.lists.reports,
    metrics: data.lists.metrics,
    use_cases: data.lists.use_cases,
    integrations: data.lists.integrations,
  };
}

// ---------------------------------------------------------------------
// Markdown (para pegar directo en ChatGPT — sin identificadores técnicos)
// ---------------------------------------------------------------------
export function buildMarkdown(data) {
  const { solution } = data;
  const lines = [];

  lines.push(`# ${solution.name}`);
  if (solution.short_description) lines.push(`\n${solution.short_description}`);
  lines.push(`\n**Categoría:** ${solution.category || '—'} | **Versión:** ${solution.current_version || '—'} | **Estado de desarrollo:** ${findStatus(DEV_STATUS, solution.dev_status).label} | **Estado documental:** ${findStatus(DOC_STATUS, solution.doc_status).label}`);
  lines.push(`\n**Avance documental:** ${data.overallPercent}% (${data.overallCompleted} de ${data.overallTotal} preguntas)`);
  lines.push(`\n_Generado el ${formatDateTime(data.generatedAt)}_`);

  data.sections.forEach((section) => {
    lines.push(`\n## ${section.name}`);
    if (section.description) lines.push(`\n${section.description}`);

    section.questions.forEach((q) => {
      let answerLine = q.isNotApplicable ? 'No aplica' : (q.answerText || '(sin responder)');
      if (q.confirmationPending) answerLine += ' _(pendiente de confirmar)_';
      lines.push(`\n**Pregunta:** ${q.text}\n**Respuesta:** ${answerLine}`);
    });

    if (section.listConfigKey) {
      const config = DYNAMIC_LIST_CONFIGS[section.listConfigKey];
      const items = data.lists[section.listConfigKey];
      if (items.length === 0) {
        lines.push(`\n_Sin ${config.label.toLowerCase()} registradas._`);
      } else {
        items.forEach((item) => {
          const title = item[config.titleField] || '(sin nombre)';
          const details = config.fields
            .filter((f) => f.key !== config.titleField && item[f.key])
            .map((f) => `${f.label}: ${item[f.key]}`)
            .join(' · ');
          lines.push(`\n- **${title}**${details ? ` — ${details}` : ''}`);
        });
      }
    }
  });

  return lines.join('\n');
}

// ---------------------------------------------------------------------
// HTML imprimible (usado por report.html y consolidated-report.html)
// ---------------------------------------------------------------------
function renderListTable(configKey, items) {
  const config = DYNAMIC_LIST_CONFIGS[configKey];
  if (!items || items.length === 0) {
    return `<p class="empty-list-note">Sin ${config.label.toLowerCase()} registradas.</p>`;
  }
  const displayFields = config.fields.filter((f) => f.key !== config.titleField);
  return `
    <table class="solutions-table" style="margin-top:8px;">
      <thead><tr><th>${escapeHtml(config.label.replace(/s$/, ''))}</th>${displayFields.map((f) => `<th>${escapeHtml(f.label)}</th>`).join('')}</tr></thead>
      <tbody>
        ${items.map((item) => `
          <tr>
            <td><strong>${escapeHtml(item[config.titleField] || '—')}</strong></td>
            ${displayFields.map((f) => `<td>${escapeHtml(item[f.key] || '—')}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

export function renderSolutionReportHtml(data) {
  const { solution } = data;

  const header = `
    <div class="report-cover">
      <div class="report-eyebrow">Ecosistema LillyTech · Ficha documental</div>
      <h1>${escapeHtml(solution.name)}</h1>
      ${solution.short_description ? `<p class="report-desc">${escapeHtml(solution.short_description)}</p>` : ''}
      <div class="report-meta-row">
        <span><strong>Categoría:</strong> ${escapeHtml(solution.category) || '—'}</span>
        <span><strong>Versión:</strong> ${escapeHtml(solution.current_version) || '—'}</span>
        <span><strong>Estado de desarrollo:</strong> ${findStatus(DEV_STATUS, solution.dev_status).label}</span>
        <span><strong>Estado documental:</strong> ${findStatus(DOC_STATUS, solution.doc_status).label}</span>
      </div>
      <div class="report-meta-row">
        <span><strong>Avance documental:</strong> ${data.overallPercent}% (${data.overallCompleted}/${data.overallTotal} preguntas)</span>
        <span><strong>Generado el:</strong> ${formatDateTime(data.generatedAt)}</span>
      </div>
    </div>
  `;

  const sectionsHtml = data.sections.map((section) => {
    const questionsHtml = section.questions.map((q) => {
      let answer = q.isNotApplicable ? 'No aplica' : (q.answerText || '<span class="text-muted">(sin responder)</span>');
      if (q.confirmationPending) answer += ' <span class="badge badge-rust">pendiente de confirmar</span>';
      return `
        <div class="question-block">
          <div class="question-label">${escapeHtml(q.text)}</div>
          <div>${q.isNotApplicable || !q.answerText ? answer : escapeHtml(q.answerText).replace(/\n/g, '<br/>')}</div>
        </div>
      `;
    }).join('');

    const listHtml = section.listConfigKey ? renderListTable(section.listConfigKey, data.lists[section.listConfigKey]) : '';

    return `
      <section class="report-section">
        <h2>${escapeHtml(section.name)} <span class="mono text-muted" style="font-size:12px;">(${section.completed}/${section.total})</span></h2>
        ${section.description ? `<p class="section-panel-desc">${escapeHtml(section.description)}</p>` : ''}
        ${questionsHtml}
        ${listHtml}
      </section>
    `;
  }).join('');

  return header + sectionsHtml;
}

export function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function slugFilename(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'solucion';
}

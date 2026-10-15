import {stat, readFile} from 'node:fs/promises';
import path from 'node:path';
export const dimensions = [
  'Idea and device',
  'Hook (0–2 s)',
  'Copy and type',
  'Colour and brand',
  'Composition',
  'Motion',
  'Transitions',
  'Pacing',
  'Product truth',
  'Sound and sync',
  'Finish',
];
export async function validateReview(project, r) {
  const errors = [];
  if (!Number.isInteger(r.round) || r.round < 1 || r.round > 5)
    errors.push('Review round must be 1..5');
  if (['launch', 'walkthrough'].includes(r.format) && r.round < 2)
    errors.push('Launch films and walkthroughs require at least two rounds');
  for (const lens of ['director', 'forensics', 'sound-sync', 'art-copy-ui', 'verifier'])
    if (!r.lenses?.[lens]?.evidence?.length) errors.push(`Missing ${lens} evidence`);
  const silent = r.format === 'loop' && r.muted === true && r.scores?.['Sound and sync'] === 'N/A';
  const scores = dimensions
    .filter((d) => !silent || d !== 'Sound and sync')
    .map((d) => r.scores?.[d]);
  if (scores.some((s) => !Number.isInteger(s) || s < 3 || s > 5))
    errors.push('All 11 rubric dimensions need integer scores 3..5');
  if (r.scores?.Finish !== 5 || (!silent && r.scores?.['Sound and sync'] !== 5))
    errors.push('Finish and Sound and sync must be 5');
  if (scores.reduce((a, b) => a + (b || 0), 0) / scores.length < 4.2)
    errors.push('Mean rubric score must be at least 4.2');
  if (
    !Array.isArray(r.issues) ||
    r.issues.some((i) => i.priority === 'P0' && i.status !== 'closed')
  )
    errors.push('Open P0 or missing issue ledger');
  if (!Array.isArray(r.gates) || !r.gates.length || r.gates.some((g) => g.pass !== true))
    errors.push('Actual technical gates must all pass');
  const evidence = [
    ...Object.values(r.lenses || {}).flatMap((l) => l.evidence || []),
    ...(r.gates || []).map((g) => g.report),
  ];
  for (const file of evidence)
    try {
      if (typeof file !== 'string' || !file) throw Error();
      const p = path.resolve(project, file);
      const rel = path.relative(project, p);
      if (rel.startsWith('..') || path.isAbsolute(rel) || (await stat(p)).size === 0) throw Error();
    } catch {
      errors.push(`Missing or invalid evidence: ${file}`);
    }
  for (const gate of r.gates || [])
    if (typeof gate.report === 'string' && gate.report.endsWith('.json'))
      try {
        const report = JSON.parse(await readFile(path.resolve(project, gate.report), 'utf8'));
        const passed =
          report.pass === true ||
          report.ok === true ||
          report.fails === 0 ||
          report.errorCount === 0;
        if (
          !passed ||
          report.pass === false ||
          report.ok === false ||
          report.fails > 0 ||
          report.errorCount > 0
        )
          errors.push(`Gate report does not confirm success: ${gate.report}`);
      } catch {
        errors.push(`Cannot read gate report: ${gate.report}`);
      }
  return {
    pass: errors.length === 0,
    errors,
    review: r,
    shipReady: errors.length === 0 && r.humanApproved === true,
  };
}

// Single source of truth for product stats — computed from the curriculum.
// Run: node scripts/stats.mjs   (used by the /api/summary endpoint and README).
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function computeStats() {
  const CURRICULUM = new Function(
    readFileSync(join(root, 'public/js/curriculum.js'), 'utf8').replace('const CURRICULUM', 'var __C') + '\n;return __C;'
  )();
  const IQ = new Function(
    readFileSync(join(root, 'public/js/interview-questions.js'), 'utf8').replace('const INTERVIEW_QUESTIONS', 'var __I') + '\n;return __I;'
  )();
  const mods = CURRICULUM.flatMap(p => p.modules);
  const secs = mods.flatMap(m => m.sections || []);
  return {
    phases: CURRICULUM.length,
    modules: mods.length,
    hours: mods.reduce((n, m) => n + (m.hours || 0), 0),
    sections: secs.length,
    codeSamples: secs.reduce((n, s) => n + (s.code || []).length, 0),
    flashcards: secs.reduce((n, s) => n + (s.flashcards || []).length, 0),
    interviewQuestions: Object.values(IQ).reduce((n, a) => n + a.length, 0),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(computeStats(), null, 2));

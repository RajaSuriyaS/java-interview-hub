import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3030;

// Execution provider: 'wandbox' (public, zero-infra, default) or 'piston' (self-hosted).
const PROVIDER = (process.env.EXEC_PROVIDER || 'wandbox').toLowerCase();
const PISTON_URL = process.env.PISTON_URL || 'http://localhost:2000';

app.use(cors());
app.use(express.json({ limit: '256kb' }));
app.use(express.static(join(__dirname, 'public'), { extensions: ['html'] }));

/* ---------- Wandbox provider (https://wandbox.org) ----------
   Free public API, no auth. Compiles the main file as prog.<ext>, so a
   top-level `public class X` must drop the `public` modifier to satisfy
   Java's "public class must match filename" rule — we rewrite it. */
const WANDBOX_COMPILER = {
  java: 'openjdk-jdk-21+35',
  python: 'cpython-3.13.8',
  javascript: 'nodejs-head',
};

function prepForWandbox(language, code) {
  if (language === 'java') {
    // Drop `public` only from the top-level class/interface/record/enum declarations.
    return code.replace(/^(\s*)public\s+(class|interface|enum|record|abstract\s+class|final\s+class)\b/gm, '$1$2');
  }
  return code;
}

async function runWandbox(language, code, stdin) {
  const compiler = WANDBOX_COMPILER[language];
  if (!compiler) {
    return { output: '', error: `-- ${language} is illustrative only (not executed) --` };
  }
  const res = await fetch('https://wandbox.org/api/compile.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: prepForWandbox(language, code), compiler, stdin: stdin || '' }),
  });
  if (!res.ok) throw new Error(`Wandbox HTTP ${res.status}`);
  const d = await res.json();
  const compileErr = d.compiler_error || '';
  const runOut = d.program_output || '';
  const runErr = d.program_error || '';
  return {
    output: runOut,
    error: [compileErr, runErr].filter(Boolean).join('\n'),
    exitCode: d.status,
  };
}

/* ---------- Piston provider (self-hosted) ---------- */
const PISTON_VERSION = { java: '15.0.2', python: '3.10.0', bash: '5.2.0', javascript: '18.15.0' };

async function runPiston(language, code, stdin) {
  const version = PISTON_VERSION[language];
  if (!version) return { output: '', error: `-- ${language} not supported --` };
  const res = await fetch(`${PISTON_URL}/api/v2/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, version, files: [{ content: code }], stdin: stdin || '' }),
  });
  if (!res.ok) throw new Error(`Piston HTTP ${res.status}`);
  const d = await res.json();
  const run = d.run || {};
  return { output: run.stdout || '', error: run.stderr || '', exitCode: run.code };
}

app.post('/api/execute', async (req, res) => {
  const { language, code, stdin = '' } = req.body || {};
  if (!language || typeof code !== 'string') {
    return res.status(400).json({ output: '', error: 'language and code are required' });
  }
  // SQL / bash are illustrative in the default (wandbox) provider.
  if (PROVIDER === 'wandbox' && !WANDBOX_COMPILER[language]) {
    return res.json({ output: '', error: `-- ${language} is shown for reference and is not executed here --` });
  }
  try {
    const result = PROVIDER === 'piston'
      ? await runPiston(language, code, stdin)
      : await runWandbox(language, code, stdin);
    res.json(result);
  } catch (err) {
    res.status(502).json({ output: '', error: `Execution failed: ${err.message}` });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', provider: PROVIDER }));

// SPA fallback
app.get('*', (_req, res) => res.sendFile(join(__dirname, 'public', 'index.html')));

app.listen(PORT, () =>
  console.log(`Java Interview Hub on http://localhost:${PORT} (exec provider: ${PROVIDER})`)
);

/** @type {import('tailwindcss').Config} */
export default {
  // Scan every place a Tailwind class can appear: the HTML shells and the
  // SPA renderer (app.js builds markup with template literals). The class
  // names inside those literals are always spelled out (ternaries choose
  // between full class names), so the JIT scanner picks them up.
  content: [
    './public/index.html',
    './public/pending.html',
    './public/js/**/*.js',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: { 950: '#0a0e1a' },
        brand: { DEFAULT: '#8b5cf6', dark: '#7c3aed' },
        success: '#10b981',
        warning: '#f59e0b',
        info: '#38bdf8',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  // A few utilities are only ever produced dynamically or via markdown-rendered
  // HTML the scanner can't see; keep them from being purged.
  safelist: [
    'text-success', 'bg-success', 'text-warning', 'bg-warning',
    'text-info', 'bg-info', 'text-brand', 'bg-brand', 'bg-brand-dark',
  ],
};

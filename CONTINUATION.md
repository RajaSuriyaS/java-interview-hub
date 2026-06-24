# Java Interview Hub — Continuation Guide

> Read this before touching `curriculum.js`. It tells you exactly what's done, what's pending, and the rules you must follow.

---

## What the app is

Node/Express SPA at port 3030. Single-page, client-side rendered.  
Key files: `public/js/curriculum.js` (all content), `public/js/app.js` (rendering engine), `server.js` (Express + Wandbox executor).  
Live at: `javazerotoall.duckdns.org` (auto-deploys from GitHub main via systemd timer on VPS).

---

## Current data model

Each module now supports **sections** for sub-navigation:

```javascript
{
  id: '1.1',
  title: 'JVM Architecture',
  hours: 4,
  sections: [
    {
      title: 'JVM Overview & Bytecode',      // shown in pill nav
      notes: `...markdown...`,               // Study Guide tab content
      code: [{ lang: 'java', title: '...', code: `...` }],  // Code Sandbox
      flashcards: [{ q: '...', a: '...' }]  // Flashcards tab
    },
    // 3-5 sections per module
  ]
}
```

When `sections` is present, `app.js` renders a **pill nav bar** above the tabs. Each pill switches the Study Guide / Code Sandbox / Flashcards to that section's content. My Notes stays module-level.

Old flat format (`notes`, `code[]`, `flashcards[]` directly on module) still works for unsectioned modules — `app.js` handles both.

---

## Progress by phase

| Phase | Modules | Status |
|---|---|---|
| 1 — JVM Internals | 1.1, 1.2, 1.3, 1.4 | ✅ 4 sections each (~400 words, 1-2 examples, 4-6 flashcards per section) |
| 2 — Modern Java | 2.1–2.5 | ⏳ Flat (needs sectioning + content expansion) |
| 3 — Spring Boot | 3.1–3.4 | ⏳ Flat (needs sectioning + content expansion) |
| 4 — Databases | 4.1–4.3 | ⏳ Thin content (needs both expansion and sectioning) |
| 5 — System Design | 5.1–5.3 | ⏳ Thin |
| 6 — Distributed/Kafka | 6.1–6.3 | ⏳ Thin |
| 7 — DevOps | 7.1–7.4 | ⏳ Thin |
| 8 — Camunda/BPM | 8.1–8.2 | ⏳ Thin |
| 9 — Linux | 9.1–9.3 | ⏳ Thin |
| 10 — Behavioral | 10.1–10.2 | ⏳ Thin |
| 11 — Architecture | 11.1–11.3 | ⏳ Thin |

---

## Rules for curriculum.js edits

### 1. Template literal safety (CRITICAL)
All `notes` strings are backtick template literals. Any unescaped `${...}` or bare backtick will break the entire file:
- `${DB_URL}` in notes → must be `\${DB_URL}`
- `` `127.0.0.1` `` in notes → must be `` \`127.0.0.1\` ``
- `` ```java ``` `` code fences in notes → must be `` \`\`\`java ... \`\`\` ``

### 2. Validate after every module edit
```bash
node --check public/js/curriculum.js
node -e "
  const fs=require('fs');
  const src=fs.readFileSync('public/js/curriculum.js','utf8').replace('const CURRICULUM','global.CURRICULUM');
  eval(src);
  const ids=CURRICULUM.flatMap(p=>p.modules.map(m=>m.id));
  const dupes=ids.filter((x,i)=>ids.indexOf(x)!==i);
  console.log('OK:', CURRICULUM.length, 'phases,', ids.length, 'modules', dupes.length?'DUPES:'+dupes:'no dupes');
"
```

### 3. Module IDs are stable
Never change existing module IDs (users store progress by ID in localStorage). Add new sections within existing modules.

### 4. Section structure requirements
- `title`: short (3-6 words), shown in the pill button
- `notes`: 300-500 words of focused markdown. Use `##` headings, bullet lists, callouts (`> [!TIP]`, `> [!WARNING]`, `> [!EU]`, `> [!SUCCESS]`)
- `code`: 1-2 runnable Java examples tightly focused on THIS section (not general)
- `flashcards`: 4-6 cards covering THIS section's key concepts

---

## Sectioning strategy per module

Split each large module at natural H2/H3 heading boundaries in the existing notes. Typical split:

**Phase 2 modules:**
- 2.1: "ArrayList vs LinkedList" | "HashMap Internals" | "TreeMap & LinkedHashMap" | "Concurrent Collections"
- 2.2: "Thread Lifecycle" | "ExecutorService & Pools" | "ReentrantLock & ReadWriteLock" | "CompletableFuture"
- 2.3: "Lambdas & Functional Interfaces" | "Stream Pipeline" | "Collectors" | "Parallel Streams"
- 2.4: "Virtual Threads: The Problem" | "Pinning & Detection" | "Structured Concurrency"
- 2.5: "Records" | "Sealed Classes" | "Pattern Matching & Switch"

**Phase 3 modules:**
- 3.1: "Why IoC?" | "Bean Lifecycle & Scopes" | "Auto-Configuration" | "@Conditional & Starters"
- 3.2: "What is a Transaction?" | "@Transactional Mechanics" | "Propagation Levels" | "Rollback & Self-Invocation Trap"
- 3.3: "JPA Entity Mapping" | "Repository Pattern" | "JPQL & Native Queries" | "N+1 & Fetch Strategies"
- 3.4: "Authentication vs Authorization" | "Filter Chain & SecurityContext" | "JWT & Stateless Auth" | "OAuth2 & Method Security"

**Phases 4-11:** Need content expansion AND sectioning simultaneously. Each section should have 300-500 word deep-dive notes (not summaries).

---

## How to continue on any machine

```bash
git clone https://github.com/RajaSuriyaS/java-interview-hub.git
cd java-interview-hub
npm install
npm start        # runs on localhost:3030
```

In Claude Code: open the repo folder, read this file, then proceed to the next pending phase.

---

## VPS deployment

Auto-deploys every 60s from GitHub via systemd timer. No manual action needed after push.  
First-time setup only: SSH to VPS, run `./deploy/redeploy.sh` to create the Docker container.  
Caddy (on SafeStrike VPS) reverse-proxies `javazerotoall.duckdns.org` → `jih-app:3030`.

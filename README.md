# ☕ Java Backend Interview Hub

A self-hosted, interactive **Senior Java Backend Engineer interview study hub** — built for European visa-sponsorship interview prep. Deep-dive notes, a **live online code compiler**, active-recall flashcards, and progress tracking that persists in your browser.

![tech](https://img.shields.io/badge/Java-21-orange) ![tech](https://img.shields.io/badge/Node-Express-green) ![tech](https://img.shields.io/badge/Tailwind-CDN-38bdf8) ![tech](https://img.shields.io/badge/Monaco-Editor-blueviolet)

---

## ✨ Features

- **10 phases · 33 modules · ~123 study hours** of structured, senior-level content.
- **Live code sandbox** — edit and **Run** Java, Python &amp; Bash on a real compiler (via the [Piston](https://github.com/engineer-man/piston) execution API, proxied by the backend). Powered by the **Monaco editor** (the VS Code engine).
- **Deep-dive study guides** — markdown-typeset notes with **callout blocks** for European-interview tips, warnings, and "strong answer" cues.
- **147 active-recall flashcards** — click to flip; "flip all" for rapid drills.
- **Per-module progress** — cycle *Not Started → In Progress → Completed*; progress rings per phase and an overall readiness %.
- **Personal notes** per module, auto-saved.
- **Everything persists** in `localStorage` — no account, no database for your progress.
- **Fully responsive** dark "slate/enterprise" UI.

## 🗂️ Curriculum

| # | Phase | Focus |
|---|-------|-------|
| 1 | JVM Internals & Runtime | Architecture, GC, Memory Model, JIT |
| 2 | Core & Modern Java (8→21) | Collections, Concurrency, Streams, **Virtual Threads**, Records/Sealed/Pattern matching |
| 3 | Spring & Spring Boot | IoC/DI, Auto-config, `@Transactional`, Data JPA |
| 4 | Databases & Persistence | SQL, Indexing, ACID & Isolation |
| 5 | System Design | Scalability, Caching, API design |
| 6 | Distributed Systems & Messaging | Microservices, **Kafka**, Sagas |
| 7 | DevOps: Docker, Kubernetes & **Helm** | Containers, K8s core, **Helm zero→advanced**, CI/CD & GitOps |
| 8 | Camunda & Process Orchestration | BPMN, Camunda 7 vs 8 |
| 9 | Linux, Networking & Observability | Shell, TCP/HTTP, the three pillars |
| 10 | Behavioral & EU Interview Strategy | STAR, system-design communication, visa logistics |

## 🚀 Quick start (local)

Requires **Node.js 18+**.

```bash
git clone https://github.com/<you>/java-interview-hub.git
cd java-interview-hub
npm install
npm start
# open http://localhost:3030
```

> The "Run" button calls `POST /api/execute`, which the Node server proxies to the public Piston API. Outbound HTTPS to `emkc.org` is required for live execution; everything else works offline.

## 🏗️ Architecture

```
Browser (vanilla JS SPA)
  ├─ Tailwind (CDN)         — styling
  ├─ Monaco editor (CDN)    — code editing
  ├─ marked + highlight.js  — markdown notes & syntax highlighting
  ├─ Lucide (CDN)           — icons
  └─ localStorage           — progress / notes
        │  fetch /api/execute
        ▼
Node + Express (server.js)
  └─ /api/execute  ──proxy──▶  Piston public API (real Java/Python/Bash runtime)
```

- `public/js/curriculum.js` — **all content** (phases, modules, notes, code, flashcards). This is the file to extend.
- `public/js/app.js` — the rendering engine (nav, tabs, progress, flashcards, sandbox).
- `server.js` — static hosting + the execution proxy.

## ➕ Extending the content

Add a module to any phase in `public/js/curriculum.js`:

```js
{
  id: '2.6',
  title: 'New Topic',
  hours: 3,
  notes: `# New Topic\n\n> [!EU]\n> An interview tip...`,   // markdown; callouts: [!TIP] [!WARNING] [!EU] [!DANGER] [!SUCCESS]
  code: [{ lang: 'java', title: 'Example', code: 'public class Main { ... }' }],
  flashcards: [{ q: 'Question?', a: 'Answer.' }]
}
```

Then `node --check public/js/curriculum.js` to validate. No build step.

## 🐳 Deployment

See [`DEPLOY.md`](./DEPLOY.md) for Docker and reverse-proxy (Caddy/Nginx) instructions to host it on a VPS.

```bash
docker build -t java-interview-hub .
docker run -d -p 3030:3030 --restart unless-stopped --name jih java-interview-hub
```

## 📋 License

MIT — personal study project. Content is original study material for interview preparation.

# ☕ Java Backend Interview Hub

A self-hosted, interactive **Senior Java Backend Engineer interview study hub** — built for European visa-sponsorship interview prep. Deep-dive notes, a **live online code compiler**, active-recall flashcards, and progress tracking that persists in your browser.

![tech](https://img.shields.io/badge/Java-21-orange) ![tech](https://img.shields.io/badge/Node-Express-green) ![tech](https://img.shields.io/badge/Tailwind-CDN-38bdf8) ![tech](https://img.shields.io/badge/Monaco-Editor-blueviolet)

---

## ✨ Features

- **16 phases · 80 modules · ~351 study hours** of structured, senior-level content (1,000+ runnable code samples, 3,900+ flashcards, 590+ interview Q&A).
- **Live code sandbox** — edit and **Run** Java on a real JDK compiler (via the [Wandbox](https://wandbox.org) execution API, proxied by the backend; self-hosted [Piston](https://github.com/engineer-man/piston) also supported). Powered by the **Monaco editor** (the VS Code engine).
- **Deep-dive study guides** — markdown-typeset notes with **callout blocks** for European-interview tips, warnings, and "strong answer" cues.
- **300+ active-recall flashcards** — click to flip; "flip all" for rapid drills.
- **Per-module progress** — cycle *Not Started → In Progress → Completed*; progress rings per phase and an overall readiness %.
- **Personal notes** per module, auto-saved.
- **Optional Google sign-in + cloud sync** — log in with Google to **save your progress and notes in a database** (SQLite) and pick up where you left off on any device. Without sign-in (or when unconfigured) everything still persists locally in `localStorage`.
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
| 11 | Real-World Java Backend Architecture | Multi-module Maven monolith, Docker+Caddy+VPS prod deploy, Spring Security & OAuth2 |

## 🚀 Quick start (local)

Requires **Node.js 22+** (the app uses the built-in `node:sqlite` module).

```bash
git clone https://github.com/<you>/java-interview-hub.git
cd java-interview-hub
npm install
npm start
# open http://localhost:3030
```

See **[docs/LOCAL_DEV.md](./docs/LOCAL_DEV.md)** for the full local-development guide (ports, live execution, troubleshooting).

> The "Run" button calls `POST /api/execute`, which the Node server proxies to the public **Wandbox** API. Outbound HTTPS to `wandbox.org` is required for live execution; notes, flashcards and progress all work offline.

## 🏗️ Architecture

```
Browser (vanilla JS SPA)
  ├─ Tailwind (CDN)         — styling
  ├─ Monaco editor (CDN)    — code editing
  ├─ marked + highlight.js  — markdown notes & syntax highlighting
  ├─ Lucide (CDN)           — icons
  └─ localStorage           — progress / notes (offline copy)
        │  fetch /api/execute   /auth/*   /api/state
        ▼
Node + Express (server.js)
  ├─ /api/execute  ──proxy──▶  Wandbox public API (real JDK / Python runtime)
  ├─ /auth/google* ──OAuth2──▶ Google (sign-in)  →  HMAC-signed session cookie
  └─ /api/state    ◀──sync──▶  SQLite (node:sqlite)  — per-user status + notes
```

- `public/js/curriculum.js` — **all content** (phases, modules, notes, code, flashcards). This is the file to extend.
- `public/js/app.js` — the rendering engine (nav, tabs, progress, flashcards, sandbox) **+ login widget and cloud sync**.
- `server.js` — static hosting, the execution proxy, auth routes, and the progress API.
- `auth.js` — Google OAuth2 flow + signed-cookie sessions (no external auth libs).
- `db.js` — SQLite persistence (`users`, `module_status`, `module_notes`) via built-in `node:sqlite`.

### Accounts & cloud sync

Sign-in is **optional and self-contained** — no third-party auth library, just `fetch` + `node:crypto`:

- Without `GOOGLE_CLIENT_ID` set, the login button is hidden and progress stays in `localStorage` (current behaviour).
- With Google OAuth configured, a user can **Sign in with Google**; their status + notes are saved to SQLite and merged back on any device. Sessions are an HMAC-signed, httpOnly cookie.
- Requires **Node 22+** (built-in `node:sqlite`). The DB lives at `$DATA_DIR/jih.db` (default `./data/`) — mount a volume there in production.

| Env var | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | enable Google sign-in (omit → localStorage-only) |
| `SESSION_SECRET` | signs session cookies — set a stable `openssl rand -hex 32` in prod |
| `GOOGLE_CALLBACK_URL` | optional; auto-derived from the request otherwise |
| `DATA_DIR` | where `jih.db` is stored (default `./data`) |

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

- **[docs/VPS_DEPLOY.md](./docs/VPS_DEPLOY.md)** — full VPS guide: DuckDNS, Caddy auto-HTTPS, and **push-to-deploy** (a systemd timer redeploys on every push to `main`; a GitHub Actions workflow is included too).
- **[DEPLOY.md](./DEPLOY.md)** — quick Docker / reverse-proxy reference.

```bash
docker build -t java-interview-hub .
docker run -d -p 3030:3030 --restart unless-stopped --name jih java-interview-hub
```

## 📋 License

MIT — personal study project. Content is original study material for interview preparation.

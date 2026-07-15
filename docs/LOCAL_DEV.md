# Running Java Interview Hub Locally

A 2-minute setup. No database, no API keys, no build step.

---

## Prerequisites

- **Node.js 22 or newer** (required for the built-in `node:sqlite` module) — check with `node --version`.
- That's it. (Docker is optional — see the bottom.)

---

## Run it (Node)

```bash
# 1. clone
git clone https://github.com/RajaSuriyaS/java-interview-hub.git
cd java-interview-hub

# 2. install dependencies (express, cors)
npm install

# 3. start the server
npm start
```

Then open **<http://localhost:3030>**.

To use a different port:

```bash
# macOS / Linux
PORT=4000 npm start

# Windows PowerShell
$env:PORT=4000; npm start

# Windows CMD
set PORT=4000 && npm start
```

---

## What runs where

| Part | Detail |
|------|--------|
| Backend | `server.js` — Express, serves the SPA from `public/` and proxies code execution |
| Frontend | static files in `public/` (vanilla JS, Tailwind/Monaco/Lucide via CDN) |
| Live code "Run" | `POST /api/execute` → **Wandbox** public API (free, no key). Java & Python execute on a real compiler; SQL/Bash are shown for reference |
| Your progress | saved in the browser's `localStorage` — survives refreshes, per-browser |

> **Internet note:** the page loads Tailwind/Monaco/Lucide from CDNs and the **Run** button calls Wandbox, so both need internet. All notes, flashcards, navigation, and progress tracking work **fully offline** — only live code execution and first-load CDN assets need a connection.

---

## Live-reload while editing content (optional)

The app has no build step, so editing files just needs a server restart (or a browser refresh for `public/` changes).

```bash
npm run dev      # uses nodemon to auto-restart server.js on change
```

`npm run dev` needs nodemon (listed as a devDependency; `npm install` already pulled it).

After editing the curriculum, validate it before committing:

```bash
node --check public/js/curriculum.js
node --check public/js/app.js
```

---

## Verify it's working

```bash
# health check
curl http://localhost:3030/health
# -> {"status":"ok","provider":"wandbox"}

# live Java execution through the proxy
curl -s -X POST http://localhost:3030/api/execute \
  -H "Content-Type: application/json" \
  -d '{"language":"java","code":"public class Main{public static void main(String[] a){System.out.println(2+2);}}"}'
# -> {"output":"4\n","error":"","exitCode":"0"}
```

In the UI: open **2.4 Virtual Threads → Code Sandbox tab → Run** — it compiles on a real JDK and prints the output.

---

## Switch the execution backend (optional)

Default is Wandbox (zero setup). To use a self-hosted [Piston](https://github.com/engineer-man/piston) instead (also runs Bash):

```bash
EXEC_PROVIDER=piston PISTON_URL=http://localhost:2000 npm start
```

---

## Run with Docker (optional)

```bash
docker build -t java-interview-hub .
docker run --rm -p 3030:3030 java-interview-hub
# open http://localhost:3030
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `EADDRINUSE: 3030` | Another process owns the port — run with `PORT=4000 npm start` or stop the other process |
| Blank page / no styling | You're offline or a CDN is blocked — Tailwind/Monaco load from CDNs |
| "Run" shows a network error | Wandbox unreachable (offline / firewall) — notes & flashcards still work offline |
| `npm start` says module not found | Run `npm install` first |
| Java run shows a filename error | Not in normal use — the server auto-strips `public` from the top-level class for Wandbox |

---

For deploying to a server, see [`VPS_DEPLOY.md`](./VPS_DEPLOY.md).

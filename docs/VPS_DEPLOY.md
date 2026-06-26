# VPS Deployment & Auto-Deploy

How to host **Java Interview Hub** on your Hetzner VPS (`178.105.239.120`) next to SafeStrike, with a DuckDNS subdomain, HTTPS, and GitHub-Actions auto-deploy on every push to `main`.

---

## 0. Architecture

```
GitHub push to main
   └─ CI workflow (lint, validate, docker build, smoke test)
        └─ Deploy workflow (on CI success)
             └─ SSH to VPS → git pull → docker compose up -d --build
                                          ├─ jih-app      (Node, :3030 internal)
                                          ├─ jih-duckdns  (keeps DNS pointed here)
                                          └─ jih-caddy    (HTTPS — standalone mode only)
```

The app listens on **3030**, published to `127.0.0.1:3030` — it never clashes with SafeStrike (8080) or its Caddy.

---

## 1. One-time: DuckDNS subdomain

1. Sign in at <https://www.duckdns.org> (same account as `safestrike`).
2. Add a new subdomain, e.g. **`javazerotoall`** → it becomes `javazerotoall.duckdns.org`.
3. Copy your **token** (top of the page).
4. The dockerised `jih-duckdns` service will keep `javazerotoall.duckdns.org` pointed at the VPS IP automatically (you set the token in `deploy/.env`). No cron needed.
   - Bare-metal alternative: `deploy/duckdns-update.sh` + a crontab entry (see that file's header).

---

## 2. One-time: prepare the VPS

```bash
ssh root@178.105.239.120

# Clone the repo
git clone https://github.com/RajaSuriyaS/java-interview-hub.git /root/java-interview-hub
cd /root/java-interview-hub

# Configure environment
cp deploy/.env.example deploy/.env
nano deploy/.env          # set DOMAIN, DUCKDNS_SUBDOMAINS, DUCKDNS_TOKEN
```

`deploy/.env`:
```env
DOMAIN=javazerotoall.duckdns.org
DUCKDNS_SUBDOMAINS=javazerotoall
DUCKDNS_TOKEN=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
EXEC_PROVIDER=wandbox
```

---

## 3. Pick a mode

### Mode A — Standalone (this app serves its own HTTPS)
Use when ports 80/443 are free (a fresh box, or you point a different IP here).

```bash
cd /root/java-interview-hub
chmod +x deploy/*.sh
STANDALONE=1 ./deploy/redeploy.sh
# -> app + duckdns + caddy. Visit https://javazerotoall.duckdns.org
```

### Mode B — Shared VPS (SafeStrike's Caddy already owns 80/443)  ← most likely
Run only the app + duckdns here, and let the **existing** Caddy terminate TLS:

```bash
cd /root/java-interview-hub
chmod +x deploy/*.sh
./deploy/redeploy.sh        # app + duckdns (no caddy)
```

Then add this block to SafeStrike's `deploy/Caddyfile` (the app is reachable on the host loopback):

```caddyfile
javazerotoall.duckdns.org {
    encode gzip
    reverse_proxy 172.17.0.1:3030
}
```

> `172.17.0.1` is the docker bridge gateway — how a container reaches a port published on the host's `127.0.0.1`. (If your Caddy runs with `network_mode: host`, use `127.0.0.1:3030`.)

Reload Caddy:
```bash
cd /root/trading-assistant
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --force-recreate --no-deps caddy
```

---

## 4. One-time: GitHub auto-deploy secrets

In the repo: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|--------|-------|
| `VPS_HOST` | `178.105.239.120` |
| `VPS_SSH_USER` | `root` |
| `VPS_SSH_KEY` | the **private** SSH key that can log into the VPS (the matching public key is in `~/.ssh/authorized_keys` on the VPS) |
| `VPS_SSH_PORT` | *(optional)* `22` |
| `DEPLOY_STANDALONE` | *(optional)* `1` for Mode A; omit/`0` for Mode B |
| `HEALTH_URL` | *(optional)* `https://javazerotoall.duckdns.org/health` to verify after deploy |
| `GOOGLE_CLIENT_ID` | *(optional)* Google OAuth client id — enables sign-in |
| `GOOGLE_CLIENT_SECRET` | *(optional)* Google OAuth client secret |
| `SESSION_SECRET` | *(optional)* cookie-signing key; auto-generated on the VPS if omitted |

You can reuse the same `VPS_SSH_KEY` you set up for SafeStrike. The deploy job
**writes `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `SESSION_SECRET` into the
VPS `deploy/.env`** on each run, so you manage these from GitHub and never edit
the server by hand (same approach as SafeStrike).

After that, **every push to `main` auto-deploys**. You can also trigger manually: Actions → *Deploy to VPS* → *Run workflow*.

---

## 5. Day-to-day

From your machine:
```bash
./ship.sh "add module 4.4 on partitioning"     # commit + push → CI → auto-deploy
./ship.sh "hotfix" --deploy                     # also SSH-deploy immediately
./ship.sh --deploy-only                         # redeploy current main, no commit
```

On the VPS:
```bash
cd /root/java-interview-hub
./deploy/redeploy.sh           # Mode B
STANDALONE=1 ./deploy/redeploy.sh   # Mode A
docker compose -f deploy/docker-compose.yml ps
docker logs -f jih-app
```

---

## 6. Verify

```bash
curl -s https://javazerotoall.duckdns.org/health
# {"status":"ok","provider":"wandbox","db":true,"googleAuth":true}
```
Open `https://javazerotoall.duckdns.org`, pick **2.4 Virtual Threads**, hit **Run** on the code sample — it compiles on a real JDK and prints output.

---

## 6b. (Optional) Google sign-in + cloud progress sync

By default progress is saved in each visitor's browser (`localStorage`). To let
users **sign in with Google** and have their status/notes saved server-side
(SQLite) and synced across devices:

1. **Create OAuth credentials** at <https://console.cloud.google.com/apis/credentials>:
   - *Create Credentials → OAuth client ID → Web application*.
   - **Authorised redirect URI:** `https://javazerotoall.duckdns.org/auth/google/callback`
     (must match your domain exactly).
   - Copy the **Client ID** and **Client secret**.
2. **Supply the credentials — pick one:**

   **A) From GitHub (recommended — like SafeStrike, no SSH needed).** Add three
   repo secrets in *Settings → Secrets and variables → Actions*: `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, and (optional) `SESSION_SECRET`. The deploy job writes
   them into the VPS `deploy/.env` automatically on the next run.

   **B) Directly on the VPS** (if you're not using the GitHub Actions deploy):
   ```bash
   cd /root/java-interview-hub && nano deploy/.env
   #   GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   #   GOOGLE_CLIENT_SECRET=xxxxxxxx
   #   SESSION_SECRET=...        # openssl rand -hex 32
   ./deploy/redeploy.sh
   ```
3. **Deploy** (push to `main`, or Actions → *Deploy to VPS* → *Run workflow*).
   Verify with `curl -s .../health` → `"googleAuth":true`. A **Sign in with
   Google** button appears in the sidebar.

Notes:
- The SQLite DB persists in the `jih_data` Docker volume (survives redeploys).
  Back it up with `docker run --rm -v jih_data:/d -v $PWD:/b alpine cp /d/jih.db /b/`.
- Requires **Node 22+** (built-in `node:sqlite`) — the bundled Dockerfile uses `node:22-alpine`.
- If you ever rotate `SESSION_SECRET`, existing sessions are invalidated (users re-login).

---

## 7. Firewall

Ensure 80/443 are open (already are, for SafeStrike):
```bash
ufw allow 80,443/tcp
```

## 8. Resource footprint
~60–80 MB RAM, near-zero idle CPU. Safe to co-locate with SafeStrike.

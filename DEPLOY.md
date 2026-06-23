# Deploying Java Interview Hub to a VPS

This app is a small Node/Express server that serves a static SPA and proxies code execution to the public Piston API. It's lightweight (~one container, no database).

## Prerequisites

- A VPS with Docker installed.
- A reverse proxy (Caddy or Nginx) if you want HTTPS + a subdomain/subpath.
- Outbound HTTPS allowed (the `/api/execute` proxy calls `https://emkc.org`).

---

## Option A — Docker (recommended)

```bash
# on the server, in the repo directory
docker build -t java-interview-hub .
docker run -d \
  --name jih \
  --restart unless-stopped \
  -p 3030:3030 \
  java-interview-hub

# verify
curl -s http://localhost:3030/health      # {"status":"ok"}
```

Update after a `git pull`:

```bash
docker build -t java-interview-hub .
docker rm -f jih
docker run -d --name jih --restart unless-stopped -p 3030:3030 java-interview-hub
```

## Option B — bare Node + systemd

```bash
npm ci --omit=dev
sudo tee /etc/systemd/system/jih.service >/dev/null <<'UNIT'
[Unit]
Description=Java Interview Hub
After=network.target

[Service]
WorkingDirectory=/opt/java-interview-hub
ExecStart=/usr/bin/node server.js
Environment=NODE_ENV=production
Environment=PORT=3030
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now jih
```

---

## Reverse proxy

### Caddy (auto-HTTPS) — own subdomain

```caddyfile
study.example.com {
    reverse_proxy localhost:3030
}
```

### Caddy — sub-path on an existing site

```caddyfile
example.com {
    handle_path /study/* {
        reverse_proxy localhost:3030
    }
}
```

### Nginx

```nginx
location / {
    proxy_pass http://127.0.0.1:3030;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

---

## Sharing the VPS with SafeStrike (the existing project)

This app uses **port 3030**, which avoids the SafeStrike backend (8080) and the V2 UI. Add it as another `reverse_proxy` block in your existing Caddyfile under a new subdomain or `/study` path — no conflict.

## Resource footprint

- Memory: ~60–80 MB.
- CPU: idle near-zero; brief spikes only while proxying a code run.
- No persistent storage needed (user progress lives in the browser's `localStorage`).

## Notes

- To run **fully offline** (no live code execution), the UI still works; only the "Run" button needs `emkc.org`. You can later self-host Piston and point `server.js` at it if you want zero external dependencies.

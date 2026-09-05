# TV Remote — laptop + phone control for Android / Google TV over WiFi

No Arduino, no ADB, no IR hardware. The laptop talks to the TV over your
home WiFi (Android TV Remote protocol v2), and any phone/camera input rides
on the same page.

## Run it (Windows laptop + TV on the same WiFi)

1. `cd tv-remote && npm install`
2. Double-click `tv-remote\start-tv.bat` (or `node tv-remote\server.js`)
3. Open http://localhost:8080
4. Turn the TV ON → **Start pairing** → type the 6-digit code from the
   TV screen → **Send code**. Paired forever (saved to `cert.json`, git-ignored).

## Pages (all served by the same server)

| Page | What |
|---|---|
| `/` | Button remote (served by Node on Railway/Render/localhost — **this is what your phone opens**) |
| `/gesture.html` | Camera gesture remote: hold 1s on **U L R D H** letters, slide the right **VOL** strip, 👍 = OK, 👎 = Back (either hand) |
| `/index.html` | Classic IR/RF remote UI (needs USB blaster hardware) |
| `/test100.html` | 1–100 IR/RF signal brute-force tester |

## Phone + public link (Cloudflare)

1. Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. Double-click `tv-remote\share-tv.bat`
3. Open the printed `https://…trycloudflare.com` link on your phone
   (HTTPS, so the camera works) → `/gesture.html`
4. Keep the URL private — anyone with it can press TV buttons.

## Online mode (GitHub Pages, no localhost in the address bar)

A public website can't touch your TV directly (browsers block websites from
reaching home-network devices), so the Pages site relays through your laptop:

1. Repo → Settings → Pages → Deploy from branch → `main` → `/ (root)`
2. Run `tv-remote\share-tv.bat`, copy the `https://…trycloudflare.com` link
3. Open the Pages URL, paste the link in the 🌐 box → Save → pair & control

Same laptop = zero paste: the page auto-finds `http://localhost:8080`
(browsers allow public pages to reach localhost), so the 🌐 box fills
itself. Only phones need the one-time paste.

## Fully hosted — Railway from GitHub (NO laptop, NO localhost, NO bat files)

The Railway URL **is** the remote. Open it on any phone/laptop and press
▶ START — same-origin API, nothing to paste.

**One-time setup (5 min):**

1. **Router port-forward** (once): forward **TCP 6466 + 6467** to the TV
   (`192.168.1.84`). In your router admin look for Port Forwarding /
   Virtual Server. Find your public IP at whatsmyip.org.
   If it never connects from mobile data, your ISP uses CGNAT (common on
   Jio/Airtel) and blocks this — fall back to `share-tv.bat` on the laptop.
2. **Push this repo to GitHub** (Railway deploys from there):
   ```bash
   git add -A && git commit -m "hosted remote" && git push
   ```
3. **Railway → New Project → Deploy from GitHub** → pick this repo.
   Railway auto-detects the `Dockerfile` (see `railway.json` healthcheck
   `/api/health`). Or via CLI:
   ```bash
   npm i -g @railway/cli
   railway login
   railway link        :: pick your project
   railway up          :: deploys this folder, stays ON
   ```
4. **Variables** (Railway → service → Variables):
   `TV_HOST=<your-public-IP-or-DDNS>`. Deploy once.
5. **Phone (no laptop on!)**: open `https://<you>.up.railway.app` →
   **▶ START** → type the PIN shown on the TV → **Send code**.
6. **Stay paired forever**: open `https://<you>.up.railway.app/api/cert`,
   copy the JSON → add as `TV_CERT_JSON` variable → Redeploy. Future
   deploys never ask for the PIN again.

`railway down` = keep-OFF (stops billing, keeps config).
`railway redeploy` = back ON. No bat files involved.

⚠️ A hosted remote URL = anyone with the link can press TV buttons.
Only share it with family, and remove the port-forward when travelling.

## Deploy via CLI — Railway / Render / Fly (keep ON vs keep OFF)

Same Docker image works everywhere. Health endpoint for all hosts:
`GET /api/health` (also `/health`, `/healthz`, `/api/ping`).

```bat
npm i -g @railway/cli
railway login
railway init        :: or: railway link
railway up          :: == KEEP-ON: builds Dockerfile, deploys, stays running
```

Env vars to set (dashboard → Variables, or `railway variables --set`):
`TV_HOST=<public-IP-or-DDNS>` and after first pairing
`TV_CERT_JSON=<paste from <your-url>/api/cert>`.

| Want | Railway | Render free | Fly.io |
|---|---|---|---|
| **KEEP-ON** (always awake, instant remote) | Default — Railway never sleeps. Just `railway up`. Keep `Serverless / App-Sleeping = OFF`. | Free tier sleeps. Ping `https://<you>.onrender.com/api/health` every 5 min with UptimeRobot / cron-job.org to hold it awake. | `fly scale count 1 --yes` + `auto_stop_machines = off` in `fly.toml`. |
| **KEEP-OFF** (sleep when idle, save ₹ / $) | `railway down` — removes the running deployment but **keeps service + vars**. Bring back with `railway redeploy`. Or turn `Serverless = ON` so it sleeps after ~5–10 min idle. | Do nothing — it auto-sleeps. First tap takes ~40s to wake. (Remove the UptimeRobot monitor.) | `fly scale count 0 --yes` (stops billing, keeps config) or `auto_stop_machines = stop`. |

Quick CLI reference:

```bash
railway up          # KEEP-ON — deploy this folder
railway logs        # watch it
railway restart     # reboot service
railway down        # KEEP-OFF — stop running deployment, keep config
railway redeploy    # back ON again after `down`
```

## Change TV

Default TV is `192.168.1.84`. Override without editing code:

```bat
set TV_HOST=192.168.1.50 && node tv-remote\server.js
```

To find your TV: it must be ON + on WiFi, ports 6466/6467 open
(Android TV Remote Service, preinstalled on most Android/Google TVs).

## Files

- `tv-remote/server.js` — Node server (no web framework, 2 deps via `androidtv-remote`)
- `tv-remote/tvlive.html` — button remote UI
- `tv-remote/gesture.js` + `gesture.html` — MediaPipe hand-tracking UI (CDN, runs on-device)
- `tv-remote/start-tv.bat` / `share-tv.bat` — one-click launchers
- `index.html`, `test100.*`, `rf_bridge*.ino` — legacy IR/RF hardware path

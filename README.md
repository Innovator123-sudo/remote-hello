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
| `/` (tvlive.html) | Button remote: power, volume, channels, d-pad, apps |
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

## Fully hosted (phone works with NO laptop, NO bat files)

Your TV must be reachable from the internet first, then the API runs free
in the cloud (Render) instead of your laptop:

1. **Router port-forward** (once): forward **TCP 6466 + 6467** to the TV
   (`192.168.1.84`). In your router admin look for Port Forwarding /
   Virtual Server. Find your public IP at whatsmyip.org.
   If it never connects from mobile data, your ISP uses CGNAT (common on
   Jio/Airtel) and blocks this — fall back to `share-tv.bat` on the laptop.
2. **Deploy**: Render.com → New → Web Service → pick this repo → Docker
   runtime → set env `TV_HOST` = your public IP (or DDNS name) → Deploy.
   Free tier sleeps when idle; first tap wakes it in ~40s.
3. **Phone**: open the Pages remote → 🌐 box → paste your
   `https://tv-remote-xxxx.onrender.com` → Save → Start pairing (read the
   PIN off the TV at home) → Send code.
4. **Stay paired**: open `<your-url>/api/cert`, copy the JSON, add it as
   env var `TV_CERT_JSON` on Render (then redeploys never unpair).

⚠️ A hosted remote URL = anyone with the link can press TV buttons.
Only share it with family, and remove the port-forward when travelling.

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

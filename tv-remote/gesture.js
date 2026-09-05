// gesture.js — fullscreen camera gesture remote (MediaPipe HandLandmarker).
// Letter grid: hold index fingertip 1s on U/L/R/D/H (HOME lives at the bottom).
// Right-edge strip = volume slider (slide finger up/down). Thumbs-up = OK, thumbs-down = Back (either hand).
// Sends keys to this same server via POST /api/key (works on laptop + mobile over Cloudflare tunnel).

const MP_VERSIONS = ['1.0.1', '0.10.21'];
const MP_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const DWELL_DEFAULT = 1000;
const COOLDOWN_MS = 1500;
const VOL_STEP = 0.045;   // finger travel (fraction of screen height) per volume press
const VOL_MIN_GAP = 110;  // ms between volume presses

const ZONES = [
  { id: 'up', key: 'KEYCODE_DPAD_UP', glyph: 'U', label: 'UP', x0: 0.34, y0: 0.02, x1: 0.66, y1: 0.26 },
  { id: 'left', key: 'KEYCODE_DPAD_LEFT', glyph: 'L', label: 'LEFT', x0: 0.02, y0: 0.38, x1: 0.24, y1: 0.62 },
  { id: 'right', key: 'KEYCODE_DPAD_RIGHT', glyph: 'R', label: 'RIGHT', x0: 0.62, y0: 0.38, x1: 0.84, y1: 0.62 },
  { id: 'down', key: 'KEYCODE_DPAD_DOWN', glyph: 'D', label: 'DOWN', x0: 0.34, y0: 0.56, x1: 0.66, y1: 0.76 },
  { id: 'home', key: 'KEYCODE_HOME', glyph: 'H', label: 'HOME', x0: 0.34, y0: 0.82, x1: 0.66, y1: 0.98 },
];
// volume slider: right-edge vertical strip (normalized coords, mirrored view)
const VOL = { x0: 0.90, y0: 0.08, x1: 1.00, y1: 0.92 };

const BONES = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17],
];

const $ = (id) => document.getElementById(id);
const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '';
let SERVER = '';
try {
  const qp = new URLSearchParams(location.search).get('server');
  SERVER = (qp || localStorage.getItem('tvServer') || '').replace(/\/$/, '');
  if (qp) { try { localStorage.setItem('tvServer', SERVER); } catch {} }
} catch {}
function apiUrl(p) { return SERVER + p; }
const canvas = $('view');
const ctx = canvas.getContext('2d');
const video = $('cam');

let landmarker = null;
let camOn = false;
let facing = 'user';
let showBones = true;
let dwellMs = DWELL_DEFAULT;
let tvReady = false;
let dwellZone = null;
let dwellStart = 0;
let cooldownUntil = 0;
let lastThumb = null;
let lastThumbAt = 0;
let flashUntil = 0;
let flashHtml = '';
let fpsEma = 0;
let lastFrame = 0;
let stream = null;
let warnedPair = 0;
let volAcc = 0, volLastY = null, volPending = 0, volLastSent = 0, volMarkerY = null;
let volLevel = null, volMax = 15;

function toast(msg, ms = 4000) {
  const t = $('toast');
  t.style.display = 'block';
  t.textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.style.display = 'none'; }, ms);
}

function flash(html) {
  flashHtml = html;
  flashUntil = performance.now() + 950;
  const f = $('flash');
  f.innerHTML = html;
  f.style.display = 'flex';
}

async function postKey(keyName) {
  try {
    const r = await fetch(apiUrl('/api/key'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: keyName }),
    });
    const ct = r.headers.get('content-type') || '';
    const j = ct.includes('application/json') ? await r.json() : { ok: false };
    if (!j.ok) {
      if (Date.now() - warnedPair > 8000) {
        warnedPair = Date.now();
        toast('⚠️ TV not paired yet — open the button remote, pair once, come back.');
      }
      return false;
    }
    return true;
  } catch {
    toast('⚠️ Lost connection to remote server.');
    return false;
  }
}

async function pollTv() {
  try {
    const r = await fetch(apiUrl('/api/status'));
    const s = await r.json();
    tvReady = s.phase === 'ready';
    if (s.volume) { volLevel = s.volume.level; volMax = s.volume.maximum || 15; }
    const pill = $('tvPill');
    pill.textContent = (tvReady ? 'TV: live ✓' : 'TV: pair first!')
      + (volLevel !== null && volLevel !== undefined ? ` · Vol ${volLevel}/${volMax}` : '');
    pill.className = 'pill ' + (tvReady ? 'ok' : 'warn');
  } catch {
    tvReady = false;
    $('tvPill').textContent = 'TV: no server?';
    $('tvPill').className = 'pill warn';
  }
}

function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

// fingertip farther from wrist than its pip joint = extended
function fingerOut(lm, tip, pip) {
  return dist(lm[tip], lm[0]) > dist(lm[pip], lm[0]) * 1.04;
}

function thumbOut(lm) {
  return dist(lm[4], lm[0]) > dist(lm[2], lm[0]) * 1.08;
}

// Returns 'up' | 'down' | null. Requires fist + extended thumb + clear vertical orientation.
function thumbPose(lm) {
  if (!(thumbOut(lm) && !fingerOut(lm, 8, 6) && !fingerOut(lm, 12, 10) &&
        !fingerOut(lm, 16, 14) && !fingerOut(lm, 20, 18))) return null;
  const wristY = lm[0].y, midY = lm[9].y, tipY = lm[4].y;
  if (wristY - midY > 0.07 && wristY - tipY > 0.10) return 'up';    // hand upright, thumb on top
  if (midY - wristY > 0.07 && tipY - wristY > 0.10) return 'down';  // hand flipped, thumb at bottom
  return null;
}

function zoneAt(cx, cy) {
  for (const z of ZONES) {
    if (z.circle) {
      if (Math.hypot(cx - z.circle.x, cy - z.circle.y) < z.circle.r) return z;
    } else if (cx >= z.x0 && cx <= z.x1 && cy >= z.y0 && cy <= z.y1) {
      return z;
    }
  }
  return null;
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
}
window.addEventListener('resize', resize);
resize();

async function loadLandmarker(statusCb) {
  let lastErr = null;
  for (const v of MP_VERSIONS) {
    try {
      statusCb('loading hand AI (' + v + ')…');
      const mod = await import(`${MP_BASE}@${v}/vision_bundle.mjs`);
      const fileset = await mod.FilesetResolver.forVisionTasks(`${MP_BASE}@${v}/wasm`);
      const lm = await mod.HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      return lm;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('AI download failed');
}

async function startCamera() {
  if (!window.isSecureContext) {
    $('startErr').textContent = 'Camera needs HTTPS or localhost — open via http://localhost:8080 or the Cloudflare link, not a file.';
    return;
  }
  if (!landmarker) {
    try {
      $('startBtn').textContent = '⏳ loading hand AI…';
      landmarker = await loadLandmarker((t) => { $('startBtn').textContent = '⏳ ' + t; });
    } catch (e) {
      $('startBtn').textContent = '📷 Start camera';
      $('startErr').textContent = 'Could not load hand AI (need internet once): ' + e.message;
      return;
    }
  }
  try {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (e) {
    $('startBtn').textContent = '📷 Start camera';
    $('startErr').textContent = e.name === 'NotAllowedError'
      ? 'Camera blocked — allow camera permission for this site, then retry.'
      : 'No camera: ' + e.message;
    return;
  }
  video.srcObject = stream;
  await video.play();
  camOn = true;
  $('start').style.display = 'none';
  $('camPill').textContent = 'camera on ✓';
  $('camPill').className = 'pill ok';
  lastFrame = performance.now();
  requestAnimationFrame(loop);
}

function stopCamera() {
  camOn = false;
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  $('camPill').textContent = 'camera off';
  $('camPill').className = 'pill';
  $('start').style.display = 'flex';
  $('startBtn').textContent = '📷 Start camera';
}

function drawCover() {
  // mirrored full-cover video
  const W = canvas.width, H = canvas.height;
  const vw = video.videoWidth || 1, vh = video.videoHeight || 1;
  const s = Math.max(W / vw, H / vh);
  const dw = vw * s, dh = vh * s;
  ctx.save();
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
  ctx.restore();
  return { ox: (W - dw) / 2, oy: (H - dh) / 2, s };
}

function toPx(p, view) {
  // normalized landmark -> canvas px under the same mirror+cover transform
  const W = canvas.width, H = canvas.height;
  const mx = 1 - p.x;
  const vw = video.videoWidth || 1, vh = video.videoHeight || 1;
  const s = Math.max(W / vw, H / vh);
  const dw = vw * s, dh = vh * s;
  return { x: mx * dw + (W - dw) / 2, y: p.y * dh + (H - dh) / 2 };
}

function drawZones(activeId, progress) {
  const W = canvas.width, H = canvas.height;
  for (const z of ZONES) {
    let x, y, w, h;
    if (z.circle) {
      const r = z.circle.r * Math.min(W, H);
      x = z.circle.x * W - r; y = z.circle.y * H - r; w = h = r * 2;
    } else {
      x = z.x0 * W; y = z.y0 * H; w = (z.x1 - z.x0) * W; h = (z.y1 - z.y0) * H;
    }
    const active = z.id === activeId;
    const cx = x + w / 2, cy = y + h / 2;
    ctx.save();
    if (z.circle) {
      ctx.beginPath();
      ctx.arc(cx, cy, w / 2, 0, Math.PI * 2);
      ctx.fillStyle = active ? 'rgba(34,197,94,.28)' : 'rgba(10,18,42,.38)';
      ctx.fill();
      ctx.lineWidth = active ? 4 : 2;
      ctx.strokeStyle = active ? '#22c55e' : 'rgba(147,197,253,.35)';
      ctx.stroke();
    } else {
      const r = 26;
      ctx.beginPath();
      ctx.roundRect(x + 8, y + 8, w - 16, h - 16, r);
      ctx.fillStyle = active ? 'rgba(34,197,94,.28)' : 'rgba(10,18,42,.38)';
      ctx.fill();
      ctx.lineWidth = active ? 4 : 2;
      ctx.strokeStyle = active ? '#22c55e' : 'rgba(147,197,253,.35)';
      ctx.stroke();
    }
    // glyph + label
    ctx.fillStyle = active ? '#fff' : 'rgba(232,238,252,.85)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const gs = Math.min(w, h) * (z.circle ? 0.42 : 0.34);
    ctx.font = `900 ${gs}px "Segoe UI", Arial`;
    ctx.fillText(z.glyph, cx, cy - gs * 0.18);
    ctx.font = `800 ${Math.max(20, gs * 0.28)}px "Segoe UI", Arial`;
    ctx.fillStyle = active ? '#bbf7d0' : 'rgba(147,197,253,.8)';
    ctx.fillText(z.label, cx, cy + gs * 0.42);
    // dwell progress bar under glyph
    if (active && progress > 0) {
      const bw = Math.min(w * 0.7, 260);
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.fillRect(cx - bw / 2, cy + gs * 0.72, bw, 10);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(cx - bw / 2, cy + gs * 0.72, bw * Math.min(1, progress), 10);
    }
    ctx.restore();
  }
}

function drawSkeleton(lm) {
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(56,189,248,.9)';
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  for (const [a, b] of BONES) {
    const pa = toPx(lm[a]), pb = toPx(lm[b]);
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
  }
  ctx.stroke();
  for (const p of lm) {
    const q = toPx(p);
    ctx.beginPath();
    ctx.arc(q.x, q.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawVolume(active) {
  const W = canvas.width, H = canvas.height;
  const x = VOL.x0 * W, y = VOL.y0 * H, w = (VOL.x1 - VOL.x0) * W, h = (VOL.y1 - VOL.y0) * H;
  const cx = x + w / 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 6, y, w - 12, h, 22);
  ctx.fillStyle = active ? 'rgba(16,185,129,.30)' : 'rgba(10,18,42,.45)';
  ctx.fill();
  ctx.lineWidth = active ? 4 : 2;
  ctx.strokeStyle = active ? '#10b981' : 'rgba(147,197,253,.35)';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232,238,252,.30)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 10; i++) {
    const ty = y + (h * i) / 10;
    ctx.beginPath();
    ctx.moveTo(x + 14, ty);
    ctx.lineTo(x + w - 14, ty);
    ctx.stroke();
  }
  ctx.fillStyle = active ? '#fff' : 'rgba(232,238,252,.85)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 30px "Segoe UI", Arial';
  ctx.fillText('+', cx, y + 28);
  ctx.fillText('−', cx, y + h - 28);
  if (volMarkerY !== null) {
    const my = y + Math.max(0, Math.min(1, (volMarkerY - VOL.y0) / (VOL.y1 - VOL.y0))) * h;
    ctx.beginPath();
    ctx.arc(cx, my, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }
  ctx.font = '800 24px "Segoe UI", Arial';
  ctx.fillStyle = '#bbf7d0';
  const lvl = (volLevel !== null && volLevel !== undefined) ? `${volLevel}/${volMax}`
    : volPending !== 0 ? (volPending > 0 ? '+' + volPending : '' + volPending) : 'VOL';
  ctx.fillText(lvl, cx, y + h + 30);
  ctx.restore();
}

function loop() {
  if (!camOn) return;
  const now = performance.now();
  const dt = now - lastFrame;
  lastFrame = now;
  if (dt > 0) fpsEma = fpsEma ? fpsEma * 0.92 + (1000 / dt) * 0.08 : 1000 / dt;
  $('fpsPill').textContent = Math.round(fpsEma) + ' fps';

  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (video.readyState >= 2 && video.videoWidth) drawCover();
  else { requestAnimationFrame(loop); return; }

  let hands = [];
  try {
    const res = landmarker.detectForVideo(video, now);
    if (res && res.landmarks && res.landmarks.length) hands = res.landmarks;
  } catch { hands = []; }
  const lm = hands.length ? hands[0] : null;

  let activeId = null;
  let progress = 0;
  let volActive = false;

  // volume pump: emit queued presses with a small gap so sliding feels smooth
  if (volPending !== 0 && now - volLastSent > VOL_MIN_GAP) {
    const up = volPending > 0;
    volPending += up ? -1 : 1;
    volLastSent = now;
    postKey(up ? 'KEYCODE_VOLUME_UP' : 'KEYCODE_VOLUME_DOWN');
  }

  if (lm) {
    for (const h of hands) if (showBones) drawSkeleton(h);
    const tip = lm[8];
    const cx = 1 - tip.x, cy = tip.y;

    // volume slider (right strip): slide finger up/down, ~1 press per 4.5% travel
    if (cx >= VOL.x0 && cx <= VOL.x1 && cy >= VOL.y0 && cy <= VOL.y1) {
      volActive = true;
      volMarkerY = cy;
      if (volLastY === null) volLastY = cy;
      volAcc += volLastY - cy;
      volLastY = cy;
      while (volAcc >= VOL_STEP) { volPending++; volAcc -= VOL_STEP; }
      while (volAcc <= -VOL_STEP) { volPending--; volAcc += VOL_STEP; }
      volPending = Math.max(-10, Math.min(10, volPending));
      dwellZone = null;
    } else {
      volLastY = null;
    }
    const z = volActive ? null : zoneAt(cx, cy);

    // thumb gestures — EITHER hand (edge-triggered + cooldown)
    let pose = null;
    for (const h of hands) { pose = thumbPose(h); if (pose) break; }
    if (pose && (pose !== lastThumb || now - lastThumbAt > 2500) && now > cooldownUntil) {
      lastThumb = pose; lastThumbAt = now;
      cooldownUntil = now + COOLDOWN_MS;
      dwellZone = null;
      const keyName = pose === 'up' ? 'KEYCODE_DPAD_CENTER' : 'KEYCODE_BACK';
      flash(pose === 'up' ? '👍<small>OK</small>' : '👎<small>BACK</small>');
      postKey(keyName);
    } else if (!pose) {
      lastThumb = null;
    }

    // dwell select (only when pointing openly: index out, others relaxed)
    const pointing = fingerOut(lm, 8, 6) && !fingerOut(lm, 12, 10) && !fingerOut(lm, 16, 14);
    if (z && pointing && now > cooldownUntil && !pose) {
      if (!dwellZone || dwellZone.id !== z.id) { dwellZone = z; dwellStart = now; }
      progress = (now - dwellStart) / dwellMs;
      activeId = z.id;
      if (progress >= 1) {
        dwellZone = null;
        cooldownUntil = now + COOLDOWN_MS;
        flash(`<span style="font-size:.5em">${z.glyph}</span><small>${z.label}</small>`);
        postKey(z.key);
      }
    } else {
      dwellZone = null;
    }

    // cursor
    const p = toPx(tip);
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
    ctx.fillStyle = activeId ? '#22c55e' : '#38bdf8';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    if (activeId) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, progress));
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 7;
      ctx.stroke();
    }
    ctx.restore();
  } else {
    dwellZone = null;
    volLastY = null;
    ctx.save();
    ctx.fillStyle = 'rgba(232,238,252,.75)';
    ctx.font = '700 34px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillText('show your hand ✋', W / 2, H / 2);
    ctx.restore();
  }

  drawVolume(volActive);
  drawZones(activeId, progress);
  if (performance.now() > flashUntil && $('flash').style.display !== 'none') {
    $('flash').style.display = 'none';
  }
  requestAnimationFrame(loop);
}

$('startBtn').onclick = startCamera;
$('switchBtn').onclick = async () => {
  facing = facing === 'user' ? 'environment' : 'user';
  if (camOn) startCamera();
  else toast('Front/back will apply when camera starts. Now: ' + facing);
};
$('boneBtn').onclick = () => {
  showBones = !showBones;
  $('boneBtn').textContent = showBones ? '🦴 lines: on' : '🦴 lines: off';
};
$('dwellSel').onchange = (e) => { dwellMs = parseInt(e.target.value, 10); };
document.addEventListener('visibilitychange', () => { dwellZone = null; });

pollTv();
setInterval(pollTv, 3000);
async function sameOriginWorks() {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch('/api/status', { signal: ctl.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}
async function autoFindServer() {
  if (SERVER) return false;
  // Hosted-first: Railway/Render URL serves the API itself — nothing to paste.
  if (await sameOriginWorks()) return true;
  if (IS_LOCAL) return true;
  for (const b of ['http://localhost:8080', 'http://127.0.0.1:8080']) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 2500);
      const r = await fetch(b + '/api/status', { signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) continue;
      SERVER = b;
      try { localStorage.setItem('tvServer', SERVER); } catch {}
      toast('✅ Auto-connected to your laptop.');
      return true;
    } catch {}
  }
  return false;
}
autoFindServer();
setTimeout(async () => {
  if (await sameOriginWorks()) return; // hosted URL — no paste needed
  if (!IS_LOCAL && !SERVER) toast('🌐 Static page? Open your Railway URL directly (it IS the remote), or paste it once on the button page — then reload.', 9000);
}, 9000);

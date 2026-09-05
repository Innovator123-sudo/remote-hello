// tv-remote/server.js — Zero-hardware WiFi remote for Android/Google TV (192.168.1.84)
// Run: node server.js  (or double-click start-tv.bat)  → open http://localhost:8080
// Flow: Start pairing → 6-digit code appears ON THE TV SCREEN → type it in → full remote.
// Cert is saved to cert.json so pairing is needed only once.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { AndroidRemote, RemoteKeyCode, RemoteDirection } = require('androidtv-remote');

const PORT = process.env.PORT || 8080;
const CERT_FILE = path.join(__dirname, 'cert.json');
const TV_HOST = process.env.TV_HOST || '192.168.1.84';

let remote = null;
let starting = false;
const state = {
  phase: 'idle', // idle | waiting-code | ready | error
  message: 'Click "Start pairing".',
  host: TV_HOST,
  powered: null,
  volume: null,
  currentApp: null,
  log: [],
};

function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  state.log.unshift(line);
  if (state.log.length > 30) state.log.pop();
  console.log(line);
}

function loadCert() {
  try {
    return JSON.parse(fs.readFileSync(CERT_FILE, 'utf8'));
  } catch { return {}; }
}
function saveCert() {
  try {
    fs.writeFileSync(CERT_FILE, JSON.stringify(remote.getCertificate()));
    log('Pairing certificate saved — next time connects instantly.');
  } catch (e) { log('Could not save cert: ' + e.message); }
}

async function beginPairing(host) {
  if (starting) return;
  starting = true;
  try { if (remote) { try { remote.stop(); } catch {} remote = null; } } catch {}
  state.host = host || TV_HOST;
  state.phase = 'starting';
  state.message = `Contacting TV at ${state.host}…`;
  log(state.message);

  const cert = loadCert();
  const hasCert = !!(cert.key && cert.cert);
  remote = new AndroidRemote(state.host, {
    pairing_port: 6467,
    remote_port: 6466,
    service_name: 'Laptop Remote',
    cert,
  });

  remote.on('secret', () => {
    state.phase = 'waiting-code';
    state.message = 'Code is on your TV screen — type it below.';
    log('TV asked for pairing code (shown on TV screen).');
  });
  remote.on('ready', () => {
    state.phase = 'ready';
    state.message = 'Connected — remote is live.';
    log('Remote READY.');
    saveCert();
  });
  remote.on('powered', (p) => { state.powered = p; log('Power: ' + (p ? 'ON' : 'OFF/STANDBY')); });
  remote.on('volume', (v) => { state.volume = v; log(`Volume ${v.level}/${v.maximum}${v.muted ? ' MUTED' : ''}`); });
  remote.on('current_app', (a) => { state.currentApp = a; log('App: ' + a); });
  remote.on('unpaired', () => {
    state.phase = 'idle';
    state.message = 'TV unpaired us — pair again.';
    log('Unpaired by TV. Start pairing again.');
  });
  remote.on('error', (e) => {
    log('Remote error: ' + (e && e.message ? e.message : e));
  });

  // Watchdog: if TV never answers, say so plainly.
  setTimeout(() => {
    if (state.phase === 'starting') {
      state.phase = 'error';
      state.message = 'TV did not answer. Turn the TV ON (physical button), same Wi-Fi, retry.';
      log('No answer from TV — is it ON and on this Wi-Fi?');
      starting = false;
    }
  }, 20000);

  try {
    const started = await remote.start();
    if (hasCert && started) {
      state.phase = 'ready';
      state.message = 'Connected with saved pairing — remote is live.';
      log('Connected with saved certificate.');
    } else if (!started && state.phase === 'starting') {
      state.phase = 'error';
      state.message = 'Could not reach TV. Turn it ON and retry.';
      log('start() returned falsy.');
    }
  } catch (e) {
    state.phase = 'error';
    state.message = 'Connection failed: ' + e.message;
    log('start() threw: ' + e.message);
  }
  starting = false;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
function json(res, code, obj) {
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json' }, CORS));
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(path.join(__dirname, 'tvlive.html')));
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/status') {
    json(res, 200, state);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/start') {
    const body = await readBody(req);
    beginPairing(body.host || TV_HOST);
    json(res, 200, { ok: true });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/code') {
    const body = await readBody(req);
    try {
      remote.sendCode(String(body.code || '').trim());
      log('Code sent, waiting for TV…');
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/key') {
    const body = await readBody(req);
    try {
      if (!remote || state.phase !== 'ready') throw new Error('Not connected yet');
      const key = String(body.key || '');
      if (key === 'POWER') remote.sendPower();
      else {
        if (!RemoteKeyCode[key]) throw new Error('Unknown key: ' + key);
        const dir = body.long ? RemoteDirection.START_LONG : RemoteDirection.SHORT;
        remote.sendKey(RemoteKeyCode[key], dir);
        if (body.long) setTimeout(() => { try { remote.sendKey(RemoteKeyCode[key], RemoteDirection.END_LONG); } catch {} }, 500);
      }
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/applink') {
    const body = await readBody(req);
    try {
      if (!remote || state.phase !== 'ready') throw new Error('Not connected yet');
      remote.sendAppLink(String(body.url));
      log('Launching app: ' + body.url);
      json(res, 200, { ok: true });
    } catch (e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/stop') {
    try { if (remote) remote.stop(); } catch {}
    remote = null;
    state.phase = 'idle';
    state.message = 'Disconnected.';
    json(res, 200, { ok: true });
    return;
  }
  const STATIC = {
    '/index.html': ['../index.html', 'text/html'],
    '/style.css': ['../style.css', 'text/css'],
    '/app.js': ['../app.js', 'application/javascript'],
    '/test100.html': ['../test100.html', 'text/html'],
    '/test100.js': ['../test100.js', 'application/javascript'],
    '/gesture.html': ['gesture.html', 'text/html'],
    '/gesture.js': ['gesture.js', 'application/javascript'],
  };
  if (req.method === 'GET' && STATIC[url.pathname]) {
    try {
      res.writeHead(200, { 'Content-Type': STATIC[url.pathname][1] });
      res.end(fs.readFileSync(path.join(__dirname, STATIC[url.pathname][0])));
    } catch { json(res, 404, { ok: false }); }
    return;
  }
  json(res, 404, { ok: false });
});

server.listen(PORT, () => {
  console.log(`TV remote live at http://localhost:${PORT}  (TV=${TV_HOST})`);
});

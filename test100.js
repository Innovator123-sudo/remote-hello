// test100.js — 100-signal brute force tester. Same packet format as app.js,
// so existing rf_bridge.ino firmware understands it with no changes.
// Packet: TX P=<PROTO> A=<ADDR> C=<CMD> B=<BITS> F=<FREQ> TEST=<n> CMD=POWER

function hex(n, pad) {
  let s = (n >>> 0).toString(16).toUpperCase();
  while (s.length < pad) s = "0" + s;
  return "0x" + s;
}

// Build the 100 signals. #1 is verified Panasonic VIERA POWER.
const SIGNALS = [];
(function build() {
  // 1-25 : PANASONIC family (addr 0x4004). #1 verified, rest are real variants.
  const panaCmds = [
    "0x0100BCBD", "0x0100BCB9", "0x0100BCF9", "0x0100BCB5", "0x0100BCA5",
    "0x01003CCD", "0x0100BCAD", "0x0100BCCD", "0x01008CBD", "0x01004CBD",
    "0x0100B4BD", "0x0100B8BD", "0x0101BCBD", "0x0102BCBD", "0x0100BDBD",
    "0x0100BBBD", "0x0100BABD", "0x0100B9BD", "0x0100B7BD", "0x0100B3BD",
    "0x0100B1BD", "0x0100A8BD", "0x010098BD", "0x010088BD", "0x010078BD"
  ];
  const panaDesc = [
    "Panasonic VIERA POWER (verified LIRC/Tasmota dump)",
    "Panasonic POWER variant sub-device B9",
    "Panasonic POWER variant F9",
    "Panasonic POWER variant B5",
    "Panasonic POWER variant A5",
    "Panasonic POWER OLD chassis (3CCD)",
    "Panasonic POWER variant BCAD",
    "Panasonic POWER variant BCCD",
    "Panasonic POWER variant 8C",
    "Panasonic POWER variant 4C (mute-adjacent)",
    "Panasonic POWER variant B4",
    "Panasonic POWER variant B8",
    "Panasonic POWER device-01 variant",
    "Panasonic POWER device-02 variant",
    "Panasonic POWER checksum variant BD",
    "Panasonic POWER checksum variant BB",
    "Panasonic POWER checksum variant BA",
    "Panasonic POWER checksum variant B9b",
    "Panasonic POWER checksum variant B7",
    "Panasonic POWER checksum variant B3",
    "Panasonic POWER checksum variant B1",
    "Panasonic POWER checksum variant A8",
    "Panasonic POWER checksum variant 98",
    "Panasonic POWER checksum variant 88",
    "Panasonic POWER checksum variant 78"
  ];
  for (let i = 0; i < 25; i++)
    SIGNALS.push({ n: i + 1, proto: "PANASONIC", addr: "0x4004", cmd: panaCmds[i], bits: 48, desc: panaDesc[i] });

  // 26-55 : NEC family POWER sweep (Samsung 26, LG 27, rest sweep address).
  SIGNALS.push({ n: 26, proto: "NEC", addr: "0x0", cmd: "0xE0E040BF", bits: 32, desc: "Samsung POWER (NEC-like)" });
  SIGNALS.push({ n: 27, proto: "NEC", addr: "0x0", cmd: "0x20DF10EF", bits: 32, desc: "LG POWER" });
  SIGNALS.push({ n: 28, proto: "NEC", addr: "0x0", cmd: "0x807F48B7", bits: 32, desc: "Hisense POWER" });
  SIGNALS.push({ n: 29, proto: "NEC", addr: "0x0", cmd: "0xE0984BB7", bits: 32, desc: "TCL POWER" });
  SIGNALS.push({ n: 30, proto: "NEC", addr: "0x0", cmd: "0x2FD48B7", bits: 32, desc: "Toshiba POWER" });
  SIGNALS.push({ n: 31, proto: "NEC", addr: "0x0", cmd: "0x04FB10EF", bits: 32, desc: "Vizio POWER" });
  SIGNALS.push({ n: 32, proto: "SAMSUNG", addr: "0x0", cmd: "0xE0E040BF", bits: 32, desc: "Samsung POWER (native proto)" });
  // NEC generic address sweep, function POWER-ish (0x10/0x40 complements)
  const necAddrs = ["0x00FF", "0x40BF", "0x20DF", "0x807F", "0x02FD", "0x00FF", "0x10EF", "0x08F7",
    "0x18E7", "0x30CF", "0x7A85", "0x5DA2", "0x48B7", "0x28D7", "0xA857", "0x6897", "0xE817",
    "0x9867", "0x08F7", "0xB04F", "0x708F", "0x8877", "0x48B7"];
  for (let i = 0; i < 23; i++) {
    const a = necAddrs[i % necAddrs.length];
    const code = "0x" + a.replace("0x", "") + "10EF";
    SIGNALS.push({ n: 33 + i, proto: "NEC", addr: "0x0", cmd: code, bits: 32, desc: "NEC generic POWER sweep " + code });
  }

  // 56-70 : SONY (12/15/20-bit POWER variants, all repeat x2 in firmware)
  const sony = ["0xA90", "0x1A90", "0x61A90", "0x290", "0xC90", "0x490", "0xA90", "0x2A90",
    "0x6A90", "0xAA90", "0xCA90", "0xEA90", "0x1A90", "0x5A90", "0x9A90"];
  const sonyBits = [12, 15, 20, 12, 12, 12, 15, 12, 12, 12, 12, 12, 15, 15, 15];
  for (let i = 0; i < 15; i++)
    SIGNALS.push({ n: 56 + i, proto: "SONY", addr: "0x0", cmd: sony[i], bits: sonyBits[i], desc: "Sony POWER " + sonyBits[i] + "-bit " + sony[i] });

  // 71-80 : PHILIPS RC5/RC6 + SHARP
  const phil = [
    ["RC5", "0xC", 12, "Philips RC5 POWER"],
    ["RC5", "0x8C", 12, "Philips RC5 POWER toggle-bit"],
    ["RC6", "0x100C", 20, "Philips RC6 POWER"],
    ["RC6", "0x100C", 24, "Philips RC6 POWER 24-bit"],
    ["RC5", "0xD", 12, "Philips RC5 STANDBY variant"],
    ["SHARP", "0x4000", 15, "Sharp Aquos POWER"],
    ["SHARP", "0x5AA5", 15, "Sharp POWER alt"],
    ["NEC", "0x7F8002FD", 32, "Sharp NEC-variant POWER"],
    ["NEC", "0x55AA10EF", 32, "Generic Asia POWER A"],
    ["NEC", "0x00FF02FD", 32, "Generic Asia POWER B"]
  ];
  for (let i = 0; i < 10; i++)
    SIGNALS.push({ n: 71 + i, proto: phil[i][0], addr: "0x0", cmd: phil[i][1], bits: phil[i][2], desc: phil[i][3] });

  // 81-90 : more brand POWERs (duplicates with native proto for coverage)
  const extra = [
    ["NEC", "0xE0E040BF", 32, "Samsung POWER via NEC"],
    ["NEC", "0x20DF10EF", 32, "LG POWER repeat"],
    ["PANASONIC", "0x4004", 48, "Panasonic POWER repeat ( Grass )", "0x0100BCBD"],
    ["SONY", "0x0", 15, "Sony POWER 15-bit alt", "0x1A90"],
    ["RC5", "0x0", 12, "Philips POWER repeat", "0xC"],
    ["NEC", "0x0", 32, "Onida/BPL POWER", "0x00FF906F"],
    ["NEC", "0x0", 32, "Videocon POWER", "0x00FFA05F"],
    ["NEC", "0x0", 32, "Mi/Xiaomi TV POWER", "0x20DF10EF"],
    ["NEC", "0x0", 32, "OnePlus TV POWER", "0x20DF10EF"],
    ["SAMSUNG", "0x0", 32, "Samsung POWER repeat", "0xE0E040BF"]
  ];
  const extraCmd = ["0xE0E040BF", "0x20DF10EF", "0x0100BCBD", "0x1A90", "0xC", "0x00FF906F", "0x00FFA05F", "0x20DF10EF", "0x20DF10EF", "0xE0E040BF"];
  for (let i = 0; i < 10; i++)
    SIGNALS.push({ n: 81 + i, proto: extra[i][0], addr: extra[i][1] === "0x0" ? "0x0" : extra[i][1], cmd: extraCmd[i], bits: extra[i][2], desc: extra[i][3] || extra[i][0] });

  // 91-100 : RF433 + oddballs
  for (let i = 0; i < 6; i++)
    SIGNALS.push({ n: 91 + i, proto: "RF433", addr: "0x0", cmd: String(5393 + i), bits: 24, desc: "433MHz RF code " + (5393 + i) });
  SIGNALS.push({ n: 97, proto: "NEC", addr: "0x0", cmd: "0xFFFFFFFF", bits: 32, desc: "NEC REPEAT frame" });
  SIGNALS.push({ n: 98, proto: "PANASONIC", addr: "0x4004", cmd: "0x01004C4D", bits: 48, desc: "Panasonic MUTE (TV reacts = aim OK)" });
  SIGNALS.push({ n: 99, proto: "PANASONIC", addr: "0x4004", cmd: "0x01000405", bits: 48, desc: "Panasonic VOL+ (visible reaction)" });
  SIGNALS.push({ n: 100, proto: "PANASONIC", addr: "0x4004", cmd: "0x0100BCBD", bits: 48, desc: "Panasonic POWER final retry" });
})();

let current = 1;
let mode = "demo";
let port = null, writer = null;
let autoTimer = null;
const locked = [];

const $ = id => document.getElementById(id);

function log(msg, color) {
  const d = document.createElement("div");
  d.style.color = color || "#7dd3fc";
  d.textContent = "[" + new Date().toLocaleTimeString() + "] " + msg;
  $("log").prepend(d);
}

function packetFor(s) {
  return "TX P=" + s.proto + " A=" + s.addr + " C=" + s.cmd + " B=" + s.bits +
    " F=43392000 TEST=" + s.n + " CMD=POWER\n";
}

function show(n) {
  current = Math.min(100, Math.max(1, n));
  const s = SIGNALS[current - 1];
  $("bigNum").textContent = s.n;
  $("sigProto").textContent = s.proto + " " + s.bits + "-bit";
  $("sigCode").textContent = s.addr + " / " + s.cmd;
  $("sigDesc").textContent = "#" + s.n + " — " + s.desc;
  document.querySelectorAll(".nbtn").forEach(b => {
    const on = parseInt(b.dataset.n) === current;
    b.classList.toggle("cur", on);
  });
}

async function send(n) {
  const s = SIGNALS[(n || current) - 1];
  show(s.n);
  const pkt = packetFor(s);
  document.querySelector('.nbtn[data-n="' + s.n + '"]')?.classList.add("sent");
  if (mode === "serial" && writer) {
    try {
      await writer.write(new TextEncoder().encode(pkt));
      // Panasonic/Sony like a double-tap
      if (s.proto === "PANASONIC" || s.proto === "SONY") {
        await new Promise(r => setTimeout(r, 220));
        await writer.write(new TextEncoder().encode(pkt));
      }
      log("TX #" + s.n + " [" + s.proto + "] " + s.cmd + " — did TV blink/react?", "#22c55e");
    } catch (e) { log("Write failed: " + e.message, "#f87171"); }
  } else {
    log("[DEMO] #" + s.n + " [" + s.proto + "] " + s.cmd + " — connect USB blaster for real output", "#fbbf24");
  }
}

async function connect() {
  try {
    if (!("serial" in navigator)) { alert("Use Chrome or Edge (Brave works too) on laptop."); return; }
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    writer = port.writable.getWriter();
    mode = "serial";
    $("statusDot").className = "dot on";
    $("statusText").textContent = "Connected — transmitting for real";
    $("modeNote").textContent = "LIVE: signals leave the USB blaster. Go 1 → 100.";
    log("Serial connected @9600. Start at #1.", "#22c55e");
  } catch (e) {
    log("Connect cancelled/failed: " + e.message + " — still in DEMO.", "#f87171");
  }
}

async function disconnect() {
  stopAuto();
  try {
    if (writer) { writer.releaseLock(); writer = null; }
    if (port) { await port.close(); port = null; }
  } catch (e) {}
  mode = "demo";
  $("statusDot").className = "dot";
  $("statusText").textContent = "DEMO mode — no output";
  $("modeNote").textContent = "DEMO: nothing reaches the TV until you Connect.";
}

function startAuto() {
  if (autoTimer) return;
  log("AUTO 1→100 started, 2s apart. Click STOP + LOCK when TV reacts.", "#fbbf24");
  $("btnAuto").textContent = "⏸ Pause auto";
  autoTimer = setInterval(() => {
    if (current >= 100) { stopAuto(); log("Reached #100.", "#fbbf24"); return; }
    send(current + 1);
  }, 2000);
}
function stopAuto() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  const b = $("btnAuto");
  if (b) b.textContent = "▶ Auto 1→100 (2s apart)";
}

function lockIt() {
  stopAuto();
  const s = SIGNALS[current - 1];
  locked.push(s.n);
  $("lockedList").textContent = locked.length ? locked.join(", ") : "—";
  log("LOCKED #" + s.n + " [" + s.proto + " " + s.cmd + "]. Test VOL+/MUTE in same family next.", "#22c55e");
}

window.addEventListener("DOMContentLoaded", () => {
  const grid = $("grid");
  SIGNALS.forEach(s => {
    const b = document.createElement("button");
    b.className = "nbtn";
    b.dataset.n = s.n;
    b.textContent = s.n;
    b.title = "#" + s.n + " " + s.proto + " " + s.cmd;
    b.onclick = () => send(s.n);
    grid.appendChild(b);
  });
  show(1);
  $("btnSend").onclick = () => send(current);
  $("btnPrev").onclick = () => { stopAuto(); show(current - 1); };
  $("btnNext").onclick = () => { stopAuto(); show(current); send(current + 1); };
  $("btnAuto").onclick = () => (autoTimer ? stopAuto() : startAuto());
  $("btnLock").onclick = lockIt;
  $("btnConnect").onclick = connect;
  $("btnDisconnect").onclick = disconnect;
  document.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") send(current + 1);
    else if (e.key === "ArrowLeft") show(current - 1);
    else if (e.key === " ") { e.preventDefault(); send(current); }
  });
  log("Ready. #1 = verified Panasonic POWER. Press SEND, watch TV, go 1→100.");
});

// Universal TV Remote — Website -> USB/WiFi Blaster -> IR (all TVs) + RF
// Packet format: TX P=<PROTO> A=<ADDR_HEX> C=<CMD_HEX> B=<BITS> F=<RF_FREQ> BRAND=x CMD=y
// Firmware parses P/A/C/B and fires real IR protocol (not fake RF).

const DB = {
  // VERIFIED Panasonic VIERA (48-bit Kaseikyo, addr 0x4004). Source: LIRC + Tasmota IR dumps.
  panasonic: { proto:"PANASONIC", addr:"0x4004", bits:48, label:"IR 37kHz",
    codes:{ POWER:"0x0100BCBD", MUTE:"0x01004C4D", "VOL+":"0x01000405", "VOL-":"0x01008485",
      "CH+":"0x01002C2D", "CH-":"0x0100ACAD", UP:"0x01005253", DOWN:"0x0100D2D3",
      LEFT:"0x01007273", RIGHT:"0x0100F2F3", OK:"0x01009293", MENU:"0x01004A4B",
      BACK:"0x01002B2A", EXIT:"0x0100CBCA", INPUT:"0x0100A0A1",
      PLAY:"0x01900392", PAUSE:"0x01908312", STOP:"0x019043D2",
      "1":"0x01000809","2":"0x01008889","3":"0x01004849","4":"0x0100C8C9","5":"0x01002829",
      "6":"0x0100A8A9","7":"0x01006869","8":"0x0100E8E9","9":"0x01001819","0":"0x01009899" } },
  samsung: { proto:"SAMSUNG", addr:"0x0", bits:32, label:"IR 38kHz",
    codes:{ POWER:"0xE0E040BF", MUTE:"0xE0E0F00F", "VOL+":"0xE0E0E01F", "VOL-":"0xE0E0D02F",
      "CH+":"0xE0E048B7", "CH-":"0xE0E008F7", UP:"0xE0E006F9", DOWN:"0xE0E08679",
      LEFT:"0xE0E0A659", RIGHT:"0xE0E046B9", OK:"0xE0E016E9", MENU:"0xE0E058A7",
      BACK:"0xE0E01AE5", EXIT:"0xE0E0B44B", INPUT:"0xE0E0D0AF",
      PLAY:"0xE0E0E21D", PAUSE:"0xE0E0E21D", STOP:"0xE0E0CE31",
      "1":"0xE0E020DF","2":"0xE0E0A05F","3":"0xE0E0609F","4":"0xE0E010EF","5":"0xE0E0906F",
      "6":"0xE0E050AF","7":"0xE0E030CF","8":"0xE0E0B04F","9":"0xE0E0708F","0":"0xE0E08877" } },
  lg: { proto:"NEC", addr:"0x0", bits:32, label:"IR 38kHz",
    codes:{ POWER:"0x20DF10EF", MUTE:"0x20DF906F", "VOL+":"0x20DF40BF", "VOL-":"0x20DFC03F",
      "CH+":"0x20DF00FF", "CH-":"0x20DF807F", UP:"0x20DF02FD", DOWN:"0x20DF827D",
      LEFT:"0x20DFE01F", RIGHT:"0x20DF609F", OK:"0x20DF22DD", MENU:"0x20DFC23D",
      BACK:"0x20DF14EB", EXIT:"0x20DFDA25", INPUT:"0x20DFD02F",
      PLAY:"0x20DF0DF2", PAUSE:"0x20DF5DA2", STOP:"0x20DF8D72",
      "1":"0x20DF8877","2":"0x20DF48B7","3":"0x20DFC837","4":"0x20DF28D7","5":"0x20DFA857",
      "6":"0x20DF6897","7":"0x20DFE817","8":"0x20DF18E7","9":"0x20DF9867","0":"0x20DF08F7" } },
  sony: { proto:"SONY", addr:"0x0", bits:12, label:"IR 40kHz",
    codes:{ POWER:"0xA90", MUTE:"0x290", "VOL+":"0x490", "VOL-":"0xC90",
      "CH+":"0x090", "CH-":"0x890", UP:"0x2F0", DOWN:"0xAF0",
      LEFT:"0x2D0", RIGHT:"0xCD0", OK:"0xA70", MENU:"0x070",
      BACK:"0xA80", EXIT:"0xD80", INPUT:"0xA50",
      PLAY:"0x4CE", PAUSE:"0x4CE", STOP:"0x1CE",
      "1":"0x010","2":"0x810","3":"0x410","4":"0xC10","5":"0x210",
      "6":"0xA10","7":"0x610","8":"0xE10","9":"0x110","0":"0x910" } },
  philips: { proto:"RC5", addr:"0x0", bits:12, label:"IR 36kHz",
    codes:{ POWER:"0xC", MUTE:"0xD", "VOL+":"0x10", "VOL-":"0x11",
      "CH+":"0x20", "CH-":"0x21", UP:"0x50", DOWN:"0x51",
      LEFT:"0x55", RIGHT:"0x56", OK:"0x57", MENU:"0x52",
      BACK:"0x53", EXIT:"0x5F", INPUT:"0x38",
      PLAY:"0x35", PAUSE:"0x30", STOP:"0x36",
      "1":"0x1","2":"0x2","3":"0x3","4":"0x4","5":"0x5",
      "6":"0x6","7":"0x7","8":"0x8","9":"0x9","0":"0x0" } },
  tcl: { proto:"NEC", addr:"0x0", bits:32, label:"IR 38kHz",
    codes:{ POWER:"0xE0984BB7", MUTE:"0xE11848B7", "VOL+":"0xE15948B7", "VOL-":"0xE15E48B7",
      "CH+":"0xE15A48B7", "CH-":"0xE15248B7", UP:"0xE11B48B7", DOWN:"0xE11F48B7",
      LEFT:"0xE15148B7", RIGHT:"0xE15348B7", OK:"0xE15D48B7", MENU:"0xE11D48B7",
      BACK:"0xE14D48B7", EXIT:"0xE14B48B7", INPUT:"0xE14748B7",
      PLAY:"0xE15648B7", PAUSE:"0xE15648B7", STOP:"0xE15C48B7",
      "1":"0xE11E48B7","2":"0xE11A48B7","3":"0xE11248B7","4":"0xE10A48B7","5":"0xE10248B7",
      "6":"0xE18248B7","7":"0xE1C242B7","8":"0xE1CAA7","9":"0xE12AA7","0":"0xE1AA57" } },
  hisense: { proto:"NEC", addr:"0x0", bits:32, label:"IR 38kHz",
    codes:{ POWER:"0x807F48B7", MUTE:"0x807F10EF", "VOL+":"0x807F40BF", "VOL-":"0x807FC03F",
      "CH+":"0x807F00FF", "CH-":"0x807F807F", UP:"0x807F02FD", DOWN:"0x807F827D",
      LEFT:"0x807FE01F", RIGHT:"0x807F609F", OK:"0x807F22DD", MENU:"0x807FC23D",
      BACK:"0x807F14EB", EXIT:"0x807FDA25", INPUT:"0x807FD02F",
      PLAY:"0x807F0DF2", PAUSE:"0x807F5DA2", STOP:"0x807F8D72",
      "1":"0x807F8877","2":"0x807F48B7","3":"0x807FC837","4":"0x807F28D7","5":"0x807FA857",
      "6":"0x807F6897","7":"0x807FE817","8":"0x807F18E7","9":"0x807F9867","0":"0x807F08F7" } },
  sharp: { proto:"SHARP", addr:"0x0", bits:15, label:"IR 38kHz",
    codes:{ POWER:"0x4000", MUTE:"0x4040", "VOL+":"0x4020", "VOL-":"0x40A0",
      "CH+":"0x4080", "CH-":"0x40C0", UP:"0x41A0", DOWN:"0x4190",
      LEFT:"0x41B0", RIGHT:"0x4180", OK:"0x41A5", MENU:"0x40E0",
      BACK:"0x41E0", EXIT:"0x41D0", INPUT:"0x4100",
      PLAY:"0x45C0", PAUSE:"0x45C0", STOP:"0x45D0",
      "1":"0x4001","2":"0x4002","3":"0x4003","4":"0x4004","5":"0x4005",
      "6":"0x4006","7":"0x4007","8":"0x4008","9":"0x4009","0":"0x4000" } },
  toshiba: { proto:"NEC", addr:"0x0", bits:32, label:"IR 38kHz",
    codes:{ POWER:"0x2FD48B7", MUTE:"0x2FD08F7", "VOL+":"0x2FD40BF", "VOL-":"0x2FDC03F",
      "CH+":"0x2FD00FF", "CH-":"0x2FD807F", UP:"0x2FD02FD", DOWN:"0x2FD827D",
      LEFT:"0x2FDE01F", RIGHT:"0x2FD609F", OK:"0x2FD22DD", MENU:"0x2FDC23D",
      BACK:"0x2FD14EB", EXIT:"0x2FDDA25", INPUT:"0x2FDD02F",
      PLAY:"0x2FD0DF2", PAUSE:"0x2FD5DA2", STOP:"0x2FD8D72",
      "1":"0x2FD8877","2":"0x2FD48B7","3":"0x2FDC837","4":"0x2FD28D7","5":"0x2FDA857",
      "6":"0x2FD6897","7":"0x2FDE817","8":"0x2FD18E7","9":"0x2FD9867","0":"0x2FD08F7" } },
  vizio: { proto:"NEC", addr:"0x0", bits:32, label:"IR 38kHz",
    codes:{ POWER:"0x04FB10EF", MUTE:"0x04FB906F", "VOL+":"0x04FB40BF", "VOL-":"0x04FBC03F",
      "CH+":"0x04FB00FF", "CH-":"0x04FB807F", UP:"0x04FB02FD", DOWN:"0x04FB827D",
      LEFT:"0x04FBE01F", RIGHT:"0x04FB609F", OK:"0x04FB22DD", MENU:"0x04FBC23D",
      BACK:"0x04FB14EB", EXIT:"0x04FBDA25", INPUT:"0x04FBD02F",
      PLAY:"0x04FB0DF2", PAUSE:"0x04FB5DA2", STOP:"0x04FB8D72",
      "1":"0x04FB8877","2":"0x04FB48B7","3":"0x04FBC837","4":"0x04FB28D7","5":"0x04FBA857",
      "6":"0x04FB6897","7":"0x04FBE817","8":"0x04FB18E7","9":"0x04FB9867","0":"0x04FB08F7" } },
  generic_rf: { proto:"RF433", addr:"0x0", bits:24, label:"433MHz OOK", isRF:true,
    codes:{ POWER:"5393", MUTE:"5394", "VOL+":"5395", "VOL-":"5396",
      "CH+":"5397", "CH-":"5398", UP:"5399", DOWN:"5400",
      LEFT:"5401", RIGHT:"5402", OK:"5403", MENU:"5404",
      BACK:"5405", EXIT:"5406", INPUT:"5407",
      PLAY:"5408", PAUSE:"5408", STOP:"5409",
      "1":"5411","2":"5412","3":"5413","4":"5414","5":"5415",
      "6":"5416","7":"5417","8":"5418","9":"5419","0":"5420" } }
};

const FIND_ORDER = ["panasonic","samsung","lg","sony","philips","tcl","hisense","sharp","toshiba","vizio"];

let brand = "panasonic";
let freq = 43392000;
let mode = "demo";
let port = null, writer = null, ws = null;
let finding = false;

const $ = id => document.getElementById(id);
const logEl = $("log"), wave = $("wave"), ctx = wave.getContext("2d");

function log(msg, color="#7dd3fc"){
  const d = document.createElement("div");
  d.style.color = color;
  d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.prepend(d);
}
function setStatus(text, sub, on){
  $("statusText").textContent = text;
  $("portInfo").textContent = sub;
  $("statusDot").className = "dot" + (on ? " on" : "");
}
function setBrand(b){
  brand = b;
  $("brandSelect").value = b;
  const nice = b.charAt(0).toUpperCase()+b.slice(1);
  $("remoteTitle").textContent = nice + " Remote";
  $("freqBadge").textContent = DB[b].isRF ? ((freq/1000000).toFixed(2)+" MHz") : (nice + " • " + DB[b].label);
  log(`Brand: ${nice} (${DB[b].proto})`);
}

$("brandSelect").onchange = e => setBrand(e.target.value);
document.querySelectorAll("#freqRow .chip").forEach(b=>{
  b.onclick = ()=>{
    document.querySelectorAll("#freqRow .chip").forEach(x=>x.classList.remove("active-select"));
    b.classList.add("active-select");
    freq = parseInt(b.dataset.freq);
    if(DB[brand].isRF) $("freqBadge").textContent = (freq/1000000).toFixed(2)+" MHz";
    log(`RF freq ${(freq/1000000).toFixed(2)} MHz (RF devices only)`);
  };
});

$("btnSerial").onclick = async ()=>{
  try{
    if(!("serial" in navigator)){ alert("Use Chrome/Edge on laptop for USB. Otherwise Demo only."); return; }
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    writer = port.writable.getWriter();
    mode = "serial"; setStatus("Connected — USB Universal Blaster", "9600 baud → IR LED (+RF) → TV", true);
    log("USB blaster connected. Point IR LED at TV, press POWER.", "#22c55e");
  }catch(e){ log("Serial failed: "+e.message, "#f87171"); }
};
$("btnWifi").onclick = ()=>{
  const url = $("espIp").value.trim() || "ws://192.168.1.50:81";
  try{
    ws = new WebSocket(url);
    ws.onopen = ()=>{ mode="wifi"; setStatus("Connected — ESP Blaster", url, true); log("ESP link open: "+url,"#22c55e"); };
    ws.onerror = ()=> log("ESP failed. Flash universal_bridge_esp.ino, check IP.", "#f87171");
  }catch(e){ log("WS error: "+e.message,"#f87171"); }
};
$("btnDemo").onclick = ()=>{ mode="demo"; setStatus("Disconnected — DEMO mode","Visualizer only, no output",false); log("Demo mode."); };
$("btnDisconnect").onclick = async ()=>{
  finding = false;
  try{ if(writer){writer.releaseLock(); writer=null;} if(port){await port.close(); port=null;} if(ws){ws.close(); ws=null;} }catch(e){}
  mode="demo"; setStatus("Disconnected — DEMO mode","Visualizer only, no output",false);
};

// --- Core send ---
function buildPacket(b, cmd){
  const e = DB[b];
  const code = (e.codes[cmd] !== undefined) ? e.codes[cmd] : cmd;
  return { entry:e, code, packet:`TX P=${e.proto} A=${e.addr} C=${code} B=${e.bits} F=${freq} BRAND=${b} CMD=${cmd}\n` };
}

async function sendRaw(packet){
  if(mode==="serial" && writer) await writer.write(new TextEncoder().encode(packet));
  else if(mode==="wifi" && ws && ws.readyState===1) ws.send(packet);
}

async function sendCmd(cmd, forcedBrand){
  const b = forcedBrand || brand;
  const { entry, code, packet } = buildPacket(b, cmd);
  $("lastCode").textContent = `Last: [${b}] ${cmd} → ${entry.proto} ${code}`;
  drawWave(code, entry.isRF);
  beep(entry.isRF ? 1200 : 1900);
  await sendRaw(packet);
  const tag = (mode==="demo") ? "[DEMO] would send" : "TX";
  const color = (mode==="demo") ? "#fbbf24" : "#22c55e";
  log(`${tag} [${b}/${entry.proto}] ${cmd}=${code}${entry.isRF?" @"+(freq/1000000).toFixed(2)+"MHz":""}`, color);
  return packet;
}

// --- Auto-find: brute-force POWER across every brand ---
$("btnFind").onclick = async ()=>{
  if(finding){ finding=false; $("findStatus").textContent=""; log("Auto-find stopped."); return; }
  finding = true;
  $("btnFind").textContent = "⏹ STOP auto-find (click when TV reacts!)";
  log("Auto-find started: sending POWER for each brand, 1.5s apart. Watch your TV!", "#fbbf24");
  for(const b of FIND_ORDER){
    if(!finding) break;
    setBrand(b);
    $("findStatus").textContent = `Trying ${b} POWER... (did TV blink/react? click STOP, then use this brand)`;
    // Panasonic/Sony like repeats
    await sendCmd("POWER", b);
    await sleep(500);
    await sendCmd("POWER", b);
    await sleep(1500);
  }
  if(finding){ finding=false; $("btnFind").textContent="🔍 TV not responding? AUTO-FIND my TV"; $("findStatus").textContent="Done. If nothing worked, check IR LED wiring + aim."; log("Auto-find done. Check wiring/aim if no response.", "#f87171"); }
  else { const locked = brand; $("btnFind").textContent="🔍 TV not responding? AUTO-FIND my TV"; $("findStatus").textContent=`Locked to ${locked}. Use remote now.`; log(`Locked to ${locked}.`, "#22c55e"); }
};
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

// --- Buttons (Panasonic POWER likes 2-3x, hold-to-repeat VOL/P) ---
let holdTimer=null;
document.querySelectorAll(".rbtn").forEach(b=>{
  const cmd = b.dataset.cmd;
  b.addEventListener("pointerdown", async ()=>{
    if(cmd==="POWER" && brand==="panasonic"){
      await sendCmd(cmd); await sleep(180); await sendCmd(cmd);
    } else await sendCmd(cmd);
    if(["VOL+","VOL-","CH+","CH-"].includes(cmd)) holdTimer = setInterval(()=>sendCmd(cmd), 300);
  });
  ["pointerup","pointerleave"].forEach(ev=>b.addEventListener(ev, ()=>{ if(holdTimer){clearInterval(holdTimer); holdTimer=null;} }));
});

function drawWave(code, isRF){
  ctx.fillStyle="#040814"; ctx.fillRect(0,0,wave.width,wave.height);
  ctx.strokeStyle="#1e3a5f"; ctx.beginPath(); ctx.moveTo(0,70); ctx.lineTo(wave.width,70); ctx.stroke();
  let n = 0; for(const c of String(code)) n = (n*31 + c.charCodeAt(0)) >>> 0;
  const bits = n.toString(2).padStart(isRF?24:32,"0");
  ctx.strokeStyle = isRF ? "#f59e0b" : "#38bdf8"; ctx.lineWidth=2;
  ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur=8;
  ctx.beginPath();
  let x=10; const w=(wave.width-20)/bits.length;
  ctx.moveTo(x,100);
  for(const bit of bits){
    if(bit==="1"){
      ctx.lineTo(x,100); ctx.lineTo(x,40);
      const steps = isRF?2:4;
      for(let i=0;i<steps;i++){ ctx.lineTo(x+w/(steps*2),100); ctx.lineTo(x+w/(steps*2),40); x+=w/steps; }
      ctx.lineTo(x,100);
    } else { ctx.lineTo(x+w,100); x+=w; }
  }
  ctx.stroke(); ctx.shadowBlur=0; ctx.lineWidth=1;
  $("modLabel").textContent = isRF ? "433MHz OOK" : "IR 38kHz burst";
}

function beep(f=1900){
  try{
    const ac = beep.ctx || (beep.ctx = new (window.AudioContext||window.webkitAudioContext)());
    const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.frequency.value = f; g.gain.value = 0.04;
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime+0.08); o.stop(ac.currentTime+0.09);
  }catch(e){}
}

setBrand("panasonic");
log("Ready. Panasonic selected. Connect USB blaster, aim IR LED, press POWER 2x.");
drawWave("0x0100BCBD", false);

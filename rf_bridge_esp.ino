// universal_bridge_esp.ino — ESP32 WiFi Universal IR + RF blaster
// Hardware: ESP32 + IR LED (GPIO 4 via transistor, see .ino for Arduino) + optional FS1000A on GPIO 12
// Libraries: ESP32 core + "IRremoteESP8266" (crankyoldgit) + "RCSwitch" + "WebSocketsServer" (Links2004)
// Set WIFI_SSID/PASS, upload, read IP from Serial Monitor, enter ws://<IP>:81 on site.

#include <WiFi.h>
#include <WebSocketsServer.h>
#include <IRremoteESP8266.h>
#include <IRsend.h>
#include <RCSwitch.h>

#define IR_PIN 4
#define RF_PIN 12
const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASS = "YOUR_PASSWORD";

IRsend ir(IR_PIN);
RCSwitch rf;
WebSocketsServer ws(81);

String field(const String& line, const String& key) {
  int i = line.indexOf(key + "=");
  if (i < 0) return "";
  int s = i + key.length() + 1;
  int e = line.indexOf(' ', s);
  if (e < 0) e = line.length();
  return line.substring(s, e);
}

void handlePacket(const String& line, uint8_t n, bool fromWs) {
  auto reply = [&](const String& s){ if(fromWs) ws.sendTXT(n, s); else Serial.println(s); };
  String P = field(line, "P"); P.toUpperCase();
  String As = field(line, "A");
  String Cs = field(line, "C");
  String Bs = field(line, "B");
  if (P.length() == 0 || Cs.length() == 0) { reply("ERR:bad-packet"); return; }
  uint16_t addr = (uint16_t)strtoul(As.c_str(), NULL, 16);
  uint64_t cmd;
  if (Cs.startsWith("0x") || Cs.startsWith("0X")) cmd = strtoull(Cs.c_str(), NULL, 16);
  else cmd = strtoull(Cs.c_str(), NULL, 10);
  int bits = Bs.toInt(); if (bits <= 0) bits = 32;

  if (P == "PANASONIC") {
    // IRremoteESP8266: full 48-bit = (addr<<32)|cmd
    uint64_t full = ((uint64_t)(addr == 0 ? 0x4004 : addr) << 32) | (cmd & 0xFFFFFFFFULL);
    ir.sendPanasonic64(full, 48);
    delay(60);
    ir.sendPanasonic64(full, 48);
  }
  else if (P == "SAMSUNG") ir.sendSAMSUNG((uint32_t)cmd, bits == 0 ? 32 : bits);
  else if (P == "NEC") ir.sendNEC((uint32_t)cmd, bits == 0 ? 32 : bits);
  else if (P == "SONY") ir.sendSony((uint32_t)cmd, bits <= 0 ? 12 : bits, 2);
  else if (P == "RC5") ir.sendRC5((uint32_t)cmd, bits <= 0 ? 12 : bits);
  else if (P == "RC6") ir.sendRC6((uint32_t)cmd, bits <= 0 ? 20 : bits);
  else if (P == "SHARP") ir.sendSharp((uint32_t)cmd, bits <= 0 ? 15 : bits);
  else if (P == "RF433") rf.send((unsigned long)cmd, bits <= 0 ? 24 : bits);
  else { reply("ERR:unknown-proto"); return; }
  reply("OK:" + Cs);
}

void onWs(uint8_t n, WStype_t t, uint8_t* p, size_t l) {
  if (t != WStype_TEXT) return;
  String line = String((char*)p).substring(0, l);
  handlePacket(line, n, true);
}

void setup() {
  Serial.begin(115200);
  ir.begin();
  rf.enableTransmit(RF_PIN);
  rf.setRepeatTransmit(6);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(400); Serial.print("."); }
  Serial.println(); Serial.println(WiFi.localIP());
  ws.begin();
  ws.onEvent(onWs);
}
void loop() {
  ws.loop();
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.startsWith("TX")) handlePacket(line, 0, false);
  }
}

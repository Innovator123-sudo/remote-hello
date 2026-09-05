// universal_bridge.ino — Universal USB IR + RF blaster (ALL TVs incl. Panasonic)
// Hardware:
//   Arduino Nano/Uno
//   IR LED 940nm on D3 (PWM, IRremote default) — REQUIRED for TVs
//     Short-range test: D3 -> 100ohm -> LED anode, LED cathode -> GND (3m)
//     Full-range: D3 -> 220ohm -> 2N2222 base; 5V -> LED+, LED- -> collector, emitter -> GND (10m)
//   Optional RF: FS1000A/SYN115 433MHz TX, DATA -> D12, VCC->5V, GND->GND + 17.3cm antenna
//
// Website packet: TX P=PANASONIC A=0x4004 C=0x100BCBD B=48 F=43392000 BRAND=panasonic CMD=POWER
// Protocols: PANASONIC, SAMSUNG, NEC, SONY, RC5, RC6, SHARP, RF433
//
// Libraries (Library Manager):
//   "IRremote" by Armin Joachimsmeyer (v4.x)
//   "RCSwitch" by sui77
// Upload, open Serial Monitor @9600 (should print UNIVERSAL-READY), then Connect on site.

#include <IRremote.hpp>
#include <RCSwitch.h>

RCSwitch rf;

String getField(const String& line, const String& key) {
  int i = line.indexOf(key + "=");
  if (i < 0) return "";
  int s = i + key.length() + 1;
  int e = line.indexOf(' ', s);
  if (e < 0) e = line.length();
  return line.substring(s, e);
}

void setup() {
  Serial.begin(9600);
  IrSender.begin(3);          // IR LED on D3
  IrSender.setSendPin(3);
  rf.enableTransmit(12);      // RF TX DATA on D12
  rf.setRepeatTransmit(6);
  Serial.println("UNIVERSAL-READY IR(D3)+RF(D12)");
}

void loop() {
  if (!Serial.available()) return;
  String line = Serial.readStringUntil('\n');
  line.trim();
  if (line.length() == 0 || !line.startsWith("TX")) return;

  String P = getField(line, "P"); P.toUpperCase();
  String As = getField(line, "A");
  String Cs = getField(line, "C");
  String Bs = getField(line, "B");
  if (P.length() == 0 || Cs.length() == 0) { Serial.println("ERR:bad-packet"); return; }

  uint16_t addr = (uint16_t)strtoul(As.c_str(), NULL, 16);
  uint32_t cmd  = (uint32_t)strtoul(Cs.c_str(), NULL, 16);
  // RF decimal codes come without 0x — strtoul hex still parses pure decimals, but force base10 if no 0x:
  if (!Cs.startsWith("0x") && !Cs.startsWith("0X")) cmd = strtoul(Cs.c_str(), NULL, 10);
  int bits = Bs.toInt();
  if (bits <= 0) bits = 32;

  Serial.print("SEND P="); Serial.print(P);
  Serial.print(" C="); Serial.println(Cs);

  if (P == "PANASONIC") {
    // Panasonic needs address + 32-bit command; send 2x for reliability
    IrSender.sendPanasonic(addr == 0 ? 0x4004 : addr, cmd);
    delay(60);
    IrSender.sendPanasonic(addr == 0 ? 0x4004 : addr, cmd);
  }
  else if (P == "SAMSUNG") { IrSender.sendSamsung(cmd, bits == 0 ? 32 : bits); }
  else if (P == "NEC")     { IrSender.sendNEC(cmd, bits == 0 ? 32 : bits); }
  else if (P == "SONY")    { IrSender.sendSony(cmd, bits <= 0 ? 12 : bits, 2); }
  else if (P == "RC5")     { IrSender.sendRC5(cmd, bits <= 0 ? 12 : bits, true); }
  else if (P == "RC6")     { IrSender.sendRC6(cmd, bits <= 0 ? 20 : bits, true); }
  else if (P == "SHARP")   { IrSender.sendSharp(cmd, bits <= 0 ? 15 : bits); }
  else if (P == "RF433")   { rf.send(cmd, bits <= 0 ? 24 : bits); }
  else { Serial.println("ERR:unknown-proto"); return; }

  Serial.println("OK");
}

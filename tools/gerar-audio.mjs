// Gera a música de fundo e os efeitos sonoros do Troco Certo em public/sons/.
// Tudo é sintetizado aqui (ondas quadradas, triangulares e ruído), no estilo
// "chiptune" de videogame, e codificado em MP3.
// Uso: npm run audio
import * as lamejs from "@breezystack/lamejs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sons");
const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

function track(seconds) { return new Float32Array(Math.ceil(seconds * RATE)); }

// Onda: "square" (com largura de pulso), "tri", "sine"
function wave(type, phase, duty = 0.5) {
  const p = phase - Math.floor(phase);
  if (type === "square") return p < duty ? 1 : -1;
  if (type === "tri") return 4 * Math.abs(p - 0.5) - 1;
  return Math.sin(2 * Math.PI * p);
}

// Nota com envelope (ataque rápido, leve queda, soltura suave)
function tone(buf, start, dur, hz, { type = "square", duty = 0.5, vol = 0.2, attack = 0.005, release = 0.05, decay = 1.5, slideTo = null, vibrato = 0 } = {}) {
  const s0 = Math.floor(start * RATE), n = Math.floor((dur + release) * RATE);
  let phase = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const t = i / RATE;
    const f = slideTo ? hz + (slideTo - hz) * Math.min(1, t / dur) : hz;
    phase += (f * (1 + vibrato * Math.sin(2 * Math.PI * 6 * t))) / RATE;
    let env = t < attack ? t / attack : Math.exp(-decay * (t - attack));
    if (t > dur) env *= Math.max(0, 1 - (t - dur) / release);
    buf[s0 + i] += wave(type, phase, duty) * env * vol;
  }
}

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
function noise(buf, start, dur, { vol = 0.1, decay = 30, lowpass = 0 } = {}) {
  const s0 = Math.floor(start * RATE), n = Math.floor(dur * RATE);
  let last = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    let v = rnd();
    if (lowpass) { last += (v - last) * lowpass; v = last; }
    buf[s0 + i] += v * Math.exp((-decay * i) / RATE) * vol;
  }
}
function kick(buf, t, vol = 0.45) { tone(buf, t, 0.12, 150, { type: "sine", vol, slideTo: 45, decay: 18, release: 0.02 }); }

// Eco curto para dar ambiente
function echo(buf, delay = 0.18, gain = 0.25) {
  const d = Math.floor(delay * RATE);
  for (let i = d; i < buf.length; i++) buf[i] += buf[i - d] * gain;
}

function toMp3(buf, file, { kbps = 96, peak = 0.89 } = {}) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  const g = max > 0 ? peak / max : 1;
  const pcm = new Int16Array(buf.length);
  for (let i = 0; i < buf.length; i++) pcm[i] = Math.max(-32767, Math.min(32767, Math.tanh(buf[i] * g) * 32767));
  const enc = new lamejs.Mp3Encoder(1, RATE, kbps);
  const parts = [];
  for (let i = 0; i < pcm.length; i += 1152) parts.push(enc.encodeBuffer(pcm.subarray(i, i + 1152)));
  parts.push(enc.flush());
  const out = Buffer.concat(parts.map((p) => Buffer.from(p.buffer, p.byteOffset, p.length)));
  writeFileSync(join(OUT, file), out);
  console.log(`${file}: ${(out.length / 1024).toFixed(0)} KB`);
}

// ---------- Música de fundo: 16 compassos em loop, 128 BPM, Dó maior ----------
function music() {
  const BPM = 128, E = 60 / BPM / 2; // colcheia
  const CH = { C: [60, 64, 67], Am: [57, 60, 64], F: [53, 57, 60], G: [55, 59, 62], Em: [52, 55, 59] };
  const chords = ["C", "Am", "F", "G", "C", "Am", "F", "G", "F", "G", "Em", "Am", "F", "G", "C", "C"];
  const _ = null, h = "-"; // pausa e "segura a nota"
  const melody = [
    [72, h, 76, h, 79, h, 76, 74], [72, h, 69, h, 72, 76, h, h], [77, h, 76, h, 74, h, 72, h], [74, h, 71, 67, 71, 74, 79, h],
    [76, h, 79, 76, 72, h, 76, 79], [81, h, 79, h, 76, h, 72, h], [77, 76, 74, 72, 74, h, 77, h], [79, h, h, h, _, _, 74, h],
    [81, h, 77, h, 72, h, 77, 81], [79, h, 74, h, 71, h, 74, 79], [76, h, 71, h, 67, h, 71, 76], [72, h, 76, h, 81, h, 79, 76],
    [77, h, 81, h, 84, h, 81, 77], [79, h, 83, h, 86, h, 83, 79], [84, h, 79, h, 76, h, 79, h], [72, h, h, h, _, _, _, _],
  ];
  const bars = chords.length, len = bars * 8 * E;
  const lead = track(len + 1), back = track(len + 1), drums = track(len + 1);

  chords.forEach((name, b) => {
    const t0 = b * 8 * E, [r, third, fifth] = CH[name];
    // Melodia: notas seguradas somam a duração
    const bar = melody[b];
    for (let k = 0; k < 8; k++) {
      if (typeof bar[k] !== "number") continue;
      let d = 1;
      while (k + d < 8 && bar[k + d] === h) d++;
      tone(lead, t0 + k * E, d * E * 0.92, midiHz(bar[k]), { type: "square", duty: 0.25, vol: 0.16, decay: 1.2, vibrato: 0.004 });
    }
    // Baixo saltitante
    [r - 12, _, r, _, r - 5, _, r, r - 5].forEach((m, k) => {
      if (m !== null) tone(back, t0 + k * E, E * 0.8, midiHz(m - 12), { type: "tri", vol: 0.32, decay: 2 });
    });
    // Arpejo rápido bem baixinho
    const arp = [r, third, fifth, r + 12];
    for (let k = 0; k < 16; k++) tone(back, t0 + (k * E) / 2, E * 0.4, midiHz(arp[k % 4] + 12), { type: "square", duty: 0.125, vol: 0.035, decay: 6 });
    // Bateria: bumbo 1 e 3, caixa 2 e 4, chimbal nas colcheias
    for (let q = 0; q < 4; q++) {
      const t = t0 + q * 2 * E;
      if (q % 2 === 0) kick(drums, t); else noise(drums, t, 0.15, { vol: 0.22, decay: 22, lowpass: 0.5 });
    }
    for (let k = 0; k < 8; k++) noise(drums, t0 + k * E, 0.04, { vol: k % 2 ? 0.05 : 0.08, decay: 90 });
  });
  echo(lead, E * 1.5, 0.22);

  // Mistura só o trecho do loop, somando a "cauda" do fim no começo para emendar sem corte
  const n = Math.floor(len * RATE), mix = new Float32Array(n);
  for (let i = 0; i < lead.length; i++) {
    const v = lead[i] + back[i] + drums[i];
    mix[i % n] += v;
  }
  toMp3(mix, "musica.mp3", { kbps: 96, peak: 0.7 });
}

// ---------- Efeitos ----------
function sfx() {
  // Caixa registradora: "tlim-tlim" brilhante com gaveta
  let b = track(0.9);
  noise(b, 0, 0.05, { vol: 0.25, decay: 60, lowpass: 0.3 });
  tone(b, 0.04, 0.08, midiHz(83), { vol: 0.25, duty: 0.25, decay: 8 });
  tone(b, 0.12, 0.5, midiHz(88), { vol: 0.25, duty: 0.25, decay: 5 });
  [88, 95, 100].forEach((m, k) => tone(b, 0.12 + k * 0.01, 0.6, midiHz(m), { type: "sine", vol: 0.12, decay: 6 }));
  echo(b, 0.09, 0.3);
  toMp3(b, "caixa.mp3");

  // Erro: "uóóó-uóóó" descendo
  b = track(0.7);
  tone(b, 0, 0.18, midiHz(55), { vol: 0.3, duty: 0.5, slideTo: midiHz(52), decay: 3 });
  tone(b, 0.22, 0.32, midiHz(50), { vol: 0.3, duty: 0.5, slideTo: midiHz(45), decay: 2.5, vibrato: 0.02 });
  toMp3(b, "erro.mp3", { peak: 0.4 });

  // Sininho da porta: "blim-blom"
  b = track(1.2);
  tone(b, 0, 0.5, midiHz(88), { type: "sine", vol: 0.35, decay: 4 });
  tone(b, 0, 0.5, midiHz(100), { type: "sine", vol: 0.08, decay: 7 });
  tone(b, 0.22, 0.7, midiHz(84), { type: "sine", vol: 0.35, decay: 3.5 });
  tone(b, 0.22, 0.7, midiHz(96), { type: "sine", vol: 0.08, decay: 6 });
  toMp3(b, "porta.mp3");

  // Toque em nota/moeda: "plic"
  b = track(0.12);
  tone(b, 0, 0.05, midiHz(84), { type: "sine", vol: 0.5, slideTo: midiHz(96), decay: 30, release: 0.02 });
  toMp3(b, "toque.mp3", { kbps: 64 });

  // Vitória: fanfarra subindo e acorde final
  b = track(2.2);
  [72, 76, 79, 84].forEach((m, k) => tone(b, k * 0.12, 0.11, midiHz(m), { vol: 0.22, duty: 0.25, decay: 3 }));
  [72, 76, 79, 84].forEach((m) => tone(b, 0.5, 1.1, midiHz(m), { vol: 0.12, duty: 0.25, decay: 1.6, vibrato: 0.006 }));
  [0, 0.5].forEach((t) => kick(b, t, 0.5));
  noise(b, 0.5, 0.6, { vol: 0.12, decay: 6 });
  echo(b, 0.14, 0.25);
  toMp3(b, "vitoria.mp3");
}

mkdirSync(OUT, { recursive: true });
music();
sfx();

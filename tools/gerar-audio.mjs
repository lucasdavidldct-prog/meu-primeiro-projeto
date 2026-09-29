// Gera a música de fundo e os efeitos sonoros do Troco Certo em public/sons/.
// Tudo é sintetizado aqui (marimba, cavaquinho, ondas de videogame e ruído)
// e codificado em MP3. São 3 músicas: menu (calma), partida e relâmpago.
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
  let sq = 0;
  for (const v of pcm) sq += (v / 32767) ** 2;
  const rmsDb = (10 * Math.log10(sq / pcm.length || 1e-9)).toFixed(1);
  const out = Buffer.concat(parts.map((p) => Buffer.from(p.buffer, p.byteOffset, p.length)));
  writeFileSync(join(OUT, file), out);
  console.log(`${file}: ${(out.length / 1024).toFixed(0)} KB, volume médio ${rmsDb} dB`);
}

// Instrumentos "de brinquedo" para as crianças menores
// Marimba/xilofone: senoide com parciais agudos que somem rápido
function marimba(buf, start, dur, hz, vol = 0.2, bright = 0.35) {
  tone(buf, start, dur, hz, { type: "sine", vol, decay: 4, attack: 0.002, release: 0.08 });
  tone(buf, start, Math.min(dur, 0.08), hz * 4, { type: "sine", vol: vol * bright, decay: 30, attack: 0.001, release: 0.02 });
  tone(buf, start, Math.min(dur, 0.04), hz * 10, { type: "sine", vol: vol * bright * 0.3, decay: 60, attack: 0.001, release: 0.01 });
}
// Corda dedilhada (tipo cavaquinho/ukulele): algoritmo de Karplus-Strong
function pluck(buf, start, dur, hz, vol = 0.2, damp = 0.996) {
  const p = Math.max(2, Math.round(RATE / hz)), ring = new Float32Array(p);
  for (let i = 0; i < p; i++) ring[i] = rnd();
  const s0 = Math.floor(start * RATE), n = Math.floor(dur * RATE);
  let prev = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const k = i % p, v = ring[k];
    ring[k] = damp * 0.5 * (v + prev); prev = v;
    const fade = i > n - 400 ? (n - i) / 400 : 1;
    buf[s0 + i] += v * vol * fade;
  }
}
const shaker = (buf, t, vol = 0.03) => noise(buf, t, 0.05, { vol, decay: 70 });

// Monta uma música em loop a partir da grade de acordes e da melodia (8 colcheias por compasso)
const _ = null, h = "-"; // pausa e "segura a nota"
function song({ file, bpm, chords, melody, lead, bar, fx }) {
  const E = 60 / bpm / 2, len = chords.length * 8 * E;
  const L = track(len + 2), B = track(len + 2), D = track(len + 2);
  chords.forEach((ch, b) => {
    const t0 = b * 8 * E, notes = melody[b];
    for (let k = 0; k < 8; k++) {
      if (typeof notes[k] !== "number") continue;
      let d = 1;
      while (k + d < 8 && notes[k + d] === h) d++;
      lead(L, t0 + k * E, d * E, midiHz(notes[k]));
    }
    bar(B, D, t0, E, ch, b);
  });
  if (fx) fx(L);
  const n = Math.floor(len * RATE), mix = new Float32Array(n);
  for (let i = 0; i < L.length; i++) mix[i % n] += L[i] + B[i] + D[i];
  toMp3(mix, file, { kbps: 96, peak: 0.7 });
}

// Acordes (MIDI): tônica, terça, quinta
const CH = { C: [60, 64, 67], Dm: [62, 65, 69], Em: [64, 67, 71], F: [65, 69, 72], G: [67, 71, 74], Am: [69, 72, 76], Bb: [70, 74, 77], Bm: [71, 74, 78], D: [62, 66, 69] };

// Menu e lojinha: calma, marimba e cavaquinho, 92 BPM em Fá maior
function musicMenu() {
  song({
    file: "musica-menu.mp3", bpm: 92,
    chords: ["F", "C", "Dm", "Bb", "F", "C", "Bb", "C", "Dm", "Bb", "F", "C", "Bb", "C", "F", "F"],
    melody: [
      [72, h, h, 69, 72, h, 77, h], [76, h, 74, h, 72, h, h, h], [74, h, h, 72, 74, h, 77, h], [74, h, h, h, 70, h, 72, h],
      [69, h, 72, h, 77, h, 76, h], [74, h, 72, h, 67, h, h, h], [70, h, 74, h, 77, h, 74, h], [76, h, h, h, _, _, 72, h],
      [77, h, h, 74, 69, h, 74, h], [77, h, h, 74, 70, h, 74, h], [72, h, 77, h, 81, h, 79, 77], [76, h, h, h, 72, h, h, h],
      [74, h, 77, h, 74, h, 70, h], [72, h, 76, h, 79, h, 76, h], [77, h, h, h, 72, h, 69, h], [65, h, h, h, _, _, _, _],
    ],
    lead: (L, t, d, hz) => marimba(L, t, d * 0.95, hz, 0.22, 0.3),
    bar: (B, D, t0, E, ch) => {
      const [r, third, fifth] = CH[ch];
      pluck(B, t0, 2 * E * 1.9, midiHz(r - 24), 0.28, 0.995);
      pluck(B, t0 + 4 * E, 2 * E * 1.9, midiHz(fifth - 24), 0.24, 0.995);
      // Batidinha do cavaquinho nos tempos 2 e 4
      for (const q of [2, 6]) [r, third, fifth, r + 12].forEach((m, k) => pluck(B, t0 + q * E + k * 0.012, E * 1.8, midiHz(m), 0.06, 0.993));
      for (let k = 0; k < 8; k++) shaker(D, t0 + k * E, k % 2 ? 0.012 : 0.02);
    },
    fx: (L) => echo(L, 0.33, 0.2),
  });
}

// Partidas: animada, xilofone, 116 BPM em Sol maior
function musicGame() {
  song({
    file: "musica-jogo.mp3", bpm: 116,
    chords: ["G", "Em", "C", "D", "G", "Em", "C", "D", "C", "D", "Bm", "Em", "C", "D", "G", "G"],
    melody: [
      [74, h, 71, 74, 79, h, 74, h], [76, h, h, 74, 71, h, 67, h], [72, h, 76, h, 79, h, 76, 72], [74, h, h, h, 78, h, 81, h],
      [79, h, 78, 79, 74, h, 71, h], [76, h, 79, h, 71, h, h, h], [76, h, 74, 72, 69, h, 72, 76], [74, h, h, h, _, _, _, _],
      [72, 74, 76, h, 79, h, 76, h], [74, 76, 78, h, 81, h, 78, h], [83, h, 78, h, 74, h, 78, h], [79, h, 76, h, 71, h, 76, h],
      [76, h, 79, h, 84, h, 81, 79], [81, h, 78, h, 74, h, 78, 81], [79, h, h, h, 74, h, 71, h], [67, h, h, h, _, _, _, _],
    ],
    lead: (L, t, d, hz) => marimba(L, t, d * 0.9, hz, 0.2, 0.55),
    bar: (B, D, t0, E, ch) => {
      const [r, third, fifth] = CH[ch];
      [[0, r - 24], [3, r - 24], [4, fifth - 24], [6, r - 12]].forEach(([k, m]) => pluck(B, t0 + k * E, E * 1.6, midiHz(m), 0.3, 0.994));
      for (const k of [2, 6]) [third, fifth].forEach((m) => pluck(B, t0 + k * E, E * 0.9, midiHz(m), 0.07, 0.99));
      for (const k of [0, 4]) kick(D, t0 + k * E, 0.3);
      for (const k of [2, 6]) noise(D, t0 + k * E, 0.1, { vol: 0.1, decay: 35, lowpass: 0.35 });
      for (let k = 0; k < 8; k++) shaker(D, t0 + k * E, k % 2 ? 0.018 : 0.03);
    },
    fx: (L) => echo(L, 60 / 116 * 0.75, 0.18),
  });
}

// Relâmpago: rápida e empolgante, videogame, 152 BPM
function musicFlash() {
  song({
    file: "musica-relampago.mp3", bpm: 152,
    chords: ["Am", "F", "C", "G", "Am", "F", "G", "G"],
    melody: [
      [81, h, 76, h, 81, 83, 84, h], [81, h, 77, h, 72, h, 77, h], [79, h, 76, h, 72, h, 76, 79], [83, h, 79, h, 74, h, 79, 83],
      [84, h, 83, 81, 76, h, 81, h], [77, h, 81, h, 84, h, 81, h], [83, h, h, 86, h, h, 83, h], [79, h, 74, h, 71, h, 74, h],
    ],
    lead: (L, t, d, hz) => tone(L, t, d * 0.85, hz, { type: "square", duty: 0.25, vol: 0.14, decay: 1.5 }),
    bar: (B, D, t0, E, ch) => {
      const [r] = CH[ch];
      for (let k = 0; k < 8; k++) tone(B, t0 + k * E, E * 0.7, midiHz((k % 2 ? r : r - 12) - 12), { type: "tri", vol: 0.3, decay: 3 });
      for (let q = 0; q < 4; q++) kick(D, t0 + q * 2 * E, 0.4);
      for (const q of [1, 3]) noise(D, t0 + q * 2 * E, 0.12, { vol: 0.18, decay: 25, lowpass: 0.5 });
      for (let k = 0; k < 16; k++) noise(D, t0 + (k * E) / 2, 0.03, { vol: k % 2 ? 0.03 : 0.05, decay: 110 });
    },
    fx: (L) => echo(L, 60 / 152 * 0.75, 0.15),
  });
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

  // Erro gentil: um "hm-hm?" curioso, subindo no fim como pergunta (sem cara de bronca)
  b = track(0.7);
  tone(b, 0, 0.1, midiHz(67), { type: "tri", vol: 0.35, decay: 6, attack: 0.01 });
  tone(b, 0, 0.1, midiHz(79), { type: "sine", vol: 0.06, decay: 10, attack: 0.01 });
  tone(b, 0.16, 0.3, midiHz(64), { type: "tri", vol: 0.35, decay: 3, attack: 0.01, slideTo: midiHz(71), vibrato: 0.012 });
  tone(b, 0.16, 0.3, midiHz(76), { type: "sine", vol: 0.06, decay: 5, attack: 0.01, slideTo: midiHz(83) });
  toMp3(b, "erro.mp3", { peak: 0.45 });

  // Sininho da porta: "blim-blom"
  b = track(1.2);
  tone(b, 0, 0.5, midiHz(88), { type: "sine", vol: 0.35, decay: 4 });
  tone(b, 0, 0.5, midiHz(100), { type: "sine", vol: 0.08, decay: 7 });
  tone(b, 0.22, 0.7, midiHz(84), { type: "sine", vol: 0.35, decay: 3.5 });
  tone(b, 0.22, 0.7, midiHz(96), { type: "sine", vol: 0.08, decay: 6 });
  toMp3(b, "porta.mp3");

  // Toque em moeda: "plic" (o jogo muda o tom conforme a moeda)
  b = track(0.12);
  tone(b, 0, 0.05, midiHz(84), { type: "sine", vol: 0.5, slideTo: midiHz(96), decay: 30, release: 0.02 });
  toMp3(b, "toque.mp3", { kbps: 64 });

  // Nota de papel: "fruft"
  b = track(0.2);
  noise(b, 0, 0.07, { vol: 0.35, decay: 45, lowpass: 0.25 });
  noise(b, 0.06, 0.1, { vol: 0.25, decay: 35, lowpass: 0.5 });
  toMp3(b, "nota.mp3", { kbps: 64, peak: 0.6 });

  // Vitória: fanfarra subindo e acorde final
  b = track(2.2);
  [72, 76, 79, 84].forEach((m, k) => tone(b, k * 0.12, 0.11, midiHz(m), { vol: 0.22, duty: 0.25, decay: 3 }));
  [72, 76, 79, 84].forEach((m) => tone(b, 0.5, 1.1, midiHz(m), { vol: 0.12, duty: 0.25, decay: 1.6, vibrato: 0.006 }));
  [0, 0.5].forEach((t) => kick(b, t, 0.5));
  noise(b, 0.5, 0.6, { vol: 0.12, decay: 6 });
  echo(b, 0.14, 0.25);
  toMp3(b, "vitoria.mp3");

  // Conquista: brilhinho subindo e sino
  b = track(1.8);
  [84, 88, 91, 96, 100, 103].forEach((m, k) => marimba(b, k * 0.06, 0.2, midiHz(m), 0.16, 0.5));
  [84, 88, 91, 96].forEach((m) => tone(b, 0.42, 1.0, midiHz(m), { type: "sine", vol: 0.1, decay: 2.2, vibrato: 0.004 }));
  tone(b, 0.42, 1.0, midiHz(108), { type: "sine", vol: 0.04, decay: 4 });
  noise(b, 0.42, 0.5, { vol: 0.05, decay: 8 });
  echo(b, 0.12, 0.3);
  toMp3(b, "conquista.mp3");

  // Sequência de dias: "fuuush" de fogo e três notas subindo
  b = track(1.4);
  { const s0 = 0, n = Math.floor(0.45 * RATE); let last = 0;
    for (let i = 0; i < n; i++) { const lp = 0.05 + 0.5 * (i / n); last += (rnd() - last) * lp; b[s0 + i] += last * 0.5 * Math.sin(Math.PI * i / n); } }
  [72, 76, 79].forEach((m, k) => tone(b, 0.35 + k * 0.1, 0.09, midiHz(m), { vol: 0.2, duty: 0.25, decay: 4 }));
  tone(b, 0.65, 0.6, midiHz(84), { vol: 0.18, duty: 0.25, decay: 2, vibrato: 0.01 });
  echo(b, 0.11, 0.25);
  toMp3(b, "sequencia.mp3");

  // Cliente famoso: "tcharam!" com brilho
  b = track(1.3);
  [[0, [67, 71, 74]], [0.14, [72, 76, 79, 84]]].forEach(([t, ms], k) => ms.forEach((m) => tone(b, t, k ? 0.6 : 0.1, midiHz(m), { vol: 0.1, duty: 0.25, decay: k ? 2 : 6 })));
  [96, 100, 103, 108].forEach((m, k) => tone(b, 0.2 + k * 0.05, 0.15, midiHz(m), { type: "sine", vol: 0.08, decay: 12 }));
  echo(b, 0.1, 0.3);
  toMp3(b, "famoso.mp3");

  // Aniversariante: língua de sogra "fuuuu-fu-fu!"
  b = track(1.1);
  tone(b, 0, 0.35, midiHz(64), { duty: 0.12, vol: 0.2, slideTo: midiHz(76), decay: 0.5, vibrato: 0.03 });
  tone(b, 0.45, 0.1, midiHz(76), { duty: 0.12, vol: 0.2, decay: 3, vibrato: 0.03 });
  tone(b, 0.6, 0.2, midiHz(79), { duty: 0.12, vol: 0.2, decay: 2, vibrato: 0.03 });
  noise(b, 0.6, 0.3, { vol: 0.06, decay: 10 });
  toMp3(b, "festa.mp3", { peak: 0.6 });

  // Apressado: "tic-tac-tic-tac" rapidinho e um "zuuum"
  b = track(0.9);
  for (let k = 0; k < 4; k++) tone(b, k * 0.09, 0.03, k % 2 ? 900 : 1300, { type: "sine", vol: 0.35, decay: 60, release: 0.01 });
  tone(b, 0.4, 0.3, midiHz(72), { type: "tri", vol: 0.2, slideTo: midiHz(96), decay: 3 });
  toMp3(b, "pressa.mp3", { peak: 0.6 });

  // Desconfiado: "tum-tum-tum?" na pontinha dos pés
  b = track(0.9);
  [[0, 55], [0.16, 58], [0.32, 55]].forEach(([t, m]) => pluck(b, t, 0.2, midiHz(m), 0.35, 0.99));
  tone(b, 0.5, 0.2, midiHz(62), { type: "tri", vol: 0.2, slideTo: midiHz(67), decay: 3 });
  toMp3(b, "hmm.mp3", { peak: 0.55 });

  // Tique do relógio no fim do relâmpago
  b = track(0.1);
  tone(b, 0, 0.02, 1500, { type: "sine", vol: 0.5, decay: 80, release: 0.01 });
  noise(b, 0, 0.01, { vol: 0.15, decay: 200 });
  toMp3(b, "tique.mp3", { kbps: 64, peak: 0.6 });
}

mkdirSync(OUT, { recursive: true });
musicMenu();
musicGame();
musicFlash();
sfx();

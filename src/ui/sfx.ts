// Efeitos sonoros sintetizados com Web Audio (sem arquivos de áudio) e vibração.
import { app } from './ctx';
import { haptic as nativeHaptic, isNative } from './native';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

const on = (): boolean => app.S?.som !== false;

/** Cria o contexto de áudio na primeira interação (navegadores exigem um gesto do usuário). */
function ac(): AudioContext | null {
  if (!on()) return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    try { ctx = new C(); } catch { return null; }
    master = ctx.createGain(); master.gain.value = .55; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

/** Destrava o áudio no primeiro toque. */
export function unlockAudio(): void {
  const f = () => { ac(); window.removeEventListener('pointerdown', f); };
  window.addEventListener('pointerdown', f);
}

function env(g: GainNode, t: number, a: number, peak: number, hold: number, rel: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
}

function tone(freq: number, t: number, dur: number, type: OscillatorType = 'sine', vol = .3, slideTo?: number): OscillatorNode | null {
  const c = ctx!, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  env(g, t, .01, vol, dur * .4, dur * .6);
  o.connect(g).connect(master!); o.start(t); o.stop(t + dur + .05);
  return o;
}

function noise(t: number, dur: number, filter: BiquadFilterType, freq: number, vol: number, a = .05, freqTo?: number): void {
  const c = ctx!, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf; s.loop = true;
  f.type = filter; f.frequency.setValueAtTime(freq, t); f.Q.value = .7;
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
  env(g, t, a, vol, dur * .35, dur * .65 - a);
  s.connect(f).connect(g).connect(master!); s.start(t); s.stop(t + dur + .1);
}

export const sfx = {
  /** Apito do árbitro: 1 = início, 2 = intervalo, 3 = fim. */
  whistle(n = 1): void {
    if (!ac()) return;
    const t0 = ctx!.currentTime;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * .32, long = i === n - 1 && n > 1;
      const o = tone(2950, t, long ? .55 : .2, 'sine', .16);
      if (o) { const l = ctx!.createOscillator(), lg = ctx!.createGain(); l.frequency.value = 28; lg.gain.value = 90; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + .7); }
    }
  },
  kick(power = .7): void {
    if (!ac()) return;
    const t = ctx!.currentTime;
    tone(150, t, .12, 'sine', .35 + power * .35, 45);
    noise(t, .06, 'bandpass', 1800, .12 + power * .1, .003);
  },
  /** Superchute: estouro grave da batida e o zunido da bola cortando o ar. */
  superKick(): void {
    if (!ac()) return;
    const t = ctx!.currentTime;
    tone(110, t, .22, 'sine', .8, 32);
    noise(t, .08, 'bandpass', 1400, .35, .002);
    noise(t + .03, .55, 'bandpass', 2600, .16, .02, 700);
    haptic('forte');
  },
  /** Cabeçada: toque abafado. */
  head(): void {
    if (!ac()) return;
    const t = ctx!.currentTime;
    tone(180, t, .1, 'sine', .35, 90);
    noise(t, .05, 'lowpass', 900, .12, .003);
  },
  /** Desarme/carrinho: pancada seca na bola. */
  tackle(): void {
    if (!ac()) return;
    const t = ctx!.currentTime;
    noise(t, .18, 'lowpass', 600, .28, .005);
    tone(120, t, .1, 'sine', .25, 70);
  },
  pass(): void {
    if (!ac()) return;
    const t = ctx!.currentTime;
    tone(210, t, .08, 'sine', .25, 80);
  },
  /** Torcida explodindo (seu gol). */
  goal(): void {
    if (!ac()) return;
    const t = ctx!.currentTime;
    noise(t, 2.6, 'bandpass', 700, .5, .25, 1300);
    noise(t + .05, 2.2, 'highpass', 2500, .12, .3);
    [392, 494, 587, 784].forEach((f, i) => tone(f, t + .15 + i * .09, .7, 'triangle', .12));
    haptic('forte');
  },
  /** Gol do adversário: lamento da torcida. */
  groan(): void {
    if (!ac()) return;
    const t = ctx!.currentTime;
    noise(t, 1.4, 'lowpass', 900, .3, .15, 300);
    tone(220, t, .9, 'triangle', .07, 150);
  },
  /** Defesa ou chute para fora: "uuuh". */
  ooh(): void {
    if (!ac()) return;
    const t = ctx!.currentTime;
    noise(t, 1.1, 'bandpass', 500, .3, .12, 850);
    haptic('leve');
  },
  /** Cartas aparecendo no pacote; mais notas quanto melhor a carta. */
  reveal(level = 0): void {
    if (!ac()) return;
    const t = ctx!.currentTime, notes = [523, 659, 784, 1047, 1319];
    notes.slice(0, 2 + Math.min(3, level)).forEach((f, i) => tone(f, t + i * .07, .35, 'triangle', .13));
  },
  /** Impacto grave da apresentação da carta especial. */
  boom(): void {
    if (!ac()) return;
    const t = ctx!.currentTime;
    tone(90, t, .7, 'sine', .55, 38);
    noise(t, .5, 'lowpass', 400, .25, .01);
    haptic('medio');
  },
  coin(): void {
    if (!ac()) return;
    const t = ctx!.currentTime;
    tone(988, t, .08, 'square', .06); tone(1319, t + .07, .18, 'square', .06);
  },
};

/** Vibração curta (usa o motor háptico nativo no APK). */
export function haptic(kind: 'leve' | 'medio' | 'forte' = 'leve'): void {
  if (app.S?.vibrar === false) return;
  if (isNative()) { nativeHaptic(kind); return; }
  try { navigator.vibrate?.(kind === 'forte' ? [60, 40, 90] : kind === 'medio' ? 40 : 15); } catch { /* sem suporte */ }
}

/** Som do início de cada ação do lance e do desfecho. */
export function planSound(p: { kind: string }): void { if (p.kind === 'pass') sfx.pass(); else if (p.kind !== 'drib') sfx.kick(); }
export function endSound(e: { goal: boolean; res: { shot?: boolean } }): void { if (e.goal) sfx.goal(); else if (e.res.shot) sfx.ooh(); }

// Motor de partida minuto a minuto (sem interface). A interface injeta onMoment
// para transformar chances do usuário em lances jogáveis.
import { inPos } from './cards';
import { calcChem, effOvr, rate, type Ratings } from './chemistry';
import { slotsOf } from './positions';
import { R, clamp, pick, rn, wpick } from './rng';
import type { OppTeam } from './season';
import { STYLES, sv } from './tactics';
import { tx } from './narration';
import type { BasePlayer, FormationId, Pos, StyleId } from './types';
import type { TeamInfo } from './state';
import { POOL } from './world';

export interface SideEntry { P: BasePlayer; pos: Pos; base: number; inMin: number; yc: number; red: boolean; name: string }
export interface Side {
  you: boolean; name: string; s: string; c1: string; c2: string;
  form: FormationId; style: StyleId; ment: number;
  xi: SideEntry[]; bench: BasePlayer[]; subs: number; goals: number; scorers: string[]; str?: number;
}
export type EvType = 'info' | 'goal' | 'goal opp' | 'goal lance' | 'chance' | 'card-y' | 'card-r' | 'lance';
export interface MatchEvent { l: string; side: 0 | 1; type: EvType; text: string }
export interface MomentRequest { pen: boolean; counter: boolean }
export interface MomentResult { goal: boolean; shot: boolean; onTarget?: boolean; scorer?: string; assist?: string | null; text?: string }
export type MomentHandler = (m: Match, req: MomentRequest) => Promise<MomentResult>;

type Tick = { m: number; l: string } | { ht: true };

export const SCORE_W: Record<Pos, number> = { GOL: 0, ZAG: .5, LD: .35, LE: .35, VOL: .6, MC: 1.2, MEI: 2.4, MD: 1.5, ME: 1.5, PD: 3.4, PE: 3.4, ATA: 5 };
const ASSIST_W: Record<Pos, number> = { GOL: .05, ZAG: .3, LD: .9, LE: .9, VOL: .8, MC: 1.5, MEI: 2.6, MD: 1.8, ME: 1.8, PD: 2, PE: 2, ATA: 1.3 };
const FOUL_W: Record<Pos, number> = { GOL: .1, ZAG: 1.4, LD: 1.1, LE: 1.1, VOL: 1.5, MC: 1, MEI: .6, MD: .8, ME: .8, PD: .5, PE: .5, ATA: .5 };
const POSS_MOD: Record<StyleId, number> = { posse: .07, retranca: -.08, contra: -.06, pressao: .03, equilibrado: 0 };

/** Lado do usuário a partir do time escalado. */
export function sideFromTeam(T: TeamInfo, o: { name: string; form: FormationId; style: StyleId; ment: number; bench: BasePlayer[] }): Side {
  const xi = T.slots.map((s, i) => {
    const P = T.xi[i]!;
    return { P, pos: s.p, base: effOvr(P, s.p, T.chem.per[i]), inMin: 0, yc: 0, red: false, name: P.short };
  });
  return { you: true, name: o.name, s: (o.name[0] || 'E').toUpperCase(), c1: '#e8c35f', c2: '#a67c1c', form: o.form, style: o.style,
    ment: o.ment - 2, xi, bench: o.bench, subs: 5, goals: 0, scorers: [] };
}

function poolPick(pos: Pos, str: number, used: Set<number>): BasePlayer {
  let c = POOL.filter(p => !used.has(p.id) && p.pos === pos && Math.abs(p.ovr - str) <= 5);
  if (!c.length) c = POOL.filter(p => !used.has(p.id) && inPos(p, pos));
  const p = pick(c);
  used.add(p.id);
  return p;
}

/** Adversário montado a partir da força média do time. */
export function sideOpp(t: OppTeam): Side {
  const used = new Set<number>();
  const xi = slotsOf(t.form).map(s => {
    const p = poolPick(s.p, t.str, used);
    return { P: p, pos: s.p, base: t.str + rn(-2.5, 2.5), inMin: 0, yc: 0, red: false, name: p.short };
  });
  const bench = (['GOL', 'ZAG', 'MC', 'PD', 'ATA', 'LD', 'MEI'] as Pos[]).map(pp => poolPick(pp, t.str - 2, used));
  return { you: false, name: t.n, s: t.s, c1: t.c1, c2: t.c2, form: t.form, style: t.style, ment: 0, xi, bench, subs: 5, goals: 0, scorers: [], str: t.str };
}

/** Rendimento atual: cai até 8% entre 55 e 90 minutos em campo. */
export const fatigue = (e: SideEntry, min: number): number => clamp((min - e.inMin - 55) / 35, 0, 1);
export const effNow = (e: SideEntry, min: number): number => (e.red ? 0 : e.base * (1 - fatigue(e, min) * .08));

function weightedPlayer(side: Side, W: Record<Pos, number>, excl?: SideEntry | null): SideEntry {
  const c = side.xi.filter(e => !e.red && e !== excl).map(e => [e, (W[e.pos] || .1) * Math.pow(Math.max(e.base, 30) / 70, 3)] as const);
  return c.length ? wpick(c) : side.xi[0];
}
export const pickShooter = (side: Side, boost?: Partial<Record<Pos, number>>): SideEntry => weightedPlayer(side, { ...SCORE_W, ...boost });

export class Match {
  seq: Tick[] = [];
  k = 0;
  label = "0'";
  min = 0;
  ev: MatchEvent[] = [];
  st = { poss: [0, 0], sh: [0, 0], on: [0, 0], yc: [0, 0] };
  ht = false;
  over = false;
  momentsLeft: number;
  lastMom = -99;
  momGoals = 0;
  private aiDone: Record<string, boolean> = {};
  onMoment?: MomentHandler;

  constructor(public A: Side, public B: Side, opts: { moments?: number; onMoment?: MomentHandler } = {}) {
    this.momentsLeft = opts.onMoment ? (opts.moments ?? 4) : 0;
    this.onMoment = opts.onMoment;
    const s1 = 1 + Math.floor(R() * 3), s2 = 2 + Math.floor(R() * 4);
    for (let m = 1; m <= 45; m++) this.seq.push({ m, l: m + "'" });
    for (let k = 1; k <= s1; k++) this.seq.push({ m: 45, l: '45+' + k + "'" });
    this.seq.push({ ht: true });
    for (let m = 46; m <= 90; m++) this.seq.push({ m, l: m + "'" });
    for (let k = 1; k <= s2; k++) this.seq.push({ m: 90, l: '90+' + k + "'" });
    this.addEv(0, 'info', `${A.name} (${A.form}, ${STYLES[A.style].n}) × ${B.name} (${B.form}, ${STYLES[B.style].n}). Bola rolando!`);
  }

  addEv(side: 0 | 1, type: EvType, text: string): void { this.ev.unshift({ l: this.label, side, type, text }); }
  ratingsOf(side: Side): Ratings { return rate(side.xi.map(e => ({ pos: e.pos, eff: effNow(e, this.min), red: e.red }))); }

  /** Avança um minuto. Retorna o que aconteceu com o relógio. */
  async step(): Promise<'tick' | 'ht' | 'end'> {
    if (this.over) return 'end';
    if (this.ht) return 'ht';
    const it = this.seq[this.k++];
    if (!it) { this.over = true; this.addEv(0, 'info', 'Fim de jogo!'); return 'end'; }
    if ('ht' in it) { this.ht = true; this.addEv(0, 'info', 'Fim do primeiro tempo.'); return 'ht'; }
    this.min = it.m; this.label = it.l;
    const { A, B } = this, rA = this.ratingsOf(A), rB = this.ratingsOf(B);
    let pA = Math.pow(rA.mid, 5) / (Math.pow(rA.mid, 5) + Math.pow(rB.mid, 5)) + POSS_MOD[A.style] - POSS_MOD[B.style] + .015 * (A.ment - B.ment);
    pA = clamp(pA, .25, .75);
    this.st.poss[0] += pA; this.st.poss[1] += 1 - pA;
    const chance = (att: number, def: number, poss: number, sa: StyleId, sb: StyleId, ma: number, mb: number) => {
      let p = .095 * Math.pow(poss / .5, .8) * Math.pow(att / def, 4) * sv(sa, sb) * (1 + .13 * ma) * (1 + .09 * mb);
      if (sa === 'retranca') p *= .75;
      if (sb === 'retranca') p *= .82;
      return p;
    };
    const cA = chance(rA.att, rB.def, pA, A.style, B.style, A.ment, B.ment), cB = chance(rB.att, rA.def, 1 - pA, B.style, A.style, B.ment, A.ment);
    if (R() < cA) await this.shot(A, B, rA, 0);
    if (!this.over && R() < cB) await this.shot(B, A, rB, 1);
    this.cards();
    this.aiManage();
    return 'tick';
  }

  secondHalf(): void { this.ht = false; }

  private cards(): void {
    for (const [side, si] of [[this.A, 0], [this.B, 1]] as const) {
      const pr = .02 * (side.style === 'pressao' ? 1.4 : 1);
      if (R() < pr) {
        const e = weightedPlayer(side, FOUL_W);
        if (R() < .06) { e.red = true; this.addEv(si, 'card-r', tx('rc2', { p: e.name })); }
        else if (e.yc) { e.red = true; this.addEv(si, 'card-r', tx('rc', { p: e.name })); }
        else { e.yc = 1; this.st.yc[si]++; this.addEv(si, 'card-y', tx('yc', { p: e.name })); }
      }
    }
  }

  private async shot(att: Side, def: Side, ra: Ratings, si: 0 | 1): Promise<void> {
    const shooter = weightedPlayer(att, SCORE_W);
    const gkE = def.xi.find(e => e.pos === 'GOL' && !e.red), gk = gkE ? gkE.name : 'o goleiro';
    const assist = R() < .62 ? weightedPlayer(att, ASSIST_W, shooter) : null;
    this.st.sh[si]++;
    const isPen = R() < .035;
    if (att.you && this.onMoment && this.momentsLeft > 0 && this.min - this.lastMom >= 10 && (isPen || R() < .34)) {
      this.momentsLeft--; this.lastMom = this.min;
      const res = await this.onMoment(this, { pen: isPen, counter: att.style === 'contra' || R() < .25 });
      if (res.shot && res.onTarget) this.st.on[si]++;
      if (res.goal) {
        att.goals++; att.scorers.push(res.scorer + ' ' + this.label); this.momGoals++;
        this.addEv(si, 'goal lance', `Lance jogado: GOL de ${res.scorer}!${res.assist ? ' Passe de ' + res.assist + '.' : ''}`);
      } else this.addEv(si, 'lance', `Lance jogado: ${res.text}`);
      return;
    }
    const goalType: EvType = si ? 'goal opp' : 'goal';
    if (isPen) {
      this.addEv(si, 'info', tx('pen', { p: shooter.name }));
      if (R() < .78) {
        this.st.on[si]++; att.goals++; att.scorers.push(shooter.name + ' ' + this.label + ' (p)');
        this.addEv(si, goalType, tx('penGoal', { p: shooter.name }));
      } else this.addEv(si, 'info', tx('penMiss', { p: shooter.name, gk }));
      return;
    }
    const q = R();
    const fin = effNow(shooter, this.min), gkv = gkE ? effNow(gkE, this.min) : 30;
    const gp = (.05 + .16 * q * q) * Math.pow(clamp((fin * .6 + ra.att * .4) / gkv, .6, 1.8), 2);
    if (R() < gp) {
      this.st.on[si]++; att.goals++; att.scorers.push(shooter.name + ' ' + this.label);
      this.addEv(si, goalType, tx('goal', { p: shooter.name, gk }) + (assist ? ` Assistência de ${assist.name}.` : ''));
    } else if (R() < .45) { this.st.on[si]++; this.addEv(si, 'chance', tx('save', { p: shooter.name, gk })); }
    else if (R() < .08) this.addEv(si, 'chance', tx('post', { p: shooter.name }));
    else if (q > .45) this.addEv(si, 'chance', tx('miss', { p: shooter.name }));
  }

  /** IA do time B: muda a mentalidade conforme o placar e faz substituições. */
  private aiManage(): void {
    const B = this.B, diff = B.goals - this.A.goals, m = this.min;
    if (m >= 60 && !this.aiDone.m60) {
      this.aiDone.m60 = true;
      if (diff < 0) { B.ment = Math.min(2, B.ment + 1); this.addEv(1, 'info', `${B.name} adianta as linhas em busca do gol.`); }
    }
    if (m >= 75 && !this.aiDone.m75) {
      this.aiDone.m75 = true;
      if (diff < 0) B.ment = 2;
      else if (diff > 0) { B.ment = Math.max(-2, B.ment - 1); this.addEv(1, 'info', `${B.name} recua para segurar o resultado.`); }
    }
    for (const mm of [62, 70, 80]) {
      if (m >= mm && !this.aiDone['s' + mm] && B.subs > 0 && B.bench.length) {
        this.aiDone['s' + mm] = true;
        const outs = B.xi.filter(e => !e.red && e.pos !== 'GOL');
        const o = outs[Math.floor(R() * outs.length)], inn = B.bench.shift();
        if (!o || !inn) continue;
        this.addEv(1, 'info', `Substituição no ${B.name}: sai ${o.name}, entra ${inn.short}.`);
        Object.assign(o, { P: inn, name: inn.short, inMin: m, yc: 0, base: (B.str ?? 70) + rn(-3, 2) });
        B.subs--;
      }
    }
  }

  /** Substituição do usuário (lado A). */
  substitute(outIdx: number, benchIdx: number): { ok: boolean; msg?: string } {
    const A = this.A;
    if (A.subs <= 0) return { ok: false, msg: 'Sem substituições restantes' };
    const e0 = A.xi[outIdx], P = A.bench[benchIdx];
    if (!e0 || e0.red || !P) return { ok: false };
    if (A.xi.some(x => !x.red && x !== e0 && x.P.id === P.id)) return { ok: false, msg: 'Esse jogador já está em campo' };
    A.bench.splice(benchIdx, 1);
    this.addEv(0, 'info', `Substituição: sai ${e0.name}, entra ${P.short}.`);
    A.bench.push(e0.P);
    const ch = calcChem(A.xi.map(x => (x === e0 ? P : x.P)), A.form).per[outIdx];
    Object.assign(e0, { P, name: P.short, base: effOvr(P, e0.pos, ch), inMin: this.min, yc: 0 });
    A.subs--;
    return { ok: true };
  }

  setStyle(s: StyleId): void { this.A.style = s; this.addEv(0, 'info', `${this.A.name} muda para ${STYLES[s].n}.`); }
  get possessionPct(): number {
    const t = this.st.poss[0] + this.st.poss[1];
    return t ? Math.round(this.st.poss[0] / t * 100) : 50;
  }
}

/** Joga a partida inteira sem interação (intervalo incluso). */
export async function simulate(A: Side, B: Side): Promise<Match> {
  const m = new Match(A, B);
  for (;;) {
    const r = await m.step();
    if (r === 'ht') m.secondHalf();
    else if (r === 'end') return m;
  }
}

export function matchReward(goalsFor: number, goalsAgainst: number, momGoals: number, divMult: number, league: boolean): number {
  const res = goalsFor > goalsAgainst ? 'w' : goalsFor === goalsAgainst ? 'd' : 'l';
  const coins = ({ w: 900, d: 450, l: 250 })[res] + goalsFor * 60 + momGoals * 40;
  return Math.round(coins * divMult * (league ? 1 : .5) / 10) * 10;
}

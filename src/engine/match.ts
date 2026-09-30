// Motor de partida minuto a minuto (sem interface). A interface injeta onMoment
// para transformar chances do usuário em lances jogáveis.
import { kitsDaPartida, type Kit } from './kits';
import { classicoCartoes, type Classico } from './rivals';
import { calcChem, effOvr, rate, type Ratings } from './chemistry';
import { ROLE, slotsOf } from './positions';
import { R, clamp, rn, wpick } from './rng';
import type { OppTeam } from './season';
import { STYLES, sv } from './tactics';
import { tx } from './narration';
import type { BasePlayer, FormationId, Pos, StyleId } from './types';
import type { TeamInfo } from './state';
import { bestXI, squadOf } from './squads';
import { FX, psLevel, teamFx, type PsId } from './playstyles';
import { funcOf, orderFx, suggestOrder, type Order, type OrderFx } from './orders';

export interface SideEntry {
  P: BasePlayer; pos: Pos; base: number; inMin: number; yc: number; red: boolean; name: string; /** Machucou no jogo. */ inj?: boolean;
  /** Efeito da função/orientação do jogador e o id da função (para a narração). */
  ofx?: OrderFx; fn?: string;
  /** Números do jogo para a nota: gols, assistências, desarmes/bloqueios, defesas (goleiro), finalizações. */
  /** Números no jogo: gols, assistências, desarmes/interceptações, defesas (goleiro), chances, erros (bola perdida que virou chance) e finalizações. */
  sx?: { g: number; a: number; d: number; s: number; c: number; e?: number; f?: number };
}
const bump = (e: SideEntry | null | undefined, k: 'g' | 'a' | 'd' | 's' | 'c' | 'e' | 'f', n = 1) => { if (!e) return; const x = (e.sx ??= { g: 0, a: 0, d: 0, s: 0, c: 0 }); x[k] = (x[k] ?? 0) + n; };
/** Quem perde a bola que vira chance do rival (meio e defesa mais expostos). */
const ERR_W: Record<Pos, number> = { GOL: .15, ZAG: 1, LD: 1, LE: 1, VOL: 1.2, MC: 1.3, MEI: 1.1, MD: 1, ME: 1, PD: .8, PE: .8, ATA: .6 };
export interface Nota { name: string; pos: Pos; nota: number; side: 0 | 1 }
export interface Side {
  you: boolean; name: string; s: string; c1: string; c2: string;
  /** Clube (para os uniformes), uniforme escolhido pelo usuário e o uniforme vestido na partida. */
  club?: string; kitEscolha?: number; kit?: Kit;
  form: FormationId; style: StyleId; ment: number;
  xi: SideEntry[]; bench: BasePlayer[]; subs: number; goals: number; scorers: string[]; str?: number;
  /** Orientações por vaga (o usuário escolhe; a IA usa as sugeridas pelos atributos). */
  ord?: Order[];
}
export type EvType = 'info' | 'goal' | 'goal opp' | 'goal lance' | 'chance' | 'card-y' | 'card-r' | 'lance';
export interface MatchEvent { l: string; side: 0 | 1; type: EvType; text: string }
export type MomentKind = 'ataque' | 'contra' | 'penalti' | 'falta' | 'goleiro' | 'escanteio' | 'lateral';
export interface MomentRequest {
  kind: MomentKind;
  /** Cobrador (pênalti e falta). */
  taker?: SideEntry;
  /** Lance de goleiro: é um pênalti contra você? */
  pen?: boolean;
  /** Lance de treino: defesa mais leve e mais ações. */
  treino?: boolean;
  /** Por onde a jogada nasce (lado do campo de quem a criou) e quem começa com a bola. */
  lado?: 'esq' | 'dir' | 'meio';
  creator?: SideEntry;
}
export interface MomentResult { goal: boolean; shot: boolean; onTarget?: boolean; scorer?: string; assist?: string | null; text?: string }
export type MomentHandler = (m: Match, req: MomentRequest) => Promise<MomentResult>;

type Tick = { m: number; l: string } | { ht: true };

export const SCORE_W: Record<Pos, number> = { GOL: 0, ZAG: .4, LD: .35, LE: .35, VOL: .6, MC: 1.3, MEI: 2.4, MD: 1.6, ME: 1.6, PD: 3.1, PE: 3.1, ATA: 3.6 };
const ASSIST_W: Record<Pos, number> = { GOL: .05, ZAG: .3, LD: .9, LE: .9, VOL: .8, MC: 1.5, MEI: 2.6, MD: 1.8, ME: 1.8, PD: 2, PE: 2, ATA: 1.3 };
const FOUL_W: Record<Pos, number> = { GOL: .1, ZAG: 1.4, LD: 1.1, LE: 1.1, VOL: 1.5, MC: 1, MEI: .6, MD: .8, ME: .8, PD: .5, PE: .5, ATA: .5 };
/** Constantes calibradas com npm run calibrar (média ~2,6 gols entre times do mesmo nível). */
export const CALIB = {
  chanceBase: .12,    // chance base de criar uma finalização por minuto
  penChance: .013,    // fração das finalizações que viram pênalti
  penConv: .78,       // conversão base do pênalti
  shotBase: .042,     // chance mínima de gol numa finalização
  shotQ: .15,         // parte que depende da qualidade da chance
  attExp: 2.5,        // peso da relação ataque/defesa na criação de chances (diferença de nível pesa mais)
  possExp: 2.8,       // peso do meio-campo na posse
  finExp: 1.5,        // peso da qualidade do finalizador contra o goleiro
  home: 1.3,         // multiplicador de chances do mandante
  away: .8,          // multiplicador de chances do visitante
  homeMid: 1.03,      // a torcida empurra: meio-campo do mandante um pouco mais forte
};

const POSS_MOD: Record<StyleId, number> = { posse: .07, retranca: -.08, contra: -.06, pressao: .03, equilibrado: 0 };

/** Lado do usuário a partir do time escalado. */
export function sideFromTeam(T: TeamInfo, o: { name: string; form: FormationId; style: StyleId; ment: number; bench: BasePlayer[]; ord?: Order[] }): Side {
  const xi = T.slots.map((s, i) => {
    const P = T.xi[i]!, od = o.ord?.[i] ?? suggestOrder(P, s.p);
    return { P, pos: s.p, base: effOvr(P, s.p, T.chem.per[i]), inMin: 0, yc: 0, red: false, name: P.short, ofx: orderFx(s.p, od), fn: funcOf(s.p, od).id };
  });
  return { you: true, name: o.name, s: (o.name[0] || 'E').toUpperCase(), c1: '#e8c35f', c2: '#1d1403', form: o.form, style: o.style,
    ment: o.ment - 2, xi, bench: o.bench, subs: 5, goals: 0, scorers: [], ord: o.ord };
}

/** Adversário real: escala o melhor XI do elenco do clube na formação escolhida. */
export function sideOpp(t: OppTeam, boost = 0): Side {
  const { xi: players, bench } = bestXI(squadOf(t.club), t.form, t.club);
  const slots = slotsOf(t.form);
  const chem = calcChem(players, t.form);
  const xi = players.map((P, i) => {
    const od = suggestOrder(P, slots[i].p);
    return { P, pos: slots[i].p, base: effOvr(P, slots[i].p, chem.per[i]) + boost, inMin: 0, yc: 0, red: false, name: P.short, ofx: orderFx(slots[i].p, od), fn: od.f };
  });
  return { you: false, name: t.n, s: t.s, club: t.club, c1: t.c1, c2: t.c2, form: t.form, style: t.style, ment: 0, xi, bench, subs: 5, goals: 0, scorers: [], str: t.str };
}

/** Cansaço de 0 a 1: começa aos 55 minutos em campo. Incansável reduz. */
export const fatigue = (e: SideEntry, min: number): number =>
  clamp((min - e.inMin - 55 / (e.ofx?.tire ?? 1)) / 35, 0, 1) * FX.incansavel[psLevel(e.P, 'incansavel')] * (e.ofx?.tire ?? 1);
/** Chance de lesão por minuto simulado, por time. */
const INJ_P = .0022;
export const effNow = (e: SideEntry, min: number): number => (e.red ? 0 : e.base * (1 - fatigue(e, min) * .08));

type Play = 'score' | 'assist' | 'head' | 'long' | 'cross';
function weightedPlayer(side: Side, W: Record<Pos, number>, excl?: SideEntry | null, bonus?: (e: SideEntry) => number, play?: Play): SideEntry {
  const c = side.xi.filter(e => !e.red && e !== excl).map(e => [e, (W[e.pos] || .1) * Math.pow(Math.max(e.base, 30) / 70, 3) * (bonus ? bonus(e) : 1) * (play && e.ofx ? e.ofx[play] : 1)] as const);
  return c.length ? wpick(c) : side.xi[0];
}
const LONG_W: Record<Pos, number> = { GOL: 0, ZAG: .3, LD: .4, LE: .4, VOL: 1.2, MC: 2, MEI: 2.6, MD: 1.4, ME: 1.4, PD: 2.2, PE: 2.2, ATA: 1.6 };
const HEAD_W: Record<Pos, number> = { GOL: 0, ZAG: 1.4, LD: .4, LE: .4, VOL: .9, MC: .8, MEI: .6, MD: .6, ME: .6, PD: 1, PE: 1, ATA: 3.2 };
const CROSS_W: Record<Pos, number> = { GOL: 0, ZAG: .1, LD: 2, LE: 2, VOL: .3, MC: .8, MEI: 1.2, MD: 2.2, ME: 2.2, PD: 2.2, PE: 2.2, ATA: .3 };
const ps = (e: SideEntry | undefined | null, id: PsId) => psLevel(e?.P, id);

/** Melhor cobrador de falta do time: prioriza Cobrança de Falta, depois passe e finalização. */
export function freeKickTaker(side: Side): SideEntry {
  const c = side.xi.filter(e => !e.red && e.pos !== 'GOL');
  return c.reduce((a, b) => {
    const v = (e: SideEntry) => ps(e, 'cobranca-de-falta') * 100 + (e.P.st[2] + e.P.st[1]) / 2;
    return v(b) > v(a) ? b : a;
  });
}
/** Batedor de pênalti: finalização precisa/cobrança de falta e finalização. */
export function penaltyTaker(side: Side): SideEntry {
  const c = side.xi.filter(e => !e.red && e.pos !== 'GOL');
  return c.reduce((a, b) => {
    const v = (e: SideEntry) => (ps(e, 'finalizacao-precisa') + ps(e, 'cobranca-de-falta')) * 20 + e.P.st[1];
    return v(b) > v(a) ? b : a;
  });
}
export const pickShooter = (side: Side, boost?: Partial<Record<Pos, number>>): SideEntry => weightedPlayer(side, { ...SCORE_W, ...boost });

export class Match {
  seq: Tick[] = [];
  k = 0;
  label = "0'";
  min = 0;
  ev: MatchEvent[] = [];
  st = { poss: [0, 0], sh: [0, 0], on: [0, 0], yc: [0, 0], ck: [0, 0] };
  /** Ocorrências do seu time (lado A) para a carreira: amarelos, expulsões e lesões (id do jogador). */
  inc = { y: [] as string[], r: [] as string[], les: [] as { id: string; name: string; jogos: number }[] };
  ht = false;
  over = false;
  momentsLeft: number;
  /** Clássico (rivalidade): jogo mais pegado. */
  classico?: Classico;
  /** Escanteio/lateral a favor que vai virar lance jogável neste minuto. */
  private bolaParada: 'escanteio' | 'lateral' | null = null;
  lastMom = -99;
  momGoals = 0;
  private aiDone: Record<string, boolean> = {};
  onMoment?: MomentHandler;
  /** Mandante: 0 = A, 1 = B, null = campo neutro. */
  home: 0 | 1 | null;
  /** Goleiro mais difícil de bater nos lances jogáveis (dificuldade e jogo fora de casa). */
  keeperBoost: number;
  /** Lances de goleiro restantes (você defende o chute que ia virar gol). */
  keeperLeft: number;
  lastKeeper = -99;

  constructor(public A: Side, public B: Side, opts: { moments?: number; onMoment?: MomentHandler; home?: 0 | 1 | null; keeperBoost?: number; keeper?: number; classico?: Classico } = {}) {
    this.classico = opts.classico;
    this.momentsLeft = opts.onMoment ? (opts.moments ?? 3) : 0;
    this.onMoment = opts.onMoment;
    this.home = opts.home ?? null;
    const kits = kitsDaPartida(A, B, this.home, A.kitEscolha);
    A.kit = kits.a; B.kit = kits.b;
    this.keeperBoost = opts.keeperBoost ?? 0;
    this.keeperLeft = opts.onMoment ? (opts.keeper ?? 0) : 0;
    const s1 = 1 + Math.floor(R() * 3), s2 = 2 + Math.floor(R() * 4);
    for (let m = 1; m <= 45; m++) this.seq.push({ m, l: m + "'" });
    for (let k = 1; k <= s1; k++) this.seq.push({ m: 45, l: '45+' + k + "'" });
    this.seq.push({ ht: true });
    for (let m = 46; m <= 90; m++) this.seq.push({ m, l: m + "'" });
    for (let k = 1; k <= s2; k++) this.seq.push({ m: 90, l: '90+' + k + "'" });
    this.addEv(0, 'info', `${A.name} (${A.form}, ${STYLES[A.style].n}) × ${B.name} (${B.form}, ${STYLES[B.style].n}). Bola rolando!`);
    if (this.home !== null) this.addEv(this.home, 'info', this.home === 0 ? `Casa cheia! A torcida do ${A.name} empurra o time.` : `Pressão da torcida do ${B.name}: jogar fora de casa é mais difícil.`);
  }

  addEv(side: 0 | 1, type: EvType, text: string): void { this.ev.unshift({ l: this.label, side, type, text }); }
  ratingsOf(side: Side): Ratings { return rate(side.xi.map(e => ({ pos: e.pos, eff: effNow(e, this.min), red: e.red, P: e.P, ofx: e.ofx }))); }
  /** Espaço que o time deixa atrás (laterais-alas, volantes que sobem...): aumenta as chances do rival, principalmente no contra-ataque. */
  exposure(side: Side): number { return side.xi.reduce((s, e) => s + (e.red ? 0 : e.ofx?.expose ?? 0), 0); }

  /** Avança um minuto. Retorna o que aconteceu com o relógio. */
  async step(): Promise<'tick' | 'ht' | 'end'> {
    if (this.over) return 'end';
    if (this.ht) return 'ht';
    const it = this.seq[this.k++];
    if (!it) { this.over = true; this.addEv(0, 'info', 'Fim de jogo!'); return 'end'; }
    if ('ht' in it) { this.ht = true; this.addEv(0, 'info', 'Fim do primeiro tempo.'); return 'ht'; }
    this.min = it.m; this.label = it.l;
    const { A, B } = this, rA = this.ratingsOf(A), rB = this.ratingsOf(B);
    if (this.home === 0) rA.mid *= CALIB.homeMid; else if (this.home === 1) rB.mid *= CALIB.homeMid;
    // Passe Preciso / em Profundidade fortalecem o meio (posse)
    rA.mid *= 1 + Math.min(.04, teamFx(A, 'passe-preciso', FX.passe) + teamFx(A, 'passe-em-profundidade', FX.passe));
    rB.mid *= 1 + Math.min(.04, teamFx(B, 'passe-preciso', FX.passe) + teamFx(B, 'passe-em-profundidade', FX.passe));
    let pA = Math.pow(rA.mid, CALIB.possExp) / (Math.pow(rA.mid, CALIB.possExp) + Math.pow(rB.mid, CALIB.possExp)) + POSS_MOD[A.style] - POSS_MOD[B.style] + .015 * (A.ment - B.ment);
    pA = clamp(pA, .25, .75);
    this.st.poss[0] += pA; this.st.poss[1] += 1 - pA;
    const chance = (att: number, def: number, poss: number, sa: StyleId, sb: StyleId, ma: number, mb: number) => {
      let p = CALIB.chanceBase * Math.pow(poss / .5, .8) * Math.pow(att / def, CALIB.attExp) * sv(sa, sb) * (1 + .13 * ma) * (1 + .09 * mb);
      if (sa === 'retranca') p *= .75;
      if (sb === 'retranca') p *= .82;
      return p;
    };
    const hA = this.home === 0 ? CALIB.home : this.home === 1 ? CALIB.away : 1;
    const hB = this.home === 1 ? CALIB.home : this.home === 0 ? CALIB.away : 1;
    const cA = chance(rA.att, rB.def, pA, A.style, B.style, A.ment, B.ment) * this.psChance(A, B) * hA * this.exposed(B, A);
    const cB = chance(rB.att, rA.def, 1 - pA, B.style, A.style, B.ment, A.ment) * this.psChance(B, A) * hB * this.exposed(A, B);
    const rollA = R(), rollB = R();
    if (rollA < cA) await this.shot(A, B, rA, 0);
    else if (rollA < cA / this.tackleKeep(B)) this.tackleEvent(B, A, 1);
    else if (rollA < cA * 2.4) bump(this.desarmador(B), 'd'); // jogada cortada antes de virar chance (só estatística)
    // Chance do rival: às vezes nasce de uma bola perdida por alguém do seu time (erro)
    if (rollB < cB && R() < .4) bump(weightedPlayer(A, ERR_W), 'e');
    if (rollA < cA && R() < .4) bump(weightedPlayer(B, ERR_W), 'e');
    if (!this.over && rollB < cB) await this.shot(B, A, rB, 1);
    else if (rollB < cB / this.tackleKeep(A)) this.tackleEvent(A, B, 0);
    else if (rollB < cB * 2.4) bump(this.desarmador(A), 'd');
    if (!this.over) await this.freeKicks();
    if (!this.over) this.ambient(pA, rA, rB);
    if (!this.over && this.bolaParada) { const k = this.bolaParada; this.bolaParada = null; await this.playMoment(A, 0, { kind: k }); }
    this.cards();
    this.injuries();
    this.aiManage();
    return 'tick';
  }

  secondHalf(): void { this.ht = false; }

  private cards(): void {
    for (const [side, si] of [[this.A, 0], [this.B, 1]] as const) {
      const pr = .02 * (side.style === 'pressao' ? 1.4 : 1) * classicoCartoes(this.classico);
      if (R() < pr) {
        const e = weightedPlayer(side, FOUL_W);
        // Quem já tem amarelo se cuida: na maioria das vezes tira o pé da dividida
        if (e.yc && R() < .8) continue;
        if (R() < .03) { e.red = true; if (si === 0) this.inc.r.push(e.P.id); this.addEv(si, 'card-r', tx('rc2', { p: e.name })); }
        else if (e.yc) { e.red = true; if (si === 0) this.inc.r.push(e.P.id); this.addEv(si, 'card-r', tx('rc', { p: e.name })); }
        else { e.yc = 1; this.st.yc[si]++; if (si === 0) this.inc.y.push(e.P.id); this.addEv(si, 'card-y', tx('yc', { p: e.name })); }
      }
    }
  }

  /** Lesões: raras (~1 a cada 5 jogos por time). Quem se machuca sai; sem substituição, fica em campo rendendo pouco. */
  private injuries(): void {
    for (const [side, si] of [[this.A, 0], [this.B, 1]] as const) {
      if (R() >= INJ_P) continue;
      const ok = side.xi.filter(e => !e.red && !e.inj);
      if (!ok.length) continue;
      const e = ok[Math.floor(R() * ok.length)], jogos = [1, 1, 1, 2, 2, 3, 4][Math.floor(R() * 7)];
      e.inj = true;
      if (si === 0) this.inc.les.push({ id: e.P.id, name: e.name, jogos });
      // Troca pelo melhor reserva para a posição; se não der, ele segue em campo mancando
      const cands = side.bench.map((P, j) => ({ P, j })).filter(c => !side.xi.some(x => !x.red && x.P.id === c.P.id));
      if (side.subs > 0 && cands.length) {
        const best = cands.reduce((a, b) => (effOvr(b.P, e.pos, 1) > effOvr(a.P, e.pos, 1) ? b : a));
        this.addEv(si, 'info', `Lesão: ${e.name} sente e sai de campo${si === 0 ? ` (fora por ${jogos} jogo${jogos > 1 ? 's' : ''})` : ''}. Entra ${best.P.short}.`);
        side.bench.splice(best.j, 1); side.bench.push(e.P);
        Object.assign(e, { P: best.P, name: best.P.short, base: effOvr(best.P, e.pos, 1), inMin: this.min, yc: 0, inj: false, sx: undefined });
        side.subs--;
      } else {
        e.base *= .6;
        this.addEv(si, 'info', `Lesão: ${e.name} se machuca e segue em campo no sacrifício.`);
      }
    }
  }

  /** Multiplicador das chances de `att` pelo espaço que `def` deixa atrás (mais forte se `att` joga no contra-ataque). */
  private exposed(def: Side, att: Side): number {
    const x = this.exposure(def) * (att.style === 'contra' ? 1.6 : 1);
    // Com gente a menos, sobra espaço para o rival
    const reds = def.xi.filter(e => e.red).length;
    return clamp(1 + .045 * x, .82, 1.3) * (1 + .14 * reds);
  }

  /** Narração do jogo corrido (lances de construção, escanteios, impedimentos) com os nomes e funções dos jogadores. */
  private ambient(pA: number, rA: Ratings, rB: Ratings): void {
    if (R() > .16) return;
    const si: 0 | 1 = R() < pA ? 0 : 1, att = si ? this.B : this.A, def = si ? this.A : this.B;
    const who = (play: Play, W: Record<Pos, number> = ASSIST_W) => weightedPlayer(att, W, null, undefined, play);
    const roll = R();
    if (roll < .18) {
      this.st.ck[si]++; this.addEv(si, 'info', tx('corner', { p: who('cross', CROSS_W).name }));
      // Parte dos seus escanteios vira lance jogável
      if (si === 0 && this.canMoment(att) && R() < .35) this.bolaParada = 'escanteio';
      return;
    }
    if (si === 0 && roll < .2 && this.canMoment(att)) { this.bolaParada = 'lateral'; return; }
    if (roll < .26) { this.addEv(si, 'info', tx('offside', { p: who('score', SCORE_W).name })); return; }
    const a = who('assist');
    const fn = a.fn ?? '';
    const k = fn === 'pivo' ? 'bPivo' : fn === 'falso-9' ? 'bFalso9' : fn === 'armador' || fn === 'regista' ? 'bArmador' : fn === 'ala' ? 'bAla'
      : fn === 'aberto' ? 'bAberto' : fn === 'invertido' ? 'bInvertido' : fn === 'box-to-box' || fn === 'infiltrador' ? 'bBox' : fn === 'construtor' || fn === 'libero' ? 'bSaida' : 'build';
    const d = weightedPlayer(def, { GOL: 0, ZAG: 1, LD: .8, LE: .8, VOL: 1.2, MC: .6, MEI: .2, MD: .4, ME: .4, PD: .1, PE: .1, ATA: .05 });
    this.addEv(si, 'info', tx(k as Parameters<typeof tx>[0], { p: a.name, q: who('score', SCORE_W).name, d: d.name }));
    // Pressão: quem domina muito faz a torcida perceber
    const dom = si ? rB.att / rA.def : rA.att / rB.def;
    if (dom > 1.08 && R() < .25) this.addEv(si, 'info', tx('pressure', { t: att.name }));
  }

  /** Fração das chances que sobra depois dos desarmes e interceptações do rival. */
  private tackleKeep(def: Side): number {
    return 1 - Math.min(.18, teamFx(def, 'desarme', FX.desarme) + teamFx(def, 'interceptacao', FX.intercept) + teamFx(def, 'antecipacao', FX.antecipacao) + teamFx(def, 'contencao', FX.contencao));
  }
  /** Multiplicador de criação de chances pelos playstyles (desarmes do rival, velocistas no contra-ataque). */
  private psChance(att: Side, def: Side): number {
    let m = this.tackleKeep(def);
    if (att.style === 'contra') {
      m *= 1 + Math.min(.16, teamFx(att, 'velocista', FX.velocista));
      // Velocidade (RIT) de quem ataca o espaço decide o contra-ataque
      const fwd = att.xi.filter(e => !e.red && (e.pos === 'ATA' || e.pos === 'PD' || e.pos === 'PE' || e.fn === 'profundidade' || e.fn === 'velocista'));
      if (fwd.length) m *= clamp(Math.pow(fwd.reduce((s, e) => s + (e.P.st?.[0] ?? 70), 0) / fwd.length / 78, 1.6), .8, 1.25);
    }
    return m;
  }
  /** Narra um desarme que matou a jogada (só às vezes, para não poluir). */
  private desarmador(def: Side): SideEntry {
    return weightedPlayer(def, { GOL: 0, ZAG: 1, LD: .8, LE: .8, VOL: 1.2, MC: .6, MEI: .2, MD: .4, ME: .4, PD: .1, PE: .1, ATA: .05 }, null,
      e => (1 + 2 * ps(e, 'desarme') + 1.5 * ps(e, 'interceptacao') + 1.5 * ps(e, 'antecipacao') + ps(e, 'contencao')) * ((e.P.st?.[4] ?? 60) / 70) ** 2);
  }
  private tackleEvent(def: Side, att: Side, si: 0 | 1): void {
    const d = this.desarmador(def);
    bump(d, 'd');
    // Só narra quem tem estilo de defesa (os outros desarmes contam na estatística em silêncio)
    if (!ps(d, 'desarme') && !ps(d, 'interceptacao') && !ps(d, 'antecipacao') && !ps(d, 'contencao')) return;
    const a = weightedPlayer(att, SCORE_W);
    this.addEv(si, 'info', tx('tackle', { d: d.name, p: a.name }));
  }

  /** Quem cria a jogada e por qual lado: alas, pontas abertos e laterais que apoiam puxam o lance para as pontas. */
  origin(att: Side): { lado: 'esq' | 'dir' | 'meio'; creator: SideEntry } {
    const W: Record<Pos, number> = { GOL: 0, ZAG: .15, LD: 1.3, LE: 1.3, VOL: .5, MC: 1, MEI: 1.6, MD: 1.8, ME: 1.8, PD: 2.2, PE: 2.2, ATA: 1 };
    const creator = weightedPlayer(att, W, null, e => (e.ofx ? .5 * e.ofx.cross + .5 * e.ofx.assist : 1));
    const x = slotsOf(att.form)[att.xi.indexOf(creator)]?.x ?? 50;
    return { lado: x < 26 ? 'esq' : x > 74 ? 'dir' : 'meio', creator };
  }

  /** Lance de goleiro: o rival vai marcar e você tenta defender. */
  private canKeeper(att: Side): boolean {
    return !att.you && this.A.you && !!this.onMoment && this.keeperLeft > 0 && this.min - this.lastKeeper >= 5;
  }
  private async playKeeper(att: Side, si: 0 | 1, shooter: SideEntry, pen: boolean, goalText: string, suffix = '', assist?: SideEntry | null): Promise<void> {
    this.keeperLeft--; this.lastKeeper = this.min;
    const res = await this.onMoment!(this, { kind: 'goleiro', taker: shooter, pen });
    const gk = this.A.xi.find(e => e.pos === 'GOL' && !e.red);
    if (res.goal) this.goal(att, si, shooter, goalText, suffix, assist);
    else { this.st.on[si]++; if (gk) (gk.sx ??= { g: 0, a: 0, d: 0, s: 0, c: 0 }).s += 2; this.addEv(0, 'lance', `Lance jogado: ${gk ? gk.name : 'o goleiro'} defendeu ${pen ? 'o pênalti' : 'o chute'} de ${shooter.name}!`); }
  }

  /** Lance jogável para o usuário, se ainda houver e o intervalo mínimo tiver passado. */
  private canMoment(att: Side): boolean {
    return att.you && !!this.onMoment && this.momentsLeft > 0 && this.min - this.lastMom >= 10;
  }
  private async playMoment(att: Side, si: 0 | 1, req: MomentRequest): Promise<void> {
    this.momentsLeft--; this.lastMom = this.min;
    const res = await this.onMoment!(this, req);
    if (res.shot) this.st.sh[si]++;
    if (res.shot && res.onTarget) this.st.on[si]++;
    if (res.goal) {
      att.goals++; att.scorers.push(res.scorer + ' ' + this.label + (req.kind === 'penalti' ? ' (p)' : req.kind === 'falta' ? ' (f)' : '')); this.momGoals++;
      bump(att.xi.find(e => e.name === res.scorer), 'g'); if (res.assist) bump(att.xi.find(e => e.name === res.assist), 'a');
      this.addEv(si, 'goal lance', `Lance jogado: GOL de ${res.scorer}!${res.assist ? ' Passe de ' + res.assist + '.' : ''}`);
    } else this.addEv(si, 'lance', `Lance jogado: ${res.text}`);
  }

  private goal(att: Side, si: 0 | 1, shooter: SideEntry, text: string, suffix = '', assist?: SideEntry | null): void {
    bump(shooter, 'g'); bump(assist, 'a');
    this.st.on[si]++; att.goals++; att.scorers.push(shooter.name + ' ' + this.label + suffix);
    this.addEv(si, si ? 'goal opp' : 'goal', text);
  }

  /** Faltas perigosas: cobrança direta, influenciada por Cobrança de Falta e pelo goleiro. */
  private async freeKicks(): Promise<void> {
    for (const [att, def, si] of [[this.A, this.B, 0], [this.B, this.A, 1]] as const) {
      if (this.over) return;
      const p = .0065 * (def.style === 'pressao' ? 1.25 : 1) * (att.ment >= 1 ? 1.15 : 1);
      if (R() >= p) continue;
      const taker = freeKickTaker(att), lvl = ps(taker, 'cobranca-de-falta');
      if (lvl > 0 && this.canMoment(att)) { await this.playMoment(att, si, { kind: 'falta', taker }); continue; }
      const gkE = def.xi.find(e => e.pos === 'GOL' && !e.red), gk = gkE ? gkE.name : 'o goleiro';
      this.st.sh[si]++;
      this.addEv(si, 'info', tx('fk', { p: taker.name }));
      const gp = FX.falta[lvl] * FX.reflexos[ps(gkE, 'reflexos')] * clamp((taker.P.st[2] + taker.P.st[1]) / 2 / 75, .8, 1.2);
      if (R() < gp) this.goal(att, si, taker, tx('fkGoal', { p: taker.name, gk }), ' (f)');
      else if (R() < .35) { this.st.on[si]++; bump(gkE, 's'); this.addEv(si, 'chance', tx('fkSave', { p: taker.name, gk })); }
      else this.addEv(si, 'chance', tx('fkMiss', { p: taker.name }));
    }
  }

  private async shot(att: Side, def: Side, ra: Ratings, si: 0 | 1): Promise<void> {
    const gkE = def.xi.find(e => e.pos === 'GOL' && !e.red), gk = gkE ? gkE.name : 'o goleiro';
    const isPen = R() < CALIB.penChance;
    if (this.canMoment(att) && (isPen || R() < .3)) {
      await this.playMoment(att, si, isPen ? { kind: 'penalti', taker: penaltyTaker(att) } : { kind: att.style === 'contra' || R() < .25 ? 'contra' : 'ataque', ...this.origin(att) });
      return;
    }
    this.st.sh[si]++;
    if (isPen && this.canKeeper(att)) {
      const taker = penaltyTaker(att);
      this.st.sh[si]++;
      this.addEv(si, 'info', tx('pen', { p: weightedPlayer(att, SCORE_W).name }));
      await this.playKeeper(att, si, taker, true, tx('penGoal', { p: taker.name }), ' (p)');
      return;
    }
    if (isPen) {
      const taker = penaltyTaker(att);
      this.addEv(si, 'info', tx('pen', { p: weightedPlayer(att, SCORE_W).name }));
      const conv = CALIB.penConv + Math.max(FX.penaltiBatedor[ps(taker, 'finalizacao-precisa')], FX.penaltiBatedor[ps(taker, 'cobranca-de-falta')]) - FX.penaltiGol[ps(gkE, 'pegador-de-penalti')];
      if (R() < conv) this.goal(att, si, taker, tx('penGoal', { p: taker.name }), ' (p)');
      else this.addEv(si, 'info', ps(gkE, 'pegador-de-penalti') ? tx('penSaved', { p: taker.name, gk }) : tx('penMiss', { p: taker.name, gk }));
      return;
    }
    // Tipo de finalização: normal, de longe ou de cabeça (mais frequentes com os especialistas em campo).
    const wLong = .22 * (1 + .12 * Math.min(4, teamFx(att, 'chute-de-longe', [0, 1, 2])));
    // Times que jogam pelas pontas (alas, pontas abertos) cruzam mais: mais cabeçadas
    const wide = att.xi.reduce((t, e) => t + (e.red ? 0 : Math.max(0, (e.ofx?.cross ?? 1) - 1)), 0);
    const wHead = .16 * (1 + .1 * Math.min(4, teamFx(att, 'cruzamento', [0, 1, 2]) + teamFx(att, 'cabeceio', [0, 1, 2]))) * (1 + .12 * Math.min(3, wide));
    const kind = wpick([['normal', .62], ['longe', wLong], ['cabeca', wHead]] as const);
    const shooter = kind === 'longe' ? weightedPlayer(att, LONG_W, null, e => 1 + 1.3 * ps(e, 'chute-de-longe'), 'long')
      : kind === 'cabeca' ? weightedPlayer(att, HEAD_W, null, e => 1 + 1.3 * ps(e, 'cabeceio') + .3 * ps(e, 'imposicao-fisica'), 'head')
      : weightedPlayer(att, SCORE_W, null, e => 1 + .4 * ps(e, 'finalizacao-precisa'), 'score');
    bump(shooter, 'f');
    const assist = kind === 'cabeca' ? weightedPlayer(att, CROSS_W, shooter, e => FX.cruzamento[ps(e, 'cruzamento')], 'cross')
      : R() < .62 ? weightedPlayer(att, ASSIST_W, shooter, e => FX.profundidade[ps(e, 'passe-em-profundidade')] + .2 * ps(e, 'passe-preciso'), 'assist') : null;
    // Bloqueio (chutes rasteiros e de longe)
    if (kind !== 'cabeca') {
      const bl = Math.min(.2, teamFx(def, 'bloqueio', FX.bloqueio));
      if (bl > 0 && R() < bl) {
        const d = weightedPlayer(def, { GOL: 0, ZAG: 1, LD: .5, LE: .5, VOL: .8, MC: .3, MEI: .1, MD: .2, ME: .2, PD: .05, PE: .05, ATA: .02 }, null, e => 1 + 3 * ps(e, 'bloqueio'));
        if (ps(d, 'bloqueio')) { bump(d, 'd'); this.addEv(si, 'chance', tx('block', { d: d.name, p: shooter.name })); return; }
      }
    }
    const q = R();
    // Atributos pesam: FIN no chute normal, FIN + FIS de longe, FIN + FIS (impulsão) de cabeça; goleiro por REF/MER/POS.
    const st = shooter.P.st ?? [], ovr = shooter.P.ovr;
    const attr = shooter.P.pos === 'GOL' ? ovr : kind === 'normal' ? st[1] : kind === 'longe' ? .6 * st[1] + .4 * st[5] : .5 * st[1] + .5 * st[5];
    const fin = effNow(shooter, this.min) + .8 * ((attr ?? ovr) - ovr);
    const gkv = gkE ? effNow(gkE, this.min) + .7 * ((gkE.P.st ? .35 * gkE.P.st[3] + .35 * gkE.P.st[0] + .3 * gkE.P.st[5] : gkE.P.ovr) - gkE.P.ovr) : 30;
    let gp = (CALIB.shotBase + CALIB.shotQ * q * q) * Math.pow(clamp((fin * .6 + ra.att * .4) / gkv, .6, 1.8), CALIB.finExp);
    gp *= FX.reflexos[ps(gkE, 'reflexos')];
    if (kind === 'normal') gp *= 1.12 * FX.finalizacao[ps(shooter, 'finalizacao-precisa')] * FX.colocadoSim[ps(shooter, 'chute-colocado')] * FX.cavadinhaSim[ps(shooter, 'cavadinha')];
    else if (kind === 'longe') gp *= .56 * FX.chuteLonge[ps(shooter, 'chute-de-longe')];
    else {
      const bestDef = Math.max(0, ...def.xi.filter(e => !e.red && e.pos !== 'GOL').map(e => FX.cabeceioDef[ps(e, 'cabeceio')] + .04 * ps(e, 'imposicao-fisica')));
      gp *= .9 * FX.cabeceio[ps(shooter, 'cabeceio')] * FX.acrobaticoSim[ps(shooter, 'acrobatico')] * (1 - bestDef) * FX.saidaGol[ps(gkE, 'saida-do-gol')];
    }
    const o = { p: shooter.name, gk };
    if (R() < gp) {
      const t = kind === 'longe' ? tx('goalLong', o) : kind === 'cabeca' ? tx('goalHead', o) : tx('goal', o);
      if (this.canKeeper(att) && kind !== 'cabeca') {
        await this.playKeeper(att, si, shooter, false, t + (assist ? ` Assistência de ${assist.name}.` : ''), '', assist);
        return;
      }
      this.goal(att, si, shooter, t + (assist ? ` ${kind === 'cabeca' ? 'Cruzamento' : 'Assistência'} de ${assist.name}.` : ''), '', assist);
    } else if (R() < .45) { this.st.on[si]++; bump(gkE, 's'); bump(shooter, 'c', .5); this.addEv(si, 'chance', kind === 'cabeca' ? tx('saveHead', o) : tx('save', o)); }
    else if (R() < .08) this.addEv(si, 'chance', tx('post', o));
    else if (q > .45) this.addEv(si, 'chance', kind === 'longe' ? tx('missLong', o) : kind === 'cabeca' ? tx('missHead', o) : tx('miss', o));
  }

  /** IA lê o jogo aos 30 minutos: se está sendo dominada, muda o plano. */
  private aiReact(): void {
    const B = this.B, A = this.A, m = this.min;
    if (m < 30 || this.aiDone.r30) return;
    this.aiDone.r30 = true;
    const poss = 100 - this.possessionPct, shotsDiff = this.st.sh[0] - this.st.sh[1];
    if (B.style === 'posse' && poss < 42) { B.style = 'contra'; this.addEv(1, 'info', `${B.name} não consegue ficar com a bola e passa a jogar no contra-ataque.`); }
    else if (shotsDiff >= 4 && B.goals <= A.goals) { B.ment = Math.max(-2, B.ment - 1); this.addEv(1, 'info', `${B.name} recua as linhas para suportar a pressão.`); }
    else if (A.style === 'posse' && B.style === 'equilibrado' && R() < .5) { B.style = 'pressao'; this.addEv(1, 'info', `${B.name} adianta a marcação para tirar a bola do ${A.name}.`); }
  }

  /** IA do time B: muda a mentalidade conforme o placar e faz substituições. */
  private aiManage(): void {
    this.aiReact();
    const B = this.B, diff = B.goals - this.A.goals, m = this.min;
    if (m >= 46 && !this.aiDone.ht) {
      this.aiDone.ht = true;
      // No intervalo: perdendo e fechado, abre o time; ganhando com folga, fecha.
      if (diff < 0 && (B.style === 'retranca' || B.style === 'contra')) { B.style = diff <= -2 ? 'pressao' : 'equilibrado'; this.addEv(1, 'info', `${B.name} volta do intervalo em ${STYLES[B.style].n.toLowerCase()}.`); }
      else if (diff >= 2 && B.style === 'pressao') { B.style = 'equilibrado'; this.addEv(1, 'info', `${B.name} diminui o ritmo com a vantagem.`); }
    }
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
        // Sai o mais cansado (ou o pior em campo); entra o reserva que melhor encaixa na posição.
        const outs = B.xi.filter(e => !e.red && e.pos !== 'GOL').sort((a, b) => effNow(a, m) - effNow(b, m) + (R() - .5) * 4);
        const o = outs[0];
        if (!o) continue;
        const cands = B.bench.filter(p => p.pos !== 'GOL');
        if (!cands.length) continue;
        const inn = cands.reduce((a, b) => (effOvr(b, o.pos, 1) > effOvr(a, o.pos, 1) ? b : a));
        B.bench.splice(B.bench.indexOf(inn), 1);
        this.addEv(1, 'info', `Substituição no ${B.name}: sai ${o.name}, entra ${inn.short}.`);
        Object.assign(o, { P: inn, name: inn.short, inMin: m, yc: 0, base: effOvr(inn, o.pos, 1), sx: undefined });
        B.subs--;
      }
    }
  }

  /**
   * Sugestão de troca rápida para o usuário: o titular mais cansado (fôlego abaixo de `limite`) e o melhor reserva
   * para a vaga dele (de preferência da mesma posição). `ignorar` são nomes que o usuário já recusou.
   */
  suggestSub(limite = 70, ignorar: ReadonlySet<string> = new Set()): { out: number; inIdx: number; folego: number; ganho: number } | null {
    const A = this.A;
    if (A.subs <= 0 || !A.bench.length || this.over) return null;
    let best: { out: number; folego: number } | null = null;
    A.xi.forEach((e, i) => {
      if (e.red || e.pos === 'GOL' || ignorar.has(e.name)) return;
      const folego = Math.round(100 - fatigue(e, this.min) * 60);
      if (folego < limite && (!best || folego < best.folego)) best = { out: i, folego };
    });
    if (!best) return null;
    const b = best as { out: number; folego: number }, e0 = A.xi[b.out];
    const emCampo = new Set(A.xi.filter(x => !x.red).map(x => x.P.id));
    let pick: { j: number; v: number } | null = null;
    A.bench.forEach((P, j) => {
      if (emCampo.has(P.id)) return;
      const v = effOvr(P, e0.pos, 1);
      if (!pick || v > pick.v) pick = { j, v };
    });
    if (!pick) return null;
    const pk = pick as { j: number; v: number }, ganho = pk.v - effNow(e0, this.min);
    return ganho > -2 ? { out: b.out, inIdx: pk.j, folego: b.folego, ganho } : null;
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
    Object.assign(e0, { P, name: P.short, base: effOvr(P, e0.pos, ch), inMin: this.min, yc: 0, sx: undefined });
    A.subs--;
    return { ok: true };
  }

  /** Notas de 0 a 10 dos jogadores (quem começou ou entrou), pelo que fizeram no jogo e pelo resultado. */
  /** Gols e assistências de cada jogador do lado A (para as estatísticas da temporada). */
  userNumbers(): Record<string, { id: string; g: number; a: number; d: number; s: number; e: number; f: number }> {
    const o: Record<string, { id: string; g: number; a: number; d: number; s: number; e: number; f: number }> = {};
    for (const e of this.A.xi) { const x = e.sx; if (x) o[e.name] = { id: e.P.id, g: x.g, a: x.a, d: x.d, s: x.s, e: x.e ?? 0, f: x.f ?? 0 }; }
    return o;
  }

  notas(): Nota[] {
    const out: Nota[] = [];
    for (const [side, si, other] of [[this.A, 0, this.B], [this.B, 1, this.A]] as const) {
      const res = Math.sign(side.goals - other.goals), sof = other.goals;
      for (const e of side.xi) {
        const x = e.sx ?? { g: 0, a: 0, d: 0, s: 0, c: 0 };
        const r = ROLE(e.pos);
        const poss = si ? 1 - this.possessionPct / 100 : this.possessionPct / 100;
        let n = 6.2 + .12 * (e.base - 75) / 5 + 1.1 * x.g + .7 * x.a + .3 * x.d + .25 * x.s + .15 * x.c + .35 * res;
        if (r === 'G') n -= .15 + .4 * sof; else if (r === 'D') n -= .2 * sof;
        if (r === 'G' && sof === 0) n += .3; else if (r === 'D' && sof === 0) n += .3;
        if (r === 'M') n += (poss - .5) * 1.5; // meio-campo que domina a posse joga bem
        if (e.yc) n -= .3;
        if (e.red) n -= 2;
        n += (R() - .5) * .5;
        out.push({ name: e.name, pos: e.pos, nota: Math.round(clamp(n, 3.5, 10) * 10) / 10, side: si });
      }
    }
    return out;
  }

  setStyle(s: StyleId): void { this.A.style = s; this.addEv(0, 'info', `${this.A.name} muda para ${STYLES[s].n}.`); }
  get possessionPct(): number {
    const t = this.st.poss[0] + this.st.poss[1];
    return t ? Math.round(this.st.poss[0] / t * 100) : 50;
  }
}

export interface Shootout { a: number; b: number; log: string[]; winner: 0 | 1 }
/** Disputa de pênaltis: 5 cobranças para cada lado e depois alternadas. Batedores pelo mesmo critério do pênalti. */
export function penaltyShootout(A: Side, B: Side): Shootout {
  const order = (s: Side) => s.xi.filter(e => !e.red && e.pos !== 'GOL')
    .sort((x, y) => ((ps(y, 'finalizacao-precisa') + ps(y, 'cobranca-de-falta')) * 20 + y.P.st[1]) - ((ps(x, 'finalizacao-precisa') + ps(x, 'cobranca-de-falta')) * 20 + x.P.st[1]));
  const oa = order(A), ob = order(B), gA = B.xi.find(e => e.pos === 'GOL' && !e.red), gB = A.xi.find(e => e.pos === 'GOL' && !e.red);
  const conv = (t: SideEntry, gk?: SideEntry) => clamp(.74 + (t.P.st[1] - 75) * .004 + Math.max(FX.penaltiBatedor[ps(t, 'finalizacao-precisa')], FX.penaltiBatedor[ps(t, 'cobranca-de-falta')]) - FX.penaltiGol[ps(gk, 'pegador-de-penalti')], .5, .92);
  let a = 0, b = 0, i = 0;
  const log: string[] = [];
  for (;;) {
    const ta = oa[i % oa.length], tb = ob[i % ob.length];
    const ga = R() < conv(ta, gA), gb = R() < conv(tb, gB);
    if (ga) a++;
    log.push(`${A.name}: ${ta.name} ${ga ? 'marca' : 'perde'} (${a}–${b})`);
    if (i < 5 && (a > b + (5 - i) || b > a + (5 - i - 1))) break; // definido antes da 5ª do rival
    if (gb) b++;
    log.push(`${B.name}: ${tb.name} ${gb ? 'marca' : 'perde'} (${a}–${b})`);
    i++;
    if (i < 5) { if (a > b + (5 - i) || b > a + (5 - i)) break; }
    else if (a !== b) break;
    if (i > 30) { a++; break; }
  }
  return { a, b, log, winner: a > b ? 0 : 1 };
}

/** Joga a partida inteira sem interação (intervalo incluso). */
export async function simulate(A: Side, B: Side, home: 0 | 1 | null = null): Promise<Match> {
  const m = new Match(A, B, { home });
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

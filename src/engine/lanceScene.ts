// Cena de um lance jogável, sem interface: posiciona os jogadores, calcula as chances de cada ação
// (com playstyles), resolve o resultado e devolve um "plano" de animação que o renderizador (2D ou 3D) executa.
// Coordenadas: x de 0 a 68 (largura), y = distância da linha de fundo (gol em y = 0), h = altura da bola.
import { GOAL, analyzeGesture, attackMods, bezier, fkControl, fkOdds, fkResolve, fkSetup, fkShotFromGesture, keeperMods, type FkSetup, type FkShot, type Gesture, type KeeperMods, type Pt } from './lance';
import { effNow, pickShooter, type Match, type MomentKind, type MomentRequest, type MomentResult, type SideEntry } from './match';
import { ROLE, slotsOf } from './positions';
import { R, clamp, pick, rn, type Rng } from './rng';

export interface Actor { id: number; x: number; y: number; tx: number; ty: number; e?: SideEntry; gk?: boolean; team: 0 | 1; num: number }
export type Target =
  | { kind: 'shot'; ax: number; power: number; curve: number }
  /** Passe: rasteiro (1 toque) ou alto (2 toques), por cima da marcação. */
  | { kind: 'pass'; m: Actor; alto?: boolean }
  /** Lançamento em profundidade: a bola vai para o espaço e o companheiro corre até ela. */
  | { kind: 'lanc'; m: Actor; x: number; y: number }
  | { kind: 'drib'; x: number; y: number };
export interface BallKey { x: number; y: number; h: number }
export interface Plan {
  kind: 'pass' | 'drib' | 'shot' | 'fk' | 'lanc';
  ok: boolean;
  /** Trajetória da bola (pontos igualmente espaçados no tempo). */
  ball: BallKey[];
  dur: number;
  /** Goleiro: para onde vai e se mergulha (-1 esquerda, 1 direita, 0 não). */
  gk?: { x: number; y: number; dive: -1 | 0 | 1; h: number };
  /** Chamado quando a animação termina (atualiza quem está com a bola, reação da defesa etc.). */
  commit: () => void;
  /** Se o lance acabou, o resultado para o motor e a mensagem de tela. */
  end?: { res: MomentResult; text: string; color: string; goal: boolean };
}

export const TITLES: Record<MomentKind, string> = { ataque: 'Chance de ataque', contra: 'Contra-ataque!', penalti: 'Pênalti!', falta: 'Falta perigosa!' };

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export function segD(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
  const t = clamp(l ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l : 0, 0, 1);
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
/** Menor distância de um ponto a uma curva amostrada. */
function pathD(p: Pt, path: Pt[]): number {
  let m = 99;
  for (let i = 1; i < path.length; i++) m = Math.min(m, segD(p, path[i - 1], path[i]));
  return m;
}
const arc = (a: Pt, b: Pt, peak: number, n: number, ha = 0, hb = 0): BallKey[] =>
  Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, h: ha + (hb - ha) * t + 4 * peak * t * (1 - t) }; });

export class LanceScene {
  readonly kind: MomentKind;
  mates: Actor[] = [];
  foes: Actor[] = [];
  carrier!: Actor;
  actions: number;
  lastPasser: Actor | null = null;
  done = false;
  readonly setup: FkSetup | null;
  readonly gkE?: SideEntry;
  readonly gkOvr: number;
  readonly km: KeeperMods;
  readonly label: string;
  private r: Rng;
  private nid = 1;

  constructor(readonly M: Match, readonly req: MomentRequest, r: Rng = R) {
    this.r = r;
    const A = M.A, B = M.B, kind = req.kind;
    this.kind = kind; this.label = M.label;
    this.gkE = B.xi.find(e => e.pos === 'GOL' && !e.red);
    // Goleiro do lance: força + atributos de goleiro + dificuldade (e mando)
    const gP = this.gkE?.P;
    this.gkOvr = (this.gkE ? effNow(this.gkE, M.min) + (gP?.st ? .7 * (.35 * gP.st[3] + .35 * gP.st[0] + .3 * gP.st[5] - gP.ovr) : 0) : 35) + (M.keeperBoost ?? 0);
    this.km = keeperMods(this.gkE?.P);
    this.setup = kind === 'falta' ? fkSetup(r) : null;
    this.actions = kind === 'penalti' || kind === 'falta' ? 1 : 6;
    const num = (e?: SideEntry) => (e ? (A.xi.indexOf(e) + 1 === 1 ? 1 : A.xi.indexOf(e) + 1) : 0);
    const mk = (x: number, y: number, team: 0 | 1, e?: SideEntry, gk = false, n = 0): Actor => ({ id: this.nid++, x, y, tx: x, ty: y, e, gk, team, num: n || num(e) });
    if (kind === 'penalti' || kind === 'falta') {
      const taker = req.taker ?? pickShooter(A, { ATA: 6, MEI: 4 });
      const s = this.setup;
      // Na falta o cobrador fica ao lado da bola (não tapa a câmera); no pênalti, atrás da marca.
      this.carrier = mk(s ? s.ball.x + (s.ball.x < 34 ? -1.1 : 1.1) : 34, s ? s.ball.y + .9 : 12, 0, taker);
      this.mates = [this.carrier];
      this.foes.push(mk(s ? s.gkX : 34, .4, 1, undefined, true, 1));
      if (s) {
        const dx = 34 - s.ball.x, dy = -s.ball.y, L = Math.hypot(dx, dy), px = -dy / L, py = dx / L;
        for (let k = 0; k < 4; k++) { const o = (k - 1.5) * (s.wall.half * 2 / 3.2); this.foes.push(mk(s.wall.x + px * o, s.wall.y + py * o, 1, undefined, false, [4, 5, 6, 8][k])); }
        const gx = s.ball.x < 34 ? 1 : -1;
        // Dois companheiros na área (sem repetir o cobrador nem um ao outro)
        const used = new Set([taker]);
        for (let k = 0; k < 2; k++) {
          let e = pickShooter(A);
          for (let t = 0; t < 12 && used.has(e); t++) e = pickShooter(A);
          if (used.has(e)) e = A.xi.find(x => !x.red && x.pos !== 'GOL' && !used.has(x)) ?? e;
          used.add(e);
          this.mates.push(mk(clamp(s.ball.x + gx * (6 + k * 5), 5, 63), clamp(s.wall.y - 3 + k * 2, 5, 40), 0, e));
        }
      }
    } else {
      const slots = slotsOf(A.form), counter = kind === 'contra', depth = counter ? rn(4, 9, r) : rn(0, 4, r);
      A.xi.forEach((e, i) => {
        if (e.red || e.pos === 'GOL') return;
        const sl = slots[i], role = ROLE(e.pos);
        if (role === 'D' && !((e.pos === 'LD' || e.pos === 'LE') && r() < .35)) return;
        const X = 3.5 + sl.x / 100 * 61;
        let Y = sl.y >= 60 ? 31 - (sl.y - 60) * .6 : sl.y >= 36 ? 30 + (60 - sl.y) * .45 : 36;
        Y -= depth;
        this.mates.push(mk(clamp(X + rn(-2, 2, r), 3, 65), clamp(Y + rn(-2, 2, r), 6, 43), 0, e));
      });
      const nOut = counter ? 3 : 4, nMid = counter ? 1 : 2;
      const ball0 = this.mates.filter(m => m.y >= 22);
      this.carrier = ball0.length ? pick(ball0, r) : this.mates.reduce((a, b) => (a.y > b.y ? a : b));
      const nums = [2, 3, 4, 6, 5, 8];
      for (let k = 0; k < nOut; k++) this.foes.push(mk(clamp(16 + k * (36 / (nOut - 1)) + (this.carrier.x - 34) * .2 + rn(-2, 2, r), 4, 64), rn(11, 16, r), 1, undefined, false, nums[k]));
      for (let k = 0; k < nMid; k++) this.foes.push(mk(clamp(this.carrier.x + rn(-9, 9, r), 4, 64), clamp(this.carrier.y - rn(5, 8, r), 8, 40), 1, undefined, false, nums[4 + k]));
      this.foes.push(mk(34, .8, 1, undefined, true, 1));
      this.react();
      for (const a of [...this.mates, ...this.foes]) { a.x = a.tx; a.y = a.ty; }
    }
  }

  get ballAt(): BallKey {
    if (this.setup) return { x: this.setup.ball.x, y: this.setup.ball.y, h: 0 };
    return { x: this.carrier.x + .5, y: this.carrier.y - .8, h: 0 };
  }
  field(): Actor[] { return this.foes.filter(f => !f.gk); }
  goalie(): Actor { return this.foes.find(f => f.gk)!; }
  private mods(m = this.carrier) { return attackMods(m.e!.P); }
  private stat(k: number, m = this.carrier) { return m.e!.P.st ? m.e!.P.st[k] : m.e!.base; }

  // ---------- Probabilidades ----------
  passP(to: Actor, alto = false): number {
    if (alto) return this.loftP(to);
    const c = this.carrier, Ln = dist(c, to), md0 = this.mods();
    let ok = 1;
    const Rr = (2 + Ln * .05 - (this.stat(2) - 70) * .02) * md0.passRadius;
    for (const f of this.foes) { const d = segD(f, c, to); if (d < Rr) ok *= 1 - .85 * (1 - d / Rr); }
    const md = Math.min(...this.field().map(f => dist(f, to)), 99);
    if (md < 2.4) ok *= .55 + .45 * md / 2.4;
    ok *= clamp(1 - Math.max(0, Ln - 24) * .02 * md0.longPass, .5, 1);
    return clamp(ok, .03, .97);
  }
  /** Passe alto: passa por cima de quem está no meio do caminho, mas é menos preciso e o receptor disputa no alto. */
  loftP(to: Pt): number {
    const c = this.carrier, Ln = dist(c, to), md0 = this.mods(), pas = this.stat(2);
    let ok = clamp(1 - Math.max(0, Ln - 10) * .011 * md0.longPass * (1 - (pas - 70) * .02), .35, .97);
    // Só quem está colado no passador consegue travar a bola na saída
    for (const f of this.field()) { const d = dist(f, c); if (d < 1.6) ok *= .6 + .4 * d / 1.6; }
    // Disputa com o marcador mais próximo do receptor (cabeceio/força ajudam quem recebe)
    const rc = this.mates.find(m => m.x === to.x && m.y === to.y), md = Math.min(...this.field().map(f => dist(f, to)), 99);
    const air = rc?.e ? (rc.e.P.st?.[5] ?? 70) / 75 + .15 * (rc.e.P.ps.some(x => x.startsWith('cabeceio')) ? 1 : 0) : 1;
    if (md < 3) ok *= clamp((.45 + .55 * md / 3) * air, .2, 1);
    return clamp(ok, .05, .95);
  }
  /** Lançamento: corrida do companheiro até o ponto contra o defensor mais próximo. */
  lancP(m: Actor, spot: Pt): number {
    const c = this.carrier, md0 = this.mods(), pas = this.stat(2);
    let ok = 1;
    const Rr = (1.8 + dist(c, spot) * .04 - (pas - 70) * .02) * md0.passRadius;
    for (const f of this.field()) { const d = segD(f, c, spot); if (d < Rr) ok *= 1 - .8 * (1 - d / Rr); }
    const pace = (a?: Actor) => (a?.e?.P.st?.[0] ?? 72) / 10;
    const tRun = dist(m, spot) / pace(m), tDef = Math.min(...this.field().map(f => dist(f, spot)), 99) / 7.2;
    ok *= clamp(.55 + (tDef - tRun) * .35, .08, 1);
    ok *= clamp(1 - Math.max(0, dist(c, spot) - 22) * .02 * md0.longPass, .5, 1);
    return clamp(ok, .03, .95);
  }
  dribP(to: Pt): number {
    const c = this.carrier;
    let ok = 1;
    const d0 = clamp((.72 - (this.stat(3) - 70) * .012) * this.mods().dribbleLoss, .15, .9);
    for (const f of this.field()) { const d = segD(f, c, to); if (d < 3) ok *= 1 - d0 * (1 - d / 3); }
    return clamp(ok * clamp(1 - Math.max(0, dist(c, to) - this.mods().dribbleReach * .66) * .04, .6, 1), .03, .97);
  }
  /** Trajetória (vista de cima) de um chute curvo até a linha do gol. */
  shotPath(ax: number, curve: number, n = 16): Pt[] {
    const c = this.carrier, reach = this.mods().curve;
    const end = { x: ax, y: 0 }, dx = end.x - c.x, dy = end.y - c.y, L = Math.hypot(dx, dy) || 1;
    // Desvio máximo da curva: 1,5 m + até 2 m com Cobrança de Falta (o ponto de controle fica no dobro)
    const b = curve * (1.5 + 2 * reach) * 2;
    const ctrl = { x: (c.x + end.x) / 2 + dy / L * b, y: (c.y + end.y) / 2 - dx / L * b };
    return Array.from({ length: n + 1 }, (_, i) => bezier(c, ctrl, end, i / n));
  }
  /** Chances de um chute: força ideal entre 0,45 e 0,85; curva engana o goleiro, mas é mais difícil de acertar. */
  shotOdds(ax: number, power = .65, curve = 0): { goal: number; miss: number; save: number; block: number } {
    const c = this.carrier, md = this.mods(), gk = this.goalie(), pen = this.kind === 'penalti';
    const D = Math.hypot(c.x - 34, c.y), edge = Math.min(1, Math.abs(ax - 34) / GOAL.half), fin = this.stat(1);
    const weak = Math.max(0, .45 - power), hard = Math.max(0, power - .88), ac = Math.abs(curve);
    if (pen) {
      const miss = clamp((.03 + Math.pow(edge, 3) * .28 - (fin - 70) * .003 + hard * 2.5) * md.shotMiss, .02, .7);
      const save = clamp(.45 * (1 - .6 * edge) * (this.gkOvr / 80) * this.km.penSave * (1 + weak * 2), .06, .85);
      return { goal: (1 - miss) * (1 - save), miss, save, block: 0 };
    }
    const miss = clamp((.04 + D * .016 * md.shotDist + Math.pow(edge, 3) * .3 - (fin - 70) * .005 + hard * 2 + ac * .06 * md.shotMiss) * md.shotMiss, .03, .9);
    const path = this.shotPath(ax, curve);
    let block = 0;
    for (const f of this.field()) if (pathD(f, path) < 1.2) block = 1 - (1 - block) * .55;
    let save = clamp(((this.gkOvr / 100) * .9 * (1 - .5 * edge) + D * .015 * md.shotDist - (fin - 70) * .004 - .07) * this.km.save, .06, .95);
    save *= clamp(1 - Math.abs(gk.x - ax) / 11, .45, 1) * (1 - .15 * ac * md.curve) * (1 + weak * 1.6);
    save = clamp(save, .04, .97);
    return { goal: (1 - miss) * (1 - block) * (1 - save), miss, save, block };
  }

  /** Semântica de toque (2D e 3D): companheiro = passe, dentro do gol = chute, campo = conduzir. */
  target(wx: number, wy: number): Target | null {
    if (wy < 1.4 && wx > 28.5 && wx < 39.5) return { kind: 'shot', ax: clamp(wx, 30.6, 37.4), power: .65, curve: 0 };
    if (this.kind === 'penalti' || this.kind === 'falta') return null;
    let best: Actor | null = null, bd = 3.4;
    for (const m of this.mates) { if (m === this.carrier) continue; const d = Math.hypot(m.x - wx, m.y - wy); if (d < bd) { bd = d; best = m; } }
    if (best) return { kind: 'pass', m: best };
    const c = this.carrier, dx = wx - c.x, dy = wy - c.y, Ln = Math.hypot(dx, dy);
    if (Ln < 1) return null;
    const k = Math.min(1, this.mods().dribbleReach / Ln);
    return { kind: 'drib', x: clamp(c.x + dx * k, 1, 67), y: clamp(c.y + dy * k, 1.5, 44) };
  }
  /** Gesto de arrastar (em coordenadas do campo) → chute com direção, força e curva. */
  shotFromGesture(g: Gesture): Target | null {
    const c = this.carrier, dx = Math.cos(g.angle), dy = Math.sin(g.angle);
    if (dy > -.2) return null;
    const ax = c.x + dx * (-c.y / dy);
    return { kind: 'shot', ax: clamp(ax, 22, 46), power: g.power, curve: g.curve };
  }
  prob(t: Target): number {
    return t.kind === 'pass' ? this.passP(t.m, t.alto) : t.kind === 'lanc' ? this.lancP(t.m, t) : t.kind === 'drib' ? this.dribP(t) : this.shotOdds(t.ax, t.power, t.curve).goal;
  }
  /** Fim de um traço que não vai para o gol: perto de um companheiro = passe; no espaço = lançamento para quem estiver mais perto. */
  throughTarget(x: number, y: number): Target | null {
    if (this.kind === 'penalti' || this.kind === 'falta') return null;
    const spot = { x: clamp(x, 2, 66), y: clamp(y, 2, 44) }, c = this.carrier;
    let best: Actor | null = null, bd = 99;
    for (const m of this.mates) { if (m === c) continue; const d = dist(m, spot); if (d < bd) { bd = d; best = m; } }
    if (!best) return null;
    if (bd < 3.4) return { kind: 'pass', m: best };
    if (bd > 14 || dist(c, spot) < 4) return this.target(x, y);
    return { kind: 'lanc', m: best, x: spot.x, y: spot.y };
  }

  // ---------- Falta ----------
  fkFromGesture(g: Gesture): { shot: FkShot; goal: number } | null {
    if (!this.setup) return null;
    const shot = fkShotFromGesture(this.setup, g);
    return shot ? { shot, goal: fkOdds(this.setup, shot, this.carrier.e!.P, this.gkE?.P).goal } : null;
  }
  fkPath(shot: FkShot, n = 30): Pt[] {
    const { c, end } = fkControl(this.setup!, shot, this.mods().curve);
    return Array.from({ length: n + 1 }, (_, i) => bezier(this.setup!.ball, c, end, i / n));
  }

  /** Reposiciona a defesa depois de cada ação. */
  react(): void {
    const r = this.r, c = this.carrier;
    const fs = this.field().slice().sort((a, b) => dist(a, c) - dist(b, c));
    fs.forEach((f, i) => {
      const d = dist(f, c);
      if (i < 2) { const k = Math.min(3.4, Math.max(0, d - 1.9)) / (d || 1); f.tx = f.x + (c.x - f.x) * k; f.ty = f.y + (c.y - f.y) * k; }
      else { f.tx = f.x + ((c.x + 34) / 2 - f.x) * .25; f.ty = clamp(Math.min(f.y, c.y - 2.5) - rn(0, 1.5, r), 3, 42); }
    });
    const gk = this.goalie();
    gk.tx = 34 + (c.x - 34) * .28;
    gk.ty = clamp(.6 + (Math.hypot(c.x - 34, c.y) < 14 ? 1.4 : .4), .5, 2.5);
    this.mates.forEach(m => { if (m === c) return; m.tx = clamp(m.x + rn(-1.5, 1.5, r), 3, 65); m.ty = clamp(m.y - rn(1, 3.5, r), 5, 44); });
  }

  private died(): Plan['end'] { return { res: { goal: false, shot: false, text: 'A defesa se fechou e a jogada morreu.' }, text: 'Recuou!', color: '#dddddd', goal: false }; }

  /** Executa a ação: sorteia o resultado e devolve o plano de animação. */
  perform(t: Target): Plan {
    const r = this.r, c = this.carrier, from = this.ballAt, nm = c.e!.name;
    if (t.kind === 'lanc') {
      this.actions--;
      const p = this.lancP(t.m, t), L = dist(c, t), dur = Math.min(1100, 380 + L * 22), m = t.m;
      m.tx = t.x; m.ty = t.y + .8;
      if (r() < p) {
        return { kind: 'lanc', ok: true, ball: arc(from, { x: t.x, y: t.y }, L > 18 ? 1.4 : .25, 12), dur,
          commit: () => { this.lastPasser = c; m.x = t.x; m.y = t.y + .8; this.carrier = m; this.react(); if (this.actions <= 0) this.done = true; },
          end: this.actions <= 0 ? this.died() : undefined };
      }
      const f = this.field().sort((a, b) => dist(a, t) - dist(b, t))[0];
      if (f) { f.tx = t.x; f.ty = t.y - .6; }
      this.done = true;
      return { kind: 'lanc', ok: false, ball: arc(from, { x: t.x, y: t.y }, .3, 10), dur, commit: () => {},
        end: { res: { goal: false, shot: false, text: `lançamento de ${nm} cortado pela defesa.` }, text: 'Cortado!', color: '#f06a5a', goal: false } };
    }
    if (t.kind === 'pass') {
      this.actions--;
      const p = this.passP(t.m, t.alto), L = dist(c, t.m), dur = t.alto ? Math.min(1300, 520 + L * 26) : Math.min(900, 280 + L * 20);
      if (r() < p) {
        return { kind: 'pass', ok: true, ball: arc(from, { x: t.m.x, y: t.m.y - .8 }, t.alto ? 2.6 + L * .09 : L > 20 ? 1.2 : .25, 14), dur,
          commit: () => { this.lastPasser = c; this.carrier = t.m; this.react(); if (this.actions <= 0) this.done = true; },
          end: this.actions <= 0 ? this.died() : undefined };
      }
      let f = this.field().sort((a, b) => segD(a, c, t.m) - segD(b, c, t.m))[0];
      const mk = this.field().sort((a, b) => dist(a, t.m) - dist(b, t.m))[0];
      if (mk && f && dist(mk, t.m) < segD(f, c, t.m)) f = mk;
      const to = f ?? t.m;
      if (f) { f.tx = f.x; f.ty = f.y; }
      this.done = true;
      return { kind: 'pass', ok: false, ball: arc(from, to, t.alto ? 2.4 + L * .07 : .3, 10), dur: t.alto ? dur : 450, commit: () => {},
        end: { res: { goal: false, shot: false, text: t.alto ? `passe alto de ${nm} perdido na disputa.` : `passe de ${nm} interceptado.` }, text: t.alto ? 'Perdeu no alto!' : 'Interceptado!', color: '#f06a5a', goal: false } };
    }
    if (t.kind === 'drib') {
      this.actions--;
      if (r() < this.dribP(t)) {
        c.tx = t.x; c.ty = t.y;
        return { kind: 'drib', ok: true, ball: arc(from, { x: t.x + .5, y: t.y - .8 }, 0, 8), dur: 620,
          commit: () => { c.x = t.x; c.y = t.y; this.react(); if (this.actions <= 0) this.done = true; },
          end: this.actions <= 0 ? this.died() : undefined };
      }
      const f = this.field().sort((a, b) => segD(a, c, t) - segD(b, c, t))[0];
      const mx = (c.x + t.x) / 2, my = (c.y + t.y) / 2;
      c.tx = mx; c.ty = my;
      if (f) { f.tx = mx; f.ty = my - .8; }
      this.done = true;
      return { kind: 'drib', ok: false, ball: arc(from, { x: mx, y: my - .6 }, 0, 6), dur: 480, commit: () => {},
        end: { res: { goal: false, shot: false, text: `${nm} foi desarmado.` }, text: 'Desarmado!', color: '#f06a5a', goal: false } };
    }
    // Chute
    this.done = true;
    const sp = this.shotOdds(t.ax, t.power, t.curve), as = this.lastPasser ? this.lastPasser.e!.name : null, gk = this.goalie();
    const path = this.kind === 'penalti' ? [c, { x: t.ax, y: 0 }] : this.shotPath(t.ax, t.curve);
    const speed = .55 + t.power;
    const dur = Math.round(clamp(Math.hypot(c.x - t.ax, c.y) * 34 / speed, 320, 1100));
    const toKeys = (pts: Pt[], hEnd: number, peak: number): BallKey[] => pts.map((p, i) => { const k = i / (pts.length - 1); return { x: p.x, y: p.y, h: hEnd * k + 4 * peak * k * (1 - k) }; });
    const hTarget = clamp(.25 + t.power * 1.9 + (r() - .5) * .5, .15, 2.2);
    const gkDive = (x: number): -1 | 0 | 1 => (Math.abs(x - gk.x) < .8 ? 0 : x < gk.x ? -1 : 1);
    if (this.kind !== 'penalti' && r() < sp.block) {
      const f = this.field().sort((a, b) => pathD(a, path) - pathD(b, path))[0];
      return { kind: 'shot', ok: false, ball: toKeys([from, { x: f.x, y: f.y + .5 }], .9, .2), dur: 320, commit: () => {},
        end: { res: { goal: false, shot: true, onTarget: false, text: `chute de ${nm} bloqueado pela zaga.` }, text: 'Bloqueado!', color: '#f2b640', goal: false } };
    }
    if (r() < sp.miss) {
      const side = t.ax >= 34 ? 1 : -1, post = r() < .25, over = !post && t.power > .85 && r() < .6;
      const endX = post ? 34 + side * GOAL.half : over ? t.ax : t.ax + side * rn(1.5, 4, r);
      const pts = this.kind === 'penalti' ? [c, { x: endX, y: 0 }] : this.shotPath(endX, t.curve);
      pts.push({ x: endX + side * (post ? -1 : .5), y: -3 });
      return { kind: 'shot', ok: false, ball: toKeys([from, ...pts.slice(1)], post ? 1.4 : over ? 3.4 : hTarget, .4), dur, gk: { x: clamp(t.ax, 31, 37), y: .5, dive: gkDive(t.ax), h: .6 }, commit: () => {},
        end: { res: { goal: false, shot: true, onTarget: false, text: post ? `${nm} acertou a trave!` : over ? `${nm} mandou por cima.` : `${nm} chutou pra fora.` }, text: post ? 'Na trave!' : over ? 'Por cima!' : 'Pra fora!', color: '#f2b640', goal: false } };
    }
    if (r() < sp.save) {
      const keys = toKeys([from, ...path.slice(1)], hTarget, .3);
      const last = keys[keys.length - 1];
      keys.push({ x: last.x + (r() - .5) * 6, y: 4 + r() * 4, h: 1.2 });
      return { kind: 'shot', ok: false, ball: keys, dur: dur + 260, gk: { x: clamp(t.ax, 30.8, 37.2), y: .6, dive: gkDive(t.ax), h: hTarget }, commit: () => {},
        end: { res: { goal: false, shot: true, onTarget: true, text: `${this.gkE ? this.gkE.name : 'o goleiro'} defendeu o chute de ${nm}.` }, text: 'Defendeu!', color: '#9ec9ec', goal: false } };
    }
    const keys = toKeys([from, ...path.slice(1)], hTarget, .3);
    keys.push({ x: t.ax, y: -1.6, h: Math.min(hTarget, 2) * .8 });
    return { kind: 'shot', ok: true, ball: keys, dur: dur + 180, gk: { x: 34 + (34 - t.ax) * .3, y: .6, dive: t.ax > 34 ? -1 : 1, h: .5 }, commit: () => {},
      end: { res: { goal: true, shot: true, onTarget: true, scorer: nm, assist: as }, text: 'GOOOL!', color: '#e8c35f', goal: true } };
  }

  /** Cobrança de falta a partir do gesto. */
  performFk(shot: FkShot): Plan {
    this.done = true;
    const s = this.setup!, r = this.r, o = fkOdds(s, shot, this.carrier.e!.P, this.gkE?.P), res = fkResolve(o, r), nm = this.carrier.e!.name;
    const gk = this.goalie();
    const cut = res === 'barreira' ? .36 : 1;
    const path = this.fkPath(shot, 30).filter((_, i, a) => i / (a.length - 1) <= cut + 1e-9);
    const hEnd = res === 'barreira' ? 1.6 : res === 'travessao' ? 3.2 : clamp(.6 + shot.power * 1.5, .5, 2.2);
    const peak = res === 'barreira' ? .6 : 1.2 + shot.power * .8;
    const ball: BallKey[] = path.map((p, i) => { const k = i / (path.length - 1); return { x: p.x, y: p.y, h: hEnd * k + 4 * peak * k * (1 - k) }; });
    const endX = o.endX, side = endX >= 34 ? 1 : -1;
    if (res === 'fora' || res === 'travessao') ball.push({ x: endX + side * 1.5, y: -3, h: hEnd });
    if (res === 'barreira') ball.push({ x: s.wall.x + (r() - .5) * 4, y: s.wall.y + 5, h: .3 });
    if (res === 'gol') ball.push({ x: endX, y: -1.6, h: hEnd * .8 });
    if (res === 'defesa') ball.push({ x: endX + side * 3, y: 3, h: .8 });
    const dive: -1 | 0 | 1 = Math.abs(endX - gk.x) < .8 ? 0 : endX < gk.x ? -1 : 1;
    const out: Record<string, [MomentResult, string, string]> = {
      gol: [{ goal: true, shot: true, onTarget: true, scorer: nm }, 'GOLAÇO!', '#e8c35f'],
      barreira: [{ goal: false, shot: true, onTarget: false, text: `a falta de ${nm} parou na barreira.` }, 'Na barreira!', '#f2b640'],
      travessao: [{ goal: false, shot: true, onTarget: false, text: `${nm} bateu forte demais, por cima do gol.` }, 'Por cima!', '#f2b640'],
      fora: [{ goal: false, shot: true, onTarget: false, text: `a falta de ${nm} saiu pela linha de fundo.` }, 'Pra fora!', '#f2b640'],
      trave: [{ goal: false, shot: true, onTarget: false, text: `${nm} acertou a trave na cobrança!` }, 'Na trave!', '#f2b640'],
      defesa: [{ goal: false, shot: true, onTarget: true, text: `${this.gkE ? this.gkE.name : 'o goleiro'} espalmou a falta de ${nm}.` }, 'Defendeu!', '#9ec9ec'],
    };
    const [rr, text, color] = out[res];
    return { kind: 'fk', ok: res === 'gol', ball, dur: Math.round(900 - shot.power * 250), commit: () => {},
      gk: res === 'barreira' ? undefined : { x: clamp(res === 'gol' ? 34 + (34 - endX) * .25 : endX, 30.8, 37.2), y: .6, dive: res === 'gol' ? (endX > 34 ? -1 : 1) : dive, h: hEnd },
      end: { res: rr, text, color, goal: res === 'gol' } };
  }

  /** Gesto → alvo (chute se for em direção ao gol; senão conduzir até o fim do traço). */
  fromDrag(pts: Pt[], fullLen: number): Target | null {
    const g = analyzeGesture(pts, fullLen);
    if (!g) return null;
    const s = this.shotFromGesture(g);
    if (s) return s;
    if (this.kind === 'penalti' || this.kind === 'falta') return null;
    const e = pts[pts.length - 1];
    return this.target(e.x, e.y);
  }
}

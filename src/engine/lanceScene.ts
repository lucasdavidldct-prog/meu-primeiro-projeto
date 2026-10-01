// Cena de um lance jogável, sem interface: posiciona os jogadores, calcula as chances de cada ação
// (com playstyles), resolve o resultado e devolve um "plano" de animação que o renderizador (2D ou 3D) executa.
// Coordenadas: x de 0 a 68 (largura), y = distância da linha de fundo (gol em y = 0), h = altura da bola.
import { climaFx } from './clima';
import { GOAL, analyzeGesture, attackMods, defenseMods, type DefenseMods, bezier, fkControl, fkOdds, fkResolve, fkSetup, fkShotFromGesture, keeperMods, type FkSetup, type FkShot, type Gesture, type KeeperMods, type Pt } from './lance';
import { effNow, pickShooter, type Match, type MomentKind, type MomentRequest, type MomentResult, type SideEntry } from './match';
import { ROLE, slotsOf } from './positions';
import { R, clamp, pick, rn, type Rng } from './rng';
import { skillStars, sub, type SubName } from './attrs';
import { FX, psLevel, type PsId } from './playstyles';
import { PS_BY_ID } from './data/schema';

/** Papel de quem está sem a bola (movimentação a cada ação). */
export type Papel = 'infiltra' | 'area' | 'aberto' | 'apoio' | 'chega' | 'ultrapassa';
export interface Actor { id: number; x: number; y: number; tx: number; ty: number; e?: SideEntry; gk?: boolean; team: 0 | 1; num: number; papel?: Papel }
/**
 * Tipo de chute. Depois de traçar a linha, o jogador escolhe: Rasteiro, Superchute ou Colocado (só o colocado faz curva).
 * Cavadinha aparece para quem tem o estilo; na bola alta (cruzamento), Cabeçada ou Voleio. 'auto'/'normal' ficam para testes.
 */
export type ShotType = 'auto' | 'normal' | 'colocado' | 'forte' | 'rasteiro' | 'cavadinha' | 'cabeca' | 'voleio';
export const SHOT_N: Record<ShotType, string> = { auto: 'Auto', normal: 'Normal', colocado: 'Colocado', forte: 'Superchute', rasteiro: 'Rasteiro', cavadinha: 'Cavadinha', cabeca: 'Cabeçada', voleio: 'Voleio' };
/** Estilo de jogo que agiu numa jogada (para mostrar na tela). */
export interface PsTag { id: PsId; lvl: 1 | 2; nome: string; icone: string; rival?: boolean }
/** Uma opção do menu de chute ou de passe, com a chance e os estilos do jogador que ajudam. */
export interface Opcao { t: Target; nome: string; dica: string; p: number; ps: PsTag[] }
/** Como a jogada começou (muda quantos atacam, quantos defendem e onde). */
export type Cenario = 'construcao' | 'posicional' | 'contra' | 'roubada' | 'bloco' | 'ponta';
export type Target =
  | { kind: 'shot'; ax: number; power: number; curve: number; tipo?: ShotType }
  /** Passe: rasteiro ou alto (por cima da marcação). */
  | { kind: 'pass'; m: Actor; alto?: boolean }
  /** Lançamento em profundidade: a bola vai para o espaço e o companheiro corre até ela. */
  | { kind: 'lanc'; m: Actor; x: number; y: number }
  | { kind: 'drib'; x: number; y: number }
  /** Finta: drible de habilidade para passar pelo marcador mais perto (toque no próprio jogador). */
  | { kind: 'finta' };
export interface BallKey { x: number; y: number; h: number }
export interface Plan {
  kind: 'pass' | 'drib' | 'shot' | 'fk' | 'lanc';
  ok: boolean;
  /** Nome da jogada para mostrar na tela (ex.: "Elástico!"). */
  say?: string;
  /** Trajetória da bola (pontos igualmente espaçados no tempo). */
  ball: BallKey[];
  dur: number;
  /** Goleiro: para onde vai e se mergulha (-1 esquerda, 1 direita, 0 não). */
  gk?: { x: number; y: number; dive: -1 | 0 | 1; h: number };
  /** Animação de quem está com a bola (chute, superchute, cabeçada, voleio, passe). */
  anim?: 'chute' | 'super' | 'cabeca' | 'voleio' | 'passe' | 'drible';
  /** Estilos de jogo que agiram nesta jogada (seus e da defesa rival). */
  ps?: PsTag[];
  /** Aviso extra (ex.: "+1 ação" do Primeiro Toque). */
  bonus?: string;
  /** Chamado quando a animação termina (atualiza quem está com a bola, reação da defesa etc.). */
  commit: () => void;
  /** Se o lance acabou, o resultado para o motor e a mensagem de tela. */
  end?: { res: MomentResult; text: string; color: string; goal: boolean };
}

export const TITLES: Record<MomentKind, string> = { ataque: 'Chance de ataque', contra: 'Contra-ataque!', penalti: 'Pênalti!', falta: 'Falta perigosa!', goleiro: 'Defenda!', escanteio: 'Escanteio!', lateral: 'Lateral no ataque', defesa: 'Defenda com a zaga!' };

/** Subatributo de um jogador em campo (para escolher cobrador e cabeceadores). */
const sub1 = (e: SideEntry, n: SubName) => (e.P.st && e.P.pos !== 'GOL' ? sub(e.P, n) : e.base);
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
/** Etiqueta de um estilo (com o nome e o ícone do catálogo). */
export function psTag(id: PsId, lvl: 0 | 1 | 2, rival = false): PsTag | null {
  if (!lvl) return null;
  const d = PS_BY_ID.get(id);
  return { id, lvl, nome: (d?.nome ?? id) + (lvl > 1 ? '+' : ''), icone: d?.icone ?? '★', rival };
}
const arc = (a: Pt, b: Pt, peak: number, n: number, ha = 0, hb = 0): BallKey[] =>
  Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, h: ha + (hb - ha) * t + 4 * peak * t * (1 - t) }; });

/** Sorteio com pesos. */
function pesado<T>(r: Rng, xs: [T, number][]): T {
  let t = 0; for (const [, w] of xs) t += w;
  let k = r() * t;
  for (const [v, w] of xs) { k -= w; if (k <= 0) return v; }
  return xs[xs.length - 1][0];
}

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
  /** Estilos de jogo da defesa rival (desarme, interceptação, bloqueio…). */
  readonly dm: DefenseMods;
  readonly label: string;
  /** Título do lance (por onde a jogada nasceu). */
  title: string;
  /** Bola parada (escanteio/lateral): a 1ª ação é obrigatoriamente um passe e não vale impedimento nela. */
  setPiece = false;
  /** Tipo de chute escolhido pelo jogador no seletor do lance. */
  shotType: ShotType = 'auto';
  /** O portador recebeu um cruzamento/passe alto na área: finaliza de primeira (cabeçada ou voleio). */
  firstTime = false;
  /** Como a jogada começou. */
  cenario: Cenario = 'posicional';
  /** Quem já ganhou a ação extra do Primeiro Toque neste lance. */
  private toque = new Set<number>();
  private r: Rng;
  private nid = 1;

  constructor(readonly M: Match, readonly req: MomentRequest, r: Rng = R) {
    this.r = r;
    const A = M.A, B = M.B, kind = req.kind;
    this.kind = kind; this.label = M.label; this.title = TITLES[kind];
    this.gkE = B.xi.find(e => e.pos === 'GOL' && !e.red);
    // Goleiro do lance: força + atributos de goleiro + dificuldade (e mando)
    const gP = this.gkE?.P;
    this.gkOvr = (this.gkE ? effNow(this.gkE, M.min) + (gP?.st ? .7 * (.35 * gP.st[3] + .35 * gP.st[0] + .3 * gP.st[5] - gP.ovr) : 0) : 35) + (M.keeperBoost ?? 0);
    this.km = keeperMods(this.gkE?.P);
    this.dm = defenseMods(B.xi);
    this.setup = kind === 'falta' ? fkSetup(r) : null;
    this.actions = kind === 'penalti' || kind === 'falta' ? 1 : kind === 'escanteio' ? 3 : req.treino ? 8 : 6;
    // Número da camisa: o escolhido pelo usuário ou o da vaga
    const num = (e?: SideEntry) => (e ? ((e.P as { num?: number }).num ?? A.xi.indexOf(e) + 1) : 0);
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
    } else if (kind === 'escanteio' || kind === 'lateral') {
      // Bola parada: cobrador na bandeirinha (escanteio) ou na linha lateral (lateral), gente na área e marcação
      this.setPiece = true;
      const lado = r() < .5 ? -1 : 1, outs = A.xi.filter(e => !e.red && e.pos !== 'GOL');
      const taker = req.taker ?? (kind === 'escanteio' ? outs.reduce((a, b) => (sub1(b, 'Cruzamento') > sub1(a, 'Cruzamento') ? b : a)) : outs.find(e => e.pos === (lado < 0 ? 'LE' : 'LD')) ?? outs[0]);
      const bx = kind === 'escanteio' ? (lado < 0 ? .6 : 67.4) : (lado < 0 ? .4 : 67.6), by = kind === 'escanteio' ? .6 : rn(18, 32, r);
      this.carrier = mk(bx, by, 0, taker);
      this.mates = [this.carrier];
      const aereos = outs.filter(e => e !== taker).sort((a, b) => sub1(b, 'Cabeceio') - sub1(a, 'Cabeceio'));
      const nBox = kind === 'escanteio' ? 4 : 3;
      aereos.slice(0, nBox).forEach((e, k) => this.mates.push(kind === 'escanteio'
        ? mk(27 + k * 4.5 + rn(-1, 1, r), rn(5, 12, r), 0, e)
        : mk(clamp(bx - lado * (6 + k * 7), 4, 64), clamp(by - 6 + k * 3 + rn(-2, 2, r), 8, 40), 0, e)));
      // Na lateral, um apoio curto para receber de volta
      if (kind === 'lateral') { const e = aereos[nBox]; if (e) this.mates.push(mk(clamp(bx - lado * 3.5, 3, 65), by + 3, 0, e)); }
      const nums = [2, 3, 4, 5, 6, 8];
      this.mates.slice(1).forEach((m, k) => this.foes.push(mk(clamp(m.x + rn(-1, 1, r), 3, 65), clamp(m.y - .9, 2, 42), 1, undefined, false, nums[k])));
      if (kind === 'escanteio') this.foes.push(mk(34 + lado * 3, 1.2, 1, undefined, false, 7));
      this.foes.push(mk(34, .8, 1, undefined, true, 1));
      this.title = TITLES[kind];
    } else {
      this.montar(req, mk, r);
      this.react();
      for (const a of [...this.mates, ...this.foes]) { a.x = a.tx; a.y = a.ty; }
    }
  }

  /**
   * Monta a jogada aberta. O cenário sai do estilo do seu time e do rival (posse = saída pelo meio, contra-ataque,
   * pressão = roubada no ataque, rival na retranca = defesa fechada), e a mentalidade muda quantos sobem e quantos ficam.
   */
  private montar(req: MomentRequest, mk: (x: number, y: number, team: 0 | 1, e?: SideEntry, gk?: boolean, n?: number) => Actor, r: Rng): void {
    const A = this.M.A, B = this.M.B, kind = req.kind, lado = req.lado;
    const cen: Cenario = lado === 'esq' || lado === 'dir' ? 'ponta' : kind === 'contra' ? 'contra' : req.treino ? 'posicional'
      : pesado(r, [['construcao', 1 + (A.style === 'posse' ? 1.6 : 0) + (A.ment < 0 ? .5 : 0)], ['posicional', 1.3], ['contra', A.style === 'contra' ? 1.4 : .25],
        ['roubada', .45 + (A.style === 'pressao' ? 1.4 : 0) + (A.ment > 0 ? .3 : 0)], ['bloco', .35 + (B.style === 'retranca' ? 1.6 : 0) + (B.ment < 0 ? .6 : 0)]]);
    this.cenario = cen;
    const slots = slotsOf(A.form), ment = A.ment;
    // Profundidade de cada cenário: quanto mais longe do gol, mais campo para construir
    const depth = cen === 'construcao' ? rn(9, 13, r) : cen === 'contra' ? rn(4, 9, r) : cen === 'roubada' ? rn(-3, 0, r) : cen === 'bloco' ? rn(1, 4, r) : rn(0, 4, r);
    A.xi.forEach((e, i) => {
      if (e.red || e.pos === 'GOL') return;
      const sl = slots[i], role = ROLE(e.pos);
      // Laterais sobem mais quando o time está ofensivo; zagueiros só na saída de bola
      if (role === 'D') {
        const sobe = (e.pos === 'LD' || e.pos === 'LE') ? .3 + .15 * ment + (cen === 'bloco' || cen === 'construcao' ? .25 : 0) : cen === 'construcao' ? .25 : 0;
        if (r() >= sobe) return;
      }
      const X = 3.5 + sl.x / 100 * 61;
      let Y = sl.y >= 60 ? 31 - (sl.y - 60) * .6 : sl.y >= 36 ? 30 + (60 - sl.y) * .45 : 36;
      Y -= depth;
      this.mates.push(mk(clamp(X + rn(-2, 2, r), 3, 65), clamp(Y + rn(-2, 2, r), 6, 46), 0, e));
    });
    const papel = (a: Actor): Papel => {
      const p = a.e?.pos ?? 'MC';
      if (p === 'ATA') return r() < .55 ? 'infiltra' : 'area';
      if (p === 'PD' || p === 'PE' || p === 'MD' || p === 'ME') return r() < .5 ? 'aberto' : 'infiltra';
      if (p === 'MEI') return r() < .5 ? 'chega' : 'apoio';
      if (p === 'LD' || p === 'LE') return 'ultrapassa';
      if (p === 'VOL' || p === 'ZAG') return 'apoio';
      return r() < .45 ? 'chega' : 'apoio';
    };
    this.mates.forEach(m => { m.papel = papel(m); });
    // Quem começa com a bola
    const perto = (y0: number, y1: number) => this.mates.filter(m => m.y >= y0 && m.y <= y1);
    if (cen === 'construcao') {
      const mc = this.mates.filter(m => ['VOL', 'MC', 'MEI'].includes(m.e!.pos));
      this.carrier = mc.length ? pick(mc, r) : this.mates.reduce((a, b) => (a.y > b.y ? a : b));
    } else if (cen === 'roubada') {
      const at = this.mates.filter(m => ROLE(m.e!.pos) === 'A');
      this.carrier = at.length ? pick(at, r) : this.mates.reduce((a, b) => (a.y < b.y ? a : b));
      this.carrier.y = this.carrier.ty = rn(20, 27, r);
    } else {
      const b0 = perto(22, 99);
      this.carrier = b0.length ? pick(b0, r) : this.mates.reduce((a, b) => (a.y > b.y ? a : b));
    }
    const c0 = this.carrier;
    // Contra-ataque e roubada: poucos no lance (quem já estava perto da bola); os outros ficaram para trás
    if (cen === 'contra' || cen === 'roubada') {
      const n = cen === 'contra' ? 2 + (ment > 0 ? 1 : 0) + (r() < .4 ? 1 : 0) : 2 + (r() < .5 ? 1 : 0);
      const resto = this.mates.filter(m => m !== c0).sort((a, b) => dist(a, c0) + a.y * .4 - (dist(b, c0) + b.y * .4)).slice(0, n);
      this.mates = [c0, ...resto];
      if (cen === 'contra') { c0.y = c0.ty = rn(30, 38, r); resto.forEach((m, k) => { m.y = m.ty = clamp(c0.y - rn(2, 8, r), 16, 40); m.x = m.tx = clamp(34 + (k % 2 ? -1 : 1) * rn(8, 18, r), 5, 63); m.papel = k ? 'aberto' : 'infiltra'; }); }
    }
    if (lado === 'esq' || lado === 'dir') {
      // Jogada pelas pontas: quem criou a jogada começa aberto, com um marcador em cima e gente na área para o cruzamento
      const e = req.creator && !req.creator.red && req.creator.pos !== 'GOL' ? req.creator : null;
      let c = e ? this.mates.find(m => m.e === e) : undefined;
      if (!c && e) { c = mk(0, 0, 0, e); c.papel = 'aberto'; this.mates.push(c); }
      if (!c) c = this.mates.reduce((a, b) => ((lado === 'esq' ? a.x < b.x : a.x > b.x) ? a : b));
      c.x = c.tx = lado === 'esq' ? rn(5, 11, r) : rn(57, 63, r);
      c.y = c.ty = rn(17, 26, r);
      this.carrier = c;
      const box = this.mates.filter(m => m !== c).sort((a, b) => a.y - b.y).slice(0, 2);
      box.forEach((m, k) => { m.x = m.tx = 34 + (k ? -1 : 1) * rn(2, 6, r) + (lado === 'esq' ? 3 : -3); m.y = m.ty = rn(9, 14, r); m.papel = 'area'; });
    }
    const c = this.carrier;
    this.title = ({ construcao: 'Saída pelo meio', posicional: 'Chance pelo meio', contra: TITLES.contra, roubada: 'Roubou no ataque!', bloco: 'Defesa fechada: ache o espaço', ponta: lado === 'esq' ? 'Jogada pela esquerda!' : 'Jogada pela direita!' } as Record<Cenario, string>)[cen];
    // Defesa: linha e meio-campo conforme o cenário e o jeito do rival (retranca = mais gente atrás; pressão = mais gente na bola)
    const retr = B.style === 'retranca' || B.ment < 0, press = B.style === 'pressao' || B.ment > 0;
    let nOut = req.treino ? 3 : cen === 'contra' ? (r() < .5 ? 2 : 3) : cen === 'roubada' ? 3 : cen === 'bloco' ? 5 : 4;
    let nMid = req.treino ? 0 : cen === 'contra' ? (r() < .5 ? 0 : 1) : cen === 'roubada' ? 1 : cen === 'construcao' ? 3 : cen === 'bloco' ? 3 : 2;
    if (!req.treino && retr && cen !== 'contra') nOut = Math.min(5, nOut + (cen === 'bloco' ? 0 : 1));
    if (!req.treino && press && (cen === 'construcao' || cen === 'posicional')) nMid++;
    const lineY = cen === 'construcao' ? rn(15, 20, r) : cen === 'bloco' ? rn(7, 11, r) : cen === 'contra' ? clamp(c.y - rn(10, 16, r), 12, 26) : cen === 'roubada' ? rn(10, 16, r) : rn(11, 16, r);
    const nums = [2, 3, 4, 6, 5, 8, 10, 7, 11];
    for (let k = 0; k < nOut; k++) {
      const w = nOut > 1 ? 36 + (nOut - 4) * 5 : 0, x0 = 34 - w / 2 + k * (nOut > 1 ? w / (nOut - 1) : 0);
      // Na roubada a defesa está desarrumada: linha torta e um fora de posição
      const bag = cen === 'roubada' ? rn(-3, 5, r) : rn(-1, 1, r);
      this.foes.push(mk(clamp(x0 + (c.x - 34) * .2 + rn(-2, 2, r), 4, 64), clamp(lineY + bag, 3, 40), 1, undefined, false, nums[k]));
    }
    for (let k = 0; k < nMid; k++) {
      const x = cen === 'bloco' || cen === 'construcao' ? 34 + (k - (nMid - 1) / 2) * rn(9, 12, r) + (c.x - 34) * .3 : c.x + rn(-9, 9, r);
      // No contra-ataque o volante vem correndo atrás (do lado do campo de quem ataca)
      const y = cen === 'contra' ? c.y + rn(2, 5, r) : cen === 'bloco' ? rn(17, 22, r) : clamp(c.y - rn(5, 9, r), 8, 42);
      this.foes.push(mk(clamp(x, 4, 64), clamp(y, 6, 46), 1, undefined, false, nums[nOut + k]));
    }
    this.foes.push(mk(34, .8, 1, undefined, true, 1));
    if (lado === 'esq' || lado === 'dir') {
      // Lateral rival em cima do portador
      const outs = this.field().slice(0, nOut);
      const fb = outs.reduce((a, b) => (Math.abs(a.x - c.x) < Math.abs(b.x - c.x) ? a : b));
      fb.x = fb.tx = c.x + (lado === 'esq' ? 2.2 : -2.2); fb.y = fb.ty = c.y - 3;
    }
    // Ações: construir do meio pede mais toques; contra-ataque e roubada são rápidos
    this.actions = req.treino ? 8 : cen === 'construcao' ? 7 : cen === 'bloco' ? 7 : cen === 'contra' ? 5 : cen === 'roubada' ? 4 : 6;
  }

  get ballAt(): BallKey {
    if (this.setup) return { x: this.setup.ball.x, y: this.setup.ball.y, h: 0 };
    // Bola alta na área (cruzamento): chega na altura da cabeça
    if (this.firstTime) return { x: this.carrier.x + .1, y: this.carrier.y - .45, h: 1.85 };
    return { x: this.carrier.x + .5, y: this.carrier.y - .8, h: 0 };
  }
  field(): Actor[] { return this.foes.filter(f => !f.gk); }
  /** Linha de impedimento: o penúltimo defensor (o goleiro conta). y menor = mais perto do gol. */
  offsideLine(): number { const ys = this.foes.map(f => f.y).sort((a, b) => a - b); return ys[1] ?? 0; }
  /** O companheiro está impedido se receber agora: à frente da bola e do penúltimo defensor (bola parada não vale). */
  isOffside(m: Actor): boolean {
    if (this.setPiece || this.kind === 'penalti' || this.kind === 'falta' || m === this.carrier) return false;
    return m.y < this.offsideLine() - .25 && m.y < this.carrier.y - .25;
  }
  /** Passe para quem está impedido: o bandeirinha levanta a bandeira. */
  private offsidePlan(m: Actor, alto: boolean): Plan {
    this.done = true;
    return { kind: 'pass', ok: false, ball: arc(this.ballAt, { x: m.x, y: m.y - .8 }, alto ? 2.4 : .3, 10), dur: 700, commit: () => {},
      end: { res: { goal: false, shot: false, text: `${m.e?.name ?? 'o atacante'} estava impedido.` }, text: 'Impedimento!', color: '#f2b640', goal: false } };
  }
  goalie(): Actor { return this.foes.find(f => f.gk)!; }
  /** Efeito do clima da partida. */
  private get cf() { return climaFx(this.M.clima); }
  private mods(m = this.carrier) { return attackMods(m.e!.P); }
  private stat(k: number, m = this.carrier) { return m.e!.P.st ? m.e!.P.st[k] : m.e!.base; }
  /** Subatributo do portador (chute de longe, voleio, passe curto…); sem dados, usa o atributo principal. */
  private sb(name: SubName, k: number, m = this.carrier) { return m.e?.P.st && m.e.P.pos !== 'GOL' ? sub(m.e.P, name) : this.stat(k, m); }

  // ---------- Probabilidades ----------
  passP(to: Actor, alto = false): number {
    if (this.isOffside(to)) return 0;
    if (alto) return this.loftP(to);
    const c = this.carrier, Ln = dist(c, to), md0 = this.mods();
    let ok = 1;
    const Rr = (2 + Ln * .05 - (this.sb(Ln < 20 ? 'Passe curto' : 'Passe longo', 2) - 70) * .02) * md0.passRadius * this.dm.intercept;
    for (const f of this.foes) { const d = segD(f, c, to); if (d < Rr) ok *= 1 - .85 * (1 - d / Rr); }
    const md = Math.min(...this.field().map(f => dist(f, to)), 99);
    const near = 2.4 * this.dm.antecipa;
    if (md < near) ok *= .55 + .45 * md / near;
    ok *= clamp(1 - Math.max(0, Ln - 24) * .02 * md0.longPass, .5, 1);
    // Tiki-Taka: toque curto quase sem erro
    if (Ln < 15 && md0.lv.tiki) ok = Math.max(ok, FX.tikiTaka[md0.lv.tiki] * (md < 1.2 ? .8 : 1));
    return clamp(ok * this.cf.passe, .03, .97);
  }
  /** Passe alto: passa por cima de quem está no meio do caminho, mas é menos preciso e o receptor disputa no alto. */
  loftP(to: Pt): number {
    // Da ponta, o passe alto é cruzamento; no resto, passe longo
    const c = this.carrier, Ln = dist(c, to), md0 = this.mods(), pas = this.sb(c.x < 16 || c.x > 52 ? 'Cruzamento' : 'Passe longo', 2);
    let ok = clamp(1 - Math.max(0, Ln - 10) * .011 * md0.longPass * FX.lancamento[md0.lv.lanc] * (1 - (pas - 70) * .02), .35, .97);
    // Cruzamento da ponta: quem tem o playstyle Cruzamento acerta mais
    const cr = this.carrier.e ? this.carrier.e.P.ps.find(x => x.startsWith('cruzamento')) : undefined;
    if (cr && (c.x < 16 || c.x > 52)) ok = Math.min(.97, ok * (cr.endsWith('+') ? 1.22 : 1.12));
    // Só quem está colado no passador consegue travar a bola na saída
    for (const f of this.field()) { const d = dist(f, c); if (d < 1.6) ok *= .6 + .4 * d / 1.6; }
    // Disputa com o marcador mais próximo do receptor (cabeceio/força ajudam quem recebe)
    const rc = this.mates.find(m => m.x === to.x && m.y === to.y), md = Math.min(...this.field().map(f => dist(f, to)), 99);
    const air = rc?.e ? (rc.e.P.st?.[5] ?? 70) / 75 + .15 * (rc.e.P.ps.some(x => x.startsWith('cabeceio')) ? 1 : 0) : 1;
    if (md < 3) ok *= clamp((.45 + .55 * md / 3) * air * this.dm.air, .2, 1);
    return clamp(ok * this.cf.passe, .05, .95);
  }
  /** Lançamento: corrida do companheiro até o ponto contra o defensor mais próximo. */
  lancP(m: Actor, spot: Pt): number {
    if (this.isOffside(m)) return 0;
    const c = this.carrier, md0 = this.mods(), pas = this.sb('Passe longo', 2);
    let ok = 1;
    const Rr = (1.8 + dist(c, spot) * .04 - (pas - 70) * .02) * md0.passRadius * this.dm.intercept;
    for (const f of this.field()) { const d = segD(f, c, spot); if (d < Rr) ok *= 1 - .8 * (1 - d / Rr); }
    const pace = (a?: Actor) => (a?.e?.P.st && a.e.P.pos !== 'GOL' ? sub(a.e.P, 'Pique') : 72) / 10;
    const tRun = dist(m, spot) / pace(m), tDef = Math.min(...this.field().map(f => dist(f, spot)), 99) / (7.2 * this.dm.antecipa);
    ok *= clamp(.55 + (tDef - tRun) * .35, .08, 1);
    ok *= clamp(1 - Math.max(0, dist(c, spot) - 22) * .02 * md0.longPass, .5, 1);
    return clamp(ok * this.cf.passe, .03, .95);
  }
  dribP(to: Pt): number {
    const c = this.carrier;
    let ok = 1;
    const m0 = this.mods(), close = this.field().some(f => dist(f, c) < 2.2);
    const d0 = clamp((.72 - (this.sb('Drible', 3) - 70) * .012) * m0.dribbleLoss * this.dm.tackle * (close ? FX.resistente[m0.lv.resistente] : 1), .12, .9);
    for (const f of this.field()) { const d = segD(f, c, to); if (d < 3) ok *= 1 - d0 * (1 - d / 3); }
    return clamp(ok * clamp(1 - Math.max(0, dist(c, to) - this.mods().dribbleReach * .66) * .04, .6, 1), .03, .97);
  }
  /** Marcador mais perto do portador (alvo da finta). */
  private nearestFoe(): Actor | undefined { const c = this.carrier; return this.field().sort((a, b) => dist(a, c) - dist(b, c))[0]; }
  /** Chance da finta: estrelas de drible, subatributos Drible e Agilidade, estilos (Firula, Drible Rápido) e a marcação. */
  fintaP(): number {
    const c = this.carrier, P = c.e!.P, f = this.nearestFoe();
    if (!f) return .95;
    const stars = skillStars(P), dri = this.sb('Drible', 3), agi = this.sb('Agilidade', 3);
    const perto = dist(f, c) < 3.5 ? 1 : .6;
    let ok = .42 + (stars - 3) * .08 + ((dri + agi) / 2 - 75) * .012;
    ok *= 1 / Math.pow(FX.firula[psLevel(P, 'firula')] * FX.dribleMarcador[psLevel(P, 'drible-rapido')], .5);
    ok /= this.dm.tackle;
    if (P.fs) ok += .14;
    return clamp(1 - (1 - ok) * perto, .08, .92);
  }
  /** Nome da finta conforme as estrelas de drible. */
  private fintaNome(): string {
    const s = skillStars(this.carrier.e!.P), r = this.r();
    return s >= 5 ? (r < .34 ? 'Caneta' : r < .67 ? 'Chapéu' : 'Elástico') : s >= 4 ? (r < .5 ? 'Elástico' : 'Pedalada') : s >= 3 ? (r < .5 ? 'Pedalada' : 'Corte seco') : 'Corte seco';
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
  /** Tipo concreto do chute: escolhido no seletor, ou lido do gesto no modo Auto. */
  shotKind(power: number, curve: number, tipo: ShotType = 'auto'): { colocado: boolean; forte: boolean; cav: boolean; rasteiro: boolean; cabeca?: boolean; voleio?: boolean } {
    const c = this.carrier, D = Math.hypot(c.x - 34, c.y), pen = this.kind === 'penalti';
    if (tipo === 'auto') return { colocado: Math.abs(curve) >= .3, forte: power >= .72, cav: !pen && power < .34 && D < 22, rasteiro: false };
    const k = { colocado: tipo === 'colocado', forte: tipo === 'forte', cav: tipo === 'cavadinha' && !pen, rasteiro: tipo === 'rasteiro' };
    return tipo === 'cabeca' ? { ...k, cabeca: true } : tipo === 'voleio' ? { ...k, voleio: true } : k;
  }
  shotOdds(ax: number, power = .65, curve = 0, tipo: ShotType = 'auto'): { goal: number; miss: number; save: number; block: number } {
    const c = this.carrier, md = this.mods(), gk = this.goalie(), pen = this.kind === 'penalti';
    // Tipo escolhido ajusta a força efetiva: forte bate forte, rasteiro firme, cavadinha de leve
    const sk = this.shotKind(power, curve, tipo);
    if (tipo !== 'auto') power = sk.forte ? Math.max(power, .78) : sk.rasteiro ? clamp(power, .5, .8) : sk.cav ? .3 : sk.colocado ? clamp(power, .45, .75) : sk.cabeca ? .6 : sk.voleio ? clamp(power, .6, .85) : power;
    const D = Math.hypot(c.x - 34, c.y), edge = Math.min(1, Math.abs(ax - 34) / GOAL.half), fora = Math.abs(ax - 34) > GOAL.half + .15;
    // O subatributo depende do chute: pênalti, cabeçada, de primeira (voleio), de fora da área ou finalização normal
    const fin = this.sb(pen ? 'Pênalti' : sk.cabeca ? 'Cabeceio' : sk.voleio || this.firstTime ? 'Voleio' : D >= 18 ? 'Chute de longe' : 'Finalização', 1);
    // Tipo de chute pelo gesto: curvo = colocado, forte = super chute, curto e lento perto do gol = cavadinha
    const lv = md.lv, { colocado, forte, cav, rasteiro } = sk;
    const weak = cav && lv.cavadinha ? 0 : Math.max(0, .45 - power), hard = Math.max(0, power - FX.superChuteLimite[lv.forte]), ac = Math.abs(curve);
    if (pen) {
      const miss = clamp((.03 + Math.pow(edge, 3) * .28 - (fin - 70) * .003 + hard * 2.5) * md.shotMiss, .02, .7);
      const save = clamp(.45 * (1 - .6 * edge) * (this.gkOvr / 80) * this.km.penSave * (1 + weak * 2) * this.cf.goleiro, .06, .85);
      if (fora) return { goal: 0, miss: 1, save: 0, block: 0 };
      return { goal: (1 - miss) * (1 - save), miss, save, block: 0 };
    }
    // De primeira é mais difícil: cabeçada (longe do gol perde força) e voleio (Acrobático ajuda)
    const aereo = sk.cabeca ? .07 * (lv.cabeca ? .5 : 1) + Math.max(0, D - 11) * .03 + (1 - this.dm.air) * .6 - .04 * psLevel(c.e!.P, 'imposicao-fisica')
      : sk.voleio ? .1 * (lv.acrobatico ? .35 : 1) : this.firstTime ? .06 * (lv.acrobatico ? .3 : 1) : 0;
    let miss = clamp((.04 + D * .016 * md.shotDist + Math.pow(edge, 3) * .3 - (fin - 70) * .005 + hard * 2 + ac * .06 * md.shotMiss + aereo) * md.shotMiss, .03, .9);
    miss = 1 - (1 - miss) * this.cf.chute; // chuva e neve atrapalham a batida
    if (colocado) miss *= FX.colocadoErro[lv.colocado];
    if (cav) miss = clamp(miss + FX.cavadinhaErro[lv.cavadinha] + (D >= 22 ? .3 : 0), .03, .9);
    // Rasteiro de longe perde precisão
    if (rasteiro && D > 22) miss = clamp(miss + (D - 22) * .01, .03, .9);
    const path = this.shotPath(ax, curve);
    let block = 0;
    for (const f of this.field()) if (pathD(f, path) < 1.2) block = 1 - (1 - block) * this.dm.block;
    if (rasteiro) block *= FX.rasteiroBloqueio[lv.rasteiro];
    let save = clamp(((this.gkOvr / 100) * .9 * (1 - .5 * edge) + D * .015 * md.shotDist - (fin - 70) * .004 - .07) * this.km.save, .06, .95);
    // De primeira depois do cruzamento: a defesa está fora de posição e o goleiro reage tarde, mas é mais fácil errar
    if (sk.cabeca) { save *= .8 * FX.cabecaDefesa[lv.cabeca]; block *= .3; }
    else if (sk.voleio) { save *= .8 * FX.acrobaticoDefesa[lv.acrobatico]; block *= .45; }
    else if (this.firstTime) { save *= .8 * Math.min(FX.acrobaticoDefesa[lv.acrobatico], FX.cabecaDefesa[lv.cabeca]); block *= .45; }
    if (colocado) save *= FX.colocadoDefesa[lv.colocado];
    if (forte) save *= FX.superChuteDefesa[lv.forte];
    if (cav) { save *= FX.cavadinhaDefesa[lv.cavadinha]; block *= .3; }
    // Rasteiro: bola rente à grama, o goleiro tem que descer (mais difícil de perto)
    if (rasteiro) save *= FX.rasteiroDefesa[lv.rasteiro] * (D < 20 ? .92 : 1);
    if (c.e?.P.fs) save *= .88; // Fora de Série: o goleiro sofre
    save *= clamp(1 - Math.abs(gk.x - ax) / 11, .45, 1) * (1 - .15 * ac * md.curve) * (1 + weak * 1.6);
    save = clamp(save * this.cf.goleiro, .04, .97);
    // Mira fora das traves: nunca é gol (antes ainda sobrava chance e a bola "entrava" vindo de fora)
    if (fora) return { goal: 0, miss: 1, save: 0, block };
    return { goal: (1 - miss) * (1 - block) * (1 - save), miss, save, block };
  }

  /** Semântica de toque (2D e 3D): companheiro = passe, dentro do gol = chute, campo = conduzir. */
  target(wx: number, wy: number): Target | null {
    // Na cobrança (escanteio/lateral) só dá para passar
    if (this.setPiece) { let best: Actor | null = null, bd = 3.4; for (const m of this.mates) { if (m === this.carrier) continue; const d = Math.hypot(m.x - wx, m.y - wy); if (d < bd) { bd = d; best = m; } } return best ? { kind: 'pass', m: best, alto: this.kind === 'escanteio' } : null; }
    if (wy < 1.4 && wx > 28.5 && wx < 39.5) return { kind: 'shot', ax: clamp(wx, 30.6, 37.4), power: .65, curve: 0 };
    if (this.kind === 'penalti' || this.kind === 'falta') return null;
    // Toque no próprio jogador com a bola: finta
    if (Math.hypot(this.carrier.x - wx, this.carrier.y - wy) < 1.6) return { kind: 'finta' };
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
    if (this.setPiece) return null;
    const c = this.carrier, dx = Math.cos(g.angle), dy = Math.sin(g.angle);
    if (dy > -.2) return null;
    const ax = clamp(c.x + dx * (-c.y / dy), 22, 46), tipo = this.shotType;
    // Colocado escolhido com traço reto: a bola abre e fecha no canto (curva para dentro do gol)
    const curve = tipo === 'colocado' && Math.abs(g.curve) < .3 ? -.45 * Math.sign(ax - 34 || 1) : tipo === 'rasteiro' || tipo === 'normal' ? g.curve * .5 : g.curve;
    return { kind: 'shot', ax, power: g.power, curve, tipo };
  }
  /** O chute com o tipo escolhido: só o Colocado segue a curva do traço; os outros vão retos. */
  shotAs(base: { ax: number; curve: number }, tipo: ShotType): Target {
    const curve = tipo === 'colocado' ? (Math.abs(base.curve) < .3 ? -.45 * Math.sign(base.ax - 34 || 1) : base.curve) : 0;
    const power = tipo === 'forte' ? .93 : tipo === 'rasteiro' ? .64 : tipo === 'colocado' ? .6 : tipo === 'cavadinha' ? .3 : tipo === 'cabeca' ? .6 : .75;
    return { kind: 'shot', ax: base.ax, power, curve, tipo };
  }
  /** Estilos do portador (ou de outro jogador) que ele tem, dentre os pedidos. */
  tags(ids: PsId[], m = this.carrier): PsTag[] {
    const P = m.e?.P;
    return ids.map(id => psTag(id, psLevel(P, id))).filter((x): x is PsTag => !!x);
  }
  /** Estilo da defesa rival que agiu (o melhor nível entre quem está em campo). */
  rivalTag(id: PsId): PsTag | null {
    let lv: 0 | 1 | 2 = 0;
    for (const e of this.M.B.xi) if (!e.red && e.pos !== 'GOL') lv = Math.max(lv, psLevel(e.P, id)) as 0 | 1 | 2;
    return psTag(id, lv, true);
  }
  /** Menu do chute depois do traço: Rasteiro, Superchute e Colocado (+ Cavadinha para quem tem o estilo); na bola alta, Cabeçada ou Voleio. */
  shotOptions(base: { ax: number; curve: number }): Opcao[] {
    const c = this.carrier, D = Math.hypot(c.x - 34, c.y), P = c.e!.P, fp: PsId[] = ['finalizacao-precisa'];
    // Estilos que atrapalham: bloqueio da zaga rival (no chute rasteiro, reto ou colocado) e o goleiro rival
    const gkT = psTag('reflexos', psLevel(this.gkE?.P, 'reflexos'), true), blq = this.rivalTag('bloqueio');
    const contra = (tipo: ShotType) => [...(blq && tipo !== 'cabeca' && tipo !== 'cavadinha' ? [blq] : []), ...(gkT ? [gkT] : [])];
    const op = (tipo: ShotType, nome: string, dica: string, ids: PsId[]): Opcao => { const t = this.shotAs(base, tipo); return { t, nome, dica, p: this.prob(t), ps: [...this.tags(ids), ...contra(tipo)] }; };
    if (this.firstTime) return [
      op('cabeca', 'Cabeçada', 'Cabeceie para baixo, no canto. Longe do gol perde força.', [...fp, 'cabeceio', 'imposicao-fisica']),
      op('voleio', psLevel(P, 'acrobatico') ? 'Bicicleta' : 'Voleio', 'De primeira, sem deixar a bola cair.', [...fp, 'acrobatico']),
    ];
    const out = [
      op('rasteiro', 'Rasteiro', 'Reto, rente à grama: passa por baixo do goleiro e trava menos.', [...fp, 'chute-rasteiro']),
      op('forte', 'Superchute', 'Reto e muito forte. Sem o estilo Super Chute, pode subir.', [...fp, 'chute-de-longe']),
      op('colocado', 'Colocado', 'O único com curva: a bola segue a curva do seu traço.', [...fp, 'chute-colocado', 'trivela']),
    ];
    if (psLevel(P, 'cavadinha') && D < 24) out.push(op('cavadinha', 'Cavadinha', 'Por cima do goleiro.', [...fp, 'cavadinha']));
    return out;
  }
  /** Menu do passe ao tocar num companheiro: rasteiro, alto ou enfiado no espaço à frente dele. */
  passOptions(m: Actor): Opcao[] {
    const c = this.carrier, L = dist(c, m), wing = c.x < 16 || c.x > 52;
    const riv = (...ids: PsId[]) => ids.map(id => this.rivalTag(id)).filter((x): x is PsTag => !!x);
    const spot = { x: clamp(m.x + (34 - m.x) * .15, 3, 65), y: clamp(m.y - 6, 3, 44) };
    const opts: Opcao[] = [
      { t: { kind: 'pass', m }, nome: 'Rasteiro', dica: 'Rápido e no pé. Cuidado com quem está na linha do passe.', p: this.passP(m), ps: [...this.tags(L < 15 ? ['passe-preciso', 'passe-tenso', 'tiki-taka'] : ['passe-preciso', 'passe-tenso']), ...riv('interceptacao', 'antecipacao')] },
      { t: { kind: 'pass', m, alto: true }, nome: wing ? 'Cruzamento' : 'Alto', dica: m.y < 17 ? 'Por cima da marcação. Na área, ele finaliza de primeira (cabeçada ou voleio).' : 'Por cima da marcação, mas mais lento: o marcador disputa no alto.', p: this.passP(m, true), ps: [...this.tags(wing ? ['cruzamento'] : ['lancamento']), ...riv('imposicao-fisica', 'cabeceio')] },
    ];
    if (m.y > 5) opts.push({ t: { kind: 'lanc', m, x: spot.x, y: spot.y }, nome: 'Enfiado', dica: 'Na frente dele, no espaço: ele corre até a bola e ganha metros.', p: this.lancP(m, spot), ps: [...this.tags(['passe-em-profundidade']), ...this.tags(['velocista'], m), ...riv('antecipacao')] });
    return opts;
  }
  prob(t: Target): number {
    return t.kind === 'pass' ? this.passP(t.m, t.alto) : t.kind === 'lanc' ? this.lancP(t.m, t) : t.kind === 'drib' ? this.dribP(t) : t.kind === 'finta' ? this.fintaP() : this.shotOdds(t.ax, t.power, t.curve, t.tipo).goal;
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

  /**
   * Movimentação depois de cada ação. Sem a bola, cada companheiro cumpre um papel (infiltrar nas costas da zaga,
   * atacar a área, abrir o campo, dar apoio atrás da bola, chegar de trás na entrada da área, ultrapassar pelo lado).
   * A defesa responde: um ou dois pressionam a bola (dois contra time de pressão) e os outros marcam quem entra no setor.
   */
  react(): void {
    const r = this.r, c = this.carrier, line0 = this.offsideLine();
    const pace = (a: Actor) => (a.e?.P.st && a.e.P.pos !== 'GOL' ? sub(a.e.P, 'Pique') : 72);
    this.mates.forEach(m => {
      if (m === c) return;
      const sgn = m.x < 34 ? -1 : 1;
      let tx: number, ty: number;
      switch (m.papel) {
        case 'infiltra': tx = m.x + (34 + sgn * rn(3, 9, r) - m.x) * .5; ty = line0 - rn(-1.5, 2.5, r); break;
        case 'area': tx = 34 + rn(-6, 6, r); ty = rn(8, 13, r); break;
        case 'aberto': tx = sgn < 0 ? rn(4, 9, r) : rn(59, 64, r); ty = clamp(c.y + rn(-6, 2, r), 10, 42); break;
        case 'apoio': tx = clamp(c.x + (c.x < 34 ? 1 : -1) * rn(6, 11, r), 5, 63); ty = clamp(c.y + rn(3, 7, r), 8, 46); break;
        case 'chega': tx = 34 + rn(-7, 7, r); ty = rn(16, 21, r); break;
        case 'ultrapassa': { const out = c.x < 34 ? -1 : 1; tx = c.x + out * rn(4, 7, r); ty = c.y - rn(6, 11, r); break; }
        default: tx = m.x + rn(-1.5, 1.5, r); ty = m.y - rn(1, 3.5, r);
      }
      // Cada um anda o quanto dá numa ação (mais rápido quem tem pique)
      const dx = tx - m.x, dy = ty - m.y, L = Math.hypot(dx, dy), step = 8 * pace(m) / 75, k = L > step ? step / L : 1;
      m.tx = clamp(m.x + dx * k, 3, 65); m.ty = clamp(m.y + dy * k, 5, 46);
    });
    // Defesa: pressão na bola, cobertura e marcação de quem chega
    const nPress = this.M.B.style === 'pressao' ? 2 : 1;
    const fs = this.field().slice().sort((a, b) => dist(a, c) - dist(b, c)), marcados = new Set<Actor>();
    fs.forEach((f, i) => {
      const d = dist(f, c);
      let tx: number, ty: number;
      if (i < nPress + 1) {
        // O primeiro (e o segundo contra time de pressão) fecha no portador; o seguinte faz a cobertura
        const alvo = i < nPress ? 1.9 : 4.2, k = Math.min(3.4, Math.max(0, d - alvo)) / (d || 1);
        tx = f.x + (c.x - f.x) * k; ty = f.y + (c.y - f.y) * k;
      } else {
        const alvo = this.mates.filter(m => m !== c && !marcados.has(m) && Math.hypot(m.tx - f.x, m.ty - f.y) < 9).sort((a, b) => a.ty - b.ty)[0];
        if (alvo) { marcados.add(alvo); tx = alvo.tx + (34 - alvo.tx) * .12; ty = alvo.ty - 1.3; }
        else { tx = f.x + ((c.x + 34) / 2 - f.x) * .3; ty = Math.min(f.y, c.y - 2.5) - rn(0, 1.5, r); }
      }
      const dx = tx - f.x, dy = ty - f.y, L = Math.hypot(dx, dy), k = L > 7 ? 7 / L : 1;
      f.tx = clamp(f.x + dx * k, 3, 65); f.ty = clamp(f.y + dy * k, 2, 44);
    });
    const gk = this.goalie();
    gk.tx = 34 + (c.x - 34) * .28;
    gk.ty = clamp(.6 + (Math.hypot(c.x - 34, c.y) < 14 ? 1.4 : .4), .5, 2.5);
    // Atacantes se ajeitam na linha do penúltimo defensor; às vezes um fica adiantado (impedido) e cabe a você perceber
    const line = this.foes.map(f => f.ty).sort((a, b) => a - b)[1] ?? 0;
    this.mates.forEach(m => { if (m !== c && m.ty < line - .2 && r() < (m.papel === 'infiltra' ? .65 : .8)) m.ty = line + rn(.3, 1.3, r); });
  }

  private died(): Plan['end'] { return { res: { goal: false, shot: false, text: 'A defesa se fechou e a jogada morreu.' }, text: 'Recuou!', color: '#dddddd', goal: false }; }

  /** Executa a ação: sorteia o resultado e devolve o plano de animação. */
  perform(t: Target): Plan {
    const r = this.r, c = this.carrier, from = this.ballAt, nm = c.e!.name;
    // Bola parada: depois da cobrança, o lance segue normal (com impedimento)
    if ((t.kind === 'pass' || t.kind === 'lanc') && this.isOffside(t.m)) { this.actions--; return this.offsidePlan(t.m, t.kind === 'pass' && !!t.alto); }
    this.setPiece = false;
    const riv = (...ids: PsId[]) => ids.map(id => this.rivalTag(id)).filter((x): x is PsTag => !!x);
    // Primeiro Toque: quem recebe com domínio orientado ganha uma ação a mais (uma vez por jogador no lance)
    const primeiroToque = (m: Actor): { bonus?: string; tag: PsTag[] } => {
      const lv = psLevel(m.e?.P, 'primeiro-toque');
      if (!lv || this.toque.has(m.id)) return { tag: [] };
      this.toque.add(m.id);
      return { bonus: `${m.e!.name}: +1 ação`, tag: [psTag('primeiro-toque', lv)!] };
    };
    if (t.kind === 'lanc') {
      this.actions--;
      const p = this.lancP(t.m, t), L = dist(c, t), dur = Math.min(1100, 380 + L * 22), m = t.m;
      m.tx = t.x; m.ty = t.y + .8;
      const ps = [...this.tags(['passe-em-profundidade']), ...this.tags(['velocista'], m)];
      if (r() < p) {
        const pt = primeiroToque(m);
        return { kind: 'lanc', ok: true, anim: 'passe', ps: [...ps, ...pt.tag], bonus: pt.bonus, ball: arc(from, { x: t.x, y: t.y }, L > 18 ? 1.4 : .25, 12), dur,
          commit: () => { this.lastPasser = c; m.x = t.x; m.y = t.y + .8; this.carrier = m; this.firstTime = false; if (pt.bonus) this.actions++; this.react(); if (this.actions <= 0) this.done = true; },
          end: this.actions <= 0 && !pt.bonus ? this.died() : undefined };
      }
      const f = this.field().sort((a, b) => dist(a, t) - dist(b, t))[0];
      if (f) { f.tx = t.x; f.ty = t.y - .6; }
      this.done = true;
      return { kind: 'lanc', ok: false, anim: 'passe', ps: [...ps, ...riv('antecipacao', 'interceptacao')], ball: arc(from, { x: t.x, y: t.y }, .3, 10), dur, commit: () => {},
        end: { res: { goal: false, shot: false, text: `lançamento de ${nm} cortado pela defesa.` }, text: 'Cortado!', color: '#f06a5a', goal: false } };
    }
    if (t.kind === 'pass') {
      this.actions--;
      // Rasteiro é rápido e reto; alto é lento e faz arco (e chega na cabeça de quem está na área)
      const p = this.passP(t.m, t.alto), L = dist(c, t.m), dur = t.alto ? Math.min(1400, 600 + L * 28) : Math.min(700, 220 + L * 14);
      const wing = c.x < 16 || c.x > 52, naArea = !!t.alto && t.m.y < 17;
      const ps = t.alto ? this.tags(wing ? ['cruzamento'] : ['lancamento']) : this.tags(L < 15 ? ['passe-preciso', 'passe-tenso', 'tiki-taka'] : ['passe-preciso', 'passe-tenso']);
      if (r() < p) {
        const pt = naArea ? { tag: [] as PsTag[] } : primeiroToque(t.m);
        return { kind: 'pass', ok: true, anim: 'passe', ps: [...ps, ...pt.tag], bonus: pt.bonus, ball: arc(from, { x: t.m.x + (naArea ? .1 : 0), y: t.m.y - (naArea ? .45 : .8) }, t.alto ? 2.6 + L * .09 : L > 20 ? .5 : .08, 14, from.h, naArea ? 1.85 : 0), dur,
          commit: () => { this.lastPasser = c; this.carrier = t.m; this.firstTime = naArea; if (pt.bonus) this.actions++; this.react(); if (this.actions <= 0) this.done = true; },
          end: this.actions <= 0 && !pt.bonus ? this.died() : undefined };
      }
      let f = this.field().sort((a, b) => segD(a, c, t.m) - segD(b, c, t.m))[0];
      const mk = this.field().sort((a, b) => dist(a, t.m) - dist(b, t.m))[0];
      if (mk && f && dist(mk, t.m) < segD(f, c, t.m)) f = mk;
      const to = f ?? t.m;
      if (f) { f.tx = f.x; f.ty = f.y; }
      this.done = true;
      return { kind: 'pass', ok: false, anim: 'passe', ps: [...ps, ...(t.alto ? riv('imposicao-fisica', 'cabeceio') : riv('interceptacao', 'antecipacao'))], ball: arc(from, to, t.alto ? 2.4 + L * .07 : .08, 10, from.h), dur: t.alto ? dur : 420, commit: () => {},
        end: { res: { goal: false, shot: false, text: t.alto ? `passe alto de ${nm} perdido na disputa.` : `passe de ${nm} interceptado.` }, text: t.alto ? 'Perdeu no alto!' : 'Interceptado!', color: '#f06a5a', goal: false } };
    }
    if (t.kind === 'finta') {
      this.actions--;
      const f = this.nearestFoe(), nome = this.fintaNome(), ps = this.tags(['firula', 'drible-rapido']);
      // Direção: passa pelo marcador rumo ao gol (4 a 6 m)
      const gx = 34 - c.x, gy = -c.y, gl = Math.hypot(gx, gy) || 1, L = 4 + skillStars(c.e!.P) * .4;
      const to = { x: clamp(c.x + gx / gl * L + (f ? (c.x - f.x) * .3 : 0), 2, 66), y: clamp(c.y + gy / gl * L, 2, 44) };
      if (r() < this.fintaP()) {
        c.tx = to.x; c.ty = to.y;
        if (f) { f.tx = f.x + (f.x - c.x) * .4; f.ty = f.y + 2.2; } // o marcador fica para trás
        return { kind: 'drib', ok: true, anim: 'drible', ps, say: `${nome}!`, ball: arc(from, { x: to.x + .5, y: to.y - .8 }, nome === 'Chapéu' ? 1.8 : 0, 8), dur: 700,
          commit: () => { c.x = to.x; c.y = to.y; if (f) { f.x = f.tx; f.y = f.ty; } this.firstTime = false; if (this.actions <= 0) this.done = true; },
          end: this.actions <= 0 ? this.died() : undefined };
      }
      this.done = true;
      if (f) { f.tx = c.x; f.ty = c.y - .6; }
      return { kind: 'drib', ok: false, anim: 'drible', ps: [...ps, ...riv('desarme', 'contencao')], say: `${nome}…`, ball: arc(from, { x: c.x + .8, y: c.y - 1.4 }, 0, 6), dur: 500, commit: () => {},
        end: { res: { goal: false, shot: false, text: `${nm} tentou o ${nome.toLowerCase()} e perdeu a bola.` }, text: 'Desarmado!', color: '#f06a5a', goal: false } };
    }
    if (t.kind === 'drib') {
      this.actions--;
      const close = this.field().some(f => dist(f, c) < 2.2);
      const ps = this.tags(['drible-rapido', 'firula', 'tecnico', 'velocista', 'explosao', ...(close ? ['resistente-pressao'] as PsId[] : [])]);
      if (r() < this.dribP(t)) {
        c.tx = t.x; c.ty = t.y;
        return { kind: 'drib', ok: true, anim: 'drible', ps, ball: arc(from, { x: t.x + .5, y: t.y - .8 }, 0, 8), dur: 620,
          commit: () => { c.x = t.x; c.y = t.y; this.firstTime = false; this.react(); if (this.actions <= 0) this.done = true; },
          end: this.actions <= 0 ? this.died() : undefined };
      }
      const f = this.field().sort((a, b) => segD(a, c, t) - segD(b, c, t))[0];
      const mx = (c.x + t.x) / 2, my = (c.y + t.y) / 2;
      c.tx = mx; c.ty = my;
      if (f) { f.tx = mx; f.ty = my - .8; }
      this.done = true;
      return { kind: 'drib', ok: false, anim: 'drible', ps: [...ps, ...riv('desarme', 'contencao')], ball: arc(from, { x: mx, y: my - .6 }, 0, 6), dur: 480, commit: () => {},
        end: { res: { goal: false, shot: false, text: `${nm} foi desarmado.` }, text: 'Desarmado!', color: '#f06a5a', goal: false } };
    }
    // Chute
    this.done = true;
    const sk = this.shotKind(t.power, t.curve, t.tipo), sp = this.shotOdds(t.ax, t.power, t.curve, t.tipo), as = this.lastPasser ? this.lastPasser.e!.name : null, gk = this.goalie();
    const path = this.kind === 'penalti' || !sk.colocado && t.tipo && t.tipo !== 'auto' && t.tipo !== 'normal' ? [c, { x: t.ax, y: 0 }] : this.shotPath(t.ax, t.curve);
    const D = Math.hypot(c.x - 34, c.y);
    const ps = this.tags(['finalizacao-precisa', ...(sk.forte ? ['chute-de-longe'] as PsId[] : D >= 18 ? ['chute-de-longe'] as PsId[] : []), ...(sk.colocado ? ['chute-colocado', 'trivela'] as PsId[] : []),
      ...(sk.rasteiro ? ['chute-rasteiro'] as PsId[] : []), ...(sk.cav ? ['cavadinha'] as PsId[] : []), ...(sk.cabeca ? ['cabeceio', 'imposicao-fisica'] as PsId[] : []), ...(sk.voleio ? ['acrobatico'] as PsId[] : [])]);
    const anim: Plan['anim'] = sk.cabeca ? 'cabeca' : sk.voleio ? 'voleio' : sk.forte ? 'super' : 'chute';
    // Superchute: a bola sai muito mais rápida (quase metade do tempo); cabeçada é mais lenta
    const speed = .55 + (sk.forte ? 1.25 : t.power);
    const dur = Math.round(clamp(Math.hypot(c.x - t.ax, c.y) * 34 / speed * (sk.forte ? .62 : sk.cabeca ? 1.12 : 1), sk.forte ? 200 : 320, 1100));
    const h0 = from.h;
    const toKeys = (pts: Pt[], hEnd: number, peak: number): BallKey[] => pts.map((p, i) => { const k = i / (pts.length - 1); return { x: p.x, y: p.y, h: h0 * (1 - k) + hEnd * k + 4 * peak * k * (1 - k) }; });
    // Cavadinha: bola sobe por cima do goleiro e cai no gol; cabeçada: para baixo; superchute: reto e firme
    const chip = sk.cav, low = sk.rasteiro;
    const hTarget = chip ? 1.5 : low ? .12 + r() * .12 : sk.cabeca ? .3 + r() * 1.1 : sk.forte ? clamp(.5 + r() * 1.3, .3, 2) : clamp(.25 + t.power * 1.9 + (r() - .5) * .5, .15, 2.2);
    const peakS = chip ? 2.8 : low ? .02 : sk.cabeca ? .15 : sk.forte ? .08 : .3;
    const gkDive = (x: number): -1 | 0 | 1 => (Math.abs(x - gk.x) < .8 ? 0 : x < gk.x ? -1 : 1);
    if (this.kind !== 'penalti' && r() < sp.block) {
      const f = this.field().sort((a, b) => pathD(a, path) - pathD(b, path))[0];
      return { kind: 'shot', ok: false, anim, ps: [...ps, ...riv('bloqueio')], ball: toKeys([from, { x: f.x, y: f.y + .5 }], .9, .2), dur: 320, commit: () => {},
        end: { res: { goal: false, shot: true, onTarget: false, text: `chute de ${nm} bloqueado pela zaga.` }, text: 'Bloqueado!', color: '#f2b640', goal: false } };
    }
    if (r() < sp.miss) {
      const side = t.ax >= 34 ? 1 : -1, foraMira = Math.abs(t.ax - 34) > GOAL.half + .15, post = !foraMira && r() < .25, over = !post && (t.power > .85 || sk.cabeca) && r() < .6;
      const endX = post ? 34 + side * GOAL.half : over ? t.ax : foraMira ? t.ax + side * rn(0, 1.5, r) : t.ax + side * rn(1.5, 4, r);
      const pts = path.length === 2 ? [c, { x: endX, y: 0 }] : this.shotPath(endX, t.curve);
      pts.push({ x: endX + side * (post ? -1 : .5), y: -3 });
      return { kind: 'shot', ok: false, anim, ps, ball: toKeys([from, ...pts.slice(1)], post ? 1.4 : over ? 3.4 : hTarget, .4), dur, gk: { x: clamp(t.ax, 31, 37), y: .5, dive: gkDive(t.ax), h: .6 }, commit: () => {},
        end: { res: { goal: false, shot: true, onTarget: false, text: post ? `${nm} acertou a trave!` : over ? `${nm} mandou por cima.` : `${nm} chutou pra fora.` }, text: post ? 'Na trave!' : over ? 'Por cima!' : 'Pra fora!', color: '#f2b640', goal: false } };
    }
    if (r() < sp.save) {
      const keys = toKeys([from, ...path.slice(1)], hTarget, peakS);
      const last = keys[keys.length - 1];
      keys.push({ x: last.x + (r() - .5) * 6, y: 4 + r() * 4, h: 1.2 });
      const gkP = this.gkE?.P, gt = psTag('reflexos', psLevel(gkP, 'reflexos'), true);
      return { kind: 'shot', ok: false, anim, ps: gt ? [...ps, gt] : ps, ball: keys, dur: dur + 260, gk: { x: clamp(t.ax, 30.8, 37.2), y: .6, dive: gkDive(t.ax), h: hTarget }, commit: () => {},
        end: { res: { goal: false, shot: true, onTarget: true, text: `${this.gkE ? this.gkE.name : 'o goleiro'} defendeu ${sk.cabeca ? 'a cabeçada' : 'o chute'} de ${nm}.` }, text: 'Defendeu!', color: '#9ec9ec', goal: false } };
    }
    const keys = toKeys([from, ...path.slice(1)], hTarget, peakS);
    keys.push({ x: t.ax, y: -1.6, h: Math.min(hTarget, 2) * .8 });
    return { kind: 'shot', ok: true, anim, ps, ball: keys, dur: dur + 180, gk: { x: 34 + (34 - t.ax) * .3, y: .6, dive: t.ax > 34 ? -1 : 1, h: .5 }, commit: () => {},
      end: { res: { goal: true, shot: true, onTarget: true, scorer: nm, assist: as }, text: sk.cabeca ? 'GOL DE CABEÇA!' : sk.forte ? 'GOLAÇO!' : 'GOOOL!', color: '#e8c35f', goal: true } };
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

// Estado do jogo (o que vai para o save) e operações sobre o elenco.
import { cardData, inPos } from './cards';
import { calcChem, effOvr, power, rate, type Chem, type Ratings } from './chemistry';
import { slotsOf } from './positions';
import { pick } from './rng';
import { newCareer, type Career, type CareerOpts } from './career';
import type { FormationId, OwnedCard, Pos, SlotDef, StyleId, Variant } from './types';
import { W, getPlayer } from './world';
import { withChem } from './chemStyles';
import { ROLE_SWAPS, orderFx, suggestOrder, type Order } from './orders';

export const SAVE_VERSION = 4;

/** Carta da coleção. tr = negociável no mercado (elenco inicial e compras no leilão; cartas de pacote não). */
/** Personalização da carta: um estilo de jogo + (dourado), um prata e o estilo de química. */
export interface CardExtra { plus?: string; prata?: string; quim?: string; /** Número da camisa (1 a 99). */ num?: number }
export interface CardRef { u: number; p: string; v: Variant; tr?: boolean; ex?: CardExtra }
export interface GameState {
  v: number;
  t: number;
  name: string;
  coins: number;
  uid: number;
  cards: CardRef[];
  squad: {
    form: FormationId; xi: number[]; bench: number[];
    /** Função escolhida em cada vaga ('' = a do esquema). Volta ao padrão ao trocar de formação. */
    roles?: (Pos | '')[];
    /** Orientação individual de cada vaga (função e participação). */
    ord?: (Order | null)[];
  };
  tac: { style: StyleId; ment: number };
  /** Elencos salvos (até 5): formação, titulares, reservas, funções, orientações e tática. */
  elencos?: { nome: string; squad: GameState['squad']; tac: GameState['tac'] }[];
  /** Modo carreira (null = ainda não escolheu o clube). */
  career: Career | null;
  rec: { w: number; d: number; l: number; gf: number; ga: number; packs: number };
  lastFree: string;
  moments: boolean;
  /** Antigo seletor 3D/2D (sem uso: os lances são sempre em 3D; o 2D só entra sozinho em aparelho sem WebGL). */
  lance3d?: boolean;
  /** Qualidade gráfica dos lances 3D (padrão: conforme o aparelho). */
  graficos?: 'alta' | 'media' | 'leve';
  /** Lance de goleiro: defender o chute que ia virar gol (padrão: ligado). */
  goleiro?: boolean;
  /** Efeitos sonoros (padrão: ligados). */
  som?: boolean;
  /** Vibração no celular (padrão: ligada). */
  vibrar?: boolean;
  /** Fotos dos jogadores da Wikimedia Commons (padrão: ligadas). */
  fotos?: boolean;
  /** Uniforme do seu time (índice nos uniformes do clube; ausente = automático: titular, o visitante troca). */
  uniforme?: number;
  /** Câmera dos lances 3D. */
  /** Câmera dos lances (a antiga 'aerea' é lida como 'padrao'). */
  camera?: 'padrao' | 'tv' | 'aerea' | 'atras';
  /** Clima das partidas ('auto' = sorteado por jogo). */
  clima?: 'auto' | 'dia' | 'sol' | 'noite' | 'chuva' | 'neve';
  /** Desenho do gramado. */
  gramado?: 'faixas' | 'xadrez' | 'circulos' | 'diagonal' | 'liso';
  /** Já viu as dicas de como jogar. */
  dicasVistas?: boolean;
  titles: number;
  /** Evolução acumulada dos jogadores (opção da carreira). */
  evo?: Record<string, { o: number; a: number }>;
  /** Dificuldade: 0 fácil, 1 normal, 2 difícil, 3 lenda (padrão: normal). */
  dif?: 0 | 1 | 2 | 3;
  /** Mensagem para mostrar uma vez ao abrir o jogo (não é salva de volta). */
  aviso?: string;
}

/** Jogo novo sem clube (a interface pede para escolher o clube da carreira). */
export function blankGame(): GameState {
  return {
    v: SAVE_VERSION, t: Date.now(), name: 'Esquadrão FC', coins: 5000, uid: 1, cards: [],
    squad: { form: '4-3-3', xi: Array(11).fill(0), bench: Array(7).fill(0) },
    tac: { style: 'equilibrado', ment: 2 }, career: null,
    rec: { w: 0, d: 0, l: 0, gf: 0, ga: 0, packs: 0 }, lastFree: '', moments: true, titles: 0,
  };
}

/** Carreira com um clube real: o elenco do clube vira as cartas iniciais. */
export function newCareerGame(club: string, o: CareerOpts = {}): GameState {
  const S = blankGame();
  const c = W.clubs.get(club);
  S.name = c?.n ?? club;
  const squad = W.byClub.get(club) ?? [];
  for (const p of squad) addCard(S, p.id, 'base', true);
  // Clubes com elenco incompleto nos dados (ex.: Série B) ganham reforços reais de nível parecido.
  if (squad.length < 18) {
    const lvl = c?.forca ?? 66, have = new Set(squad.map(p => p.id));
    const need: Pos[] = ['GOL', 'GOL', 'ZAG', 'ZAG', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MC', 'MEI', 'PE', 'PD', 'ATA', 'ATA', 'ME', 'MD', 'LD'];
    for (const pos of need.slice(squad.length)) {
      let cand = W.pool.filter(p => p.pos === pos && Math.abs(p.ovr - lvl) <= 3 && !have.has(p.id));
      if (!cand.length) cand = W.pool.filter(p => p.pos === pos && !have.has(p.id));
      const p = pick(cand); have.add(p.id); addCard(S, p.id, 'base', true);
    }
  }
  S.career = newCareer(club, o);
  autoLineup(S);
  return S;
}

/** Jogo avulso com cartas sorteadas (usado nos testes). */
export function newGame(): GameState {
  const S = blankGame();
  const need: Pos[] = ['GOL', 'GOL', 'ZAG', 'ZAG', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MC', 'MEI', 'PE', 'PD', 'ATA', 'ATA', 'ME', 'MD', 'LD'];
  const got = new Set<string>();
  for (const pos of need) {
    let cand = W.pool.filter(p => p.pos === pos && p.ovr >= 64 && p.ovr <= 70 && !got.has(p.id));
    if (!cand.length) cand = W.pool.filter(p => p.pos === pos && !got.has(p.id));
    const p = pick(cand);
    got.add(p.id);
    addCard(S, p.id, 'base');
  }
  autoLineup(S);
  return S;
}

export function addCard(S: GameState, p: string, v: Variant, tr = false): CardRef {
  const c: CardRef = { u: S.uid++, p, v };
  if (tr) c.tr = true;
  S.cards.push(c);
  return c;
}

/** Carta do usuário: dados da versão + estilos extras escolhidos por ele (o de química entra no teamInfo, pela química). */
function owned(c: CardRef): OwnedCard {
  const P = cardData(c.p, c.v), ex = c.ex;
  const o: OwnedCard = { ...P, u: c.u, tr: c.tr };
  if (ex?.quim) o.quim = ex.quim;
  if (ex?.num) o.num = ex.num;
  if (ex?.plus || ex?.prata) o.ps = mergePs(P.ps, ex.plus, ex.prata);
  return o;
}
/** Soma os estilos extras: o + substitui a versão prata do mesmo estilo; o prata não rebaixa um + que já existe. */
export function mergePs(base: string[], plus?: string, prata?: string): string[] {
  let ps = base.slice();
  if (plus) ps = [...ps.filter(x => x !== plus && x !== plus + '+'), plus + '+'];
  if (prata && !ps.includes(prata) && !ps.includes(prata + '+')) ps.push(prata);
  return ps;
}
export function cardByUid(S: GameState, u: number): OwnedCard | null {
  const c = S.cards.find(c => c.u === u);
  return c ? owned(c) : null;
}
export const allCards = (S: GameState): OwnedCard[] => S.cards.map(owned);
export const xiCards = (S: GameState): (OwnedCard | null)[] => S.squad.xi.map(u => (u ? cardByUid(S, u) : null));

export function removeCard(S: GameState, u: number): void {
  S.cards = S.cards.filter(c => c.u !== u);
  S.squad.xi = S.squad.xi.map(x => (x === u ? 0 : x));
  S.squad.bench = S.squad.bench.map(x => (x === u ? 0 : x));
}

/**
 * Melhora a escalação trocando jogadores enquanto a Força do time (setores, com química, posição e funções) subir.
 * Parte do time montado por posição e testa, vaga a vaga, cada carta da coleção (ou trocar dois titulares de lugar).
 */
function optimizeXI(S: GameState, all: OwnedCard[]): void {
  const score = (xi: number[]) => { const T = teamInfo({ ...S, squad: { ...S.squad, xi } }); return T.full ? power(T.r) * 10 + T.chem.total * .01 : -1; };
  let xi = S.squad.xi.slice(), best = score(xi);
  const idOf = new Map(all.map(P => [P.u, P.id]));
  for (let pass = 0; pass < 4; pass++) {
    let improved = false;
    for (let i = 0; i < 11; i++) {
      for (const P of all) {
        if (P.u === xi[i]) continue;
        const j = xi.indexOf(P.u), cand = xi.slice();
        if (j >= 0) { cand[j] = xi[i]; cand[i] = P.u; }
        else {
          if (xi.some((u, k) => k !== i && idOf.get(u) === P.id)) continue; // mesma pessoa em outra versão
          cand[i] = P.u;
        }
        const v = score(cand);
        if (v > best + 1e-9) { best = v; xi = cand; improved = true; }
      }
    }
    if (!improved) break;
  }
  S.squad.xi = xi;
}

/** Escala o melhor time: monta por posição e depois otimiza pela Força (química e posição incluídas). */
/** Jogador suspenso ou lesionado na carreira (pelo id do jogador, vale para qualquer versão da carta). */
export const outOf = (S: GameState, pid: string): { t: 'susp' | 'les'; n: number } | undefined => S.career?.fora?.[pid];

/**
 * Tira do time quem está suspenso ou lesionado: cada vaga recebe o melhor disponível (reservas primeiro, depois a coleção)
 * que joga naquela posição. Devolve os nomes trocados ("sai → entra").
 */
export function replaceUnavailable(S: GameState): string[] {
  const slots = squadSlots(S), out: string[] = [];
  const inXI = () => new Set(S.squad.xi.filter(Boolean).map(u => cardByUid(S, u)?.id));
  S.squad.xi.forEach((u, i) => {
    const P = u ? cardByUid(S, u) : null;
    if (!P || !outOf(S, P.id)) return;
    const used = inXI(), pos = slots[i].p;
    const cands = allCards(S).filter(c => !used.has(c.id) && !outOf(S, c.id) && (c.pos === 'GOL') === (pos === 'GOL'));
    const benchU = new Set(S.squad.bench);
    const best = cands.sort((a, b) => (effOvr(b, pos, 1) + (benchU.has(b.u) ? 2 : 0)) - (effOvr(a, pos, 1) + (benchU.has(a.u) ? 2 : 0)))[0];
    if (!best) return;
    const bj = S.squad.bench.indexOf(best.u);
    if (bj >= 0) S.squad.bench[bj] = u;
    S.squad.xi[i] = best.u;
    out.push(`${P.short} → ${best.short}`);
  });
  return out;
}

export const MAX_ELENCOS = 5;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
/** Salva o time atual como elenco predefinido (mesmo nome = substitui). */
export function savePreset(S: GameState, nome: string): { ok: boolean; msg?: string } {
  const L = S.elencos ??= [], n = nome.trim().slice(0, 24) || `Elenco ${L.length + 1}`;
  const i = L.findIndex(e => e.nome === n);
  if (i < 0 && L.length >= MAX_ELENCOS) return { ok: false, msg: `No máximo ${MAX_ELENCOS} elencos salvos: apague um antes` };
  const e = { nome: n, squad: clone(S.squad), tac: clone(S.tac) };
  if (i >= 0) L[i] = e; else L.push(e);
  return { ok: true };
}
/** Carrega um elenco salvo; cartas que você não tem mais ficam vazias na vaga. */
export function loadPreset(S: GameState, i: number): { ok: boolean; faltando: number } {
  const e = S.elencos?.[i];
  if (!e) return { ok: false, faltando: 0 };
  const tem = new Set(S.cards.map(c => c.u));
  const sq = clone(e.squad);
  let faltando = 0;
  sq.xi = sq.xi.map(u => (u && tem.has(u) ? u : (u && faltando++, 0)));
  sq.bench = sq.bench.map(u => (u && tem.has(u) ? u : 0));
  S.squad = sq; S.tac = clone(e.tac);
  return { ok: true, faltando };
}

export function autoLineup(S: GameState): void {
  const slots = squadSlots(S);
  const all = allCards(S).filter(P => !outOf(S, P.id));
  const usedU = new Set<number>(), usedP = new Set<string>(), xi: number[] = Array(11).fill(0);
  const order = slots.map((_, i) => i).sort((a, b) => (slots[a].p === 'GOL' ? -1 : 0) - (slots[b].p === 'GOL' ? -1 : 0));
  for (const pass of [0, 1, 2]) for (const i of order) {
    if (xi[i]) continue;
    const pos = slots[i].p;
    let best: OwnedCard | null = null, bv = -1;
    for (const P of all) {
      if (usedU.has(P.u) || usedP.has(P.id)) continue;
      const ok = pass === 0 ? P.pos === pos : pass === 1 ? inPos(P, pos) : true;
      if (!ok) continue;
      const v = effOvr(P, pos, 1) + (P.pos === pos ? .5 : 0);
      if (v > bv) { bv = v; best = P; }
    }
    if (best) { xi[i] = best.u; usedU.add(best.u); usedP.add(best.id); }
  }
  S.squad.xi = xi;
  optimizeXI(S, all);
  usedU.clear(); usedP.clear();
  for (const u of S.squad.xi) { const P = all.find(c => c.u === u); if (P) { usedU.add(u); usedP.add(P.id); } }
  const rest = all.filter(P => !usedU.has(P.u)).sort((a, b) => b.ovr - a.ovr);
  const bench: number[] = [], bp = new Set<string>();
  const g = rest.find(P => P.pos === 'GOL');
  if (g) { bench.push(g.u); bp.add(g.id); }
  for (const P of rest) {
    if (bench.length >= 7) break;
    if (bp.has(P.id) || usedP.has(P.id) || bench.includes(P.u)) continue;
    bench.push(P.u); bp.add(P.id);
  }
  while (bench.length < 7) bench.push(0);
  S.squad.bench = bench;
}

/** Vagas do esquema com as funções escolhidas pelo usuário (ex.: VOL jogando de MC). */
export function squadSlots(S: GameState): SlotDef[] {
  const roles = S.squad.roles ?? [];
  return slotsOf(S.squad.form).map((s, i) => {
    const r = roles[i];
    return r && ROLE_SWAPS[s.p].includes(r) ? { ...s, p: r } : s;
  });
}
/** Muda a função de uma vaga (a posição do esquema volta a ser a padrão se for a mesma). */
export function setRole(S: GameState, i: number, p: Pos): void {
  const base = slotsOf(S.squad.form)[i].p;
  const roles = S.squad.roles ?? Array(11).fill('');
  roles[i] = p === base ? '' : p;
  S.squad.roles = roles;
  // Função tática de outro setor não vale mais
  if (S.squad.ord?.[i]) S.squad.ord[i] = { p: S.squad.ord[i]!.p };
}
export function setOrder(S: GameState, i: number, o: Order): void {
  const ord = S.squad.ord ?? Array(11).fill(null);
  ord[i] = { ...ord[i], ...o };
  S.squad.ord = ord;
}
/** Orientação valendo numa vaga: a escolhida ou, se nenhuma, a sugerida pelos atributos do jogador. */
export function orderAt(S: GameState, i: number, P: OwnedCard | null, pos: Pos): Order {
  const o = S.squad.ord?.[i], sug = suggestOrder(P, pos);
  return { f: o?.f ?? sug.f, p: o?.p ?? 0 };
}
/** Trocar de formação zera funções e orientações (as vagas mudam). */
export function setFormation(S: GameState, f: FormationId): void {
  if (S.squad.form === f) return;
  S.squad.form = f; S.squad.roles = undefined; S.squad.ord = undefined;
}

export interface TeamInfo { xi: (OwnedCard | null)[]; chem: Chem; slots: SlotDef[]; r: Ratings; ovr: number; full: boolean }
export function teamInfo(S: GameState): TeamInfo {
  const xi0 = xiCards(S), slots = squadSlots(S), chem = calcChem(xi0, slots);
  // Estilo de química de cada carta, proporcional à química dela na formação
  const xi = xi0.map((P, i) => (P ? withChem(P, P.quim, chem.per[i]) : null));
  const entries = slots.map((s, i) => ({ pos: s.p, eff: effOvr(xi[i], s.p, chem.per[i]), P: xi[i], ofx: orderFx(s.p, orderAt(S, i, xi[i], s.p)) }));
  const filled = xi.filter(Boolean) as OwnedCard[];
  const ovr = filled.length ? Math.round(filled.reduce((a, P) => a + P.ovr, 0) / 11) : 0;
  return { xi, chem, slots, r: rate(entries), ovr, full: filled.length === 11 };
}

/** Coloca a carta u na vaga (titular ou reserva), trocando de lugar se ela já estiver no time. */
export function applyPick(S: GameState, kind: 'xi' | 'bench', i: number, u: number): { ok: boolean; msg?: string } {
  const xi = S.squad.xi, bench = S.squad.bench;
  const cand = cardByUid(S, u);
  if (!cand) return { ok: false };
  const target = kind === 'xi' ? xi : bench, cur = target[i];
  const jx = xi.indexOf(u), jb = bench.indexOf(u);
  if (kind === 'xi' && jx < 0) {
    const dupe = xi.some((x, k) => x && k !== i && cardByUid(S, x)!.id === cand.id);
    if (dupe) return { ok: false, msg: 'Esse jogador já está escalado em outra versão' };
  }
  if (jx >= 0) xi[jx] = cur || 0;
  else if (jb >= 0) bench[jb] = cur || 0;
  target[i] = u;
  return { ok: true };
}

/** Repetidas vendáveis (mesmo jogador e versão, fora do elenco). A primeira cópia fica. */
export function duplicates(S: GameState): number[] {
  const inSq = new Set([...S.squad.xi, ...S.squad.bench].filter(Boolean));
  const seen = new Set<string>(), out: number[] = [];
  for (const c of S.cards.slice().sort((a, b) => a.u - b.u)) {
    const k = c.p + '|' + c.v;
    if (seen.has(k) && !inSq.has(c.u)) out.push(c.u); else seen.add(k);
  }
  return out;
}

export function today(): string {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

/** Remove cartas de jogadores que não existem mais (ex.: apagados no editor). Retorna quantas saíram. */
export function sanitizeState(S: GameState): number {
  const before = S.cards.length;
  const gone = S.cards.filter(c => !getPlayer(c.p)).map(c => c.u);
  for (const u of gone) removeCard(S, u);
  return before - S.cards.length;
}

/** Força do seu time na mesma escala da "Força" dos clubes (para comparar com o adversário). */
export const teamStrength = (T: TeamInfo): number => power(T.r);

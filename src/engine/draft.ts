// Draft dos Craques: monte um time escolhendo 1 entre 5 cartas por posição (jogadores, lendas e Fora de Série) e
// jogue um mata-mata de 4 jogos contra rivais cada vez mais fortes. Perdeu, acabou. Quanto mais longe, maior o prêmio;
// campeão leva uma carta do draft para o clube. Tudo serializável (vai para o save) e sem interface.
import { calcChem, effOvr } from './chemistry';
import { funcOf, orderFx, suggestOrder } from './orders';
import { FORM_IDS, slotsOf } from './positions';
import { R, pick, shuffle, type Rng } from './rng';
import { clubStrength } from './squads';
import { W, allClubs } from './world';
import type { BasePlayer, FormationId, Pos } from './types';
import type { Side } from './match';

export type DraftFase = 'formacao' | 'capitao' | 'escolha' | 'jogos' | 'fim';
export interface Draft {
  fase: DraftFase;
  formOps: FormationId[];
  form?: FormationId;
  capOps: string[];
  /** Jogador escolhido em cada vaga da formação (id), na ordem das vagas. */
  picks: (string | null)[];
  /** Vaga sendo escolhida agora e as 5 opções dela. */
  slot: number;
  ops: string[];
  /** Rivais do mata-mata (id do clube) e vitórias até agora. */
  rivais: string[];
  wins: number;
  /** Placar de cada jogo jogado (você × rival, e pênaltis). */
  jogos: { gf: number; ga: number; pens?: [number, number] }[];
  /** Prêmio em moedas já recebido, carta do campeão já levada e pacote já aberto (para não dar duas vezes). */
  pago?: boolean;
  levou?: boolean;
  abriu?: boolean;
}
export const FASES_DRAFT = ['Oitavas de final', 'Quartas de final', 'Semifinal', 'Final'];
export const DRAFT_CUSTO = 10000;

/** Prêmio pela campanha: moedas, pacote e se ganha uma carta do draft. */
export function draftPremio(wins: number): { coins: number; pack: 'ouro' | 'premium' | null; carta: boolean } {
  return [
    { coins: 2000, pack: null, carta: false },
    { coins: 6000, pack: null, carta: false },
    { coins: 15000, pack: 'ouro', carta: false },
    { coins: 30000, pack: 'premium', carta: false },
    { coins: 60000, pack: 'premium', carta: true },
  ][Math.max(0, Math.min(4, wins))] as { coins: number; pack: 'ouro' | 'premium' | null; carta: boolean };
}

const pool = (): BasePlayer[] => [...W.pool, ...W.legends].filter(p => !p.filler && p.ovr >= 70);
const serve = (P: BasePlayer, pos: Pos) => P.pos === pos || P.alt.includes(pos);

export function novoDraft(r: Rng = R): Draft {
  const formOps = shuffle(FORM_IDS, r).slice(0, 3);
  return { fase: 'formacao', formOps, capOps: [], picks: [], slot: 0, ops: [], rivais: [], wins: 0, jogos: [] };
}

/** Sorteia 5 opções sem repetir quem já está no time: 3 boas, 1 craque e 1 estrela (lenda/Fora de Série às vezes). */
function opcoes(pos: Pos | null, usados: Set<string>, r: Rng, capitao = false): string[] {
  const todos = pool().filter(p => !usados.has(p.id) && (pos ? serve(p, pos) : true));
  const faixa = (a: number, b: number) => todos.filter(p => p.ovr >= a && p.ovr <= b);
  const out: string[] = [];
  const tira = (lista: BasePlayer[]) => {
    const l = lista.filter(p => !out.includes(p.id) && !out.some(id => W.players.get(id)?.name === p.name));
    if (l.length) out.push(pick(l, r).id);
  };
  if (capitao) for (let k = 0; k < 5; k++) tira(faixa(87, 99));
  else {
    for (let k = 0; k < 3; k++) tira(faixa(74, 82));
    tira(faixa(83, 88));
    tira(r() < .35 ? todos.filter(p => p.leg || p.fs) : faixa(87, 99));
  }
  while (out.length < 5 && todos.length > out.length) tira(todos);
  return shuffle(out, r);
}

export function escolherFormacao(D: Draft, f: FormationId, r: Rng = R): void {
  D.form = f; D.picks = slotsOf(f).map(() => null);
  // Capitão: só quem cabe em alguma vaga da formação
  const posicoes = new Set(slotsOf(f).map(s => s.p));
  D.capOps = opcoes(null, new Set(), r, true).filter(id => { const P = W.players.get(id)!; return posicoes.has(P.pos) || P.alt.some(a => posicoes.has(a)); });
  while (D.capOps.length < 3) D.capOps.push(...opcoes(null, new Set(D.capOps), r, true).filter(id => !D.capOps.includes(id) && posicoes.has(W.players.get(id)!.pos)).slice(0, 3 - D.capOps.length));
  D.fase = 'capitao';
}

export function escolherCapitao(D: Draft, id: string, r: Rng = R): void {
  const slots = slotsOf(D.form!), P = W.players.get(id)!;
  let i = slots.findIndex(s => s.p === P.pos);
  if (i < 0) i = slots.findIndex(s => P.alt.includes(s.p));
  D.picks[Math.max(0, i)] = id;
  D.fase = 'escolha';
  proximaVaga(D, r);
}

function proximaVaga(D: Draft, r: Rng): void {
  const i = D.picks.findIndex(p => !p);
  if (i < 0) { iniciarJogos(D, r); return; }
  D.slot = i;
  D.ops = opcoes(slotsOf(D.form!)[i].p, new Set(D.picks.filter(Boolean) as string[]), r);
}

export function escolherJogador(D: Draft, id: string, r: Rng = R): void {
  if (D.fase !== 'escolha' || !D.ops.includes(id)) return;
  D.picks[D.slot] = id;
  proximaVaga(D, r);
}

export const draftPlayers = (D: Draft): (BasePlayer | null)[] => D.picks.map(id => (id ? W.players.get(id) ?? null : null));

/** Força do time do draft (média do rendimento em cada vaga, com a química). */
export function draftForca(D: Draft): { forca: number; quim: number } {
  if (!D.form) return { forca: 0, quim: 0 };
  const xi = draftPlayers(D), slots = slotsOf(D.form), ch = calcChem(xi, slots);
  const ef = xi.map((P, i) => (P ? effOvr(P, slots[i].p, ch.per[i]) : 0)).filter(Boolean);
  return { forca: ef.length ? Math.round(ef.reduce((a, b) => a + b, 0) / ef.length) : 0, quim: ch.total };
}

/** Rivais: um clube por fase, cada vez mais forte (a final é contra um gigante). */
function iniciarJogos(D: Draft, r: Rng): void {
  const base = draftForca(D).forca, usados = new Set<string>();
  D.rivais = [-5, -2, 1, 4].map(d => {
    const alvo = base + d, cands = allClubs().filter(c => !usados.has(c.id)).sort((a, b) => Math.abs(clubStrength(a.id) - alvo) - Math.abs(clubStrength(b.id) - alvo)).slice(0, 4);
    const c = pick(cands, r).id; usados.add(c);
    return c;
  });
  D.fase = 'jogos';
}

/** Registra o jogo da fase atual. Vitória (ou pênaltis) avança; derrota encerra. */
export function registrarJogo(D: Draft, gf: number, ga: number, pens?: [number, number]): 'avancou' | 'campeao' | 'eliminado' {
  D.jogos.push({ gf, ga, pens });
  const venceu = gf > ga || (gf === ga && !!pens && pens[0] > pens[1]);
  if (!venceu) { D.fase = 'fim'; return 'eliminado'; }
  D.wins++;
  if (D.wins >= 4) { D.fase = 'fim'; return 'campeao'; }
  return 'avancou';
}

/** Lado da partida com o time do draft (como o seu time na carreira). */
export function draftSide(D: Draft, nome: string): Side {
  const slots = slotsOf(D.form!), xi0 = draftPlayers(D) as BasePlayer[], ch = calcChem(xi0, slots);
  const xi = slots.map((s, i) => {
    const P = xi0[i], od = suggestOrder(P, s.p);
    return { P, pos: s.p, base: effOvr(P, s.p, ch.per[i]), inMin: 0, yc: 0, red: false, name: P.short, ofx: orderFx(s.p, od), fn: funcOf(s.p, od).id };
  });
  // Banco: os melhores que você deixou passar não ficam; usa reservas neutras do pool pela posição mais comum
  const usados = new Set(xi0.map(p => p.id));
  const bench = pool().filter(p => !usados.has(p.id) && p.ovr >= 76 && p.ovr <= 82).slice(0, 7);
  return { you: true, name: nome, s: (nome[0] || 'D').toUpperCase(), c1: '#e8c35f', c2: '#1d1403', form: D.form!, style: 'equilibrado', ment: 0, xi, bench, subs: 5, goals: 0, scorers: [] };
}

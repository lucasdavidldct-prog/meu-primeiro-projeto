// Atributos detalhados (subatributos), estrelas de drible e de perna ruim.
// Os dados guardam só os 6 atributos principais; os detalhes são derivados deles, da posição e dos estilos de jogo,
// de forma determinística (o mesmo jogador sempre tem os mesmos números). A média de cada grupo é o atributo principal.
import { psLevel, type PsId } from './playstyles';
import { clamp } from './rng';
import type { BasePlayer, Pos } from './types';

export const SUB_GROUPS = [
  { n: 'Ritmo', subs: ['Aceleração', 'Pique'] },
  { n: 'Finalização', subs: ['Posicionamento', 'Finalização', 'Força do chute', 'Chute de longe', 'Voleio', 'Pênalti'] },
  { n: 'Passe', subs: ['Visão de jogo', 'Cruzamento', 'Precisão na falta', 'Passe curto', 'Passe longo', 'Curva'] },
  { n: 'Drible', subs: ['Agilidade', 'Equilíbrio', 'Reação', 'Controle de bola', 'Drible', 'Frieza'] },
  { n: 'Defesa', subs: ['Interceptação', 'Cabeceio', 'Marcação', 'Desarme em pé', 'Carrinho'] },
  { n: 'Físico', subs: ['Impulsão', 'Fôlego', 'Força', 'Agressividade'] },
] as const;
export const GK_GROUPS = ['Mergulho', 'Manejo', 'Chute', 'Reflexo', 'Velocidade', 'Posicionamento'] as const;

export type SubName = typeof SUB_GROUPS[number]['subs'][number];

/** Quanto cada posição puxa alguns subatributos (antes de recentralizar no atributo principal). */
const POS_BIAS: Partial<Record<Pos, Partial<Record<SubName, number>>>> = {
  ATA: { Posicionamento: 4, Finalização: 3, Voleio: 2, Cabeceio: 3, Marcação: -3, Carrinho: -4 },
  PD: { Aceleração: 3, Agilidade: 3, Cruzamento: 3, Drible: 2, Força: -3 },
  PE: { Aceleração: 3, Agilidade: 3, Cruzamento: 3, Drible: 2, Força: -3 },
  MEI: { 'Visão de jogo': 4, 'Passe curto': 2, Agilidade: 2, Frieza: 2, Força: -3 },
  MC: { 'Passe curto': 3, 'Passe longo': 2, Fôlego: 3, Reação: 1 },
  VOL: { Interceptação: 4, Marcação: 2, Fôlego: 3, Agressividade: 3, Voleio: -3 },
  ZAG: { Cabeceio: 4, Marcação: 3, 'Desarme em pé': 2, Força: 4, Impulsão: 2, Agilidade: -3, Cruzamento: -3 },
  LD: { Cruzamento: 3, Pique: 2, Fôlego: 3, Carrinho: 2 },
  LE: { Cruzamento: 3, Pique: 2, Fôlego: 3, Carrinho: 2 },
  MD: { Cruzamento: 4, Fôlego: 2, Aceleração: 2 },
  ME: { Cruzamento: 4, Fôlego: 2, Aceleração: 2 },
};

/** Estilos de jogo puxam os subatributos ligados a eles: [prata, dourado]. */
const PS_BIAS: Partial<Record<PsId, Partial<Record<SubName, [number, number]>>>> = {
  'finalizacao-precisa': { Finalização: [4, 7], Frieza: [2, 3] },
  'chute-colocado': { Curva: [4, 7], Finalização: [2, 3] },
  'chute-de-longe': { 'Chute de longe': [6, 10], 'Força do chute': [4, 7] },
  'chute-rasteiro': { 'Força do chute': [3, 5], Finalização: [2, 4] },
  cavadinha: { Frieza: [4, 6], Finalização: [1, 2] },
  'cobranca-de-falta': { 'Precisão na falta': [8, 12], Curva: [5, 8], Pênalti: [2, 4] },
  cabeceio: { Cabeceio: [8, 12], Impulsão: [3, 6] },
  'passe-preciso': { 'Passe curto': [4, 7], 'Visão de jogo': [2, 3] },
  'passe-tenso': { 'Passe curto': [3, 5], 'Força do chute': [1, 2] },
  'passe-em-profundidade': { 'Visão de jogo': [6, 9], 'Passe longo': [2, 4] },
  lancamento: { 'Passe longo': [6, 10] },
  'tiki-taka': { 'Passe curto': [4, 6], Reação: [2, 3] },
  cruzamento: { Cruzamento: [6, 10], Curva: [2, 3] },
  'primeiro-toque': { 'Controle de bola': [3, 6], Reação: [3, 5] },
  'drible-rapido': { Agilidade: [4, 6], Drible: [3, 5] },
  firula: { Drible: [4, 6], Agilidade: [3, 5], Equilíbrio: [2, 3] },
  tecnico: { 'Controle de bola': [5, 8], Equilíbrio: [2, 3] },
  'resistente-pressao': { Frieza: [5, 8], Equilíbrio: [3, 4] },
  velocista: { Pique: [5, 8], Aceleração: [3, 5] },
  desarme: { Carrinho: [6, 10], 'Desarme em pé': [3, 5] },
  interceptacao: { Interceptação: [7, 10] },
  antecipacao: { Interceptação: [3, 5], Marcação: [3, 4], Reação: [3, 5] },
  contencao: { Marcação: [6, 9], 'Desarme em pé': [3, 5] },
  bloqueio: { Marcação: [3, 5], Carrinho: [2, 3] },
  'imposicao-fisica': { Força: [7, 10], Agressividade: [3, 5], Equilíbrio: [2, 3] },
  acrobatico: { Voleio: [7, 10], Agilidade: [2, 3], Impulsão: [2, 3] },
  trivela: { Curva: [6, 9] },
  explosao: { Aceleração: [6, 9], Agilidade: [2, 3] },
  incansavel: { Fôlego: [8, 12] },
};

/** Hash estável 0..1 a partir de um texto. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

export interface Detail { groups: { n: string; main: number; subs: { n: string; v: number }[] }[]; skills: number; weak: number }
const cache = new WeakMap<BasePlayer, { st: number[]; ps: string[]; d: Detail }>();

/** Atributos detalhados do jogador (goleiros: os 6 atributos de goleiro, sem subdivisão). */
export function detail(P: BasePlayer): Detail {
  const hit = cache.get(P);
  if (hit && hit.st === P.st && hit.ps === P.ps) return hit.d;
  let groups: Detail['groups'];
  if (P.pos === 'GOL') groups = [{ n: 'Goleiro', main: P.ovr, subs: GK_GROUPS.map((n, i) => ({ n, v: P.st[i] })) }];
  else {
    const bias = POS_BIAS[P.pos] ?? {};
    groups = SUB_GROUPS.map((g, gi) => {
      const main = P.st[gi];
      const raw = g.subs.map(n => {
        let b = (bias as Record<string, number>)[n] ?? 0;
        for (const id in PS_BIAS) { const l = psLevel(P, id as PsId); if (l) b += (PS_BIAS[id as PsId] as Record<string, [number, number]>)[n]?.[l - 1] ?? 0; }
        return b + (hash(P.id + n) - .5) * 6;
      });
      // Recentraliza: a média dos subatributos volta a ser o atributo principal
      const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
      return { n: g.n, main, subs: g.subs.map((n, i) => ({ n, v: clamp(Math.round(main + raw[i] - mean), 15, 99) })) };
    });
  }
  const d: Detail = { groups, skills: skillStars(P), weak: weakFoot(P) };
  cache.set(P, { st: P.st, ps: P.ps, d });
  return d;
}

/** Valor de um subatributo (usado nos lances). Para goleiros e nomes desconhecidos, cai no atributo principal. */
export function sub(P: BasePlayer, name: SubName): number {
  const d = detail(P);
  for (const g of d.groups) for (const s of g.subs) if (s.n === name) return s.v;
  return P.ovr;
}

/** Estrelas de drible (1 a 5): drible alto e Firula levam a 5. */
export function skillStars(P: BasePlayer): number {
  if (P.pos === 'GOL') return 1;
  const dri = P.st[3];
  let s = dri >= 88 ? 4 : dri >= 80 ? 3 : dri >= 70 ? 2 : 1;
  const f = psLevel(P, 'firula');
  if (f === 2) s = 5; else if (f === 1) s = Math.min(5, s + 1);
  // Drible Rápido + com drible de elite também dá 5 estrelas
  if (psLevel(P, 'drible-rapido') === 2 && dri >= 90) s = 5;
  return s;
}
/** Perna ruim (1 a 5): ambidestros têm 5; os outros variam de 2 a 4, com um pouco a mais para finalizadores técnicos. */
export function weakFoot(P: BasePlayer): number {
  if (P.foot === 'A') return 5;
  const h = hash(P.id + 'pr');
  let w = h < .22 ? 2 : h < .78 ? 3 : 4;
  if (P.pos !== 'GOL' && P.st[1] >= 85 && h > .6) w = Math.min(5, w + 1);
  return w;
}

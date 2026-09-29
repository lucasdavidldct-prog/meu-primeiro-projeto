import type { StyleId } from './types';

export const STYLES: Record<StyleId, { n: string; d: string }> = {
  equilibrado: { n: 'Equilibrado', d: 'Sem riscos: o time se ajusta ao jogo. Nenhuma vantagem, nenhuma fraqueza.' },
  posse: { n: 'Toque de bola', d: 'Mais posse e paciência. Rende contra times fechados, sofre contra pressão alta.' },
  contra: { n: 'Contra-ataque', d: 'Cede a bola e mata em velocidade. Pune quem pressiona ou ataca demais.' },
  pressao: { n: 'Pressão alta', d: 'Marca no campo de ataque e rouba bolas. Desmonta o toque de bola, mas abre espaço para contra-ataques.' },
  retranca: { n: 'Retranca', d: 'Linhas baixas e compactas. Sofre bem menos chances, mas cria pouco.' },
};
export const STYLE_IDS = Object.keys(STYLES) as StyleId[];

/** Estilo do atacante -> estilo do defensor -> multiplicador de chance. */
const SVS: Record<StyleId, Partial<Record<StyleId, number>>> = {
  contra: { pressao: 1.24, posse: 1.12, retranca: .84 },
  pressao: { posse: 1.2, equilibrado: 1.05, contra: .9 },
  posse: { retranca: 1.2, equilibrado: 1.05, pressao: .88 },
  retranca: { posse: 1.08 },
  equilibrado: {},
};
export const sv = (a: StyleId, b: StyleId): number => SVS[a]?.[b] ?? 1;

export const MENT = ['Muito defensivo', 'Defensivo', 'Equilibrado', 'Ofensivo', 'Muito ofensivo'];

/** Estilo que leva vantagem contra o estilo dado. */
export function counterOf(style: StyleId): StyleId {
  let best: StyleId = 'equilibrado', bv = 0;
  for (const s of STYLE_IDS) {
    const v = sv(s, style) / sv(style, s);
    if (v > bv) { bv = v; best = s; }
  }
  return best;
}

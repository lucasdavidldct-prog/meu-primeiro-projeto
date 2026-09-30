// Ícones próprios dos estilos de jogo (traço simples, 24×24): o desenho mostra a jogada, para reconhecer rápido na carta.
import { PS_BY_ID } from '../engine/data/schema';

const B = (cx: number, cy: number, r = 2.5) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const DOT = (cx: number, cy: number, r = 1.6) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="currentColor"/>`;

const ICONS: Record<string, string> = {
  // Finalização
  'finalizacao-precisa': `<circle cx="12" cy="12" r="8"/>${DOT(12, 12, 3)}<path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>`,
  'chute-colocado': `<path d="M13 3h8v8"/><path d="M5 18C6 10 10 7 18 6"/><path d="M15 3.5l3 2.5-3 2.5"/>${B(4, 20)}`,
  'chute-de-longe': `${B(16, 12, 5)}<path d="M2 7h8M1 12h9M2 17h8"/>`,
  'cavadinha': `<path d="M4 19C7 3 15 3 19 17"/>${B(20, 19, 2)}<path d="M12 13v8M9 15.5h6"/>${DOT(12, 11, 1.3)}`,
  'cobranca-de-falta': `<path d="M10 14v8M13 14v8M16 14v8"/><path d="M5 18C5 7 14 3 21 7"/><path d="M18 4l3 3-3.5 1.5"/>${B(4, 20, 2)}`,
  'cabeceio': `<circle cx="10" cy="14" r="4.5"/>${B(18, 5, 3)}<path d="M13.5 10.5l2-2"/><path d="M2 23c1-2 3.5-3 8-3s7 1 8 3"/>`,
  // Passe
  'passe-preciso': `${B(4, 19)}<path d="M6.5 16.5l8-8"/><circle cx="18" cy="6" r="4"/>${DOT(18, 6, 1.2)}`,
  'passe-tenso': `${B(5, 12, 3)}<path d="M10 12h11M17 8l4 4-4 4M1 6h5M1 18h5"/>`,
  'passe-em-profundidade': `<path d="M3 21L20 4M13 4h7v7"/>${DOT(6, 9)}${DOT(10, 13)}${DOT(15, 18)}`,
  'lancamento': `<path d="M4 19C7 3 17 3 21 15"/><path d="M17.5 13.5l3.5 2 1-3.5"/>${B(3, 20, 2)}`,
  'tiki-taka': `${B(5, 18, 2)}${B(19, 18, 2)}${B(12, 5, 2)}<path d="M7.5 18h9M17.8 15.8l-4.6-8.6M10.8 7.2l-4.6 8.6"/>`,
  'cruzamento': `<path d="M22 7h-5v11h5"/><path d="M4.5 17C6 8 11 6 16 9.5"/><path d="M13 8.5l3 1-1 3"/>${B(3, 19, 2)}`,
  // Controle
  'primeiro-toque': `<path d="M2 16h8l4 2h7v3H2z"/>${B(16, 9, 3.5)}<path d="M10 5c-2 1.5-2 6 0 7.5"/>`,
  'drible-rapido': `<path d="M2 19l5-7 4 5 6-9"/><path d="M13.5 8l3.5-1 1.5 3.5"/>${B(20, 19, 2)}`,
  'firula': `${B(12, 15, 4)}<path d="M5 9.5c2-6 12-6 14 0"/><path d="M19.5 6.5l-.5 3-3-.5"/><path d="M4 2v4M2 4h4M20 1v3M18.5 2.5h3"/>`,
  'tecnico': `${B(12, 12, 4)}<path d="M6 4.5C2.5 8 2.5 16 6 19.5M18 4.5c3.5 3.5 3.5 11.5 0 15"/>`,
  'resistente-pressao': `<path d="M12 2l8 3v6c0 6-4 9-8 11-4-2-8-5-8-11V5z"/>${B(12, 11, 3)}`,
  'velocista': `<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>`,
  // Defesa
  'desarme': `<path d="M2 21h20"/><path d="M3 17l9-2 7 2"/>${DOT(5, 10, 2)}<path d="M5 12l3 3"/>${B(20, 14, 2)}`,
  'interceptacao': `<path d="M2 17h7"/><path d="M13 17h9" stroke-dasharray="2 2"/><path d="M9 17l5-9"/><path d="M11 7.5l3 .5.5 3"/>`,
  'antecipacao': `<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>${DOT(12, 12, 1.2)}`,
  'contencao': `<path d="M4 4v16M20 4v16"/><path d="M8 12h8M13 9l3 3-3 3"/>`,
  'bloqueio': `<rect x="12" y="3" width="6" height="18" rx="1"/><path d="M12 9h6M12 15h6M15 3v6M15 15v6"/>${B(5, 12)}<path d="M7.5 9l2 1.5M7.5 15l2-1.5"/>`,
  // Físico
  'imposicao-fisica': `<circle cx="12" cy="5" r="3"/><path d="M3 21v-5c0-4 3.5-6 9-6s9 2 9 6v5"/><path d="M8 14v7M16 14v7"/>`,
  'acrobatico': `<path d="M5 12a7 7 0 1 1 2.5 5.4"/><path d="M3.5 15.5L5 12l3.5 1"/>${B(12, 12, 2.5)}`,
  'trivela': `<path d="M5 20c10 0 1-14 13-14"/><path d="M15 3l3.5 3-3.5 3"/>${B(3, 20, 2)}`,
  'explosao': `<path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5L19 19M19 5l-3.5 3.5M8.5 15.5L5 19"/>`,
  'incansavel': `<path d="M6 8c-3 0-4 2-4 4s1 4 4 4c4 0 8-8 12-8 3 0 4 2 4 4s-1 4-4 4c-4 0-8-8-12-8z"/>`,
  // Goleiro
  'reflexos': `<path d="M8 21v-3l-4-5 1.5-1.5L8 13V5a1.5 1.5 0 0 1 3 0v6V4a1.5 1.5 0 0 1 3 0v7V5a1.5 1.5 0 0 1 3 0v8c0 4-2 8-4 8z"/>`,
  'saida-do-gol': `<path d="M3 3h18M3 3v8M21 3v8"/><path d="M12 6v14M8 16l4 4 4-4"/>`,
  'pegador-de-penalti': `<path d="M2 20V5h20v15"/><path d="M6 17c2-4 6-6 10-6"/>${B(17.5, 11)}<path d="M12 21v1"/>`,
  'reposicao-longa': `<path d="M2 15v6h5v-6"/><path d="M5 13C9 2 17 2 21 11"/><path d="M17.5 10l3.5 1.5.5-3.5"/>`,
};

/** SVG do estilo de jogo (cai no emoji se faltar desenho). */
export function psIcon(id: string): string {
  const d = ICONS[id];
  if (!d) return PS_BY_ID.get(id)?.icone ?? '';
  return `<svg class="psi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}
export const hasPsIcon = (id: string): boolean => id in ICONS;

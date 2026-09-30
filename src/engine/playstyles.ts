// Efeito dos playstyles no jogo. Nível 0 = não tem, 1 = normal, 2 = versão "+".
import type { BasePlayer } from './types';

export type PsId =
  | 'chute-de-longe' | 'finalizacao-precisa' | 'cobranca-de-falta' | 'cabeceio' | 'passe-preciso' | 'passe-em-profundidade'
  | 'cruzamento' | 'drible-rapido' | 'velocista' | 'primeiro-toque' | 'desarme' | 'interceptacao' | 'bloqueio'
  | 'imposicao-fisica' | 'incansavel' | 'reflexos' | 'saida-do-gol' | 'pegador-de-penalti' | 'reposicao-longa';

export function psLevel(P: BasePlayer | null | undefined, id: PsId): 0 | 1 | 2 {
  if (!P) return 0;
  for (const s of P.ps) {
    if (s === id + '+') return 2;
    if (s === id) return 1;
  }
  return 0;
}

/** Escolhe o valor do efeito pelo nível: [sem, normal, +]. */
export const byLevel = (lvl: 0 | 1 | 2, v: readonly [number, number, number]): number => v[lvl];

/** Tabela única com a força de cada efeito (fácil de ajustar e de testar). */
export const FX = {
  // Simulação
  finalizacao: [1, 1.18, 1.32],      // multiplica a chance de gol em finalizações normais
  chuteLonge: [1, 1.7, 2.3],         // chance de gol em chutes de fora da área
  cabeceio: [1, 1.55, 1.95],         // chance de gol de cabeça
  cabeceioDef: [0, .1, .18],         // zagueiro com cabeceio tira essa fração dos gols de cabeça
  falta: [.035, .11, .18],           // chance de gol de falta direta
  cruzamento: [1, 1.5, 1.9],         // peso de quem dá assistência em lances de cabeça
  profundidade: [1, 1.35, 1.6],      // peso de quem dá assistência em lances normais
  desarme: [0, .022, .035],          // cada defensor tira essa fração das chances do rival
  intercept: [0, .016, .026],
  bloqueio: [0, .035, .055],         // chance de bloquear o chute
  incansavel: [1, .65, .4],          // multiplica o cansaço
  reflexos: [1, .9, .82],            // multiplica a chance de gol sofrido
  saidaGol: [1, .9, .8],             // em cabeçadas e cruzamentos
  penaltiGol: [0, .07, .12],         // tira da conversão do pênalti
  penaltiBatedor: [0, .03, .05],     // soma na conversão (finalização precisa/cobrança de falta)
  velocista: [0, .03, .05],          // soma na chance de criar jogadas quando o time joga no contra-ataque
  passe: [0, .006, .01],             // soma na força do meio-campo (posse)
  // Lances jogáveis
  passeRaio: [1, .78, .62],          // raio de interceptação do passe
  passeLongo: [1, .6, .35],          // penalidade de passe longo
  dribleMarcador: [1, .78, .62],     // chance do marcador tomar a bola
  dribleAlcance: [9, 10.5, 12],      // metros por condução
  chuteErro: [1, .8, .66],           // chance de errar o alvo
  chuteDistancia: [1, .7, .5],       // penalidade de distância (chute de longe)
  curva: [.5, .85, 1],               // alcance da curva na falta
  faltaDispersao: [1.2, .85, .6],    // dispersão (m) da falta
  defesaGoleiro: [1, 1.12, 1.22],    // multiplica a chance de defesa do goleiro no lance
  defesaPenalti: [1, 1.2, 1.35],
} as const;

export type SideLike = { xi: { P: BasePlayer; red: boolean }[] };

/** Soma dos níveis de um playstyle entre os jogadores em campo. */
export function teamPs(side: SideLike, id: PsId): number {
  let s = 0;
  for (const e of side.xi) if (!e.red) s += psLevel(e.P, id);
  return s;
}

/** Soma do efeito de um playstyle entre os jogadores em campo (usa a tabela FX). */
export function teamFx(side: SideLike, id: PsId, fx: readonly [number, number, number]): number {
  let s = 0;
  for (const e of side.xi) if (!e.red) s += fx[psLevel(e.P, id)];
  return s;
}

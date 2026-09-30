// Efeito dos playstyles no jogo. Nível 0 = não tem, 1 = normal, 2 = versão "+".
import type { BasePlayer } from './types';

export type PsId =
  | 'chute-de-longe' | 'finalizacao-precisa' | 'cobranca-de-falta' | 'cabeceio' | 'passe-preciso' | 'passe-em-profundidade'
  | 'cruzamento' | 'drible-rapido' | 'velocista' | 'primeiro-toque' | 'desarme' | 'interceptacao' | 'bloqueio'
  | 'imposicao-fisica' | 'incansavel' | 'reflexos' | 'saida-do-gol' | 'pegador-de-penalti' | 'reposicao-longa'
  | 'chute-colocado' | 'cavadinha' | 'passe-tenso' | 'lancamento' | 'tiki-taka' | 'firula' | 'tecnico' | 'resistente-pressao'
  | 'antecipacao' | 'contencao' | 'acrobatico' | 'trivela' | 'explosao';

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
  finalizacao: [1, 1.2, 1.5],      // multiplica a chance de gol em finalizações normais
  chuteLonge: [1, 1.7, 2.7],         // chance de gol em chutes de fora da área
  cabeceio: [1, 1.55, 2.3],         // chance de gol de cabeça
  cabeceioDef: [0, .1, .22],         // zagueiro com cabeceio tira essa fração dos gols de cabeça
  falta: [.035, .11, .22],           // chance de gol de falta direta
  cruzamento: [1, 1.5, 2.2],         // peso de quem dá assistência em lances de cabeça
  profundidade: [1, 1.35, 1.8],      // peso de quem dá assistência em lances normais
  desarme: [0, .022, .045],          // cada defensor tira essa fração das chances do rival
  intercept: [0, .016, .034],
  bloqueio: [0, .035, .07],         // chance de bloquear o chute
  incansavel: [1, .65, .3],          // multiplica o cansaço
  reflexos: [1, .9, .78],            // multiplica a chance de gol sofrido
  saidaGol: [1, .9, .75],             // em cabeçadas e cruzamentos
  penaltiGol: [0, .07, .15],         // tira da conversão do pênalti
  penaltiBatedor: [0, .03, .06],     // soma na conversão (finalização precisa/cobrança de falta)
  velocista: [0, .03, .07],          // soma na chance de criar jogadas quando o time joga no contra-ataque
  passe: [0, .006, .014],             // soma na força do meio-campo (posse)
  // Lances jogáveis
  passeRaio: [1, .78, .55],          // raio de interceptação do passe
  passeLongo: [1, .6, .3],          // penalidade de passe longo
  dribleMarcador: [1, .78, .55],     // chance do marcador tomar a bola
  dribleAlcance: [9, 10.5, 12.5],      // metros por condução
  chuteErro: [1, .8, .6],           // chance de errar o alvo
  chuteDistancia: [1, .7, .45],       // penalidade de distância (chute de longe)
  curva: [.5, .85, 1],               // alcance da curva na falta
  faltaDispersao: [1.2, .85, .6],    // dispersão (m) da falta
  defesaGoleiro: [1, 1.12, 1.28],    // multiplica a chance de defesa do goleiro no lance
  defesaPenalti: [1, 1.2, 1.45],
  // Playstyles novos — lance jogável (o tipo de chute sai do gesto: traço curvo = colocado, rápido = forte, curto e lento = cavadinha)
  colocadoErro: [1, .75, .55],       // chute curvo: chance de errar o alvo
  colocadoDefesa: [1, .85, .7],      // chute curvo: chance do goleiro defender
  superChuteDefesa: [1, .86, .74],   // chute forte: chance do goleiro defender
  superChuteLimite: [.88, .93, .97], // força a partir da qual a bola sobe demais
  cavadinhaDefesa: [.9, .45, .3],    // cavadinha por cima do goleiro (sem o playstyle quase sempre é defendida)
  cavadinhaErro: [.35, .14, .08],
  acrobaticoDefesa: [1, .85, .72],   // finalização de primeira (voleio)
  cabecaDefesa: [1, .85, .72],       // cabeçada depois do cruzamento
  trivelaCurva: [1, 1.3, 1.6],       // alcance da curva em chutes e faltas
  passeTenso: [1, .8, .65],          // raio de interceptação do passe rasteiro
  tikiTaka: [0, .9, .95],            // chance mínima do passe curto (até 15 m)
  lancamento: [1, .6, .35],          // penalidade de distância no passe alto
  firula: [1, .85, .72],             // chance de perder a bola no drible
  tecnico: [1, .9, .8],
  resistente: [1, .8, .65],          // com marcador colado
  explosaoAlcance: [0, 1.2, 2.4],    // metros a mais por condução
  // Defesa rival no lance jogável (nível do time: soma dos níveis dos marcadores ÷ 3, até 2)
  defDesarme: [1, 1.15, 1.3],        // chance do marcador tomar a bola no drible
  defContencao: [1, 1.1, 1.2],       // idem (não dá o bote errado)
  defIntercepta: [1, 1.15, 1.3],     // raio de interceptação dos passes rasteiros
  defAntecipa: [1, 1.12, 1.25],      // marcador chega antes no receptor
  defBloqueio: [.55, .45, .35],      // fração do chute que passa por cada marcador no caminho
  defFisico: [1, .9, .8],            // disputa pelo alto do receptor contra a defesa
  // Playstyles novos — simulação
  colocadoSim: [1, 1.12, 1.25],      // gols em finalizações normais
  cavadinhaSim: [1, 1.04, 1.08],
  acrobaticoSim: [1, 1.1, 1.2],      // gols de cabeça/voleio
  antecipacao: [0, .018, .032],      // tira chances do rival (como interceptação)
  contencao: [0, .012, .024],
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

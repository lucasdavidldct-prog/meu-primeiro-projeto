// Função no campo e orientação de cada jogador (instruções individuais) e como isso pesa na partida.
import type { Pos } from './types';

export type OrderGroup = 'GOL' | 'ZAG' | 'LAT' | 'VOL' | 'MC' | 'MEI' | 'PONTA' | 'ATA';
export const groupOf = (p: Pos): OrderGroup =>
  p === 'GOL' ? 'GOL' : p === 'ZAG' ? 'ZAG' : p === 'LD' || p === 'LE' ? 'LAT' : p === 'VOL' ? 'VOL' : p === 'MC' ? 'MC' : p === 'MEI' ? 'MEI'
    : p === 'ATA' ? 'ATA' : 'PONTA';

/** Instrução individual: função (estilo) e participação (-1 defende mais, 0 equilibrado, 1 ataca mais). */
export interface Order { f?: string; p?: -1 | 0 | 1 }

/**
 * Efeito de uma função: multiplicadores do peso do jogador em cada setor e nas jogadas.
 * att/mid/def = peso no ataque, meio e defesa · score = finalizações · assist = passes para gol ·
 * head = cabeçadas · long = chutes de longe · cross = cruzamentos · tire = cansaço · expose = espaço que deixa atrás.
 */
export interface OrderFx { att: number; mid: number; def: number; score: number; assist: number; head: number; long: number; cross: number; tire: number; expose: number }
const N: OrderFx = { att: 1, mid: 1, def: 1, score: 1, assist: 1, head: 1, long: 1, cross: 1, tire: 1, expose: 0 };
const fx = (o: Partial<OrderFx>): OrderFx => ({ ...N, ...o });

export interface FuncDef { id: string; n: string; d: string; fx: OrderFx }

export const FUNCS: Record<OrderGroup, FuncDef[]> = {
  GOL: [
    { id: 'tradicional', n: 'Goleiro tradicional', d: 'Fica embaixo das traves: mais seguro nos chutes de longe.', fx: fx({}) },
    { id: 'libero', n: 'Goleiro-líbero', d: 'Adiantado, corta lançamentos e ajuda a sair jogando. Deixa o gol mais exposto a chutes de longe.', fx: fx({ mid: 1.25, expose: -.6 }) },
  ],
  ZAG: [
    { id: 'marcador', n: 'Zagueiro marcador', d: 'Colado no atacante: ganha mais divididas e bolas aéreas.', fx: fx({ def: 1.15, mid: .8, head: 1.3 }) },
    { id: 'construtor', n: 'Zagueiro construtor', d: 'Sai jogando com passes longos: melhora o meio, mas marca um pouco menos.', fx: fx({ def: .92, mid: 1.6, assist: 1.4 }) },
    { id: 'cobertura', n: 'Zagueiro de cobertura', d: 'Fica na sobra: corta contra-ataques e cobre os laterais.', fx: fx({ def: 1.08, expose: -.5 }) },
  ],
  LAT: [
    { id: 'apoio', n: 'Lateral de apoio', d: 'Sobe e volta na medida certa.', fx: fx({}) },
    { id: 'ala', n: 'Ala', d: 'Vive no ataque: muitos cruzamentos, mas deixa as costas livres.', fx: fx({ att: 1.5, def: .8, cross: 1.6, tire: 1.2, expose: .5 }) },
    { id: 'invertido', n: 'Lateral invertido', d: 'Fecha por dentro e vira meio-campista na saída de bola.', fx: fx({ mid: 1.7, att: .9, cross: .6, def: 1.05 }) },
    { id: 'defensivo', n: 'Lateral defensivo', d: 'Quase um terceiro zagueiro: sobe pouco.', fx: fx({ att: .5, def: 1.2, cross: .6 }) },
  ],
  VOL: [
    { id: 'cabeca-de-area', n: 'Cabeça de área', d: 'Protege a zaga e corta as jogadas pelo meio.', fx: fx({ def: 1.25, att: .7, expose: -.4 }) },
    { id: 'regista', n: 'Volante construtor', d: 'Organiza desde trás com passes longos.', fx: fx({ mid: 1.3, def: .9, assist: 1.6, long: 1.3 }) },
    { id: 'box-to-box', n: 'Box-to-box', d: 'Corre o campo todo: ajuda na defesa e chega para finalizar. Cansa mais.', fx: fx({ att: 1.5, mid: 1.1, score: 1.8, long: 1.4, tire: 1.35, expose: .3 }) },
  ],
  MC: [
    { id: 'box-to-box', n: 'Box-to-box', d: 'Corre o campo todo: ajuda na defesa e chega para finalizar. Cansa mais.', fx: fx({ att: 1.2, def: 1.15, score: 1.4, tire: 1.35 }) },
    { id: 'armador', n: 'Armador', d: 'Dita o ritmo e procura o passe decisivo.', fx: fx({ mid: 1.25, assist: 1.8, score: .7, def: .85 }) },
    { id: 'marcador', n: 'Meio-campista marcador', d: 'Recupera bolas e dá cobertura: sobe pouco.', fx: fx({ def: 1.35, att: .65, score: .6, expose: -.3 }) },
    { id: 'infiltrador', n: 'Infiltrador', d: 'Pisa na área de surpresa: mais finalizações, menos marcação.', fx: fx({ att: 1.45, score: 2.1, def: .75, expose: .3 }) },
  ],
  MEI: [
    { id: 'armador', n: 'Meia armador', d: 'O cérebro do time: mais assistências e posse.', fx: fx({ mid: 1.3, assist: 1.8, score: .8 }) },
    { id: 'meia-atacante', n: 'Meia-atacante', d: 'Joga como um segundo atacante: finaliza mais.', fx: fx({ att: 1.3, score: 1.7, long: 1.4, mid: .85 }) },
    { id: 'flutuante', n: 'Meia flutuante', d: 'Se movimenta entre as linhas e aparece pelos lados.', fx: fx({ att: 1.15, mid: 1.1, cross: 1.4, assist: 1.3 }) },
  ],
  PONTA: [
    { id: 'aberto', n: 'Ponta aberto', d: 'Colado na linha lateral: dribla e cruza.', fx: fx({ cross: 1.9, assist: 1.4, score: .8 }) },
    { id: 'invertido', n: 'Ponta invertido', d: 'Corta para dentro para finalizar com a perna boa.', fx: fx({ score: 1.6, long: 1.6, cross: .6, att: 1.1 }) },
    { id: 'profundidade', n: 'Atacante de profundidade', d: 'Ataca as costas da defesa: rende muito no contra-ataque.', fx: fx({ att: 1.2, score: 1.3, mid: .75 }) },
  ],
  ATA: [
    { id: 'centroavante', n: 'Centroavante', d: 'Finalizador de área: vive para o gol.', fx: fx({ score: 1.35, head: 1.3, mid: .8, assist: .7 }) },
    { id: 'pivo', n: 'Pivô', d: 'Segura a bola de costas, ganha pelo alto e serve quem chega.', fx: fx({ head: 1.8, assist: 1.8, mid: 1.25, score: .85 }) },
    { id: 'falso-9', n: 'Falso 9', d: 'Recua para armar: puxa marcadores e abre espaço para os pontas e meias.', fx: fx({ mid: 1.9, att: .9, assist: 2.2, score: .6, head: .5 }) },
    { id: 'velocista', n: 'Atacante veloz', d: 'Ataca o espaço nas costas da zaga: letal no contra-ataque.', fx: fx({ att: 1.15, score: 1.15, head: .7, mid: .7 }) },
  ],
};

export const PART_LABELS: Record<OrderGroup, [string, string, string]> = {
  GOL: ['', '', ''],
  ZAG: ['Fica atrás', 'Equilibrado', 'Apoia o ataque'],
  LAT: ['Fica atrás', 'Equilibrado', 'Apoia o ataque'],
  VOL: ['Fica atrás', 'Equilibrado', 'Apoia o ataque'],
  MC: ['Volta para defender', 'Equilibrado', 'Vai ao ataque'],
  MEI: ['Volta para defender', 'Equilibrado', 'Fica no ataque'],
  PONTA: ['Volta para defender', 'Equilibrado', 'Fica no ataque'],
  ATA: ['Volta para defender', 'Equilibrado', 'Fica no ataque'],
};

export const defaultFunc = (p: Pos): string => FUNCS[groupOf(p)][0].id;
export function funcOf(p: Pos, o?: Order | null): FuncDef {
  const L = FUNCS[groupOf(p)];
  return L.find(f => f.id === o?.f) ?? L[0];
}

/** Efeito final (função + participação) de um jogador numa posição. */
export function orderFx(p: Pos, o?: Order | null): OrderFx {
  const f = { ...funcOf(p, o).fx };
  const k = p === 'GOL' ? 0 : o?.p ?? 0;
  if (k > 0) { f.att *= 1.3; f.score *= 1.25; f.def *= .7; f.tire *= 1.1; f.expose += .35; }
  if (k < 0) { f.att *= .7; f.score *= .75; f.def *= 1.45; f.expose -= .25; }
  return f;
}

/** Funções que o jogador pode assumir a partir da posição do esquema (ex.: VOL pode jogar de MC). */
export const ROLE_SWAPS: Record<Pos, Pos[]> = {
  GOL: ['GOL'], ZAG: ['ZAG', 'VOL'], LD: ['LD', 'MD', 'ZAG'], LE: ['LE', 'ME', 'ZAG'], VOL: ['VOL', 'MC', 'ZAG'], MC: ['MC', 'VOL', 'MEI'],
  MEI: ['MEI', 'MC', 'ATA'], MD: ['MD', 'PD', 'LD', 'MC'], ME: ['ME', 'PE', 'LE', 'MC'], PD: ['PD', 'MD', 'ATA'], PE: ['PE', 'ME', 'ATA'], ATA: ['ATA', 'MEI', 'PD', 'PE'],
};

/** Nomes das posições por extenso (menus). */
export const POS_NAME: Record<Pos, string> = {
  GOL: 'Goleiro', ZAG: 'Zagueiro', LD: 'Lateral-direito', LE: 'Lateral-esquerdo', VOL: 'Volante', MC: 'Meio-campista', MEI: 'Meia',
  MD: 'Meia pela direita', ME: 'Meia pela esquerda', PD: 'Ponta-direita', PE: 'Ponta-esquerda', ATA: 'Atacante',
};

/** Função sugerida pelos atributos e playstyles do jogador (usada pela IA e como padrão das suas cartas). */
export function suggestOrder(P: { st: number[]; ps: string[]; pos: Pos; foot: 'D' | 'E' | 'A' } | null | undefined, pos: Pos): Order {
  if (!P || !P.st) return { f: defaultFunc(pos), p: 0 };
  const [RIT, FIN, PAS, DRI, DEF, FIS] = P.st, has = (id: string) => P.ps.some(x => x.startsWith(id));
  const g = groupOf(pos);
  let f: string;
  if (P.pos === 'GOL' || g === 'GOL') f = has('reposicao-longa') && P.st[4] >= 60 ? 'libero' : 'tradicional';
  else if (g === 'ZAG') f = PAS >= 72 || has('passe-') ? 'construtor' : RIT >= 76 ? 'cobertura' : 'marcador';
  else if (g === 'LAT') f = (has('cruzamento') || DRI >= 78) && RIT >= 78 ? 'ala' : DEF >= 78 && PAS < 72 ? 'defensivo' : 'apoio';
  else if (g === 'VOL') f = PAS >= 78 || has('passe-em-profundidade') ? 'regista' : has('incansavel') && FIN >= 65 ? 'box-to-box' : 'cabeca-de-area';
  else if (g === 'MC') f = PAS >= 81 || has('passe-em-profundidade') ? 'armador' : DEF >= 76 ? 'marcador' : FIN >= 76 ? 'infiltrador' : 'box-to-box';
  else if (g === 'MEI') f = FIN > PAS + 2 ? 'meia-atacante' : DRI >= 84 && has('cruzamento') ? 'flutuante' : 'armador';
  else if (g === 'PONTA') {
    const right = pos === 'PD' || pos === 'MD', inverted = (right && P.foot === 'E') || (!right && P.foot === 'D');
    f = has('cruzamento') && !inverted ? 'aberto' : RIT >= 88 && has('velocista') ? 'profundidade' : inverted || FIN >= 78 ? 'invertido' : 'aberto';
  } else f = (has('cabeceio') || FIS >= 82) && PAS >= 68 ? 'pivo' : RIT >= 87 ? 'velocista' : PAS >= 80 && FIN < 84 ? 'falso-9' : 'centroavante';
  return { f, p: 0 };
}

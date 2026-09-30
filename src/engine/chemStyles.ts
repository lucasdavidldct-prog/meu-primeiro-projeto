// Estilos de química: você escolhe um por carta e ele soma pontos nos atributos principais.
// O bônus cheio vale com química 3; com química 2 vale 2/3, com 1 vale 1/3 e com 0 não vale nada.
import type { BasePlayer } from './types';

export interface ChemStyle { id: string; n: string; d: string; gk: boolean; b: [number, number, number, number, number, number] }

export const CHEM_STYLES: ChemStyle[] = [
  // Linha: RIT FIN PAS DRI DEF FIS
  { id: 'basico', n: 'Básico', d: 'Um pouco de tudo.', gk: false, b: [2, 2, 2, 2, 2, 2] },
  { id: 'artilheiro', n: 'Artilheiro', d: 'Velocidade e finalização: o atacante de profundidade.', gk: false, b: [5, 5, 0, 0, 0, 0] },
  { id: 'matador', n: 'Matador', d: 'Finalização e drible: decide dentro da área.', gk: false, b: [0, 5, 0, 5, 0, 0] },
  { id: 'canhao', n: 'Canhão', d: 'Finalização e físico: chute forte e presença.', gk: false, b: [0, 6, 0, 0, 0, 4] },
  { id: 'flecha', n: 'Flecha', d: 'Velocidade e drible: o ponta que passa por todos.', gk: false, b: [6, 0, 0, 4, 0, 0] },
  { id: 'maestro', n: 'Maestro', d: 'Passe e drible: o camisa 10.', gk: false, b: [0, 0, 5, 5, 0, 0] },
  { id: 'arquiteto', n: 'Arquiteto', d: 'Passe e físico: organiza e aguenta o jogo.', gk: false, b: [0, 0, 5, 0, 0, 5] },
  { id: 'motor', n: 'Motor', d: 'Velocidade, passe e drible: o meia que carrega o time.', gk: false, b: [3, 0, 4, 3, 0, 0] },
  { id: 'sombra', n: 'Sombra', d: 'Velocidade e defesa: marca e cobre.', gk: false, b: [5, 0, 0, 0, 5, 0] },
  { id: 'ancora', n: 'Âncora', d: 'Defesa e físico: a muralha da zaga.', gk: false, b: [0, 0, 0, 0, 5, 5] },
  { id: 'pilar', n: 'Pilar', d: 'Passe, defesa e físico: o volante completo.', gk: false, b: [0, 0, 3, 0, 4, 3] },
  { id: 'gladiador', n: 'Gladiador', d: 'Finalização e defesa: box-to-box que chega e marca.', gk: false, b: [0, 5, 0, 0, 5, 0] },
  { id: 'guardiao', n: 'Guardião', d: 'Drible e defesa: sai jogando com a bola.', gk: false, b: [0, 0, 0, 5, 5, 0] },
  // Goleiro: MER MAN CHU REF VEL POS
  { id: 'gk-basico', n: 'Básico', d: 'Um pouco de tudo.', gk: true, b: [2, 2, 2, 2, 2, 2] },
  { id: 'gk-luva', n: 'Luva', d: 'Mergulho e posicionamento.', gk: true, b: [5, 0, 0, 0, 0, 5] },
  { id: 'gk-gato', n: 'Gato', d: 'Reflexo e velocidade.', gk: true, b: [0, 0, 0, 5, 5, 0] },
  { id: 'gk-paredao', n: 'Paredão', d: 'Manejo e reflexo: não solta a bola.', gk: true, b: [0, 5, 0, 5, 0, 0] },
];
export const CHEM_BY_ID = new Map(CHEM_STYLES.map(c => [c.id, c]));

/** Estilos permitidos para o jogador (goleiro só usa os de goleiro). */
export const chemStylesFor = (P: BasePlayer): ChemStyle[] => CHEM_STYLES.filter(c => c.gk === (P.pos === 'GOL'));

/** Pontos que o estilo soma em cada atributo com essa química (0 a 3). */
export function chemBoost(id: string | undefined, chem: number): number[] {
  const c = id ? CHEM_BY_ID.get(id) : undefined;
  return c ? c.b.map(v => Math.round(v * Math.max(0, Math.min(3, chem)) / 3)) : [0, 0, 0, 0, 0, 0];
}

/** Cópia do jogador com o estilo de química aplicado (novos objetos: os caches do motor percebem a mudança). */
export function withChem<T extends BasePlayer>(P: T, id: string | undefined, chem: number): T {
  const b = chemBoost(id, chem);
  if (!b.some(Boolean)) return P;
  return { ...P, st: P.st.map((s, i) => Math.min(99, s + b[i])) };
}

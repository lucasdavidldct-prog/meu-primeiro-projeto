// Clássicos: rivalidades históricas. Nesses jogos o rival cresce (mais força e mais pegada), mas não é derrota certa.
// peso 2 = clássico máximo (ex.: Galo x Cruzeiro); peso 1 = rivalidade forte.

export interface Classico { n: string; peso: 1 | 2 }

const LISTA: [string, string, string, 1 | 2][] = [
  // Brasil
  ['CAM', 'CRU', 'Clássico Mineiro', 2], ['CAM', 'AMG', 'Clássico Galo x Coelho', 1], ['CAM', 'FLA', 'Galo x Flamengo', 1],
  ['FLA', 'FLU', 'Fla-Flu', 2], ['FLA', 'VAS', 'Clássico dos Milhões', 2], ['FLA', 'BOT', 'Clássico da Rivalidade', 1],
  ['FLU', 'VAS', 'Clássico dos Gigantes', 1], ['FLU', 'BOT', 'Clássico Vovô', 1], ['BOT', 'VAS', 'Clássico da Amizade', 1],
  ['COR', 'PAL', 'Derby Paulista', 2], ['SAO', 'COR', 'Majestoso', 1], ['SAO', 'PAL', 'Choque-Rei', 1],
  ['SAN', 'COR', 'Clássico Alvinegro', 1], ['SAN', 'PAL', 'Clássico da Saudade', 1], ['SAN', 'SAO', 'San-São', 1],
  ['GRE', 'INT', 'Grenal', 2], ['BAH', 'VIT', 'Ba-Vi', 2], ['CAP', 'CFC', 'Atletiba', 2], ['CEA', 'FOR', 'Clássico-Rei', 2],
  ['SPT', 'NAU', 'Clássico dos Clássicos', 1], ['GOI', 'VNO', 'Clássico goiano', 1],
  // Europa
  ['RMA', 'BAR', 'El Clásico', 2], ['RMA', 'ATM', 'Derbi madrileño', 2], ['BET', 'SEV', 'Derbi sevillano', 2], ['BAR', 'ESP', 'Derbi barceloní', 1],
  ['MUN', 'MCI', 'Derby de Manchester', 2], ['LIV', 'EVE', 'Derby de Merseyside', 2], ['ARS', 'TOT', 'Derby do norte de Londres', 2],
  ['LIV', 'MUN', 'Clássico do Noroeste', 2], ['CHE', 'ARS', 'Derby de Londres', 1], ['CHE', 'TOT', 'Derby de Londres', 1],
  ['INM', 'MIL', 'Derby della Madonnina', 2], ['ROM', 'LAZ', 'Derby della Capitale', 2], ['JUV', 'INM', "Derby d'Italia", 2], ['JUV', 'TOR', 'Derby della Mole', 1],
  ['FCB', 'BVB', 'Der Klassiker', 2], ['BVB', 'S04', 'Revierderby', 2], ['HSV', 'SVW', 'Nordderby', 1],
  // Outros
  ['NAS', 'HIL', 'Derby de Riad', 2], ['ITT', 'AHL', 'Derby de Jidá', 2],
  ['BOC', 'RIV', 'Superclásico', 2], ['PEN', 'NAC', 'Clásico uruguayo', 2], ['OLI', 'CCP', 'Superclásico paraguaio', 2], ['CCO', 'UCH', 'Superclásico chileno', 2],
  ['LAG', 'LAF', 'El Tráfico', 2], ['NYC', 'NYR', 'Hudson River Derby', 1], ['MIA', 'ORL', 'Derby da Flórida', 1],
];

const MAPA = new Map<string, Classico>();
for (const [a, b, n, peso] of LISTA) { MAPA.set(a + '|' + b, { n, peso }); MAPA.set(b + '|' + a, { n, peso }); }

/** O jogo entre esses dois clubes é clássico? */
export const classico = (a: string, b: string): Classico | undefined => MAPA.get(a + '|' + b);

/** Quanto o rival cresce no clássico (pontos de força) e quanto os cartões aumentam. */
export const classicoBoost = (c: Classico | undefined): number => (c ? (c.peso === 2 ? 3 : 2) : 0);
export const classicoCartoes = (c: Classico | undefined): number => (c ? (c.peso === 2 ? 1.5 : 1.25) : 1);
/** Moedas: vitória em clássico vale mais. */
export const classicoPremio = (c: Classico | undefined): number => (c ? (c.peso === 2 ? 1.6 : 1.3) : 1);

export const rivaisDe = (clube: string): { id: string; c: Classico }[] =>
  LISTA.filter(([a, b]) => a === clube || b === clube).map(([a, b, n, peso]) => ({ id: a === clube ? b : a, c: { n, peso } }));

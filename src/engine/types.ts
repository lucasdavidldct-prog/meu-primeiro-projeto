export type Pos = 'GOL' | 'ZAG' | 'LD' | 'LE' | 'VOL' | 'MC' | 'MEI' | 'MD' | 'ME' | 'PD' | 'PE' | 'ATA';
export type Role = 'G' | 'D' | 'M' | 'A';
export type Variant = 'base' | 'dest' | 'heroi' | 'fc' | 'elite' | 'lenda';
export type Tier = 'bronze' | 'prata' | 'ouro' | Exclude<Variant, 'base'>;
export type StyleId = 'equilibrado' | 'posse' | 'contra' | 'pressao' | 'retranca';
export type FormationId = '4-3-3' | '4-4-2' | '4-2-3-1' | '4-1-2-1-2' | '3-5-2' | '3-4-3' | '5-3-2';

export interface Nation { n: string; f: [string, string, string]; h?: boolean }

export interface Club { n: string; s: string; c1: string; c2: string }

/** Jogador da base de dados (sem versão de carta). */
export interface BasePlayer {
  id: string;
  name: string;
  short: string;
  nat: string;
  pos: Pos;
  alt: Pos[];
  ovr: number;
  /** Liga (id) e clube (sigla). Lendas usam 'ICO'. */
  lg: string;
  club: string;
  age: number;
  /** RIT FIN PAS DRI DEF FIS (goleiros: MER MAN CHU REF VEL POS). */
  st: number[];
  /** Pé bom: D, E ou A (ambidestro). */
  foot: 'D' | 'E' | 'A';
  /** Playstyles (ids; sufixo + para a versão forte). */
  ps: string[];
  leg?: boolean;
  /** Lendas: clube em que marcou época, época e clube atual ligado (ex.: CAM). */
  hist?: string;
  epoca?: string;
  legClub?: string;
  /** Reserva genérico criado para completar elencos incompletos. */
  filler?: boolean;
}

/** Jogador numa versão de carta específica. */
export interface CardPlayer extends BasePlayer {
  v: Variant;
  tier: Tier;
}

/** Carta que o jogador possui (u = identificador único da carta). */
export interface OwnedCard extends CardPlayer { u: number }

export interface SlotDef { p: Pos; x: number; y: number }

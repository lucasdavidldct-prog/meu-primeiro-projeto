// Uniformes: quando as cores dos dois times se confundem (ex.: Galo x Botafogo), o adversário joga de reserva.

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0');
  return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)) as [number, number, number];
}
/** Distância perceptiva aproximada entre duas cores (0 a ~765). */
export function colorDist(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b), rm = (r1 + r2) / 2;
  return Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2);
}
/** Quão parecidos são dois uniformes (camisa pesa mais que o detalhe). */
const kitDist = (a: [string, string], b: [string, string]) => colorDist(a[0], b[0]);

const RESERVAS: [string, string][] = [['#f4f4f4', '#1b1b1b'], ['#1d4fd8', '#ffffff'], ['#f2c21b', '#15306b'], ['#c62828', '#ffffff'], ['#1b1b1b', '#f2c21b'], ['#0f8a5f', '#ffffff']];
const LIMITE = 200;

/** Cores do adversário na partida: o uniforme dele, o invertido (detalhe vira camisa) ou um reserva bem diferente do seu. */
export function awayKit(mine: [string, string], theirs: [string, string]): [string, string] {
  if (kitDist(mine, theirs) >= LIMITE) return theirs;
  const inv: [string, string] = [theirs[1], theirs[0]];
  if (kitDist(mine, inv) >= LIMITE) return inv;
  return RESERVAS.reduce((best, k) => (kitDist(mine, k) > kitDist(mine, best) ? k : best));
}

// ---------- Uniformes por clube (titular, reserva e, no Galo, o terceiro) ----------
/** Desenho da camisa: lisa, listras verticais, aros (listras horizontais), faixa no peito, faixa diagonal ou meio a meio. */
export type Padrao = 'liso' | 'listras' | 'aros' | 'faixa' | 'diagonal' | 'metade';
export interface Kit { n: string; s: string; t: string; p: Padrao; sh: string; so?: string }

const K = (n: string, s: string, t: string, p: Padrao, sh: string, so?: string): Kit => ({ n, s, t, p, sh, so });
const PRETO = '#111111', BRANCO = '#f4f4f4';
/** Clubes com desenho conhecido (as cores são dos clubes; o desenho é nosso). */
const TABELA: Record<string, Kit[]> = {
  CAM: [K('Titular', PRETO, BRANCO, 'listras', PRETO, BRANCO), K('Reserva', BRANCO, PRETO, 'liso', BRANCO, BRANCO), K('Terceiro', '#161616', '#d4a93c', 'faixa', '#161616', '#161616')],
  FLA: [K('Titular', '#c8102e', PRETO, 'aros', BRANCO, '#c8102e'), K('Reserva', BRANCO, '#c8102e', 'liso', BRANCO)],
  PAL: [K('Titular', '#006437', BRANCO, 'liso', BRANCO, '#006437'), K('Reserva', BRANCO, '#006437', 'liso', '#006437')],
  BOT: [K('Titular', PRETO, BRANCO, 'listras', PRETO), K('Reserva', '#9aa0a6', PRETO, 'liso', PRETO)],
  FLU: [K('Titular', '#8a1538', '#00613c', 'listras', BRANCO, BRANCO), K('Reserva', BRANCO, '#8a1538', 'liso', BRANCO)],
  CRU: [K('Titular', '#003da5', BRANCO, 'liso', BRANCO, BRANCO), K('Reserva', BRANCO, '#003da5', 'liso', BRANCO)],
  SAO: [K('Titular', BRANCO, '#e4032e', 'faixa', BRANCO, BRANCO), K('Reserva', '#e4032e', PRETO, 'listras', PRETO)],
  COR: [K('Titular', BRANCO, PRETO, 'liso', PRETO, BRANCO), K('Reserva', PRETO, BRANCO, 'liso', PRETO)],
  SAN: [K('Titular', BRANCO, PRETO, 'liso', BRANCO), K('Reserva', PRETO, BRANCO, 'listras', PRETO)],
  GRE: [K('Titular', '#0d80bf', PRETO, 'listras', PRETO, BRANCO), K('Reserva', BRANCO, '#0d80bf', 'liso', BRANCO)],
  INT: [K('Titular', '#e30613', BRANCO, 'liso', BRANCO, '#e30613'), K('Reserva', BRANCO, '#e30613', 'liso', BRANCO)],
  VAS: [K('Titular', BRANCO, PRETO, 'diagonal', BRANCO), K('Reserva', PRETO, BRANCO, 'diagonal', PRETO)],
  BAH: [K('Titular', BRANCO, '#0053a0', 'faixa', '#0053a0'), K('Reserva', '#0053a0', '#e30613', 'listras', '#0053a0')],
  CAP: [K('Titular', '#c8102e', PRETO, 'aros', PRETO), K('Reserva', BRANCO, '#c8102e', 'liso', BRANCO)],
  VIT: [K('Titular', '#e30613', PRETO, 'aros', BRANCO), K('Reserva', BRANCO, '#e30613', 'liso', BRANCO)],
  SPT: [K('Titular', '#e30613', PRETO, 'aros', PRETO), K('Reserva', BRANCO, '#e30613', 'liso', BRANCO)],
  CEA: [K('Titular', PRETO, BRANCO, 'listras', PRETO), K('Reserva', BRANCO, PRETO, 'liso', BRANCO)],
  BAR: [K('Titular', '#a50044', '#004d98', 'listras', '#004d98'), K('Reserva', '#f2c21b', '#a50044', 'liso', '#f2c21b')],
  RMA: [K('Titular', BRANCO, '#febe10', 'liso', BRANCO), K('Reserva', '#1b2a4a', '#febe10', 'liso', '#1b2a4a')],
  ATM: [K('Titular', '#cb3524', BRANCO, 'listras', '#272e61'), K('Reserva', '#272e61', '#cb3524', 'liso', '#272e61')],
  JUV: [K('Titular', PRETO, BRANCO, 'listras', BRANCO), K('Reserva', '#f2c21b', PRETO, 'liso', PRETO)],
  MIL: [K('Titular', '#fb090b', PRETO, 'listras', BRANCO), K('Reserva', BRANCO, '#fb090b', 'liso', BRANCO)],
  INM: [K('Titular', '#0068a8', PRETO, 'listras', PRETO), K('Reserva', BRANCO, '#0068a8', 'liso', BRANCO)],
  NEW: [K('Titular', PRETO, BRANCO, 'listras', PRETO), K('Reserva', '#e9f1f4', PRETO, 'liso', BRANCO)],
  BOC: [K('Titular', '#0033a0', '#fcd116', 'faixa', '#0033a0'), K('Reserva', BRANCO, '#0033a0', 'liso', BRANCO)],
  RIV: [K('Titular', BRANCO, '#e30613', 'diagonal', PRETO), K('Reserva', '#e30613', BRANCO, 'liso', '#e30613')],
  PEN: [K('Titular', '#fcd116', PRETO, 'listras', PRETO), K('Reserva', BRANCO, PRETO, 'liso', BRANCO)],
  BVB: [K('Titular', '#fde100', PRETO, 'liso', PRETO), K('Reserva', PRETO, '#fde100', 'liso', PRETO)],
  ATH: [K('Titular', '#ee2523', BRANCO, 'listras', PRETO), K('Reserva', '#1d4f3a', BRANCO, 'liso', '#1d4f3a')],
  SCP: [K('Titular', '#005ca9', PRETO, 'listras', PRETO), K('Reserva', BRANCO, '#005ca9', 'liso', BRANCO)],
  UDI: [K('Titular', PRETO, BRANCO, 'listras', PRETO), K('Reserva', BRANCO, PRETO, 'liso', BRANCO)],
};

const lum = (hex: string) => { const [r, g, b] = rgb(hex); return .299 * r + .587 * g + .114 * b; };
/** Uniformes do clube: os da tabela ou um par titular/reserva feito com as cores do escudo. */
export function kitsDoClube(club: string | undefined, c1: string, c2: string): Kit[] {
  const t = club ? TABELA[club] : undefined;
  if (t) return t;
  const titular = K('Titular', c1, c2, 'liso', lum(c1) < 110 ? c1 : c2);
  // Camisa clara: a reserva é escura (a outra cor, se for escura); senão, reserva branca com detalhe na cor do clube
  const reserva = lum(c1) >= 200 ? K('Reserva', lum(c2) < 150 ? c2 : '#1b2a4a', c1, 'liso', lum(c2) < 150 ? c2 : '#1b2a4a') : K('Reserva', BRANCO, c1, 'liso', BRANCO);
  return [titular, reserva];
}
/** Cores que aparecem de longe (listras, aros e meio a meio mostram as duas). */
const vistas = (k: Kit) => (k.p === 'listras' || k.p === 'aros' || k.p === 'metade' ? [k.s, k.t] : [k.s]);
/** Distância entre dois uniformes: a menor entre as cores que aparecem de longe. */
export function kitDistancia(a: Kit, b: Kit): number {
  let m = Infinity;
  for (const x of vistas(a)) for (const y of vistas(b)) m = Math.min(m, colorDist(x, y));
  return m;
}
const reservas = (): Kit[] => RESERVAS.map(([s, t], i) => K(`Extra ${i + 1}`, s, t, 'liso', s));

export interface LadoKit { club?: string; c1: string; c2: string }
/**
 * Uniformes da partida: quem joga em casa (ou você, em campo neutro ou se escolheu um uniforme) fica com o seu;
 * o outro veste o primeiro uniforme que não se confunde, ou o mais contrastante.
 */
export function kitsDaPartida(A: LadoKit, B: LadoKit, home: 0 | 1 | null, escolhaA?: number): { a: Kit; b: Kit } {
  const kA = kitsDoClube(A.club, A.c1, A.c2), kB = kitsDoClube(B.club, B.c1, B.c2);
  const ajusta = (fixo: Kit, op: Kit[]) => op.find(k => kitDistancia(fixo, k) >= LIMITE) ?? [...op, ...reservas()].reduce((best, k) => (kitDistancia(fixo, k) > kitDistancia(fixo, best) ? k : best));
  if (escolhaA !== undefined && kA[escolhaA]) { const a = kA[escolhaA]; return { a, b: ajusta(a, kB) }; }
  if (home === 1) { const b = kB[0]; return { a: ajusta(b, kA), b }; }
  const a = kA[0];
  return { a, b: ajusta(a, kB) };
}

/** Uniforme vestido pelo lado (calculado no início da partida; se faltar, o titular do clube). */
export const kitDe = (S: LadoKit & { kit?: Kit }): Kit => S.kit ?? kitsDoClube(S.club, S.c1, S.c2)[0];
const GOLEIROS: Kit[] = [K('Goleiro', '#c6f432', '#111111', 'liso', '#111111'), K('Goleiro', '#ff7a1a', '#111111', 'liso', '#111111'), K('Goleiro', '#7b2cbf', '#f4f4f4', 'liso', '#7b2cbf'), K('Goleiro', '#19c3d6', '#0b2230', 'liso', '#0b2230'), K('Goleiro', '#ff3d8b', '#111111', 'liso', '#111111')];
/** Goleiro com cor bem diferente dos dois times (`i` = qual dos dois goleiros, para não se repetirem). */
export function goleiroKit(a: Kit, b: Kit, i = 0): Kit {
  const r = [...GOLEIROS].sort((x, y) => Math.min(kitDistancia(y, a), kitDistancia(y, b)) - Math.min(kitDistancia(x, a), kitDistancia(x, b)));
  return r[i] ?? r[0];
}

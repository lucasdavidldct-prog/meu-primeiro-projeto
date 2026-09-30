// Clima da partida: muda o visual do lance e tem um efeito pequeno no jogo (bola molhada escorrega, neve pesa).
export type Clima = 'dia' | 'sol' | 'noite' | 'chuva' | 'neve';
export const CLIMAS: Clima[] = ['dia', 'sol', 'noite', 'chuva', 'neve'];
export const CLIMA_N: Record<Clima, string> = { dia: 'Dia nublado', sol: 'Sol forte', noite: 'Noite', chuva: 'Chuva', neve: 'Neve' };
export const CLIMA_I: Record<Clima, string> = { dia: '⛅', sol: '☀️', noite: '🌙', chuva: '🌧️', neve: '❄️' };

/** Ligas onde neva de vez em quando (no Brasil e nos países quentes, nunca). */
const NEVA = new Set(['bundesliga', 'premier-league', 'mls', 'serie-a']);

/** Sorteia o clima de um jogo (`r` = número entre 0 e 1). */
export function sortearClima(r: number, liga?: string): Clima {
  const neve = liga && NEVA.has(liga) ? .06 : 0;
  if (r < neve) return 'neve';
  const x = (r - neve) / (1 - neve);
  return x < .42 ? 'noite' : x < .7 ? 'dia' : x < .86 ? 'sol' : 'chuva';
}

/** Efeitos no lance: passe (acerto), chute (precisão) e goleiro (defesa). */
export function climaFx(c: Clima | undefined): { passe: number; chute: number; goleiro: number; texto: string } {
  switch (c) {
    case 'chuva': return { passe: .96, chute: .97, goleiro: .93, texto: 'Chuva: a bola escorrega — passe um pouco mais difícil, e o goleiro também sofre.' };
    case 'neve': return { passe: .93, chute: .95, goleiro: .97, texto: 'Neve: a bola fica pesada — passes e chutes mais difíceis.' };
    case 'sol': return { passe: 1, chute: .99, goleiro: .98, texto: 'Sol forte: o goleiro pode se atrapalhar com a luz.' };
    default: return { passe: 1, chute: 1, goleiro: 1, texto: '' };
  }
}

/** Desenho do corte do gramado. */
export type Gramado = 'faixas' | 'xadrez' | 'circulos' | 'diagonal' | 'liso';
export const GRAMADOS: Gramado[] = ['faixas', 'xadrez', 'circulos', 'diagonal', 'liso'];
export const GRAMADO_N: Record<Gramado, string> = { faixas: 'Faixas', xadrez: 'Xadrez', circulos: 'Círculos', diagonal: 'Diagonal', liso: 'Liso' };

/** Cenário do lance em 3D: clima, gramado, cores da casa (arquibancada e torcida) e se é a Arena MRV. */
export interface Ambiente { clima: Clima; gramado: Gramado; casa?: { c1: string; c2: string }; mrv?: boolean }

interface LadoAmb { club?: string; c1: string; c2: string; kit?: { s: string; t: string } }
/**
 * Cenário da partida: o estádio é do mandante (em amistoso e treino, o seu); o Galo em casa joga na Arena MRV.
 * Arquibancada e torcida usam as cores do uniforme de quem é da casa.
 */
export function ambienteDaPartida(M: { clima?: Clima; home: 0 | 1 | null; A: LadoAmb; B: LadoAmb }, gramado: Gramado = 'faixas'): Ambiente {
  const casa = M.home === 1 ? M.B : M.A;
  return { clima: M.clima ?? 'noite', gramado, casa: { c1: casa.kit?.s ?? casa.c1, c2: casa.kit?.t ?? casa.c2 }, mrv: casa.club === 'CAM' };
}

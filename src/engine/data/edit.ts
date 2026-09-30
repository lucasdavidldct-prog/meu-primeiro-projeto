// Operações puras sobre os dados das ligas, usadas pelo Editor de elencos.
import { slug, type ClubeData, type JogadorData, type LigaData } from './schema';

export interface Loc { liga: LigaData; clube: ClubeData; idx: number }

export function findPlayer(ligas: LigaData[], id: string): Loc | null {
  for (const liga of ligas) for (const clube of liga.clubes) {
    const idx = clube.elenco.findIndex(j => j.id === id);
    if (idx >= 0) return { liga, clube, idx };
  }
  return null;
}

export function findClub(ligas: LigaData[], sigla: string): { liga: LigaData; clube: ClubeData } | null {
  for (const liga of ligas) { const clube = liga.clubes.find(c => c.id === sigla); if (clube) return { liga, clube }; }
  return null;
}

export function newPlayerId(ligas: LigaData[], sigla: string, curto: string): string {
  const ids = new Set(ligas.flatMap(l => l.clubes.flatMap(c => c.elenco.map(j => j.id))));
  const base = slug(`${sigla}-${curto}`) || slug(sigla) + '-jogador';
  let id = base, n = 2;
  while (ids.has(id)) id = `${base}-${n++}`;
  return id;
}

/** Move o jogador para outro clube (pode ser de outra liga). Retorna as ligas alteradas. */
export function transferPlayer(ligas: LigaData[], id: string, destSigla: string): LigaData[] {
  const from = findPlayer(ligas, id), to = findClub(ligas, destSigla);
  if (!from || !to || from.clube === to.clube) return [];
  const [j] = from.clube.elenco.splice(from.idx, 1);
  to.clube.elenco.push(j);
  return from.liga === to.liga ? [from.liga] : [from.liga, to.liga];
}

export function blankPlayer(id: string): JogadorData {
  return {
    id, nome: '', nomeCurto: '', nacionalidade: 'BRA', idade: 24, posicao: 'MC', posicoesAlt: [], pe: 'D', overall: 70,
    atributos: { RIT: 70, FIN: 62, PAS: 72, DRI: 70, DEF: 60, FIS: 68 }, playstyles: [],
  };
}

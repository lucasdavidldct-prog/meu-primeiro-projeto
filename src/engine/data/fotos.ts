// Escolha da foto de um jogador entre os resultados do Wikidata (fotos livres da Wikimedia Commons).
// Função pura: o script de busca (scripts/buscar-fotos.ts) faz as requisições e usa esta regra.

/** Ocupação "jogador de futebol" no Wikidata. */
export const FUTEBOLISTA = 'Q937857';

export interface Candidato {
  q: string;
  /** Ocupações (P106). */
  ocupacoes: string[];
  /** Ano de nascimento (P569), se houver. */
  nascimento?: number;
  /** Arquivo da foto na Commons (P18), se houver. */
  imagem?: string;
}

export interface Alvo { idade: number; lenda?: boolean }

/** Entrada de data/fotos.json: arquivo na Commons e item do Wikidata (para conferência), ou null = procurado e não achado. */
export type FotoRef = { f: string; q: string } | null;

/** Primeiro candidato que é jogador de futebol, tem foto e nasceu no ano esperado (±2; lendas: antes de 1995). */
export function escolherFoto(cands: Candidato[], alvo: Alvo, ano: number): FotoRef {
  const nasc = ano - alvo.idade;
  for (const c of cands) {
    if (!c.imagem || !c.ocupacoes.includes(FUTEBOLISTA)) continue;
    if (alvo.lenda) { if (c.nascimento && c.nascimento > 1995) continue; }
    else if (!c.nascimento || Math.abs(c.nascimento - nasc) > 2) continue;
    return { f: c.imagem, q: c.q };
  }
  return null;
}

/** Nomes a tentar na busca, do mais específico ao mais curto (sem repetir). */
export function nomesDeBusca(nome: string, curto: string): string[] {
  const w = nome.split(/\s+/).filter(Boolean);
  const out = [nome];
  if (w.length > 2) out.push(`${w[0]} ${w[w.length - 1]}`);
  if (curto.includes(' ') || curto.length > 5) out.push(curto);
  return [...new Set(out)];
}

/** URL da miniatura na Commons (o redirecionamento leva ao arquivo em upload.wikimedia.org). */
export const urlFoto = (arquivo: string, largura = 240): string =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(arquivo.replace(/ /g, '_'))}?width=${largura}`;
export const paginaFoto = (arquivo: string): string =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(arquivo.replace(/ /g, '_'))}`;

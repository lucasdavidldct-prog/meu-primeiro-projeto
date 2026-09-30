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

/** URL da miniatura via redirecionamento (plano B se a URL direta falhar). */
export const urlFoto = (arquivo: string, largura = 330): string =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(arquivo.replace(/ /g, '_'))}?width=${largura}`;

/**
 * URL direta da miniatura em upload.wikimedia.org (sem redirecionamento; tamanhos padrão da Wikimedia: 250, 330, 500...).
 * O caminho usa o MD5 do nome do arquivo: /thumb/a/ab/Nome.jpg/330px-Nome.jpg
 */
export function urlFotoDireta(arquivo: string, largura = 330): string {
  const nome = arquivo.replace(/ /g, '_'), h = md5(nome), enc = encodeURIComponent(nome);
  const ext = nome.split('.').pop()!.toLowerCase();
  const thumb = ext === 'svg' ? `${largura}px-${enc}.png` : ext === 'tif' || ext === 'tiff' ? `lossy-page1-${largura}px-${enc}.jpg` : `${largura}px-${enc}`;
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${h[0]}/${h.slice(0, 2)}/${enc}/${thumb}`;
}

/** MD5 (UTF-8) compacto, suficiente para montar o caminho das imagens da Wikimedia. */
export function md5(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const n = ((bytes.length + 8) >> 6) + 1, w = new Uint32Array(n * 16);
  bytes.forEach((b, i) => { w[i >> 2] |= b << ((i % 4) * 8); });
  w[bytes.length >> 2] |= 0x80 << ((bytes.length % 4) * 8);
  w[n * 16 - 2] = bytes.length * 8;
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let o = 0; o < w.length; o += 16) {
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      const r = i >> 4;
      let f: number, g: number;
      if (r === 0) { f = (b & c) | (~b & d); g = i; }
      else if (r === 1) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (r === 2) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const t = d; d = c; c = b;
      const x = (a + f + K[i] + w[o + g]) >>> 0, s = S[r * 4 + (i % 4)];
      b = (b + ((x << s) | (x >>> (32 - s)))) >>> 0; a = t;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  return [a0, b0, c0, d0].map(v => Array.from({ length: 4 }, (_, i) => ((v >>> (i * 8)) & 255).toString(16).padStart(2, '0')).join('')).join('');
}
export const paginaFoto = (arquivo: string): string =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(arquivo.replace(/ /g, '_'))}`;

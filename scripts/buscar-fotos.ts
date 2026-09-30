// Busca fotos livres (Wikimedia Commons) dos jogadores pelo Wikidata e grava data/fotos.json.
// Uso: npm run fotos   (precisa de internet; só procura quem ainda não está no arquivo)
//      npm run fotos -- --refazer   (procura de novo quem ficou sem foto)
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { escolherFoto, nomesDeBusca, type Candidato, type FotoRef } from '../src/engine/data/fotos';

const API = 'https://www.wikidata.org/w/api.php';
const UA = 'EsquadraoFC/1.0 (jogo pessoal; https://github.com/lucasdavidldct-prog/meu-primeiro-projeto)';
const ARQ = 'data/fotos.json';
const ANO = new Date().getFullYear();
const refazer = process.argv.includes('--refazer');

interface Jog { id: string; nome: string; nomeCurto: string; idade: number; lenda?: boolean }

function jogadores(): Jog[] {
  const out: Jog[] = [];
  for (const f of readdirSync('data/ligas').filter(f => f.endsWith('.json'))) {
    const L = JSON.parse(readFileSync(join('data/ligas', f), 'utf8')) as { clubes: { elenco?: Jog[] }[] };
    for (const c of L.clubes) for (const j of c.elenco ?? []) out.push(j);
  }
  const { lendas } = JSON.parse(readFileSync('data/lendas.json', 'utf8')) as { lendas: Jog[] };
  for (const j of lendas) out.push({ ...j, lenda: true });
  return out;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function api(params: Record<string, string>): Promise<any> {
  const url = API + '?' + new URLSearchParams({ format: 'json', ...params });
  for (let t = 0; t < 5; t++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 429 || r.status >= 500) { await sleep(2000 * (t + 1)); continue; }
      return await r.json();
    } catch { await sleep(1500 * (t + 1)); }
  }
  throw new Error('Wikidata não respondeu: ' + url);
}

async function candidatos(busca: string): Promise<Candidato[]> {
  const s = await api({ action: 'wbsearchentities', search: busca, language: 'pt', uselang: 'pt', type: 'item', limit: '7' });
  const ids: string[] = (s.search ?? []).map((x: { id: string }) => x.id);
  if (!ids.length) return [];
  const e = await api({ action: 'wbgetentities', ids: ids.join('|'), props: 'claims' });
  return ids.map(q => {
    const cl = e.entities?.[q]?.claims ?? {};
    const vals = (p: string) => (cl[p] ?? []).map((c: any) => c.mainsnak?.datavalue?.value).filter(Boolean);
    const t = vals('P569')[0]?.time as string | undefined;
    return { q, ocupacoes: vals('P106').map((v: any) => v.id), nascimento: t ? parseInt(t.slice(1, 5), 10) : undefined, imagem: vals('P18')[0] as string | undefined };
  });
}

async function main(): Promise<void> {
  const fotos: Record<string, FotoRef> = existsSync(ARQ) ? JSON.parse(readFileSync(ARQ, 'utf8')) : {};
  const todos = jogadores();
  const fila = todos.filter(j => !(j.id in fotos) || (refazer && fotos[j.id] === null));
  console.log(`${todos.length} jogadores, ${fila.length} para procurar.`);
  let feitos = 0, achados = 0, falhas = 0;
  const trabalhador = async () => {
    for (let j = fila.shift(); j; j = fila.shift()) {
      try {
        let ref: FotoRef = null;
        for (const b of nomesDeBusca(j.nome, j.nomeCurto)) {
          ref = escolherFoto(await candidatos(b), { idade: j.idade, lenda: j.lenda }, ANO);
          if (ref) break;
        }
        fotos[j.id] = ref;
        if (ref) achados++;
      } catch (e) { falhas++; console.warn(j.id, (e as Error).message); }
      if (++feitos % 100 === 0) { console.log(`${feitos} procurados, ${achados} fotos`); salvar(fotos); }
    }
  };
  await Promise.all([1, 2, 3, 4].map(trabalhador));
  salvar(fotos);
  const total = Object.values(fotos).filter(Boolean).length;
  console.log(`Pronto: ${achados} fotos novas (${total} no total), ${falhas} falhas de rede.`);
}

function salvar(f: Record<string, FotoRef>): void {
  const ks = Object.keys(f).sort();
  writeFileSync(ARQ, '{\n' + ks.map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(f[k])}`).join(',\n') + '\n}\n');
}

void main();

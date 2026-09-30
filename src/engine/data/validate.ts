// Regras de consistência dos dados. Retorna erros (bloqueiam) e avisos (só alertam).
import { POSS, PROFILE } from '../positions';
import type { Pos } from '../types';
import {
  ATR_GOL, ATR_LINHA, CLUBES_ESPERADOS, MAX_PLAYSTYLES, PLUS_MIN_OVR, PS_BY_ID, parsePs,
  type ClubeData, type JogadorData, type LendasData, type LigaData, type NacoesData,
} from './schema';

export interface Relatorio { erros: string[]; avisos: string[] }

const HEX = /^#[0-9a-fA-F]{6}$/;
const SIGLA = /^[A-Z0-9]{2,4}$/;

/** Overall estimado a partir dos atributos, com o peso da posição. */
export function ovrFromAtributos(j: Pick<JogadorData, 'posicao' | 'atributos'>): number {
  const keys = j.posicao === 'GOL' ? ATR_GOL : ATR_LINHA;
  const w = PROFILE[j.posicao].map(x => Math.max(0, x - .4));
  let s = 0, t = 0;
  keys.forEach((k, i) => { s += (j.atributos[k] ?? 0) * w[i]; t += w[i]; });
  return t ? s / t : 0;
}

export function validarJogador(j: JogadorData, onde: string, nacoes: NacoesData, r: Relatorio): void {
  const E = (m: string) => r.erros.push(`${onde}: ${m}`), A = (m: string) => r.avisos.push(`${onde}: ${m}`);
  if (!j.id || typeof j.id !== 'string') E('jogador sem id');
  if (!j.nome?.trim()) E('sem nome');
  if (!j.nomeCurto?.trim()) E('sem nome curto');
  else if (j.nomeCurto.length > 16) A(`nome curto longo demais para a carta ("${j.nomeCurto}")`);
  if (!nacoes[j.nacionalidade]) E(`nacionalidade desconhecida "${j.nacionalidade}" (adicione em data/nacoes.json)`);
  if (!Number.isInteger(j.idade) || j.idade < 15 || j.idade > 45) E(`idade inválida (${j.idade})`);
  if (!POSS.includes(j.posicao)) E(`posição inválida "${j.posicao}"`);
  if (!Array.isArray(j.posicoesAlt)) E('posicoesAlt deve ser uma lista');
  else {
    for (const p of j.posicoesAlt) if (!POSS.includes(p as Pos)) E(`posição alternativa inválida "${p}"`);
    if (j.posicoesAlt.includes(j.posicao)) E('posição principal repetida nas alternativas');
    if (new Set(j.posicoesAlt).size !== j.posicoesAlt.length) E('posições alternativas repetidas');
    if (j.posicao === 'GOL' && j.posicoesAlt.length) E('goleiro não pode ter posição alternativa');
    if (j.posicao !== 'GOL' && j.posicoesAlt.includes('GOL')) E('jogador de linha com GOL como alternativa');
  }
  if (!['D', 'E', 'A'].includes(j.pe)) E(`pé bom inválido "${j.pe}" (use D, E ou A)`);
  if (!Number.isInteger(j.overall) || j.overall < 40 || j.overall > 99) E(`overall inválido (${j.overall})`);
  const keys: readonly string[] = j.posicao === 'GOL' ? ATR_GOL : ATR_LINHA;
  const got = Object.keys(j.atributos || {});
  if (got.length !== 6 || !keys.every(k => got.includes(k))) E(`atributos devem ser ${keys.join(', ')}`);
  else {
    for (const k of keys) { const v = j.atributos[k]; if (!Number.isInteger(v) || v < 1 || v > 99) E(`atributo ${k} inválido (${v})`); }
    const est = ovrFromAtributos(j);
    if (Math.abs(est - j.overall) > 10) A(`overall ${j.overall} distante dos atributos (≈${Math.round(est)})`);
  }
  if (!Array.isArray(j.playstyles)) E('playstyles deve ser uma lista');
  else {
    if (j.playstyles.length > MAX_PLAYSTYLES) E(`mais de ${MAX_PLAYSTYLES} playstyles`);
    const seen = new Set<string>();
    for (const s of j.playstyles) {
      const { id, plus } = parsePs(s), def = PS_BY_ID.get(id);
      if (!def) { E(`playstyle desconhecido "${s}"`); continue; }
      if (seen.has(id)) E(`playstyle repetido "${id}"`);
      seen.add(id);
      if (def.gol !== (j.posicao === 'GOL')) E(`playstyle "${def.nome}" não combina com a posição ${j.posicao}`);
      if (plus && j.overall < PLUS_MIN_OVR) E(`"${def.nome}+" exige overall ${PLUS_MIN_OVR} ou mais`);
    }
  }
}

function validarClube(c: ClubeData, liga: string, nacoes: NacoesData, r: Relatorio): void {
  const onde = `${liga}/${c.sigla || c.id || '?'}`;
  const E = (m: string) => r.erros.push(`${onde}: ${m}`), A = (m: string) => r.avisos.push(`${onde}: ${m}`);
  if (!c.nome?.trim()) E('clube sem nome');
  if (!SIGLA.test(c.sigla || '')) E(`sigla inválida "${c.sigla}" (2 a 4 letras maiúsculas)`);
  if (c.id !== c.sigla) E(`id do clube (${c.id}) deve ser igual à sigla (${c.sigla})`);
  if (!c.cidade?.trim()) E('clube sem cidade');
  if (!Array.isArray(c.cores) || c.cores.length !== 2 || !c.cores.every(x => HEX.test(x))) E('cores devem ser duas cores #rrggbb');
  if (c.forca != null && (!Number.isInteger(c.forca) || c.forca < 40 || c.forca > 95)) E(`forca inválida (${c.forca})`);
  const el = c.elenco || [];
  if (el.length < 11) A(`elenco incompleto: ${el.length} jogadores — o jogo completa com reservas genéricos`);
  else if (el.length < 22) A(`elenco curto: ${el.length} jogadores (o ideal é ~25)`);
  else if (el.length > 40) A(`elenco grande: ${el.length} jogadores`);
  const gks = el.filter(j => j.posicao === 'GOL').length;
  if (gks < 2) A(`só ${gks} goleiro(s)`);
  for (const [grp, ps] of [['defensores', ['ZAG', 'LD', 'LE']], ['meio-campistas', ['VOL', 'MC', 'MEI', 'MD', 'ME']], ['atacantes', ['ATA', 'PD', 'PE']]] as const) {
    const n = el.filter(j => (ps as readonly string[]).includes(j.posicao)).length;
    if (n < 3) A(`poucos ${grp} (${n})`);
  }
  el.forEach((j, i) => validarJogador(j, `${onde}/${j.nomeCurto || '#' + i}`, nacoes, r));
}

export interface Dados { ligas: LigaData[]; lendas: LendasData; nacoes: NacoesData }

export function validarDados(d: Dados, opts: { arquivos?: Record<string, string> } = {}): Relatorio {
  const r: Relatorio = { erros: [], avisos: [] };
  for (const [code, n] of Object.entries(d.nacoes)) {
    if (!n.nome || !Array.isArray(n.cores) || n.cores.length !== 3 || !n.cores.every(x => HEX.test(x))) r.erros.push(`nacoes/${code}: precisa de nome e 3 cores #rrggbb`);
  }
  const clubIds = new Map<string, string>(), playerIds = new Map<string, string>();
  for (const l of d.ligas) {
    const file = opts.arquivos?.[l.id];
    if (file && file !== l.id) r.erros.push(`${file}.json: id da liga "${l.id}" diferente do nome do arquivo`);
    if (!l.nome || !l.temporada) r.erros.push(`${l.id}: faltam nome ou temporada`);
    const exp = CLUBES_ESPERADOS[l.id];
    if (exp && l.clubes.length !== exp) r.avisos.push(`${l.id}: ${l.clubes.length} clubes (esperado ${exp})`);
    for (const c of l.clubes) {
      if (clubIds.has(c.id)) r.erros.push(`${l.id}/${c.id}: sigla repetida (também em ${clubIds.get(c.id)})`);
      clubIds.set(c.id, l.id);
      validarClube(c, l.id, d.nacoes, r);
      for (const j of c.elenco || []) {
        if (playerIds.has(j.id)) r.erros.push(`${l.id}/${c.id}/${j.nomeCurto}: id "${j.id}" repetido (também em ${playerIds.get(j.id)})`);
        playerIds.set(j.id, `${l.id}/${c.id}`);
      }
    }
  }
  // Exigências do projeto
  const find = (liga: string, pred: (j: JogadorData) => boolean) =>
    d.ligas.find(l => l.id === liga)?.clubes.find(c => c.elenco.some(pred));
  if (!find('saudi-pro-league', j => j.nome.includes('Cristiano Ronaldo'))) r.erros.push('saudi-pro-league: Cristiano Ronaldo precisa estar em algum clube');
  if (!find('mls', j => j.nome.includes('Lionel') && j.nome.includes('Messi'))) r.erros.push('mls: Lionel Messi precisa estar em algum clube');
  const galo = d.ligas.find(l => l.id === 'brasileirao')?.clubes.find(c => c.id === 'CAM');
  if (!galo) r.erros.push('brasileirao: Atlético Mineiro (CAM) não encontrado');
  else if (galo.elenco.length < 25) r.avisos.push(`brasileirao/CAM: o Galo tem só ${galo.elenco.length} jogadores`);
  // Lendas
  const lids = new Set<string>();
  for (const j of d.lendas.lendas) {
    const onde = `lendas/${j.nomeCurto}`;
    if (lids.has(j.id) || playerIds.has(j.id)) r.erros.push(`${onde}: id "${j.id}" repetido`);
    lids.add(j.id);
    if (!j.clubeHistorico) r.erros.push(`${onde}: falta clubeHistorico`);
    if (j.clube && !clubIds.has(j.clube)) r.erros.push(`${onde}: clube "${j.clube}" não existe`);
    validarJogador(j, onde, d.nacoes, r);
  }
  return r;
}

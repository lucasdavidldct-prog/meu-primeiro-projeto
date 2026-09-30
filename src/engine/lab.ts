// Laboratório de estilos de jogo (modo desenvolvedor): um time neutro de teste (todos 80, sem playstyles)
// e um único jogador com o estilo escolhido em sem / prata / +, para sentir no lance e medir na simulação.
import { FX, type PsId } from './playstyles';
import { funcOf, orderFx, suggestOrder } from './orders';
import { slotsOf } from './positions';
import { resetRng, seedRng } from './rng';
import { Match, simulate, type Side, type SideEntry, type MomentKind } from './match';
import type { BasePlayer, Pos } from './types';

export type Lvl = 0 | 1 | 2;
export const LVL_N = ['Sem', 'Prata', '+ Dourado'] as const;

/** Como mostrar os valores de um efeito: % do normal, pontos a mais, probabilidade, metros. */
type Fmt = 'mult' | 'add' | 'prob' | 'm';
export interface Efeito { n: string; v: readonly number[]; fmt: Fmt; bom: 'maior' | 'menor'; onde: 'lance' | 'sim' }
export interface LabInfo {
  /** Quem carrega o estilo no teste: seu jogador (ataque), a defesa rival ou o goleiro. */
  lado: 'ataque' | 'defesa' | 'goleiro';
  pos: Pos;
  /** Lances jogáveis em que o estilo age ('goleiro' = o lance de defender o chute). */
  lances: MomentKind[];
  dica: string;
  efeitos: Efeito[];
}

const L = (n: string, v: readonly number[], fmt: Fmt, bom: 'maior' | 'menor'): Efeito => ({ n, v, fmt, bom, onde: 'lance' });
const S = (n: string, v: readonly number[], fmt: Fmt, bom: 'maior' | 'menor'): Efeito => ({ n, v, fmt, bom, onde: 'sim' });

export const LAB: Record<string, LabInfo> = {
  // Finalização
  'finalizacao-precisa': { lado: 'ataque', pos: 'ATA', lances: ['ataque', 'penalti'], dica: 'Chute de qualquer jeito: ele erra menos o alvo.',
    efeitos: [L('Chance de errar o alvo', FX.chuteErro, 'mult', 'menor'), S('Chance de gol nas finalizações', FX.finalizacao, 'mult', 'maior'), S('Conversão de pênalti', FX.penaltiBatedor, 'add', 'maior')] },
  'chute-colocado': { lado: 'ataque', pos: 'ATA', lances: ['ataque'], dica: 'Faça o traço do chute CURVO (chute colocado no canto).',
    efeitos: [L('Erro no chute com curva', FX.colocadoErro, 'mult', 'menor'), L('Defesa do goleiro no chute com curva', FX.colocadoDefesa, 'mult', 'menor'), S('Gols nas finalizações', FX.colocadoSim, 'mult', 'maior')] },
  'chute-de-longe': { lado: 'ataque', pos: 'MEI', lances: ['ataque'], dica: 'Chute de FORA da área com traço RÁPIDO (super chute).',
    efeitos: [L('Penalidade pela distância', FX.chuteDistancia, 'mult', 'menor'), L('Defesa do goleiro no chute forte', FX.superChuteDefesa, 'mult', 'menor'), L('Força máxima sem isolar a bola', FX.superChuteLimite, 'prob', 'maior'), S('Gols de fora da área', FX.chuteLonge, 'mult', 'maior')] },
  'chute-rasteiro': { lado: 'ataque', pos: 'ATA', lances: ['ataque'], dica: 'Escolha o chute RASTEIRO no seletor (ou traço rápido e baixo) de dentro ou da entrada da área.',
    efeitos: [L('Defesa do goleiro no chute rasteiro', FX.rasteiroDefesa, 'mult', 'menor'), L('Chance de o marcador travar', FX.rasteiroBloqueio, 'mult', 'menor')] },
  'cavadinha': { lado: 'ataque', pos: 'ATA', lances: ['ataque'], dica: 'Perto do gol, faça um traço CURTO e LENTO: vira cavadinha.',
    efeitos: [L('Erro na cavadinha (soma)', FX.cavadinhaErro, 'prob', 'menor'), L('Defesa do goleiro na cavadinha', FX.cavadinhaDefesa, 'mult', 'menor'), S('Gols nas finalizações', FX.cavadinhaSim, 'mult', 'maior')] },
  'cobranca-de-falta': { lado: 'ataque', pos: 'MEI', lances: ['falta', 'ataque'], dica: 'Na falta, curve o traço por cima/ao lado da barreira.',
    efeitos: [L('Alcance da curva', FX.curva, 'mult', 'maior'), L('Dispersão da cobrança', FX.faltaDispersao, 'm', 'menor'), S('Gol de falta direta', FX.falta, 'prob', 'maior'), S('Conversão de pênalti', FX.penaltiBatedor, 'add', 'maior')] },
  'cabeceio': { lado: 'ataque', pos: 'ATA', lances: ['ataque'], dica: 'Cruze com 2 toques (passe alto) para ele dentro da área e finalize de primeira.',
    efeitos: [L('Defesa do goleiro na cabeçada', FX.cabecaDefesa, 'mult', 'menor'), S('Chance de gol de cabeça', FX.cabeceio, 'mult', 'maior')] },
  // Passe
  'passe-preciso': { lado: 'ataque', pos: 'MC', lances: ['ataque'], dica: 'Toque em companheiros marcados: o passe passa mais.',
    efeitos: [L('Raio de interceptação do passe', FX.passeRaio, 'mult', 'menor'), S('Força do meio-campo (posse)', FX.passe, 'add', 'maior')] },
  'passe-tenso': { lado: 'ataque', pos: 'MC', lances: ['ataque'], dica: 'Passe rasteiro (1 toque) entre marcadores.',
    efeitos: [L('Raio de interceptação do passe rasteiro', FX.passeTenso, 'mult', 'menor')] },
  'passe-em-profundidade': { lado: 'ataque', pos: 'MEI', lances: ['ataque'], dica: 'Passes longos e lançamentos no espaço.',
    efeitos: [L('Penalidade do passe longo', FX.passeLongo, 'mult', 'menor'), S('Peso nas assistências', FX.profundidade, 'mult', 'maior'), S('Força do meio-campo (posse)', FX.passe, 'add', 'maior')] },
  'lancamento': { lado: 'ataque', pos: 'MC', lances: ['ataque'], dica: 'Passe alto longo (2 toques) para o outro lado.',
    efeitos: [L('Penalidade de distância no passe alto', FX.lancamento, 'mult', 'menor')] },
  'tiki-taka': { lado: 'ataque', pos: 'MC', lances: ['ataque'], dica: 'Toques curtos (até 15 m), mesmo com marcador perto.',
    efeitos: [L('Chance mínima do passe curto', FX.tikiTaka, 'prob', 'maior')] },
  'cruzamento': { lado: 'ataque', pos: 'PD', lances: ['ataque'], dica: 'Vá até a ponta e cruze com passe alto (2 toques).',
    efeitos: [L('Acerto do cruzamento da ponta', [1, 1.12, 1.22], 'mult', 'maior'), S('Peso nas assistências de cabeça', FX.cruzamento, 'mult', 'maior')] },
  // Controle
  'primeiro-toque': { lado: 'ataque', pos: 'MEI', lances: ['ataque'], dica: 'Conduza perto dos marcadores.',
    efeitos: [L('Chance de perder a bola no drible', [1, .93, .93], 'mult', 'menor')] },
  'drible-rapido': { lado: 'ataque', pos: 'PE', lances: ['ataque'], dica: 'Conduza a bola passando pelos marcadores.',
    efeitos: [L('Chance do marcador tomar a bola', FX.dribleMarcador, 'mult', 'menor')] },
  'firula': { lado: 'ataque', pos: 'PE', lances: ['ataque'], dica: 'Conduza a bola passando pelos marcadores.',
    efeitos: [L('Chance de perder a bola no drible', FX.firula, 'mult', 'menor')] },
  'tecnico': { lado: 'ataque', pos: 'MEI', lances: ['ataque'], dica: 'Conduções longas: vai mais longe e perde menos.',
    efeitos: [L('Chance de perder a bola no drible', FX.tecnico, 'mult', 'menor'), L('Metros a mais por condução', [0, .6, .6], 'm', 'maior')] },
  'resistente-pressao': { lado: 'ataque', pos: 'MC', lances: ['ataque'], dica: 'Conduza com um marcador colado (a menos de 2 m).',
    efeitos: [L('Perda de bola com marcador colado', FX.resistente, 'mult', 'menor')] },
  'velocista': { lado: 'ataque', pos: 'PD', lances: ['ataque', 'contra'], dica: 'Conduza em velocidade: cada condução vai mais longe.',
    efeitos: [L('Metros por condução', FX.dribleAlcance, 'm', 'maior'), S('Criação no contra-ataque', FX.velocista, 'add', 'maior')] },
  // Defesa (a defesa RIVAL carrega o estilo: tente atacar contra ela)
  'desarme': { lado: 'defesa', pos: 'ZAG', lances: ['ataque'], dica: 'Os marcadores rivais têm o estilo: tente driblar e veja quantas bolas eles tomam.',
    efeitos: [L('Chance do marcador tomar a bola', FX.defDesarme, 'mult', 'maior'), S('Chances do rival tiradas (por defensor)', FX.desarme, 'add', 'maior')] },
  'interceptacao': { lado: 'defesa', pos: 'ZAG', lances: ['ataque'], dica: 'Os marcadores rivais têm o estilo: tente passes rasteiros entre eles.',
    efeitos: [L('Raio de interceptação dos passes', FX.defIntercepta, 'mult', 'maior'), S('Chances do rival tiradas (por defensor)', FX.intercept, 'add', 'maior')] },
  'antecipacao': { lado: 'defesa', pos: 'ZAG', lances: ['ataque'], dica: 'Os marcadores rivais têm o estilo: passe para companheiros marcados e lançamentos.',
    efeitos: [L('Alcance do marcador sobre o receptor', FX.defAntecipa, 'mult', 'maior'), S('Chances do rival tiradas (por defensor)', FX.antecipacao, 'add', 'maior')] },
  'contencao': { lado: 'defesa', pos: 'ZAG', lances: ['ataque'], dica: 'Os marcadores rivais têm o estilo: tente o drible.',
    efeitos: [L('Chance do marcador tomar a bola', FX.defContencao, 'mult', 'maior'), S('Chances do rival tiradas (por defensor)', FX.contencao, 'add', 'maior')] },
  'bloqueio': { lado: 'defesa', pos: 'ZAG', lances: ['ataque'], dica: 'Os marcadores rivais têm o estilo: chute com gente na frente.',
    efeitos: [L('Parte do chute que passa por cada marcador', FX.defBloqueio, 'prob', 'menor'), S('Chance de bloquear o chute', FX.bloqueio, 'add', 'maior')] },
  // Físico
  'imposicao-fisica': { lado: 'defesa', pos: 'ZAG', lances: ['ataque'], dica: 'Os marcadores rivais têm o estilo: cruze (passe alto) para a área.',
    efeitos: [L('Disputa pelo alto do seu receptor', FX.defFisico, 'mult', 'menor')] },
  'acrobatico': { lado: 'ataque', pos: 'ATA', lances: ['ataque'], dica: 'Cruze (passe alto) para ele e finalize de primeira (voleio).',
    efeitos: [L('Defesa do goleiro no voleio', FX.acrobaticoDefesa, 'mult', 'menor'), S('Gols de cabeça/voleio', FX.acrobaticoSim, 'mult', 'maior')] },
  'trivela': { lado: 'ataque', pos: 'PD', lances: ['ataque', 'falta'], dica: 'Chute ou bata falta com o traço bem curvo.',
    efeitos: [L('Alcance da curva', FX.trivelaCurva, 'mult', 'maior')] },
  'explosao': { lado: 'ataque', pos: 'PE', lances: ['ataque'], dica: 'Conduções curtas: arranca mais longe.',
    efeitos: [L('Metros a mais por condução', FX.explosaoAlcance, 'm', 'maior')] },
  'incansavel': { lado: 'ataque', pos: 'MC', lances: [], dica: 'Só na simulação: cansa menos no segundo tempo.',
    efeitos: [S('Cansaço', FX.incansavel, 'mult', 'menor')] },
  // Goleiro (no lance de ataque, o goleiro RIVAL carrega o estilo; no lance de goleiro, o seu)
  'reflexos': { lado: 'goleiro', pos: 'GOL', lances: ['ataque', 'goleiro'], dica: 'No ataque, chute contra o goleiro rival; no lance de goleiro, você é ele.',
    efeitos: [L('Chance de defesa do goleiro', FX.defesaGoleiro, 'mult', 'maior'), S('Gols sofridos', FX.reflexos, 'mult', 'menor')] },
  'saida-do-gol': { lado: 'goleiro', pos: 'GOL', lances: [], dica: 'Só na simulação: sai bem nos cruzamentos.',
    efeitos: [S('Gols de cabeça/cruzamento sofridos', FX.saidaGol, 'mult', 'menor')] },
  'pegador-de-penalti': { lado: 'goleiro', pos: 'GOL', lances: ['penalti', 'goleiro'], dica: 'Bata um pênalti contra ele, ou defenda um pênalti sendo ele.',
    efeitos: [L('Defesa de pênalti', FX.defesaPenalti, 'mult', 'maior'), S('Conversão de pênalti do rival', FX.penaltiGol, 'add', 'menor')] },
  'reposicao-longa': { lado: 'goleiro', pos: 'GOL', lances: [], dica: 'Só na simulação: reforça a saída de bola (força do meio).',
    efeitos: [] },
};

/** Texto de um valor do efeito para a tabela. */
export function fmtEfeito(e: Efeito, i: number): string {
  const v = e.v[i], n = (x: number, d = 0) => x.toLocaleString('pt-BR', { maximumFractionDigits: d });
  if (e.fmt === 'mult') return `${n(v * 100)}%`;
  if (e.fmt === 'add') return v ? `+${n(v * 100, 1)} p.p.` : '—';
  if (e.fmt === 'prob') return `${n(v * 100, 1)}%`;
  return `${n(v, 1)} m`;
}

// ---------- Times de teste ----------
let seq = 0;
/** Jogador neutro: 80 em tudo, sem estilos. */
export function neutral(pos: Pos, name = 'Neutro'): BasePlayer {
  seq++;
  return { id: `lab-${pos}-${seq}`, name, short: name, nat: 'BRA', pos, alt: [], lg: 'lab', club: 'LAB', age: 25, ovr: 80, st: [80, 80, 80, 80, 80, 80], foot: 'D', ps: [] };
}
/** Cópia do jogador testado com só o estilo pedido (os outros estilos dele saem, para isolar o efeito). */
export function withStyle(P: BasePlayer, ps: string, lvl: Lvl): BasePlayer {
  return { ...P, ps: lvl ? [lvl === 2 ? ps + '+' : ps] : [] };
}

function entry(P: BasePlayer, pos: Pos): SideEntry {
  const od = suggestOrder(P, pos);
  return { P, pos, base: P.ovr, inMin: 0, yc: 0, red: false, name: P.short, ofx: orderFx(pos, od), fn: funcOf(pos, od).id };
}
function side(you: boolean, name: string, c1: string, c2: string, players: BasePlayer[]): Side {
  const slots = slotsOf('4-3-3');
  return { you, name, s: name[0], c1, c2, form: '4-3-3', style: 'equilibrado', ment: 0, xi: slots.map((sl, i) => entry(players[i], sl.p)), bench: [], subs: 0, goals: 0, scorers: [] };
}

export interface LabSetup { A: Side; B: Side; tested: SideEntry; lado: LabInfo['lado'] }
/**
 * Monta seu time de teste e o rival, com o jogador testado no lugar certo:
 * ataque = no seu time (na vaga mais parecida); defesa = três marcadores rivais com o estilo;
 * goleiro = o goleiro rival nos lances em que você chuta (ataque, pênalti) e o seu no lance de goleiro e na simulação.
 */
export function labSetup(ps: string, lvl: Lvl, base?: BasePlayer, lance?: MomentKind): LabSetup {
  const info = LAB[ps];
  const slots = slotsOf('4-3-3');
  const mine = slots.map(sl => neutral(sl.p, sl.p === 'GOL' ? 'Goleiro' : 'Neutro'));
  const theirs = slots.map(sl => neutral(sl.p, 'Rival'));
  const P = withStyle(base ?? neutral(info.pos, 'Testado'), ps, lvl);
  const near: Pos[] = { ATA: ['ATA', 'PD', 'PE', 'MEI'], PD: ['PD', 'PE', 'ATA'], PE: ['PE', 'PD', 'ATA'], MEI: ['MC', 'ATA'], MC: ['MC'], VOL: ['MC'], ZAG: ['ZAG'], LD: ['LD', 'ZAG'], LE: ['LE', 'ZAG'], MD: ['PD', 'MC'], ME: ['PE', 'MC'], GOL: ['GOL'] }[P.pos === 'GOL' ? 'GOL' : info.lado === 'ataque' ? P.pos : info.pos] as Pos[];
  let idx = -1;
  for (const p of near) { idx = slots.findIndex(s => s.p === p); if (idx >= 0) break; }
  if (idx < 0) idx = slots.findIndex(s => s.p !== 'GOL');
  if (info.lado === 'ataque') mine[idx] = P;
  else if (info.lado === 'goleiro') {
    const g = slots.findIndex(s => s.p === 'GOL');
    if (lance && lance !== 'goleiro') theirs[g] = { ...P, short: P.short + ' (rival)' }; else mine[g] = P;
  }
  else {
    // Três marcadores rivais com o estilo (zagueiros primeiro, depois laterais)
    const order = ['ZAG', 'LD', 'LE', 'MC'];
    const ids = slots.map((s, i) => [order.indexOf(s.p), i]).filter(([o]) => o >= 0).sort((a, b) => a[0] - b[0]).slice(0, 3).map(([, i]) => i);
    ids.forEach((i, k) => { theirs[i] = k === 0 ? { ...P, pos: slots[i].p } : withStyle(neutral(slots[i].p, 'Rival'), ps, lvl); });
  }
  const A = side(true, 'Teste', '#e8c35f', '#1d1403', mine), B = side(false, 'Rival de teste', '#3a6fd8', '#ffffff', theirs);
  const gkOf = (sd: Side) => sd.xi.find(e => e.pos === 'GOL')!;
  const tested = info.lado === 'defesa' ? B.xi.find(e => e.P.id === P.id)! : info.lado === 'goleiro' ? (lance && lance !== 'goleiro' ? gkOf(B) : gkOf(A)) : A.xi[idx];
  return { A, B, tested, lado: info.lado };
}

/** Partida de teste para um lance (sem mando, goleiro sem bônus). */
export function labMatch(s: LabSetup): Match {
  const m = new Match(s.A, s.B);
  m.label = 'Laboratório';
  return m;
}

export interface LabStats { lvl: Lvl; gf: number; ga: number; sh: number; sha: number; on: number; tg: number }
/**
 * Mede o estilo na simulação: os três níveis jogam as mesmas N partidas (mesma semente),
 * então a diferença vem só do estilo. `onProgress` permite atualizar a tela entre os níveis.
 */
export async function labSim(ps: string, n: number, base?: BasePlayer, onProgress?: (lvl: Lvl) => Promise<void> | void): Promise<LabStats[]> {
  const out: LabStats[] = [];
  try {
    for (const lvl of [0, 1, 2] as Lvl[]) {
      seedRng(4242);
      const st: LabStats = { lvl, gf: 0, ga: 0, sh: 0, sha: 0, on: 0, tg: 0 };
      for (let i = 0; i < n; i++) {
        const s = labSetup(ps, lvl, base), m = await simulate(s.A, s.B);
        st.gf += m.A.goals; st.ga += m.B.goals; st.sh += m.st.sh[0]; st.sha += m.st.sh[1]; st.on += m.st.on[0];
        if (s.lado === 'ataque') st.tg += m.A.scorers.filter(x => x.startsWith(s.tested.name)).length;
      }
      for (const k of ['gf', 'ga', 'sh', 'sha', 'on', 'tg'] as const) st[k] /= n;
      out.push(st);
      await onProgress?.(lvl);
    }
  } finally { resetRng(); }
  return out;
}

export const labIds = (): PsId[] => Object.keys(LAB) as PsId[];

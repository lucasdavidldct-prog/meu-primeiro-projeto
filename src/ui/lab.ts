// Laboratório de estilos de jogo (modo desenvolvedor): escolha um estilo e um jogador, alterne entre sem / prata / +,
// jogue o lance correspondente e compare os números na simulação.
import { PLAYSTYLES, PS_CATS, type PsCat } from '../engine/data/schema';
import { LAB, LVL_N, fmtEfeito, labMatch, labSetup, labSim, type LabStats, type Lvl } from '../engine/lab';
import type { MomentKind } from '../engine/match';
import { allCards, cardByUid } from '../engine/state';
import { cardHTML } from './card';
import { app, render } from './ctx';
import { closeSheet, esc, openSheet, toast } from './dom';
import { runMoment } from './matchView';
import { psIcon } from './psIcons';

const lab = {
  ps: 'chute-colocado',
  lvl: 1 as Lvl,
  /** Carta do seu clube usada como jogador testado (null = jogador neutro 80). */
  u: null as number | null,
  sim: null as LabStats[] | null,
  simFor: '',
  running: false,
  /** Placar dos seus lances no laboratório, por estilo e nível: [tentativas, gols]. */
  tally: {} as Record<string, [number, number][]>,
};

const LANCE_N: Record<MomentKind, string> = { ataque: 'Ataque', contra: 'Contra-ataque', falta: 'Falta', penalti: 'Pênalti', goleiro: 'Lance de goleiro', escanteio: 'Escanteio', lateral: 'Lateral', defesa: 'Lance de defesa' };
const basePlayer = () => (lab.u != null ? cardByUid(app.S, lab.u) ?? undefined : undefined);

export function viewLab(): string {
  const info = LAB[lab.ps], d = PLAYSTYLES.find(p => p.id === lab.ps)!, base = basePlayer();
  const cats = Object.keys(PS_CATS) as PsCat[];
  const tally = lab.tally[lab.ps + '|' + (lab.u ?? 'n')] ?? [[0, 0], [0, 0], [0, 0]];
  const quem = info.lado === 'defesa' ? 'Três zagueiros com o estilo (do rival quando você ataca; os seus no lance de defesa)' : info.lado === 'goleiro' ? 'O goleiro' : base ? esc(base.short) : 'O jogador de teste (80 em tudo)';
  return `<div class="row" style="justify-content:space-between;align-items:center;margin-top:8px"><h2 style="margin:0">🧪 Laboratório de estilos</h2><button class="btn" data-act="labBack">Voltar</button></div>
  <p class="small muted">Todo mundo é neutro (80, sem estilos). Só quem está sendo testado recebe o estilo, no nível escolhido: jogue o lance em <b>Sem</b>, <b>Prata</b> e <b>+</b> e compare.</p>
  ${cats.map(c => { const l = PLAYSTYLES.filter(p => p.cat === c); return l.length ? `<div class="ps-cat">${PS_CATS[c]}</div><div class="chips lab-ps">${l.map(p => `<button class="chip" data-act="labPs" data-id="${p.id}" aria-pressed="${p.id === lab.ps}">${psIcon(p.id)} ${esc(p.nome)}</button>`).join('')}</div>` : ''; }).join('')}
  <div class="panel lab-box">
    <div class="row" style="gap:10px;align-items:center"><span class="lab-ic ${lab.lvl === 2 ? 'plus' : lab.lvl === 1 ? 'on' : ''}">${psIcon(lab.ps)}</span>
      <div><b>${esc(d.nome)}</b><div class="small muted">${esc(PS_CATS[d.cat])} · ${quem} com o estilo</div></div></div>
    <p class="small" style="margin:10px 0 4px"><b>Prata:</b> ${esc(d.desc)}<br><b>+:</b> ${esc(d.descPlus)}</p>
    <div class="chips" style="margin-top:8px">${([0, 1, 2] as Lvl[]).map(l => `<button class="chip lab-lvl l${l}" data-act="labLvl" data-l="${l}" aria-pressed="${l === lab.lvl}">${LVL_N[l]}</button>`).join('')}</div>
    ${info.lado === 'ataque' ? `<div class="row" style="gap:8px;margin-top:10px;align-items:center"><span class="small muted">Jogador:</span><button class="btn" data-act="labPick">${base ? esc(base.short) + ` (${base.ovr})` : 'Neutro 80'} ▾</button>${base ? '<button class="btn" data-act="labNeutral">Usar neutro</button>' : ''}</div>` : ''}
    <p class="small tip" style="margin-top:10px">💡 ${esc(info.dica)}</p>
    ${info.lances.length ? `<div class="lab-play">${info.lances.map(k => `<button class="btn pri" data-act="labPlay" data-k="${k}">Jogar: ${LANCE_N[k]} (${LVL_N[lab.lvl]})</button>`).join('')}</div>
      <div class="small muted" style="margin-top:8px">Seus lances aqui (acertos = gol no ataque; defesa no lance de goleiro e no de defesa): ${([0, 1, 2] as Lvl[]).map(l => `${LVL_N[l]} <b>${tally[l][1]}/${tally[l][0]}</b>`).join(' · ')}</div>`
      : '<p class="small muted">Esse estilo não tem lance jogável: ele age só na simulação (veja abaixo).</p>'}
  </div>
  ${info.efeitos.length ? `<h3>Efeitos do estilo</h3><div class="panel"><table class="lab-t"><tr><th></th>${LVL_N.map((n, i) => `<th class="${i === lab.lvl ? 'cur' : ''}">${n}</th>`).join('')}</tr>
    ${info.efeitos.map(e => `<tr><td>${esc(e.n)}<span class="lab-sub">${e.onde === 'lance' ? 'lance' : 'simulação'} · ${e.bom === 'maior' ? '↑' : '↓'} melhor${info.lado === 'defesa' && e.onde === 'lance' ? ' p/ defesa' : ''}</span></td>${[0, 1, 2].map(i => `<td class="${i === lab.lvl ? 'cur' : ''}">${fmtEfeito(e, i)}</td>`).join('')}</tr>`).join('')}</table></div>` : ''}
  <h3>Medir na simulação</h3>
  <div class="panel"><p class="small muted" style="margin:0 0 10px">300 partidas por nível entre os dois times de teste, com a mesma sorte nos três: a diferença vem só do estilo.</p>
    <button class="btn block" data-act="labSim" ${lab.running ? 'disabled' : ''}>${lab.running ? 'Simulando…' : 'Simular 3 × 300 partidas'}</button>
    ${lab.sim && lab.simFor === lab.ps + '|' + (lab.u ?? 'n') ? simTable(lab.sim) : ''}</div>`;
}

function simTable(r: LabStats[]): string {
  const info = LAB[lab.ps], f = (x: number) => x.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rows: [string, (s: LabStats) => number][] = [['Gols a favor / jogo', s => s.gf], ['Gols sofridos / jogo', s => s.ga], ['Finalizações / jogo', s => s.sh], ['No alvo / jogo', s => s.on], ['Finalizações do rival / jogo', s => s.sha]];
  if (info.lado === 'ataque') rows.splice(1, 0, ['Gols do jogador testado / jogo', s => s.tg]);
  return `<table class="lab-t" style="margin-top:12px"><tr><th></th>${LVL_N.map(n => `<th>${n}</th>`).join('')}</tr>
    ${rows.map(([n, g]) => `<tr><td>${n}</td>${r.map(s => `<td>${f(g(s))}</td>`).join('')}</tr>`).join('')}</table>
    <p class="small muted" style="margin:8px 0 0">${info.lado === 'defesa' ? 'Estilo de defesa: na simulação está no time rival, então o que importa é os seus gols e finalizações caírem.' : info.lado === 'goleiro' ? 'Estilo de goleiro: está no seu goleiro, então o que importa é os gols sofridos caírem.' : 'Um jogador só muda pouco o placar do time: olhe principalmente os gols e finalizações dele.'}</p>`;
}

export const labActions = {
  openLab() { app.tab = 'lab'; render(); window.scrollTo(0, 0); },
  labBack() { app.tab = 'club'; render(); window.scrollTo(0, 0); },
  labPs(d: DOMStringMap) { lab.ps = d.id!; if (LAB[lab.ps].lado !== 'ataque') lab.u = null; render(); },
  labLvl(d: DOMStringMap) { lab.lvl = +d.l! as Lvl; render(); },
  labNeutral() { lab.u = null; render(); },
  labPick() {
    const pos = LAB[lab.ps].pos;
    const cards = allCards(app.S).filter(P => P.pos !== 'GOL').sort((a, b) => Number(b.pos === pos) - Number(a.pos === pos) || b.ovr - a.ovr).slice(0, 60);
    openSheet(`<h2>Jogador do teste</h2><p class="small muted" style="margin-top:-4px">Os estilos que ele já tem saem durante o teste; fica só o estilo escolhido.</p>
      <div class="plist">${cards.map(P => `<button class="prow" data-act="labPickU" data-u="${P.u}">${cardHTML(P)}<div><div class="nm">${esc(P.short)}</div><div class="meta">${P.pos}</div></div><div class="right"><b>${P.ovr}</b></div></button>`).join('')}</div>`);
  },
  labPickU(d: DOMStringMap) { lab.u = +d.u!; closeSheet(); render(); },
  async labPlay(d: DOMStringMap) {
    const kind = d.k as MomentKind, s = labSetup(lab.ps, lab.lvl, basePlayer(), kind), m = labMatch(s);
    const mine = s.lado === 'ataque' ? s.tested : undefined;
    const fwd = s.A.xi.find(e => e.pos === 'ATA')!, mid = s.A.xi.find(e => e.pos === 'MC')!;
    const res = kind === 'goleiro' ? await runMoment(m, { kind, taker: s.B.xi.find(e => e.pos === 'ATA')!, pen: lab.ps === 'pegador-de-penalti' })
      : kind === 'defesa' ? await runMoment(m, { kind, taker: s.B.xi.find(e => e.pos === 'ATA')!, creator: s.B.xi.find(e => e.pos === 'MC') })
      : kind === 'falta' || kind === 'penalti' ? await runMoment(m, { kind, taker: mine ?? fwd })
      : await runMoment(m, { kind, lado: 'meio', creator: mine ?? mid });
    const key = lab.ps + '|' + (lab.u ?? 'n'), t = lab.tally[key] ??= [[0, 0], [0, 0], [0, 0]];
    const gol = kind === 'goleiro' || kind === 'defesa' ? !res.goal : res.goal;
    t[lab.lvl][0]++; if (gol) t[lab.lvl][1]++;
    toast(kind === 'goleiro' || kind === 'defesa' ? (res.goal ? 'Gol do rival' : res.text ?? 'Defendeu!') : res.goal ? 'Gol!' : res.text ?? 'Sem gol');
    render();
  },
  async labSim() {
    if (lab.running) return;
    lab.running = true; render();
    const key = lab.ps + '|' + (lab.u ?? 'n');
    // Solta a tela entre os níveis para o botão mostrar o progresso
    const r = await labSim(lab.ps, 300, basePlayer(), () => new Promise(ok => setTimeout(ok, 0)));
    lab.sim = r; lab.simFor = key; lab.running = false;
    if (app.tab === 'lab') render();
  },
};

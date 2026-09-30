import { inPos } from '../engine/cards';
import { type Nota, Match, effNow, fatigue, freeKickTaker, matchReward, penaltyShootout, penaltyTaker, sideFromTeam, sideOpp, simulate, type Shootout, type Side } from '../engine/match';
import { allClubs, getPlayer } from '../engine/world';
import { clubStrength } from '../engine/squads';
import { clamp } from '../engine/rng';
import { oppFromClub, type OppTeam } from '../engine/season';
import { applyIncidents, needsPens, recordResult, type Fixture } from '../engine/career';
import { cardByUid, orderAt, replaceUnavailable, teamInfo } from '../engine/state';
import { MENT, STYLES, STYLE_IDS } from '../engine/tactics';
import type { CardPlayer, StyleId } from '../engine/types';
import { cardHTML } from './card';
import { app, render, saveNow, userClub } from './ctx';
import { crestHTML } from './crest';
import { closeSheet, esc, fmt, openSheet, toast } from './dom';
import { runMoment2D } from './moment2d';
import { runKeeper2D } from './keeper2d';
import { webglAvailable } from '../three/support';
import { haptic, sfx } from './sfx';

/** Lance 3D (carregado sob demanda), ou 2D se desligado nas configurações, sem WebGL ou se o 3D falhar. */
export async function runMoment(m: Match, req: Parameters<typeof runMoment2D>[1]): Promise<Awaited<ReturnType<typeof runMoment2D>>> {
  if (req.kind === 'goleiro') {
    if (app.S.lance3d !== false && webglAvailable()) {
      try { const { runKeeper3D } = await import('../three/keeper3d'); return await runKeeper3D(m, req); }
      catch (e) { console.warn('Lance de goleiro 3D indisponível, usando 2D', e); }
    }
    return runKeeper2D(m, req);
  }
  if (app.S.lance3d !== false && webglAvailable()) {
    try { const { runMoment3D } = await import('../three/moment3d'); return await runMoment3D(m, req); }
    catch (e) { console.warn('Lance 3D indisponível, usando 2D', e); }
  }
  return runMoment2D(m, req);
}

export const DIF_NAMES = ['Fácil', 'Normal', 'Difícil', 'Lenda'];
/** Dificuldade: força extra do adversário, goleiro dos lances e quantos lances você joga (fora de casa: um a menos). */
export function difficulty(home: 0 | 1 | null): { boost: number; keeper: number; moments: number; gk: number } {
  const d = app.S.dif ?? 1;
  const boost = [-3, 0, 2.5, 5][d], keeper = [-6, 0, 5, 9][d] + (home === 1 ? 3 : 0);
  const moments = [4, 3, 3, 2][d] - (home === 1 ? 1 : 0);
  return { boost, keeper, moments: Math.max(1, moments), gk: [2, 2, 1, 1][d] };
}

interface Live { desfalques?: string[]; m: Match; fx: Fixture | null; speed: number; paused: boolean; busy: boolean; /** Sugestões de troca recusadas (nome de quem sairia). */ naoTrocar: Set<string>; avisado?: string; timer?: ReturnType<typeof setTimeout>; reward?: number; pens?: Shootout; notas?: Nota[] }
let L: Live | null = null;
const DELAYS = [0, 650, 300, 110];

/** Seu time pronto para jogar (ou null se faltam titulares). */
function userSide(): Side | null {
  const S = app.S;
  // Suspensos e lesionados não jogam: o time troca sozinho e avisa
  const trocas = replaceUnavailable(S);
  if (trocas.length) { saveNow(); toast(`Fora deste jogo (suspenso/lesionado): ${trocas.join(', ')}`); }
  const T = teamInfo(S);
  if (!T.full) { toast('Complete os 11 titulares antes de jogar'); app.tab = 'squad'; render(); return null; }
  const bench = S.squad.bench.filter(Boolean).map(u => cardByUid(S, u)!) as CardPlayer[];
  const ord = T.slots.map((sl, i) => orderAt(S, i, T.xi[i], sl.p));
  const A = sideFromTeam(T, { name: S.name, form: S.squad.form, style: S.tac.style, ment: S.tac.ment, bench, ord });
  const uc = userClub();
  Object.assign(A, { s: uc.s, c1: uc.c1, c2: uc.c2 });
  return A;
}

/** Aplica o resultado: moedas, retrospecto, pênaltis no mata-mata e registro na carreira. */
function finalize(m: Match, fx: Fixture | null): { coins: number; pens?: Shootout; desfalques: string[] } {
  const S = app.S, g = m.A.goals, o = m.B.goals;
  const coins = matchReward(g, o, m.momGoals, fx ? fx.mult : 1, !!fx);
  const res = g > o ? 'w' : g === o ? 'd' : 'l';
  S.coins += coins; S.rec[res]++; S.rec.gf += g; S.rec.ga += o;
  let pens: Shootout | undefined, desfalques: string[] = [];
  if (fx && S.career) {
    // Números da temporada: gols, assistências, jogos e notas de quem esteve em campo
    const st = S.career.stats ??= {}, nums = m.userNumbers();
    for (const n of m.notas().filter(x => x.side === 0)) {
      const r = st[n.name] ??= { g: 0, a: 0, j: 0, n: 0 };
      r.j++; r.n += n.nota; r.g += nums[n.name]?.g ?? 0; r.a += nums[n.name]?.a ?? 0;
    }
    // Cartões e lesões valem para os próximos jogos
    desfalques = applyIncidents(S.career, m.inc).map(a => {
      const [id, k] = a.split('|'), n = getPlayer(id)?.short ?? id, f = S.career!.fora?.[id];
      return k === 'lesao' ? `🚑 ${n} lesionado: fora por ${f?.n ?? 1} jogo(s)` : k === 'vermelho' ? `🟥 ${n} expulso: suspenso no próximo jogo` : `🟨 ${n} levou o 3º amarelo: suspenso no próximo jogo`;
    });
    if (needsPens(fx, g, o)) pens = penaltyShootout(m.A, m.B);
    recordResult(S.career, g, o, pens ? [pens.a, pens.b] : undefined);
  }
  saveNow();
  return { coins, pens, desfalques };
}

export function startMatch(opp: OppTeam, fx: Fixture | null): void {
  const S = app.S, A = userSide();
  if (!A) return;
  const home = fx ? fx.home : null, d = difficulty(home);
  const m = new Match(A, sideOpp(opp, d.boost), {
    home, keeperBoost: d.keeper, keeper: S.moments && S.goleiro !== false ? d.gk : 0,
    moments: S.moments ? d.moments : 0,
    onMoment: S.moments ? async (mm, req) => {
      L!.busy = true; renderMatch();
      const res = await runMoment(mm, req);
      L!.busy = false;
      return res;
    } : undefined,
  });
  if (fx) m.addEv(0, 'info', `${fx.label}${fx.home === 0 ? ' · em casa' : fx.home === 1 ? ' · fora de casa' : ' · campo neutro'}.`);
  L = { m, fx, speed: 1, paused: false, busy: false, naoTrocar: new Set() };
  const ov = document.createElement('div');
  ov.className = 'match'; ov.id = 'match';
  document.body.appendChild(ov);
  renderMatch(); loop(); sfx.whistle(1);
}

function loop(): void {
  if (!L || L.m.over) return;
  clearTimeout(L.timer);
  if (L.paused || L.m.ht || L.busy) return;
  L.timer = setTimeout(async () => {
    if (!L) return;
    const n0 = L.m.ev.length, r = await L.m.step();
    // Sons dos eventos novos (gols do lance jogado já tocam no próprio lance)
    for (const e of L.m.ev.slice(0, L.m.ev.length - n0)) {
      if (e.type === 'goal') sfx.goal(); else if (e.type === 'goal opp') sfx.groan();
    }
    if (r === 'ht') sfx.whistle(2);
    if (r === 'end') { sfx.whistle(3); endMatch(); }
    renderMatch(); loop();
  }, DELAYS[L.speed]);
}

function endMatch(): void {
  if (!L) return;
  const r = finalize(L.m, L.fx);
  L.reward = r.coins; L.pens = r.pens; L.notas = L.m.notas(); L.desfalques = r.desfalques;
  if (r.pens) L.m.addEv(r.pens.winner ? 1 : 0, 'info', `Pênaltis: ${L.m.A.name} ${r.pens.a} × ${r.pens.b} ${L.m.B.name}.`);
}

/** Craque do jogo e notas do seu time. */
function notasHTML(ns: Nota[], opp: string): string {
  const best = ns.reduce((a, b) => (b.nota > a.nota ? b : a));
  const cls = (n: number) => (n >= 7.5 ? 'up' : n < 6 ? 'down' : '');
  return `<p style="margin:0 0 6px">⭐ Craque do jogo: <b>${esc(best.name)}</b>${best.side ? ' (' + esc(opp) + ')' : ''} · nota <b>${best.nota.toFixed(1)}</b></p>
   <details class="small" style="margin-bottom:10px"><summary>Notas do seu time</summary><div class="notas">${ns.filter(n => n.side === 0).sort((a, b) => b.nota - a.nota).map(n => `<span><i>${n.pos}</i> ${esc(n.name)} <b class="${cls(n.nota)}">${n.nota.toFixed(1)}</b></span>`).join('')}</div></details>`;
}

/** Simula o jogo do usuário sem assistir (sem lances jogáveis). */
export async function quickPlay(opp: OppTeam, fx: Fixture): Promise<void> {
  const A = userSide();
  if (!A) return;
  const m = await simulate(A, sideOpp(opp, difficulty(fx.home).boost), fx.home);
  const r = finalize(m, fx);
  const res = m.A.goals > m.B.goals ? 'Vitória' : m.A.goals === m.B.goals ? 'Empate' : 'Derrota';
  render();
  openSheet(`<h2>${res} · ${m.A.goals} × ${m.B.goals}</h2>
    <p class="small muted" style="margin-top:-4px">${esc(fx.label)} · ${esc(m.B.name)}</p>
    ${r.pens ? `<p><b>Pênaltis: ${r.pens.a} × ${r.pens.b}</b> — ${r.pens.winner === 0 ? 'classificado!' : 'eliminado.'}</p>` : ''}
    <div class="scorers" style="font-size:13px"><div>${m.A.scorers.map(esc).join('<br>') || '—'}</div><div>${m.B.scorers.map(esc).join('<br>') || '—'}</div></div>
    ${r.desfalques.length ? `<div class="desf">${r.desfalques.map(esc).join('<br>')}</div>` : ''}<p>+${fmt(r.coins)} moedas.</p>${notasHTML(m.notas(), m.B.s)}<button class="btn pri block" data-act="closeSheet">Continuar</button>`);
}

export function renderMatch(): void {
  const ov = document.getElementById('match');
  if (!ov || !L) return;
  const M = L.m, A = M.A, B = M.B;
  const poss = M.possessionPct;
  const ms = (lab: string, a: number, b: number) => { const t = a + b || 1; return `<div class="ms"><span class="lab">${lab}</span><span>${a}</span><div class="dual"><b style="width:${a / t * 100}%"></b><i style="width:${b / t * 100}%"></i></div><span>${b}</span></div>`; };
  const res = A.goals > B.goals ? 'Vitória' : A.goals === B.goals ? 'Empate' : 'Derrota';
  ov.innerHTML = `<div class="ov-inner">
   <div class="board">
     <div>${crestHTML({ n: A.name, s: A.s, c1: A.c1, c2: A.c2 }, 'team')}<div class="tn">${esc(A.name)}</div></div>
     <div><div class="score">${A.goals} – ${B.goals}</div><span class="clock">${M.over ? 'Encerrado' : M.ht ? 'Intervalo' : M.label}</span><div class="small muted" style="margin-top:4px">${M.home === 0 ? 'Em casa' : M.home === 1 ? 'Fora de casa' : 'Campo neutro'}</div></div>
     <div>${crestHTML({ n: B.name, s: B.s, c1: B.c1, c2: B.c2 }, 'team')}<div class="tn">${esc(B.name)}</div></div>
   </div>
   <div class="scorers"><div>${A.scorers.map(esc).join('<br>')}</div><div>${B.scorers.map(esc).join('<br>')}</div></div>
   ${M.over ? `<div class="ht"><h2 style="margin:0 0 4px">${res}${L.pens ? ` · pênaltis ${L.pens.a} × ${L.pens.b}` : ''}</h2>
     ${L.pens ? `<p class="small" style="margin:0 0 6px">${L.pens.winner === 0 ? '<b class="up">Classificado nos pênaltis!</b>' : '<b class="down">Eliminado nos pênaltis.</b>'}</p><details class="small muted" style="margin-bottom:8px"><summary>Cobranças</summary>${L.pens.log.map(esc).join('<br>')}</details>` : ''}
     ${L.desfalques?.length ? `<div class="desf">${L.desfalques.map(esc).join('<br>')}</div>` : ''}
     <p style="margin:0 0 10px">+${fmt(L.reward ?? 0)} moedas${L.fx ? ' · ' + esc(L.fx.label) : ' · amistoso'}.</p>
     ${L.notas ? notasHTML(L.notas, B.s) : ''}
     <button class="btn pri block" data-act="closeMatch">Continuar</button></div>` : ''}
   ${M.ht && !M.over ? `<div class="ht"><b>Intervalo.</b> <span class="muted small">Ajuste o time e volte para o segundo tempo.</span><div class="row" style="margin-top:10px"><button class="btn pri" style="flex:1" data-act="secondHalf">Começar 2º tempo</button><button class="btn" data-act="subs">Substituições (${A.subs})</button></div></div>` : ''}
   ${subHint()}
   ${!M.over ? `<div class="mctl">
     <button class="chip" data-act="mPause" aria-pressed="${L.paused}">${L.paused ? 'Continuar' : 'Pausar'}</button>
     ${[1, 2, 3].map(s => `<button class="chip" data-act="mSpeed" data-s="${s}" aria-pressed="${L!.speed === s}">${['', '1×', '2×', '4×'][s]}</button>`).join('')}
     <button class="chip" data-act="subs">Subst. (${A.subs})</button>
     <span class="small muted" style="margin-left:auto">Lances: ${M.momentsLeft}</span>
   </div>
   <div class="mctl">
     <select id="mStyle" aria-label="Estilo">${STYLE_IDS.map(k => `<option value="${k}" ${k === A.style ? 'selected' : ''}>${STYLES[k].n}</option>`).join('')}</select>
     <button class="chip" data-act="mMent" data-d="-1" aria-label="Mais defensivo">−</button>
     <span class="small" style="min-width:110px;text-align:center">${MENT[A.ment + 2]}</span>
     <button class="chip" data-act="mMent" data-d="1" aria-label="Mais ofensivo">+</button>
   </div>` : ''}
   <div class="feed">${M.ev.map(e => `<div class="ev ${e.type} ${e.side ? 'opp' : ''}"><span class="m">${e.l}</span><span class="t">${e.side ? '<b style="color:var(--opp)">' + esc(B.s) + '</b> ' : ''}${esc(e.text)}</span></div>`).join('')}</div>
   <div class="mstats">${ms('Posse %', poss, 100 - poss)}${ms('Finalizações', M.st.sh[0], M.st.sh[1])}${ms('No alvo', M.st.on[0], M.st.on[1])}${ms('Escanteios', M.st.ck[0], M.st.ck[1])}${ms('Amarelos', M.st.yc[0], M.st.yc[1])}</div>
  </div>`;
  const st = ov.querySelector<HTMLSelectElement>('#mStyle');
  if (st) st.onchange = () => { M.setStyle(st.value as StyleId); renderMatch(); };
}

/** Aviso de troca rápida quando um titular está cansado (um toque troca; "Agora não" some com a sugestão). */
function subHint(): string {
  if (!L || L.m.over || L.m.ht) return '';
  const M = L.m, s = M.suggestSub(70, L.naoTrocar);
  if (!s) return '';
  const e = M.A.xi[s.out], P = M.A.bench[s.inIdx];
  if (L.avisado !== e.name) { L.avisado = e.name; haptic('leve'); }
  return `<div class="sub-hint"><span class="sh-ic">🔋</span><div><b>${esc(e.name)}</b> está cansado · fôlego <b class="${s.folego < 55 ? 'down' : ''}">${s.folego}%</b>
      <div class="small muted">Entra <b>${esc(P.short)}</b> (${P.pos} · ${P.ovr})${s.ganho > 0 ? ` · +${Math.round(s.ganho)} de rendimento` : ''}</div></div>
    <div class="sh-acts"><button class="btn pri" data-act="quickSub" data-o="${s.out}" data-i="${s.inIdx}">Trocar</button><button class="btn" data-act="skipSub" data-n="${esc(e.name)}">Agora não</button></div></div>`;
}

function openSubs(): void {
  if (!L) return;
  const live = L, M = live.m, A = M.A, wasPaused = live.paused;
  live.paused = true; clearTimeout(live.timer);
  let out: number | null = null;
  const resume = () => { live.paused = wasPaused; renderMatch(); loop(); };
  const draw = () => {
    const sh = openSheet(out === null
      ? `<h2>Quem sai?</h2><p class="small muted" style="margin-top:-4px">${A.subs} substituições restantes. O cansaço pesa depois dos 55 minutos.</p>
        <div class="plist">${A.xi.map((e, i) => e.red ? '' : `<button class="prow" data-sub-out="${i}">${cardHTML(e.P as CardPlayer)}<div><div class="nm">${esc(e.name)}</div><div class="meta">${e.pos}${e.yc ? ' · amarelado' : ''}</div></div><div class="right"><b>${Math.round(effNow(e, M.min))}</b><div>fôlego ${Math.round(100 - fatigue(e, M.min) * 60)}%</div></div></button>`).join('')}</div>`
      : `<h2>Quem entra no lugar de ${esc(A.xi[out].name)}?</h2><div class="plist">${A.bench.map((P, j) => `<button class="prow" data-sub-in="${j}">${cardHTML(P as CardPlayer)}<div><div class="nm">${esc(P.short)}</div><div class="meta">${P.pos}${P.alt.length ? ' / ' + P.alt.join(' / ') : ''}${!inPos(P, A.xi[out!].pos) ? ' · <span class="down">fora de posição</span>' : ''}</div></div><div class="right"><b>${P.ovr}</b></div></button>`).join('') || '<p class="empty-note">Sem reservas disponíveis.</p>'}</div>`,
      '', resume);
    sh.addEventListener('click', e => {
      const t = e.target as HTMLElement;
      const o = t.closest<HTMLElement>('[data-sub-out]'), n = t.closest<HTMLElement>('[data-sub-in]');
      if (o) {
        if (A.subs <= 0) { toast('Sem substituições restantes'); return; }
        out = +o.dataset.subOut!; draw();
      } else if (n && out !== null) {
        const r = M.substitute(out, +n.dataset.subIn!);
        if (!r.ok) { if (r.msg) toast(r.msg); return; }
        closeSheet(); resume();
      }
    });
  };
  draw();
}

/** Treino de lances: com o seu time contra um adversário mediano, sem valer nada. */
export async function trainingMoment(kind: 'ataque' | 'penalti' | 'falta' = 'ataque'): Promise<void> {
  const S = app.S, T = teamInfo(S);
  if (!T.full) { toast('Complete os 11 titulares antes de treinar'); return; }
  const bench = S.squad.bench.filter(Boolean).map(u => cardByUid(S, u)!) as CardPlayer[];
  const ord = T.slots.map((sl, i) => orderAt(S, i, T.xi[i], sl.p));
  const A = sideFromTeam(T, { name: S.name, form: S.squad.form, style: S.tac.style, ment: S.tac.ment, bench, ord });
  const uc = userClub();
  Object.assign(A, { s: uc.s, c1: uc.c1, c2: uc.c2 });
  const opp = allClubs().filter(c => c.id !== S.career?.club).sort((a, b) => Math.abs(clubStrength(a.id) - 70) - Math.abs(clubStrength(b.id) - 70))[0];
  const m = new Match(A, sideOpp(oppFromClub(opp)), { keeperBoost: -8 });
  m.label = 'Treino';
  const taker = kind === 'falta' ? freeKickTaker(A) : kind === 'penalti' ? penaltyTaker(A) : undefined;
  const res = await runMoment(m, { kind, taker, treino: true });
  openSheet(`<h2>${res.goal ? 'Gol no treino!' : 'Treino'}</h2>
    <p class="small muted" style="margin-top:-4px">${res.goal ? `Belo gol de ${esc(res.scorer ?? '')}.` : esc(res.text ?? '')} O treino não vale nada: repita quantas vezes quiser.</p>
    <div style="display:grid;gap:8px">
      <button class="btn pri block" data-act="treino" data-k="ataque">Treinar ataque (passo a passo)</button>
      <div class="row" style="gap:8px"><button class="btn" style="flex:1" data-act="treino" data-k="falta">Treinar falta</button><button class="btn" style="flex:1" data-act="treino" data-k="penalti">Treinar pênalti</button></div>
      <button class="btn block" data-act="closeSheet">Fechar</button>
    </div>`);
}

/** Só em desenvolvimento: abre um lance direto (usado nos testes de navegador). */
export function devMoment(kind: 'ataque' | 'contra' | 'penalti' | 'falta' | 'goleiro', pen = false): Promise<unknown> {
  const S = app.S, T = teamInfo(S);
  const bench = S.squad.bench.filter(Boolean).map(u => cardByUid(S, u)!) as CardPlayer[];
  const A = sideFromTeam(T, { name: S.name, form: S.squad.form, style: S.tac.style, ment: S.tac.ment, bench });
  const opp = allClubs()[0];
  const m = new Match(A, sideOpp(oppFromClub(opp)));
  if (kind === 'goleiro') return runMoment(m, { kind, taker: penaltyTaker(m.B), pen });
  const taker = kind === 'falta' ? freeKickTaker(A) : kind === 'penalti' ? penaltyTaker(A) : undefined;
  return runMoment(m, { kind, taker, ...(kind === 'ataque' || kind === 'contra' ? m.origin(A) : {}) });
}

export const matchActions = {
  closeMatch() { document.getElementById('match')?.remove(); if (L) clearTimeout(L.timer); L = null; app.tab = 'season'; render(); },
  secondHalf() { if (!L) return; L.m.secondHalf(); sfx.whistle(1); renderMatch(); loop(); },
  mPause() { if (!L) return; L.paused = !L.paused; renderMatch(); loop(); },
  mSpeed(d: DOMStringMap) { if (!L) return; L.speed = +d.s!; renderMatch(); loop(); },
  mMent(d: DOMStringMap) {
    if (!L) return;
    const A = L.m.A;
    A.ment = clamp(A.ment + +d.d!, -2, 2);
    L.m.addEv(0, 'info', `${A.name}: ${MENT[A.ment + 2].toLowerCase()}.`);
    renderMatch();
  },
  subs() { openSubs(); },
  quickSub(d: DOMStringMap) {
    if (!L) return;
    const r = L.m.substitute(+d.o!, +d.i!);
    if (!r.ok) { if (r.msg) toast(r.msg); return; }
    sfx.whistle(1); renderMatch();
  },
  skipSub(d: DOMStringMap) { if (!L) return; L.naoTrocar.add(d.n ?? ''); renderMatch(); },
  treino(d: DOMStringMap) { closeSheet(); void trainingMoment((d.k ?? 'ataque') as 'ataque' | 'penalti' | 'falta'); },
};

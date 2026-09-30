import { inPos } from '../engine/cards';
import { Match, effNow, fatigue, matchReward, sideFromTeam, sideOpp } from '../engine/match';
import { clamp } from '../engine/rng';
import { DIVS, finishRound, type OppTeam } from '../engine/season';
import { cardByUid, teamInfo } from '../engine/state';
import { MENT, STYLES, STYLE_IDS } from '../engine/tactics';
import type { CardPlayer, StyleId } from '../engine/types';
import { cardHTML } from './card';
import { app, render, save, userClub } from './ctx';
import { crestHTML } from './crest';
import { closeSheet, esc, fmt, openSheet, toast } from './dom';
import { runMoment2D } from './moment2d';

interface Live { m: Match; league: boolean; speed: number; paused: boolean; busy: boolean; timer?: ReturnType<typeof setTimeout>; reward?: number }
let L: Live | null = null;
const DELAYS = [0, 650, 300, 110];

export function startMatch(opp: OppTeam, league: boolean): void {
  const S = app.S, T = teamInfo(S);
  if (!T.full) { toast('Complete os 11 titulares antes de jogar'); app.tab = 'squad'; render(); return; }
  const bench = S.squad.bench.filter(Boolean).map(u => cardByUid(S, u)!) as CardPlayer[];
  const A = sideFromTeam(T, { name: S.name, form: S.squad.form, style: S.tac.style, ment: S.tac.ment, bench });
  Object.assign(A, { s: userClub().s });
  const m = new Match(A, sideOpp(opp), {
    moments: S.moments ? 4 : 0,
    onMoment: S.moments ? async (mm, req) => {
      L!.busy = true; renderMatch();
      const res = await runMoment2D(mm, req);
      L!.busy = false;
      return res;
    } : undefined,
  });
  L = { m, league, speed: 1, paused: false, busy: false };
  const ov = document.createElement('div');
  ov.className = 'match'; ov.id = 'match';
  document.body.appendChild(ov);
  renderMatch(); loop();
}

function loop(): void {
  if (!L || L.m.over) return;
  clearTimeout(L.timer);
  if (L.paused || L.m.ht || L.busy) return;
  L.timer = setTimeout(async () => {
    if (!L) return;
    const r = await L.m.step();
    if (r === 'end') endMatch();
    renderMatch(); loop();
  }, DELAYS[L.speed]);
}

function endMatch(): void {
  if (!L) return;
  const S = app.S, m = L.m, g = m.A.goals, o = m.B.goals;
  const coins = matchReward(g, o, m.momGoals, DIVS[S.season.div].m, L.league);
  const res = g > o ? 'w' : g === o ? 'd' : 'l';
  S.coins += coins; S.rec[res]++; S.rec.gf += g; S.rec.ga += o;
  if (L.league) finishRound(S.season, g, o);
  L.reward = coins;
  save();
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
     <div><div class="score">${A.goals} – ${B.goals}</div><span class="clock">${M.over ? 'Encerrado' : M.ht ? 'Intervalo' : M.label}</span></div>
     <div>${crestHTML({ n: B.name, s: B.s, c1: B.c1, c2: B.c2 }, 'team')}<div class="tn">${esc(B.name)}</div></div>
   </div>
   <div class="scorers"><div>${A.scorers.map(esc).join('<br>')}</div><div>${B.scorers.map(esc).join('<br>')}</div></div>
   ${M.over ? `<div class="ht"><h2 style="margin:0 0 4px">${res}</h2><p style="margin:0 0 10px">+${fmt(L.reward ?? 0)} moedas${L.league ? ' · resultado lançado na tabela' : ' · amistoso'}.</p><button class="btn pri block" data-act="closeMatch">Continuar</button></div>` : ''}
   ${M.ht && !M.over ? `<div class="ht"><b>Intervalo.</b> <span class="muted small">Ajuste o time e volte para o segundo tempo.</span><div class="row" style="margin-top:10px"><button class="btn pri" style="flex:1" data-act="secondHalf">Começar 2º tempo</button><button class="btn" data-act="subs">Substituições (${A.subs})</button></div></div>` : ''}
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
   <div class="feed">${M.ev.map(e => `<div class="ev ${e.type} ${e.side ? 'opp' : ''}"><span class="m">${e.l}</span><span class="t">${e.side && e.type !== 'info' ? '<b style="color:var(--opp)">' + esc(B.s) + '</b> ' : ''}${esc(e.text)}</span></div>`).join('')}</div>
   <div class="mstats">${ms('Posse %', poss, 100 - poss)}${ms('Finalizações', M.st.sh[0], M.st.sh[1])}${ms('No alvo', M.st.on[0], M.st.on[1])}${ms('Amarelos', M.st.yc[0], M.st.yc[1])}</div>
  </div>`;
  const st = ov.querySelector<HTMLSelectElement>('#mStyle');
  if (st) st.onchange = () => { M.setStyle(st.value as StyleId); renderMatch(); };
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
        <div class="plist">${A.xi.map((e, i) => e.red ? '' : `<button class="prow" data-sub-out="${i}">${cardHTML(e.P as CardPlayer)}<div><div class="nm">${esc(e.P.name)}</div><div class="meta">${e.pos}${e.yc ? ' · amarelado' : ''}</div></div><div class="right"><b>${Math.round(effNow(e, M.min))}</b><div>fôlego ${Math.round(100 - fatigue(e, M.min) * 60)}%</div></div></button>`).join('')}</div>`
      : `<h2>Quem entra no lugar de ${esc(A.xi[out].name)}?</h2><div class="plist">${A.bench.map((P, j) => `<button class="prow" data-sub-in="${j}">${cardHTML(P as CardPlayer)}<div><div class="nm">${esc(P.name)}</div><div class="meta">${P.pos}${P.alt.length ? ' / ' + P.alt.join(' / ') : ''}${!inPos(P, A.xi[out!].pos) ? ' · <span class="down">fora de posição</span>' : ''}</div></div><div class="right"><b>${P.ovr}</b></div></button>`).join('') || '<p class="empty-note">Sem reservas disponíveis.</p>'}</div>`,
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

export const matchActions = {
  closeMatch() { document.getElementById('match')?.remove(); if (L) clearTimeout(L.timer); L = null; app.tab = 'season'; render(); },
  secondHalf() { if (!L) return; L.m.secondHalf(); renderMatch(); loop(); },
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
};

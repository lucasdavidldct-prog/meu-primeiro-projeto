// Tela da carreira: próximo jogo, tabela, Libertadores, outras ligas e sala de troféus.
import { MAIN_LEAGUES, groupStandings, leagueStandings, libUserStatus, nextFixture, phaseName, seasonOver, type CupTie, type Career } from '../../engine/career';
import { oppFromId, type Standing } from '../../engine/season';
import { teamInfo, teamStrength } from '../../engine/state';
import { STYLES, counterOf } from '../../engine/tactics';
import { W } from '../../engine/world';
import { app, userClub } from '../ctx';
import { crestHTML } from '../crest';
import { esc } from '../dom';

const clubC = (id: string) => { const c = W.clubs.get(id); return c ? { n: c.n, s: c.s, c1: c.c1, c2: c.c2 } : { n: id, s: id, c1: '#555555', c2: '#dddddd' }; };
const nm = (C: Career, id: string) => (id === C.club ? app.S.name : W.clubs.get(id)?.n ?? id);

function table(C: Career, st: Standing[], zones: { up?: number; lib?: number; down?: number } = {}, compact = false): string {
  const n = st.length;
  return `<div class="panel tbl-wrap" style="padding:6px 8px"><table><thead><tr><th>#</th><th>Time</th><th>J</th>${compact ? '' : '<th>V</th><th>E</th><th>D</th>'}<th>SG</th><th>Pts</th></tr></thead><tbody>
  ${st.map((t, i) => `<tr class="${t.id === C.club ? 'you' : ''} ${zones.lib && i < zones.lib ? 'zone-up' : ''} ${zones.up && i < zones.up ? 'zone-up' : ''} ${zones.down && i >= n - zones.down ? 'zone-down' : ''}"><td>${i + 1}</td><td><span class="team-cell">${crestHTML(t.id === C.club ? userClub() : clubC(t.id), 'row')}<span>${esc(nm(C, t.id))}</span></span></td><td>${t.P}</td>${compact ? '' : `<td>${t.W}</td><td>${t.D}</td><td>${t.L}</td>`}<td>${t.GF - t.GA > 0 ? '+' : ''}${t.GF - t.GA}</td><td><b>${t.Pts}</b></td></tr>`).join('')}
  </tbody></table></div>`;
}

function tieHTML(C: Career, t: CupTie): string {
  const agg = (i: 0 | 1) => t.legs.reduce((s, l) => s + (l ? l[i] : 0), 0);
  const played = t.legs.some(Boolean);
  const cls = (id: string) => (t.winner ? (t.winner === id ? 'up' : 'muted') : '') + (id === C.club ? ' you-txt' : '');
  return `<div class="tie"><span class="${cls(t.a)}">${esc(nm(C, t.a))}</span><b>${played ? `${agg(0)} × ${agg(1)}` : '×'}${t.pens ? ` <small>(${t.pens[0]}–${t.pens[1]} pên.)</small>` : ''}</b><span class="${cls(t.b)}">${esc(nm(C, t.b))}</span></div>`;
}

function viewLib(C: Career): string {
  const L = C.lib;
  if (!L) return `<div class="panel small muted">Seu clube não está na Libertadores de ${C.year}. Termine entre os 5 primeiros da Série A para se classificar.</div>`;
  const ko = (['quartas', 'semi', 'final'] as const).filter(p => L.ties[p].length);
  return `<div class="panel small" style="margin-bottom:10px"><b>${phaseName(L.phase)}</b> · Você: ${esc(libUserStatus(L, C.club))}${L.champion ? ` · Campeão: <b>${esc(nm(C, L.champion))}</b>` : ''}</div>
  ${ko.reverse().map(p => `<h3>${phaseName(p)}</h3><div class="panel">${L.ties[p].map(t => tieHTML(C, t)).join('')}</div>`).join('')}
  ${L.groups.map((g, i) => `<h3>Grupo ${'ABCD'[i]}</h3>${table(C, groupStandings(g), { up: 2 }, true)}`).join('')}`;
}

function viewOthers(C: Career): string {
  const ids = C.others.map(o => o.id);
  const cur = ids.includes(app.otherLeague) ? app.otherLeague : ids[0];
  const L = C.others.find(o => o.id === cur)!;
  return `<div class="chips">${C.others.map(o => `<button class="chip" data-act="cvLeague" data-l="${o.id}" aria-pressed="${o.id === cur}">${esc(o.name)}</button>`).join('')}</div>
  <p class="small muted">Rodada ${L.round} de ${L.rounds.length} · simulada junto com o seu campeonato.</p>
  ${table(C, leagueStandings(L), MAIN_LEAGUES.includes(L.id) ? {} : { lib: 5, down: 4 })}
  ${L.last.length ? `<h3>Última rodada</h3><div class="panel" style="padding:8px 12px">${L.last.map(m => `<div class="res"><span>${esc(nm(C, m.h))}</span><b>${m.gh} × ${m.ga}</b><span>${esc(nm(C, m.a))}</span></div>`).join('')}</div>` : ''}`;
}

function viewTrophies(C: Career): string {
  const count = (k: string) => C.trophies.filter(t => t.comp === k).length;
  const cab = [['brasileirao', 'Brasileirão', '🏆'], ['libertadores', 'Libertadores', '🏆'], ['serie-b', 'Série B', '🥇']] as const;
  return `<div class="trophies">${cab.map(([k, n, ic]) => `<div class="trophy ${count(k) ? 'won' : ''}"><span class="ic">${ic}</span><b>${count(k)}</b><span>${n}</span></div>`).join('')}</div>
  ${C.trophies.length ? `<div class="panel" style="margin-top:10px">${C.trophies.slice().reverse().map(t => `<div class="res"><span>${t.year}</span><b>${esc(t.name)}</b><span></span></div>`).join('')}</div>` : '<p class="empty-note">A sala de troféus ainda está vazia. Bora encher!</p>'}
  <h3>Temporadas</h3>
  ${C.history.length ? `<div class="panel tbl-wrap" style="padding:6px 8px"><table><thead><tr><th>Ano</th><th>Divisão</th><th>Pos.</th><th>Pts</th><th>Libertadores</th><th>Artilheiro</th></tr></thead><tbody>${C.history.slice().reverse().map(h => `<tr><td>${h.year}</td><td style="text-align:left">Série ${h.div}</td><td>${h.pos}º</td><td>${h.pts}</td><td>${h.lib ? esc(h.lib) : '—'}</td><td style="text-align:left">${h.art ? esc(h.art) : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-note">Nenhuma temporada encerrada ainda.</p>'}`;
}

export function viewSeason(): string {
  const S = app.S, C = S.career!;
  let next: string;
  if (seasonOver(C)) {
    const pos = leagueStandings(C.league).findIndex(t => t.id === C.club) + 1;
    next = `<div class="panel"><h2 style="margin-top:0">Temporada ${C.year} encerrada</h2><p>Você terminou em <b>${pos}º lugar</b> no ${esc(C.league.name)}${C.lib ? ` · Libertadores: <b>${esc(libUserStatus(C.lib, C.club))}</b>` : ''}.</p><button class="btn pri block" data-act="endSeason">Receber prêmios e começar ${C.year + 1}</button></div>`;
  } else {
    const f = nextFixture(C)!, T = teamInfo(S), o = oppFromId(f.opp, teamStrength(T));
    const you = `<div>${crestHTML(userClub(), 'team')}<div class="nm">${esc(S.name)}</div><div class="small muted">Força ${teamStrength(T)} · ${S.squad.form}</div></div>`;
    const them = `<div>${crestHTML(clubC(f.opp), 'team')}<div class="nm">${esc(o.n)}</div><div class="small muted">Força ${o.str} · ${o.form}</div></div>`;
    const ko = f.ko && f.ko.leg === 1 ? `<div class="tip">Jogo de volta. Agregado: <b>${f.ko.agg[0]} × ${f.ko.agg[1]}</b>. Empate no agregado vai para os pênaltis.</div>` : f.ko?.phase === 'final' ? '<div class="tip">Final em jogo único, campo neutro. Empate vai para os pênaltis.</div>' : '';
    next = `<div class="panel"><div class="small muted" style="text-align:center;margin-bottom:10px;letter-spacing:.06em;text-transform:uppercase">${esc(f.label)}</div>
     <div class="fixture">${f.home === 1 ? them + '<div class="vs">×</div>' + you : you + '<div class="vs">×</div>' + them}</div>
     <div class="small muted" style="text-align:center;margin-top:6px">${f.home === null ? 'Campo neutro' : `Mando: ${esc(f.home === 0 ? S.name : o.n)}`}</div>
     ${ko}
     <div class="tip">O adversário deve jogar em <b>${STYLES[o.style].n}</b>. ${o.style === 'equilibrado' ? 'Nenhum estilo leva vantagem clara contra ele.' : `Estilo que leva vantagem: <b>${STYLES[counterOf(o.style)].n}</b>.`}</div>
     <div class="row" style="margin-top:12px"><button class="btn pri" style="flex:1" data-act="play">Jogar partida</button><button class="btn" data-act="simPlay">Simular</button><button class="btn" data-act="friendly">Amistoso</button></div></div>`;
  }
  const v = app.careerView;
  const body = v === 'lib' ? viewLib(C) : v === 'outras' ? viewOthers(C) : v === 'trofeus' ? viewTrophies(C)
    : `${table(C, leagueStandings(C.league), C.div === 'A' ? { lib: 5, down: 4 } : { up: 4, down: 4 })}
       ${C.league.last.length ? `<h3>Última rodada</h3><div class="panel" style="padding:8px 12px">${C.league.last.map(m => `<div class="res"><span>${esc(nm(C, m.h))}</span><b>${m.gh} × ${m.ga}</b><span>${esc(nm(C, m.a))}</span></div>`).join('')}</div>` : ''}`;
  return `<h2>${esc(C.league.name)} <span class="muted" style="font-size:18px">· ${C.year}</span></h2>
  <p class="small muted" style="margin-top:-4px">${C.div === 'A' ? 'Os 5 primeiros vão para a Libertadores; os 4 últimos caem.' : 'Os 4 primeiros sobem para a Série A; os 4 últimos caem.'}${C.short ? ' Temporada curta (só turno).' : ''}</p>
  ${next}
  <div class="chips" style="margin-top:16px">${[['tabela', 'Tabela'], ['lib', 'Libertadores'], ['outras', 'Outras ligas'], ['trofeus', 'Troféus']].map(([k, n]) => `<button class="chip" data-act="cv" data-v="${k}" aria-pressed="${k === v}">${n}</button>`).join('')}</div>
  <div style="margin-top:10px">${body}</div>`;
}

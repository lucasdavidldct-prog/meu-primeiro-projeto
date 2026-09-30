import { classico } from '../../engine/rivals';
// Tela da carreira: próximo jogo, tabela, Libertadores, outras ligas e sala de troféus.
import { MAIN_LEAGUES, groupStandings, leagueStandings, libUserStatus, nextFixture, phaseName, seasonOver, type CupTie, type Career } from '../../engine/career';
import { oppFromId, type Standing } from '../../engine/season';
import { teamInfo, teamStrength } from '../../engine/state';
import { STYLES, counterOf } from '../../engine/tactics';
import { W, getPlayer } from '../../engine/world';
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

/** Estatísticas: seu time (ordenável) e a artilharia/assistências da liga. */
type StatK = 'j' | 'g' | 'a' | 'f' | 'd' | 'e' | 's' | 'n';
const STAT_COLS: [StatK, string, string][] = [['j', 'J', 'Jogos'], ['g', 'G', 'Gols'], ['a', 'A', 'Assistências'], ['f', 'Fin', 'Finalizações'], ['d', 'Des', 'Desarmes e interceptações'], ['e', 'Err', 'Erros (bola perdida que virou chance do rival)'], ['s', 'Def', 'Defesas (goleiro)'], ['n', 'Nota', 'Nota média']];
function viewStats(C: Career): string {
  const k = (app.statSort ?? 'g') as StatK;
  const rows = Object.entries(C.stats ?? {}).map(([nome, r]) => ({ nome, j: r.j, g: r.g, a: r.a, f: r.f ?? 0, d: r.d ?? 0, e: r.e ?? 0, s: r.s ?? 0, n: r.j ? r.n / r.j : 0 }))
    .sort((x, y) => (y[k] - x[k]) * (k === 'e' ? -1 : 1) || y.g - x.g);
  const lider = (kk: StatK, rot: string) => { const r = [...rows].sort((x, y) => y[kk] - x[kk])[0]; return r && r[kk] ? `<div class="kpi"><span>${rot}</span><b>${esc(r.nome)}</b><em>${kk === 'n' ? r[kk].toFixed(1) : r[kk]}</em></div>` : ''; };
  const art = Object.entries(C.league.art ?? {}).map(([id, r]) => ({ id, ...r, P: getPlayer(id) })).filter(x => x.P);
  const top = (kk: 'g' | 'a') => art.filter(x => x[kk]).sort((x, y) => y[kk] - x[kk] || y.a - x.a).slice(0, 10);
  const lista = (kk: 'g' | 'a') => top(kk).map((x, i) => `<div class="rank${x.c === C.club ? ' me' : ''}"><i>${i + 1}</i>${crestHTML(clubC(x.c), 'badge')}<span>${esc(x.P!.short)} <small class="muted">${esc(clubC(x.c).n)}</small></span><b>${x[kk]}</b></div>`).join('') || '<p class="small muted">Ainda sem gols na liga.</p>';
  return `<h3 style="margin-top:4px">Destaques do seu time</h3>
    <div class="kpis">${lider('g', 'Artilheiro')}${lider('a', 'Garçom')}${lider('d', 'Mais desarmes')}${lider('s', 'Mais defesas')}${lider('n', 'Melhor nota')}</div>
    <h3>Seu time na temporada</h3>
    ${rows.length ? `<div class="tbl-wrap"><table class="stat-t"><thead><tr><th>Jogador</th>${STAT_COLS.map(([c, a, t]) => `<th title="${t}"><button data-act="statSort" data-k="${c}" aria-pressed="${c === k}">${a}</button></th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr><td>${esc(r.nome)}</td>${STAT_COLS.map(([c]) => `<td class="${c === k ? 'cur' : ''}">${c === 'n' ? r.n.toFixed(1) : r[c]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="small muted">Toque no título da coluna para ordenar. Err = bolas perdidas que viraram chance do rival.</p>` : '<p class="small muted">Jogue uma partida para ver os números.</p>'}
    <h3>Artilharia · ${esc(C.league.name)}</h3><div class="panel ranks">${lista('g')}</div>
    <h3>Assistências · ${esc(C.league.name)}</h3><div class="panel ranks">${lista('a')}</div>`;
}

export function viewSeason(): string {
  const S = app.S, C = S.career!;
  let next: string;
  if (seasonOver(C)) {
    const pos = leagueStandings(C.league).findIndex(t => t.id === C.club) + 1;
    next = `<div class="panel"><h2 style="margin-top:0">Temporada ${C.year} encerrada</h2><p>Você terminou em <b>${pos}º lugar</b> no ${esc(C.league.name)}${C.lib ? ` · Libertadores: <b>${esc(libUserStatus(C.lib, C.club))}</b>` : ''}.</p><button class="btn pri block" data-act="endSeason">Receber prêmios e começar ${C.year + 1}</button></div>`;
  } else {
    const f = nextFixture(C)!, T = teamInfo(S), o = oppFromId(f.opp, teamStrength(T)), cl = classico(C.club, f.opp);
    const you = `<div>${crestHTML(userClub(), 'team')}<div class="nm">${esc(S.name)}</div><div class="small muted">Força ${teamStrength(T)} · ${S.squad.form}</div></div>`;
    const them = `<div>${crestHTML(clubC(f.opp), 'team')}<div class="nm">${esc(o.n)}</div><div class="small muted">Força ${o.str} · ${o.form}</div></div>`;
    const ko = f.ko && f.ko.leg === 1 ? `<div class="tip">Jogo de volta. Agregado: <b>${f.ko.agg[0]} × ${f.ko.agg[1]}</b>. Empate no agregado vai para os pênaltis.</div>` : f.ko?.phase === 'final' ? '<div class="tip">Final em jogo único, campo neutro. Empate vai para os pênaltis.</div>' : '';
    next = `<div class="panel"><div class="small muted" style="text-align:center;margin-bottom:10px;letter-spacing:.06em;text-transform:uppercase">${esc(f.label)}</div>
     <div class="fixture">${f.home === 1 ? them + '<div class="vs">×</div>' + you : you + '<div class="vs">×</div>' + them}</div>
     <div class="small muted" style="text-align:center;margin-top:6px">${f.home === null ? 'Campo neutro' : `Mando: ${esc(f.home === 0 ? S.name : o.n)}`}</div>
     ${ko}
     ${cl ? `<div class="classico">🔥 <b>${esc(cl.n)}</b> · jogo de rivalidade: o rival vem ${cl.peso === 2 ? '+3' : '+2'} de força e mais pegado. Vitória vale ${cl.peso === 2 ? '60' : '30'}% a mais de moedas.</div>` : ''}
     <div class="tip">O adversário deve jogar em <b>${STYLES[o.style].n}</b>. ${o.style === 'equilibrado' ? 'Nenhum estilo leva vantagem clara contra ele.' : `Estilo que leva vantagem: <b>${STYLES[counterOf(o.style)].n}</b>.`}</div>
     <div class="row" style="margin-top:12px"><button class="btn pri" style="flex:1" data-act="play">Jogar partida</button><button class="btn" data-act="simPlay">Simular</button><button class="btn" data-act="friendly">Amistoso</button></div></div>`;
  }
  const v = app.careerView;
  const body = v === 'lib' ? viewLib(C) : v === 'outras' ? viewOthers(C) : v === 'trofeus' ? viewTrophies(C) : v === 'stats' ? viewStats(C)
    : `${table(C, leagueStandings(C.league), C.div === 'A' ? { lib: 5, down: 4 } : { up: 4, down: 4 })}
       ${C.league.last.length ? `<h3>Última rodada</h3><div class="panel" style="padding:8px 12px">${C.league.last.map(m => `<div class="res"><span>${esc(nm(C, m.h))}</span><b>${m.gh} × ${m.ga}</b><span>${esc(nm(C, m.a))}</span></div>`).join('')}</div>` : ''}`;
  return `<h2>${esc(C.league.name)} <span class="muted" style="font-size:18px">· ${C.year}</span></h2>
  <p class="small muted" style="margin-top:-4px">${C.div === 'A' ? 'Os 5 primeiros vão para a Libertadores; os 4 últimos caem.' : 'Os 4 primeiros sobem para a Série A; os 4 últimos caem.'}${C.short ? ' Temporada curta (só turno).' : ''}</p>
  ${next}
  <div class="chips" style="margin-top:16px">${[['tabela', 'Tabela'], ['stats', 'Estatísticas'], ['lib', 'Libertadores'], ['outras', 'Outras ligas'], ['trofeus', 'Troféus']].map(([k, n]) => `<button class="chip" data-act="cv" data-v="${k}" aria-pressed="${k === v}">${n}</button>`).join('')}</div>
  <div style="margin-top:10px">${body}</div>`;
}

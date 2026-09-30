import { DIVS, ROUNDS, nextOpponent, standings } from '../../engine/season';
import { teamInfo } from '../../engine/state';
import { STYLES, counterOf } from '../../engine/tactics';
import { app, userClub } from '../ctx';
import { crestHTML } from '../crest';
import { esc } from '../dom';

export function viewSeason(): string {
  const S = app.S, se = S.season, D = DIVS[se.div];
  const table = standings(se, S.name);
  const done = se.round >= ROUNDS;
  let nextHTML: string;
  if (!done) {
    const o = nextOpponent(se), T = teamInfo(S);
    nextHTML = `<div class="panel"><div class="small muted" style="text-align:center;margin-bottom:10px;letter-spacing:.08em;text-transform:uppercase">Rodada ${se.round + 1} de ${ROUNDS}</div>
     <div class="fixture"><div>${crestHTML(userClub(), 'team')}<div class="nm">${esc(S.name)}</div><div class="small muted">Geral ${T.ovr}</div></div>
     <div class="vs">×</div>
     <div>${crestHTML(o, 'team')}<div class="nm">${esc(o.n)}</div><div class="small muted">Geral ${o.str} · ${o.form}</div></div></div>
     <div class="tip">O adversário joga em <b>${STYLES[o.style].n}</b>. ${o.style === 'equilibrado' ? 'Nenhum estilo leva vantagem clara contra ele.' : `Estilo que leva vantagem: <b>${STYLES[counterOf(o.style)].n}</b>.`}</div>
     <div class="row" style="margin-top:12px"><button class="btn pri" style="flex:1" data-act="play">Jogar partida</button><button class="btn" data-act="friendly">Amistoso</button></div></div>`;
  } else {
    const pos = table.findIndex(t => t.you) + 1;
    nextHTML = `<div class="panel"><h2 style="margin-top:0">Temporada encerrada</h2><p>Você terminou em <b>${pos}º lugar</b> na ${D.n}.</p><button class="btn pri block" data-act="endSeason">Receber prêmios e começar nova temporada</button></div>`;
  }
  const last = se.last && se.last.length ? `<h3>Última rodada</h3><div class="panel" style="padding:8px 12px">${se.last.map(m => {
    const n = (i: number) => esc(se.teams[i].you ? S.name : se.teams[i].n);
    return `<div class="res"><span>${n(m[0])}</span><b>${m[2]} × ${m[3]}</b><span>${n(m[1])}</span></div>`;
  }).join('')}</div>` : '';
  return `<h2>${D.n} <span class="muted" style="font-size:18px">· Temporada ${se.num}</span></h2>
  <p class="small muted" style="margin-top:-4px">Os 3 primeiros sobem de divisão${se.div === 0 ? '' : ', os 2 últimos caem'}. Força média dos rivais: ${D.s}.</p>
  ${nextHTML}
  <h3>Classificação</h3>
  <div class="panel tbl-wrap" style="padding:6px 8px"><table><thead><tr><th>#</th><th>Time</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th><th>Pts</th></tr></thead><tbody>
  ${table.map((t, i) => `<tr class="${t.you ? 'you' : ''} ${i < 3 && se.div < 4 ? 'zone-up' : ''} ${i >= 8 && se.div > 0 ? 'zone-down' : ''}"><td>${i + 1}</td><td><span class="team-cell">${crestHTML(t.you ? userClub() : (se.teams[t.i] as { s: string; n: string; c1: string; c2: string }), 'row')}<span>${esc(t.n)}</span></span></td><td>${t.P}</td><td>${t.W}</td><td>${t.D}</td><td>${t.L}</td><td>${t.GF - t.GA > 0 ? '+' : ''}${t.GF - t.GA}</td><td><b>${t.Pts}</b></td></tr>`).join('')}
  </tbody></table></div>${last}`;
}

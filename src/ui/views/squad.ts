import { inPos } from '../../engine/cards';
import { FORM_IDS } from '../../engine/positions';
import { clamp } from '../../engine/rng';
import { SCALE_OFFSET } from '../../engine/chemistry';
import { cardByUid, outOf, teamInfo, teamStrength } from '../../engine/state';
import { MENT, STYLES, STYLE_IDS } from '../../engine/tactics';
import { cardHTML, pips } from '../card';
import { app } from '../ctx';
import { esc } from '../dom';

export function viewSquad(): string {
  const S = app.S, sel = app.sel;
  const T = teamInfo(S), { xi, chem, slots, r } = T;
  // Selo de suspenso (🟥) ou lesionado (🚑) com quantos jogos faltam
  const fora = (id: string) => { const o = outOf(S, id); return o ? `<span class="out-b ${o.t}" title="${o.t === 'susp' ? 'Suspenso' : 'Lesionado'}: ${o.n} jogo(s)">${o.t === 'susp' ? '🟥' : '🚑'}${o.n}</span>` : ''; };
  const bar = (l: string, raw: number) => { const v = raw - SCALE_OFFSET; return `<div class="bar">${l}<i><b style="width:${clamp((v - 45) / 50 * 100, 4, 100)}%"></b></i><span>${Math.round(v)}</span></div>`; };
  let pitch = `<div class="pitch"><svg class="lines" viewBox="0 0 100 140" preserveAspectRatio="none" fill="none" stroke="rgba(255,255,255,.28)" stroke-width=".5"><rect x="3" y="3" width="94" height="134"/><path d="M3 70h94"/><circle cx="50" cy="70" r="11"/><rect x="24" y="3" width="52" height="19"/><rect x="37" y="3" width="26" height="7"/><rect x="24" y="118" width="52" height="19"/><rect x="37" y="130" width="26" height="7"/></svg>`;
  slots.forEach((s, i) => {
    // Goleiro um pouco mais baixo para não ficar atrás dos zagueiros
    const P = xi[i], top = s.p === 'GOL' ? 89.5 : 7 + (100 - s.y) * .83;
    const selc = sel && sel.kind === 'xi' && sel.i === i
      ? ` style="outline:2px solid var(--gold);outline-offset:3px;border-radius:6px;left:${s.x}%;top:${top}%"`
      : ` style="left:${s.x}%;top:${top}%"`;
    if (P) {
      const oop = !inPos(P, s.p);
      pitch += `<button class="slot" data-act="slot" data-i="${i}" data-u="${P.u}"${selc} aria-label="${s.p}: ${esc(P.name)}">${cardHTML(P, 'sm', fora(P.id))}<span class="lbl ${oop ? 'oop' : ''}">${s.p} ${pips(chem.per[i])}</span></button>`;
    } else pitch += `<button class="slot empty" data-act="slot" data-i="${i}"${selc}><span class="ph">${s.p}</span></button>`;
  });
  pitch += '</div>';
  const bench = S.squad.bench.map((u, i) => {
    const P = u ? cardByUid(S, u) : null;
    return P ? `<button class="slot" data-act="bslot" data-i="${i}" data-u="${P.u}">${cardHTML(P, 'sm', fora(P.id))}<span class="lbl">RES ${P.pos}</span></button>`
      : `<button class="slot empty" data-act="bslot" data-i="${i}"><span class="ph">+</span></button>`;
  }).join('');
  return `
  <div class="summary">
    <div class="stat"><small>Força</small><b>${teamStrength(T)}</b></div>
    <div class="stat"><small>Química</small><b>${chem.total}<span class="muted" style="font-size:16px">/33</span></b></div>
    <div class="stat"><small>Formação</small><b style="font-size:22px">${S.squad.form}</b></div>
  </div>
  <div class="bars">${bar('ATA', r.att)}${bar('MEI', r.mid)}${bar('DEF', r.def)}${bar('GOL', r.gk)}</div>
  <p class="small muted" style="margin:4px 0 0">Força = média dos setores (atributos, playstyles, química e funções). É a mesma escala da Força dos adversários. Média dos overalls: ${T.ovr}.</p>
  ${pitch}
  <p class="small muted" style="margin:6px 0 0">Toque num jogador para trocar, ou <b>segure a carta e arraste</b> para outra posição (vale para as reservas também). Losangos verdes = química (0–3). Posição em amarelo = fora de posição.</p>
  <h3>Reservas</h3><div class="bench">${bench}</div>
  <div class="row" style="margin-top:6px"><button class="btn" data-act="auto">Escalar melhor time</button></div>
  <h3>Formação</h3>
  <div class="chips">${FORM_IDS.map(f => `<button class="chip" data-act="form" data-f="${f}" aria-pressed="${f === S.squad.form}">${f}</button>`).join('')}</div>
  <h3>Estilo de jogo</h3>
  <div class="chips">${STYLE_IDS.map(k => `<button class="chip" data-act="style" data-s="${k}" aria-pressed="${k === S.tac.style}">${STYLES[k].n}</button>`).join('')}</div>
  <div class="style-desc">${STYLES[S.tac.style].d}</div>
  <h3>Mentalidade</h3>
  <div class="chips">${MENT.map((m, i) => `<button class="chip" data-act="ment" data-m="${i}" aria-pressed="${i === S.tac.ment}">${m}</button>`).join('')}</div>
  <p class="small muted">Mais ofensivo cria mais chances e também deixa mais espaço atrás. Dá para mudar tudo isso durante a partida.</p>`;
}

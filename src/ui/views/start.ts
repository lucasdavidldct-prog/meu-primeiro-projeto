// Começo da carreira: escolha do clube real (padrão: Atlético Mineiro).
import { clubStrength } from '../../engine/squads';
import { W, leagueClubs } from '../../engine/world';
import { app } from '../ctx';
import { crestHTML } from '../crest';
import { esc } from '../dom';

export function viewStart(): string {
  const lg = app.startLiga, clubs = leagueClubs(lg).slice().sort((a, b) => a.n.localeCompare(b.n, 'pt-BR'));
  const sel = W.clubs.get(app.startClub);
  const serieB = sel?.lg === 'serie-b';
  return `<h2>Modo carreira</h2>
  <p class="small muted" style="margin-top:-4px">Escolha o seu clube. O elenco real vira as suas cartas iniciais; os pacotes trazem jogadores de qualquer liga.</p>
  ${app.S.cards.length ? '<div class="tip" style="border-color:var(--warn)">Começar uma carreira substitui a coleção e o save atuais.</div>' : ''}
  <div class="chips" style="margin-top:12px">${[['brasileirao', 'Série A'], ['serie-b', 'Série B']].map(([k, n]) => `<button class="chip" data-act="stLiga" data-l="${k}" aria-pressed="${k === lg}">${n}</button>`).join('')}</div>
  <div class="club-grid">${clubs.map(c => `<button class="club-tile ${c.id === app.startClub ? 'on' : ''}" data-act="stClub" data-c="${c.id}" aria-pressed="${c.id === app.startClub}">${crestHTML(c, 'mid')}<b>${esc(c.n)}</b><span class="muted small">Força ${clubStrength(c.id)}</span></button>`).join('')}</div>
  <div class="panel" style="margin-top:14px">
    <div class="row" style="justify-content:space-between"><span>Temporada curta (só turno, 19 rodadas)</span><button class="chip" data-act="stShort" aria-pressed="${app.startShort}">${app.startShort ? 'Sim' : 'Não'}</button></div>
    <div class="row" style="justify-content:space-between;margin-top:10px"><span>Jogar a Libertadores já na 1ª temporada</span><button class="chip" data-act="stLib" aria-pressed="${app.startLib && !serieB}" ${serieB ? 'disabled' : ''}>${app.startLib && !serieB ? 'Sim' : 'Não'}</button></div>
    <div class="row" style="justify-content:space-between;margin-top:10px"><span>Modo teste (+1.000.000 moedas)</span><button class="chip" data-act="stRich" aria-pressed="${app.startRich}">${app.startRich ? 'Sim' : 'Não'}</button></div>
    <p class="small muted" style="margin:8px 0 0">Sem essa opção, as vagas vêm só pela classificação: os 5 primeiros do Brasileirão (e o campeão da Libertadores) jogam a edição seguinte.${serieB ? ' Clubes da Série B começam brigando pelo acesso.' : ''}</p>
  </div>
  <button class="btn pri block" style="margin-top:14px" data-act="stGo">Começar carreira com ${esc(sel?.n ?? '')}</button>`;
}

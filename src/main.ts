// Fontes: só latin e latin-ext (nomes como Błaszczykowski, Hamšík, Čech); sem os conjuntos que o jogo não usa.
import '@fontsource/saira/latin-400.css';
import '@fontsource/saira/latin-ext-400.css';
import '@fontsource/saira/latin-500.css';
import '@fontsource/saira/latin-ext-500.css';
import '@fontsource/saira/latin-600.css';
import '@fontsource/saira/latin-ext-600.css';
import '@fontsource/saira/latin-700.css';
import '@fontsource/saira/latin-ext-700.css';
import '@fontsource/saira-extra-condensed/latin-600.css';
import '@fontsource/saira-extra-condensed/latin-ext-600.css';
import '@fontsource/saira-extra-condensed/latin-700.css';
import '@fontsource/saira-extra-condensed/latin-ext-700.css';
import '@fontsource/saira-extra-condensed/latin-800.css';
import '@fontsource/saira-extra-condensed/latin-ext-800.css';
import '@fontsource/saira-extra-condensed/latin-900.css';
import '@fontsource/saira-extra-condensed/latin-ext-900.css';
import './ui/styles.css';
import { blankGame } from './engine/state';
import { flushSave, loadSave } from './save/db';
import { loadEditedLigas } from './save/dados';
import { applyEdits } from './engine/world';
import { startApp } from './ui/app';
import { applyEvolution } from './engine/evolution';
import { devMoment } from './ui/matchView';
import { loadMinhasFotos } from './ui/fotos';

async function boot(): Promise<void> {
  // Correções feitas no Editor de elencos (quando não há servidor local) valem por cima dos arquivos.
  try { const edits = await loadEditedLigas(); if (Object.keys(edits).length) applyEdits(edits); }
  catch (e) { console.warn('Não foi possível ler as edições de elenco', e); }
  try { await loadMinhasFotos(); } catch (e) { console.warn('Não foi possível ler as fotos', e); }
  let S = null;
  try { S = await loadSave(); } catch (e) { console.warn('Não foi possível ler o save', e); }
  if (!S) { S = blankGame(); await flushSave(S).catch(e => console.warn('Não foi possível salvar', e)); }
  applyEvolution(S.evo);
  startApp(S);
  if (import.meta.env.DEV) Object.assign(window, { __esquadrao: { devMoment } });
}
void boot();

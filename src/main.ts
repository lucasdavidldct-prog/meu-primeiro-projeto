import '@fontsource/saira/400.css';
import '@fontsource/saira/500.css';
import '@fontsource/saira/600.css';
import '@fontsource/saira/700.css';
import '@fontsource/saira-extra-condensed/600.css';
import '@fontsource/saira-extra-condensed/700.css';
import '@fontsource/saira-extra-condensed/800.css';
import '@fontsource/saira-extra-condensed/900.css';
import './ui/styles.css';
import { newGame } from './engine/state';
import { flushSave, loadSave } from './save/db';
import { loadEditedLigas } from './save/dados';
import { applyEdits } from './engine/world';
import { startApp } from './ui/app';

async function boot(): Promise<void> {
  // Correções feitas no Editor de elencos (quando não há servidor local) valem por cima dos arquivos.
  try { const edits = await loadEditedLigas(); if (Object.keys(edits).length) applyEdits(edits); }
  catch (e) { console.warn('Não foi possível ler as edições de elenco', e); }
  let S = null;
  try { S = await loadSave(); } catch (e) { console.warn('Não foi possível ler o save', e); }
  if (!S) { S = newGame(); await flushSave(S).catch(e => console.warn('Não foi possível salvar', e)); }
  startApp(S);
}
void boot();

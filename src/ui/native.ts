// Integração com o app Android (Capacitor). No navegador tudo aqui vira no-op.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const isNative = (): boolean => Capacitor.isNativePlatform();

export function haptic(kind: 'leve' | 'medio' | 'forte'): void {
  const style = kind === 'forte' ? ImpactStyle.Heavy : kind === 'medio' ? ImpactStyle.Medium : ImpactStyle.Light;
  void Haptics.impact({ style }).catch(() => {});
}

const click = (sel: string): boolean => {
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) return false;
  el.click(); return true;
};

/** Botão "voltar" do Android: fecha o que estiver aberto por cima, na ordem em que aparece na tela. */
function onBack(): void {
  if (document.querySelector('.moment, .m3d')) return; // lance em andamento: precisa terminar a jogada
  if (click('.walk')) return;
  if (document.getElementById('sheet')) { click('#sheet'); return; } // toque fora = fechar
  if (document.getElementById('reveal')) { click('#reveal [data-act="closeReveal"]'); return; }
  if (document.getElementById('match')) {
    if (click('#match [data-act="closeMatch"]')) return;
    if (!document.querySelector('#match [data-act="mPause"][aria-pressed="true"]')) click('#match [data-act="mPause"]');
    return;
  }
  if (click('[data-act="edBack"]')) return;
  const cur = document.querySelector<HTMLElement>('#tabs button[aria-current="true"]');
  if (cur && cur.dataset.t !== 'season' && click('#tabs button[data-t="season"]')) return;
  void App.minimizeApp();
}

/** Prepara o app nativo: barra de status, botão voltar, gravação ao minimizar. */
export async function initNative(flush: () => void): Promise<void> {
  if (!isNative()) return;
  document.documentElement.classList.add('native');
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0a1511' });
  } catch (e) { console.warn('Barra de status', e); }
  void App.addListener('backButton', onBack);
  void App.addListener('pause', flush);
  void SplashScreen.hide().catch(() => {});
}

/** Exporta um arquivo no celular: grava no cache e abre o menu de compartilhar (Drive, Arquivos, WhatsApp…). */
export async function shareFile(name: string, text: string): Promise<void> {
  const w = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: 'Save do Esquadrão FC', files: [w.uri], dialogTitle: 'Guardar save' });
}

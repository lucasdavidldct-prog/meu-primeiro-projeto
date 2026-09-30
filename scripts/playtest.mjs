// npm run playtest — abre o jogo num navegador de verdade (desktop e celular), começa uma carreira,
// passa por todas as abas, tira prints e falha se aparecer erro no console.
// Uso: npm run playtest [-- --out=pasta] [-- --url=http://localhost:5173/]
// Sem --url, sobe um servidor Vite temporário. Playwright: usa o instalado no projeto ou o global do ambiente.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const arg = (k, d) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const out = arg('out', 'playtest-out');
let url = arg('url', '');
mkdirSync(out, { recursive: true });

async function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { return await import(p); } catch { /* tenta o próximo */ }
  }
  throw new Error('Playwright não encontrado (npm i -D playwright ou use o do ambiente).');
}

let server;
if (!url) {
  const port = 5199;
  server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
  // Espera o servidor responder (até 30 s)
  for (let i = 0; ; i++) {
    try { if ((await fetch(`http://localhost:${port}/`)).ok) break; } catch { /* ainda subindo */ }
    if (i > 60) throw new Error('Vite não subiu em 30 s');
    await new Promise(r => setTimeout(r, 500));
  }
  url = `http://localhost:${port}/`;
}

const { chromium, devices } = await loadPlaywright();
const errors = [];
const step = m => console.log('·', m);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [label, opts] of [['desktop', { viewport: { width: 1280, height: 800 } }], ['celular', { ...devices['Pixel 7'] }]]) {
    const ctx = await browser.newContext(opts), page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errors.push(`[${label}] ${m.text()}`); });
    page.on('pageerror', e => errors.push(`[${label}] pageerror: ${e.message}`));
    // Fotos vêm da Wikimedia: não espera imagens (sem rede, o evento load demoraria)
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-act="stGo"]');
    await page.screenshot({ path: `${out}/${label}-inicio.png` });
    step(`${label}: começando carreira`);
    await page.click('[data-act="stGo"]');
    await page.waitForSelector('.help');
    await page.click('.sheet [data-act="closeSheet"]');
    for (const t of ['season', 'squad', 'store', 'club']) {
      step(`${label}: aba ${t}`);
      await page.click(`#tabs button[data-t="${t}"]`);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/${label}-${t}.png`, fullPage: true });
    }
    await ctx.close();
    console.log(`${label}: ok`);
  }
} finally {
  await browser.close();
  // mata o grupo inteiro (npx + vite)
  if (server) try { process.kill(-server.pid); } catch { /* já saiu */ }
}
console.log(`Prints em ${out}/`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Console sem erros.');

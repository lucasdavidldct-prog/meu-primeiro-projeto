// Gera arte/icone-play-store-512.png (imagem da Play Store) e arte/icone-previa.png a partir de arte/icone.svg.
// Precisa do Playwright: npx playwright install chromium && node tools/gerar-icone-png.cjs
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const svg = fs.readFileSync(require('path').join(__dirname, '..', 'arte', 'icone.svg'), 'utf8');
  const uri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  const storeUri = 'data:image/svg+xml;base64,' + Buffer.from(svg.replace('viewBox="0 0 108 108"', 'viewBox="16 16 76 76"')).toString('base64');
  const b = await chromium.launch();
  // Play Store: 512x512 quadrado cheio (a loja arredonda sozinha)
  let p = await b.newPage({ viewport: { width: 512, height: 512 } });
  await p.setContent(`<body style="margin:0"><img src="${storeUri}" width="512" height="512">`);
  await p.screenshot({ path: require('path').join(__dirname, '..', 'arte', 'icone-play-store-512.png') });
  // Prévia: como aparece no celular (formas de ícone e tamanho real na tela inicial)
  p = await b.newPage({ viewport: { width: 760, height: 330 }, deviceScaleFactor: 2 });
  // O ícone adaptável mostra só o miolo (72 de 108): recorta com zoom de 1,5x
  const ic = (shape, size) => `<div style="width:${size}px;height:${size}px;overflow:hidden;border-radius:${shape};background:url(${uri}) center/150% no-repeat;box-shadow:0 3px 8px rgba(0,0,0,.25)"></div>`;
  const app = (size, label) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;font:13px sans-serif;color:#fff">${ic('50%', size)}<span>${label}</span></div>`;
  await p.setContent(`<body style="margin:0;background:linear-gradient(135deg,#3a2f6b,#b04a7c);font-family:sans-serif">
    <div style="display:flex;gap:28px;padding:22px;align-items:flex-end">
      ${ic('50%',160)}${ic('22%',160)}${ic('34% 34% 34% 34% / 30% 30% 30% 30%',160)}
    </div>
    <div style="display:flex;gap:26px;padding:0 22px 16px;align-items:flex-start">
      ${app(58,'Troco Certo')}
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;font:13px sans-serif;color:#fff"><div style="width:58px;height:58px;border-radius:50%;background:#4285f4"></div><span>Outro app</span></div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;font:13px sans-serif;color:#fff"><div style="width:58px;height:58px;border-radius:50%;background:#34a853"></div><span>Outro app</span></div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;font:13px sans-serif;color:#fff"><div style="width:58px;height:58px;border-radius:50%;background:#fbbc05"></div><span>Outro app</span></div>
    </div>`);
  await p.screenshot({ path: require('path').join(__dirname, '..', 'arte', 'icone-previa.png') });
  await b.close();
})();

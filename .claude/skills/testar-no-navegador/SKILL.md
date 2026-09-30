---
name: testar-no-navegador
description: Joga o Esquadrão FC num navegador de verdade (Playwright/Chromium, desktop e celular) para achar erros de console, telas quebradas e problemas de usabilidade, incluindo os lances 3D e o lance de goleiro. Use depois de mudar telas, CSS, lances ou fluxo da carreira, ou quando pedirem "jogue e veja o que melhorar".
---

# Testar no navegador

## Rodada rápida (sempre)
```bash
npm run playtest                                   # sobe um Vite temporário
npm run playtest -- --url=http://localhost:5173/   # usa o servidor que já está rodando
```
- Passa por Início → Carreira → abas Temporada, Elenco, Loja e Clube, em desktop e em celular (Pixel 7).
- Os prints ficam em `playtest-out/`: abra os PNG com a ferramenta Read e olhe de verdade (texto cortado, sobreposição, contraste).
- A execução falha se aparecer erro no console.

## Roteiros específicos
Para ir além, escreva um script `.mjs` no scratchpad:
- Importe o Playwright de `/opt/node22/lib/node_modules/playwright/index.mjs`.
- Use `page.goto(url, { waitUntil: 'domcontentloaded' })`. As fotos vêm da Wikimedia, que costuma estar bloqueada aqui, e o evento `load` demoraria.

Atalhos (só em dev):
- `window.__esquadrao.devMoment(kind, pen?)` abre um lance direto. `kind` pode ser `'ataque' | 'contra' | 'falta' | 'penalti' | 'goleiro'`.
  - Nos lances 3D, simule o traço com `page.mouse` (down, vários move, up).
  - Depois remova `.moment` se o roteiro seguir.
- Para renderizar cartas soltas, importe módulos dentro de `page.evaluate`:
  ```js
  await import('/src/ui/card.ts')
  ```
  Exemplos: `cardHTML(cardData(id, 'lenda'), 'lg')`, ícones com `psIcon(id)`.
- O 3D precisa de `--use-angle=swiftshader --enable-unsafe-swiftshader` no `chromium.launch`.

## O que relatar
- Erros de console e o passo que os causou.
- Problemas visuais, com o print.
- Sugestões de melhoria pensando no jogador (celular primeiro): lista curta e priorizada.

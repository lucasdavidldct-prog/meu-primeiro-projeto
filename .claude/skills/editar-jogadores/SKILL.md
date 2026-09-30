---
name: editar-jogadores
description: Adiciona, atualiza ou remove jogadores reais e lendas (Ídolos, Heróis, Hall da Fama) nos JSON de data/ do Esquadrão FC, mantendo o formato, as nações, as fotos e os saves consistentes. Use quando pedirem para atualizar elencos, transferências, notas ou listas de lendas.
---

# Editar jogadores e lendas

## Onde fica cada coisa
- **Jogadores atuais**: `data/ligas/<liga>.json` → `clubes[].elenco[]`.
- **Lendas**: `data/lendas.json` → `lendas[]`, com os campos extras:
  - `clubeHistorico`, `epoca`, `categoria` (`idolo` | `heroi` | `hall`);
  - `clube`, opcional: sigla do clube atual ligado à lenda (ex.: `CAM`).
- **Esquema completo**: `src/engine/data/schema.ts` (`JogadorData`, `LendaData`, lista `PLAYSTYLES`).
- **Nações**: `data/nacoes.json`, código de 3 letras. Nação nova precisa de `nome`, `cores` (3 cores) e `horizontal`, se for o caso.

## Regras
- **Atributos**:
  - Linha: `RIT FIN PAS DRI DEF FIS`.
  - Goleiro (`posicao: "GOL"`): `MER MAN CHU REF VEL POS`.
- **Estilos de jogo**:
  - No máximo 6, só ids que existem em `PLAYSTYLES`; `id+` = dourado.
  - Estilos de goleiro só em goleiros.
- **Ids**:
  - Lenda: `lenda-<slug-do-nomeCurto>`.
  - Mesma pessoa em duas categorias: sufixo, ex. `lenda-lucio-heroi`.
  - Nunca reaproveite um id para outra pessoa: o save guarda cartas pelo id.
- **Notas**:
  - Estimativas próprias e coerentes com a escala.
  - Lendas: Ídolo 87–98, Herói 85–90, Hall da Fama 84–88.
- **Galo (CAM)**: ídolos do Atlético Mineiro nunca são removidos, mesmo quando pedirem para refazer as listas.
- **Remoções**: ao tirar alguém, as cartas somem dos saves (`sanitizeState`). Lendas removidas devolvem moedas (`src/save/db.ts`); avise o usuário disso.

## Fluxo
1. Edite os JSON. Para listas grandes, gere com um script no scratchpad em vez de editar à mão.
2. Rode:
   ```bash
   npm run formatar-dados   # um jogador por linha
   npm run validar-dados    # ids, nações, clubes, atributos
   npm test
   ```
3. **Fotos**: o CI busca sozinho quem não está em `data/fotos.json`. Localmente a Wikimedia costuma estar bloqueada; não force.
4. Atualize `tests/lendas.test.ts` se mudou alguma regra das listas.
5. Siga a skill `lancar-versao` para publicar.

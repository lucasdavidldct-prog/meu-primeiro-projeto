# Troco Certo

**Desafio do Dia**: um minijogo diário, igual para todo o Brasil, em que você devolve o troco com notas e moedas de Real o mais rápido possível. O ranking compara jogadores e estados.

## Rodar no seu computador

Precisa só do [Node.js](https://nodejs.org) 18 ou mais novo. Não há dependências para instalar.

```bash
npm start          # abre em http://localhost:3000
npm test           # roda os testes do servidor
```

## Como o jogo funciona

- 5 clientes por dia. O desafio vira à meia-noite de Brasília e é o mesmo para todo mundo (gerado a partir da data).
- Troco errado: +5s. Cada peça além do mínimo possível: +2s.
- O resultado sai em quadradinhos (🟩 perfeito, 🟨 com erro ou peça a mais) para compartilhar no WhatsApp.
- "Treinar" gera clientes aleatórios e não conta para o ranking.

## Níveis

Fora do ranking, a criança joga quantas vezes quiser em 3 níveis. Terminar um nível libera o próximo, e o recorde de estrelas fica salvo no aparelho.

| Nível | Como é |
|---|---|
| 🐣 Iniciante | Preços redondos (de 50 em 50 centavos), trocos pequenos e dica do valor do troco depois de um erro |
| 🦊 Intermediário | Centavos quebrados e notas de até R$ 50 |
| 🦁 Avançado | Valores até R$ 200 e clientes que dão moedas a mais para facilitar o troco |

## Música e sons

A música de fundo e os efeitos ficam em `public/sons/`. Eles são compostos em código, no estilo de videogame antigo (chiptune), por `tools/gerar-audio.mjs`. Para mudar e gerar de novo:

```bash
npm install
npm run audio
```

## Como o ranking funciona

| Arquivo | O que faz |
|---|---|
| `public/index.html` | O jogo. |
| `public/regras.js` | As regras (desafio do dia, pontuação). Usado pelo jogo **e** pelo servidor. |
| `server.js` | Serve o jogo e a API do ranking. Guarda os resultados em `dados/resultados.jsonl`. |

**Contra trapaça:** o navegador manda só as notas e moedas usadas em cada cliente e o tempo. O servidor refaz o desafio do dia, confere se cada troco bate, recusa tempos impossíveis (rápido demais para um humano) e calcula a pontuação ele mesmo. Cada jogador (identificado por um código salvo no navegador) só entra uma vez por dia.

**Placar dos estados:** média de tempo dos jogadores do estado. Um estado só entra no placar com pelo menos 3 jogadores.

API:
- `POST /api/resultado` com `{ day, uf, playerId, rounds: [{ pieces: { "1000": 1, "25": 2 }, ms, wrong }] }`
- `GET /api/ranking?day=AAAA-MM-DD&uf=SP&playerId=...`
- `GET /api/saude`

## Colocar no ar (Render, plano grátis)

1. Crie uma conta em [render.com](https://render.com) entrando com o GitHub.
2. Clique em **New > Blueprint** e escolha este repositório e o branch com o código.
3. O Render lê o `render.yaml` e cria o serviço `troco-certo`. Em alguns minutos o jogo fica em `https://troco-certo.onrender.com` (ou um nome parecido, se esse já existir).

Limites do plano grátis:
- O servidor dorme depois de 15 minutos sem uso. O primeiro acesso depois disso demora cerca de 1 minuto.
- O disco é apagado quando o servidor reinicia ou recebe código novo, e o ranking some junto. Serve para testar com amigos. Para valer, use um VPS ou um serviço com disco (`Dockerfile` pronto, com volume em `/data`).

Variáveis de ambiente: `PORT` (padrão 3000) e `DATA_DIR` (padrão `./dados`).

## App Android (APK)

O GitHub gera o APK sozinho a cada mudança em `public/` ou `android/` (workflow `.github/workflows/apk.yml`) e publica na página de Releases, com o nome **Troco Certo (teste)**.

- O jogo vai dentro do APK e abre na hora, mesmo sem internet. Só o ranking usa o servidor.
- O endereço do servidor vem de `TROCO_API_URL`. Se o Render der outro nome, crie essa variável em *Settings > Secrets and variables > Actions > Variables* e rode o workflow de novo.
- O APK é assinado com uma chave de teste (`android/app/teste.keystore`), então versões novas instalam por cima. Para a Play Store, será preciso uma chave própria, guardada fora do repositório.

Para gerar no computador: copie o conteúdo de `public/` (com a pasta `fonts/`) para `android/app/src/main/assets/` e rode `gradle assembleRelease` dentro de `android/` (precisa do Android SDK).

## Próximos passos

- Ranking por cidade.
- Empacotar como app Android (PWA/TWA) para publicar na Play Store.
- Quando passar de alguns milhares de jogadores por dia: trocar o arquivo por um banco de dados (SQLite ou Postgres).

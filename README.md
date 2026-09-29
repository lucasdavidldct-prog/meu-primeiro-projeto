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

## Colocar no ar

O servidor precisa de um **disco que não se apaga**, porque os resultados ficam num arquivo. Opções:

1. **VPS** (a mais barata para rodar direto, cerca de R$ 25 a R$ 40 por mês): instale o Node, clone o repositório e rode `npm start` com [pm2](https://pm2.keymetrics.io) para ficar sempre ligado.
2. **Railway ou Fly.io**: usam o `Dockerfile` deste repositório. Crie um volume montado em `/data` (o servidor já grava lá via `DATA_DIR=/data`).
3. **Render (plano grátis)**: serve para testar com amigos, mas o disco grátis é apagado quando o servidor reinicia, e o ranking some junto.

Variáveis de ambiente: `PORT` (padrão 3000) e `DATA_DIR` (padrão `./dados`).

## Próximos passos

- Ranking por cidade.
- Empacotar como app Android (PWA/TWA) para publicar na Play Store.
- Quando passar de alguns milhares de jogadores por dia: trocar o arquivo por um banco de dados (SQLite ou Postgres).

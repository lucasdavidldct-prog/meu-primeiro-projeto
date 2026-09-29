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

## Para quem ainda não sabe ler

- A Moedinha **fala**: as instruções da tela inicial, o pedido de cada cliente (com o preço e quanto ele pagou), os erros e acertos, e as mensagens da lojinha. Tocar num balão repete a fala. No app Android usa a voz do próprio celular; no navegador, a voz do navegador.
- O menu inicial usa ícones grandes e cores: a Moedinha explica "botão verde, amarelo e branco".
- O estado (para o ranking) fica na **Área dos pais**, que abre segurando o botão por 2 segundos.

## Minha lojinha

Cada cliente atendido rende moedinhas 🪙: 2 por troco certo, mais 2 se for perfeito, mais 3 por estrela e 10 de bônus no desafio do dia. Com elas a criança compra decoração para a loja onde atende os clientes: parede, balcão, prateleira, bichinho e enfeite (33 itens, de 15 a 90 moedinhas). A carteira e a decoração ficam salvas no aparelho.

Duas categorias especiais, em `public/regional.js`:
- **Brasil:** 55 itens típicos dos 27 estados (pão de queijo, acarajé, chimarrão, frevo…), todos juntos numa aba só.
- **Antigamente:** 11 brinquedos da infância dos pais e avós (peão, bolinha de gude, peteca, bilboquê, carrinho de rolimã, bichinho virtual…).

Os itens que não existem em emoji são desenhados em SVG no mesmo arquivo.

## Música e sons

A música de fundo e os efeitos ficam em `public/sons/`. Eles são compostos em código, no estilo de videogame antigo (chiptune), por `tools/gerar-audio.mjs`. Para mudar e gerar de novo:

```bash
npm install
npm run audio
```

## Ícone

A Moedinha é desenhada em `tools/gerar-icone.py`, que gera o ícone do Android (`android/app/src/main/res/drawable/ic_launcher_*.xml`), `arte/icone.svg` e o favicon. A imagem de 512×512 para a Play Store é `arte/icone-play-store-512.png` (gerada por `tools/gerar-icone-png.cjs`).

## Como o ranking funciona

| Arquivo | O que faz |
|---|---|
| `public/index.html` | O jogo. |
| `public/regras.js` | As regras (desafio do dia, pontuação, apelidos). Usado pelo jogo **e** pelo servidor. |
| `server.js` | Serve o jogo, a API do ranking, o painel do dono e os códigos de recuperação. Guarda tudo em `dados/`. |
| `integridade.js` | Verificação do Play Integrity (desligada até a publicação). |
| `admin/index.html` | Painel do dono, em `/admin`. |

**Sem login e sem nome.** Cada aparelho ganha um código aleatório. No ranking aparece só um **apelido sorteado** de listas prontas (ex.: "🐆 Onça Veloz 7"); o servidor recusa qualquer outra combinação. A criança troca o apelido no 🎲.

**Contra trapaça:**
- O servidor refaz os 5 clientes do dia, confere cada troco e calcula a pontuação ele mesmo.
- **Tempo medido no servidor:** o jogo avisa quando cada cliente aparece, quando o troco é entregue e quando pausa. Vale o **maior** entre o tempo que o celular diz e o tempo medido (com 1,5 s de folga para a internet). Declarar um tempo menor não adianta.
- Um resultado por jogador por dia; limites de pedidos por minuto.
- **Play Integrity** (quando ligado): prova que o resultado veio do app original da Play Store num celular de verdade.
- **Painel do dono** para remover resultados suspeitos.

**Placar dos estados:** média de tempo dos jogadores do estado. Um estado só entra no placar com pelo menos 3 jogadores.

API principal:
- `POST /api/resultado`: `{ day, uf, playerId, nick, rounds: [{ pieces, ms, wrong }], integrity? }`
- `POST /api/evento`: `{ day, playerId, round, tipo: inicio|fim|pausa|volta }`
- `GET /api/ranking?day=AAAA-MM-DD&uf=SP&playerId=...`
- `POST /api/apelido`, `POST /api/nonce`, `POST /api/backup`, `GET /api/backup/:codigo`, `GET /api/saude`

## Painel do dono

Abra `https://SEU-SERVIDOR/admin` e digite a senha (`ADMIN_TOKEN`). No Render ela é gerada sozinha: veja em **Environment**. O painel lista os resultados do dia com tempo declarado × medido, erros e alertas (rápido demais, sem medição, integridade), e permite **remover** ou **devolver** um resultado.

## Código de recuperação

Na Área dos pais, "Criar código de recuperação" gera algo como `pipa-caju-sapo-42`. Ele guarda moedinhas, decoração, níveis, apelido e estado (nada pessoal) e é atualizado sozinho depois de cada partida. No celular novo, "Já tem um código?" restaura tudo. Só o aparelho que criou o código consegue atualizá-lo; tentativas de adivinhar são limitadas a 10 por minuto.

## Play Integrity (ligar na publicação)

Tudo já está no código; falta a configuração, que depende da conta na Play Store:

1. No **Google Cloud**, crie um projeto e ative a **Play Integrity API**. Anote o **número do projeto**.
2. Na **Play Console**, em *Integridade do app*, vincule esse projeto.
3. No Google Cloud, crie uma **conta de serviço**, gere uma chave JSON.
4. No GitHub, em *Settings > Secrets and variables > Actions > Variables*, crie `PLAY_CLOUD_PROJECT` com o número do projeto (o próximo APK já pede o token).
5. No Render, adicione `GOOGLE_SERVICE_ACCOUNT` com o conteúdo do JSON e mude `INTEGRITY_MODE` para `log`. Olhe o painel por alguns dias: resultados legítimos devem aparecer como "app original".
6. Quando estiver tudo certo, mude `INTEGRITY_MODE` para `require`: resultados sem prova do Google passam a ser recusados.

## Colocar no ar (Render, plano grátis)

1. Crie uma conta em [render.com](https://render.com) entrando com o GitHub.
2. Clique em **New > Blueprint** e escolha este repositório e o branch com o código.
3. O Render lê o `render.yaml` e cria o serviço `troco-certo`. Em alguns minutos o jogo fica em `https://troco-certo.onrender.com` (ou um nome parecido, se esse já existir).

Limites do plano grátis:
- O servidor dorme depois de 15 minutos sem uso. O primeiro acesso depois disso demora cerca de 1 minuto.
- O disco é apagado quando o servidor reinicia ou recebe código novo, e o ranking some junto. Serve para testar com amigos. Para valer, use um VPS ou um serviço com disco (`Dockerfile` pronto, com volume em `/data`).

Variáveis de ambiente: `PORT` (padrão 3000), `DATA_DIR` (padrão `./dados`), `ADMIN_TOKEN` (senha do painel, mínimo 12 caracteres), `INTEGRITY_MODE` (`off`, `log` ou `require`), `GOOGLE_SERVICE_ACCOUNT` (JSON da conta de serviço) e `PLAY_PACKAGE` (padrão `app.trococerto`).

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

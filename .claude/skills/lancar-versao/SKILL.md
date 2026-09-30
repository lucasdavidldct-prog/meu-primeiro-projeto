---
name: lancar-versao
description: Publica uma nova versão do Esquadrão FC — checagens, versão no package.json, seção no README, commit, push e acompanhamento do build do APK no GitHub Actions até sair a release esquadrao-apk. Use quando terminar uma rodada de mudanças ou quando pedirem "gerar o APK" / "lançar versão".
---

# Lançar versão

1. **Checar tudo** (tem que passar):
   ```bash
   npm run checar && npm run build
   ```
   Se mexeu no motor, rode também `npm run calibrar` e confira os alvos do CLAUDE.md.
   Se mexeu em tela, rode `npm run playtest` e olhe os prints em `playtest-out/`.
2. **Versão**:
   - Mudanças visíveis ao jogador: suba o minor (`1.5.x` → `1.6.0`). Correções e ajustes: suba o patch.
   - Troque em `package.json` e na primeira ocorrência do nome do app em `package-lock.json`.
3. **README**: adicione `## Versão X.Y.Z` acima da anterior, com bullets em pt-BR contando o que o jogador vai notar.
4. **Commit**:
   - Título em pt-BR no imperativo/descritivo, corpo com bullets.
   - Termine com as linhas de atribuição pedidas pela sessão.
   - Nunca coloque identificador de modelo no commit.
5. **Push** na branch de trabalho:
   ```bash
   git fetch origin <branch> && git merge --no-edit origin/<branch>   # o bot do CI pode ter gravado fotos
   git push -u origin <branch>
   ```
6. **Acompanhar o CI** (workflow "APK Android", `.github/workflows/apk.yml`):
   - Liste as execuções da branch com as ferramentas do GitHub e espere `completed`.
   - Espere com `sleep` em segundo plano, nunca em loop no primeiro plano.
   - Falhou? Leia o log do job com falha, corrija a causa real e envie de novo. Nunca desligue nem pule um teste.
   - Deu certo? O bot pode ter commitado `data/fotos.json`; traga para o local com `git fetch` + merge.
7. **Avisar o usuário** em pt-BR:
   - Link da release: https://github.com/lucasdavidldct-prog/meu-primeiro-projeto/releases/tag/esquadrao-apk
   - O que mudou, como testar e decisões de design relevantes.

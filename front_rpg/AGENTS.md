## Architecture
- Keep the game presentation at the index route, with reusable design-system controls and bundled artwork; the landing page must work without a game service connection.
- Keep class attributes in one shared module (`src/lib/class-stats.ts`) that both the landing page and the character creation screen read from, so the two surfaces can never show different numbers for the same class.
- Scale pixel-art sprites only in integer multiples of their native size (pass the native size through the `--sprite-size` CSS custom property and multiply in CSS), so enlarged artwork stays crisp instead of blurring.

## O front e o jogo sao dois apps, e o mapa entra por iframe

Contexto de operacao, para eu nao quebrar o fluxo sem querer.

A rota `/jogo` (`src/routes/jogo.tsx`) nao importa o jogo: ela monta um
`<iframe src={urlDoJogo()}/jogo.html>`. O mapa e o bundle do projeto da RAIZ,
servido pelo Node (producao) ou pelo Vite do jogo (dev, porta 5173).

Consequencias que costumam virar bug:

- `src/lib/api.ts` tem DUAS urls que nao podem ser confundidas. `urlDaApi()`
  e a API de conta (8787). `urlDoJogo()` e de onde o mapa e carregado (5173
  em dev, a origem em producao). Trocar uma pela outra quebra o fluxo
- o token de entrada NUNCA vai na URL. Vai no `sessionStorage`, a rota `/jogo`
  le e apaga, e repassa ao iframe por `postMessage` com o campo `origem`
- o jogo confere esse `origem` contra o `document.referrer` dele. Mudar quem
  embute o iframe sem mudar essa checagem trava o mapa em "carregando"

## NAO SUBIR SERVIDOR NEM FRONT

Regra do usuario. Vale sempre.

**Nao rodar** `npm run dev` aqui dentro, nem `npm run start` / `npm run dev:web`
na raiz. O usuario sobe e faz a playteste.

Se precisar conferir se algo esta no ar, ler as portas
(`Get-NetTCPConnection -State Listen`) nao sobe nada.

## Responder ANTES de agir

Quando a pergunta nao pedir mudanca de codigo, **responder a pergunta** e
parar. So sai executando depois que a resposta foi dada.

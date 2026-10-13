# RavenDorn — front

O front do **RavenDorn**: a vitrine do jogo. E um app separado do jogo em si.

## O que e este app

A vitrine e oroteador de entrada. Ela mostra o jogo para quem ainda nao tem
conta, cria os personagens, guarda a sessao e so entao monta o jogo dentro de
um `iframe`.

O jogo **nao** faz parte deste build. Ele e o projeto da raiz do
repositorio, servido pelo Node (producao) ou pelo Vite do jogo (dev, porta
5173). A rota `/jogo` nao importa nada do motor: ela so monta o `<iframe>`.

Duas urls no `src/lib/api.ts` que nao podem ser confundidas:

- `urlDaApi()` e a API de conta, na 8787
- `urlDoJogo()` e de onde o mapa e carregado (5173 em dev, a propria origem em
  producao)

## Desenvolvimento

Precisa de Node.js e npm.

```sh
npm i
npm run dev      # front em :3000
```

O front sozinho mostra a vitrine, mas a rota `/jogo` precisa do jogo no ar.
Para o fluxo completo, suba os tres processos da raiz do repositorio: o
servidor Node (API e WebSocket), o `dev:web` (o mapa, com HMR) e este front.

## Scripts

| script | o que faz |
|---|---|
| `npm run dev` | front em `:3000` |
| `npm run build` | build de producao (cliente, SSR e Nitro) |
| `npm run preview` | serve o build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |

## Estrutura

| caminho | o que mora la |
|---|---|
| `src/routes/` | as telas: vitrine, entrada, personagens, conta, `/jogo` |
| `src/components/marca-projeto.tsx` | o nome do projeto e a logo |
| `src/lib/class-stats.ts` | os atributos das classes, lidos pelas duas telas |
| `src/lib/api.ts` | sessao, token e as duas urls |
| `src/assets/` | arte empacotada pelo build |

## Stack

- TanStack Start
- React
- TypeScript
- Tailwind CSS

## O token de entrada

O token **nunca** vai na URL. Ele vai no `sessionStorage`, a rota `/jogo` le
e apaga, e repassa ao `iframe` por `postMessage` com o campo `origem`. O jogo
confere esse `origem` contra o `document.referrer` dele — mudar quem embute o
iframe sem mudar essa checagem trava o mapa em "carregando".
# Rodar no MacBook e expor pela internet

Guia de **teste**. Não é produção: não tem domínio, não tem TLS próprio, e a
carteira depende de um túnel de terceiros.

O objetivo é simples: rodar o jogo inteiro no seu MacBook e abrir pelo
navegador do mesmo MacBook, em uma URL pública `https://`, sem comprar
servidor e sem configurar DNS.

---

## O que é este projeto

**Dois apps** que sobem juntos:

| app | onde | o que é |
|---|---|---|
| jogo | raiz do repositório | o mapa, o HUD, o motor |
| servidor | raiz do repositório | API de conta e WebSocket |
| front | pasta `front_rpg` | a vitrine, o login, a seleção de personagem |

O front **não** contém o jogo: a rota `/jogo` dele monta um `<iframe>` que
carrega o mapa. Por isso os dois precisam estar no ar.

Em produção os dois **não** se fundem em um processo. O Node da raiz serve a
API, o WebSocket e o `jogo.html` na 8787, e o front do Nitro sobe separado na
3000. O Node da raiz faz **proxy** das rotas do site para a 3000 — ele não
monta o front no próprio processo (`repassarParaOFront`, em
`server/src/index.js`).

---

## Passo 0 — o preset do Nitro ✅ já aplicado

O build do front vinha configurado para **Cloudflare Workers**, e não para Node:

```
front_rpg/.output/nitro.json  ->  "preset": "cloudflare-module"
```

O Node da raiz faz proxy para esse `.output` esperando um servidor HTTP comum,
e o que estava lá foi empacotado para outro runtime e não subia. Era esse o
motivo do 502.

Já está corrigido em `front_rpg/vite.config.ts`:

```ts
export default defineConfig({
  nitro: { preset: "node-server" },
  tanstackStart: { server: { entry: "server" } },
});
```

Depois do build o `.output/nitro.json` precisa dizer `node-server`. Se voltar
a dizer `cloudflare-module`, apague a pasta `.output` e builde de novo — build
incremental reaproveita o preset antigo.

> Note que o pacote também aceita as variáveis `NITRO_PRESET` e
> `SERVER_PRESET`, mas **só dentro do sandbox da plataforma**. Fora dele as
> duas são silenciosamente ignoradas e o padrão cloudflare volta sem aviso —
> por isso a correção está no `vite.config.ts` e não no ambiente.

---

## 1. Instalar

No MacBook, na raiz do repositório:

```sh
npm install
npm --prefix front_rpg install
```

O túnel:

```sh
brew install cloudflared
```

---

## 2. O segredo do servidor

Na raiz do repositório, crie o `.env`:

```
SEGREDO_DO_TOKEN=algum-texto-aleatorio-e-grande
```

**Sem isso o servidor sobe mas ninguém consegue logar.** É o erro mais
confuso do projeto: o `contas` fica `null` (`server/src/index.js`), o front
carrega normal, e a tela de entrada simplesmente nunca passa.

---

## 3. Build

```sh
npm run build
npm --prefix front_rpg run build
```

Aqui é o momento mais pesado de memória do projeto inteiro. Veja a seção do
Mac mais adiante.

---

## 4. Subir

**Dois processos.** O site é servido por dois, e o navegador nunca vê os dois:
ele só conversa com a 8787.

**Terminal 1** — a raiz do repositório. API, WebSocket e o `jogo.html`:

```sh
npm start
```

**Terminal 2** — dentro de `front_rpg/`. O front (Nitro):

```sh
PORT=3000 node .output/server/index.mjs
```

Confira os dois, nesta ordem:

```sh
curl http://localhost:8787/health          # a API responde
curl http://localhost:3000                 # o front responde
curl http://localhost:8787/                # o Node repassa para o front
```

O terceiro é o que prova que o proxy está ligado.

---

## 5. Expor pela internet

Em **outro terminal**, com o `npm start` ainda rodando:

```sh
cloudflared tunnel --url http://localhost:8787
```

Em poucos segundos ele imprime uma URL assim:

```
https://alguma-coisa-aleatoria.trycloudflare.com
```

Abra essa URL no navegador do MacBook. É o jogo inteiro, com HTTPS.

**Só essa porta.** O túnel aponta para a 8787, e a 8787 entrega o site inteiro:
o front chega por proxy, o WebSocket é dela, e o `jogo.html` também. A 3000
fica só na sua máquina, e o navegador nunca fala com ela.

O WebSocket deriva o próprio endereço de `window.location` — em HTTPS o
navegador usa `wss://` sozinho. Nada precisa apontar para lugar nenhum, e
`VITE_API_URL` pode continuar `localhost` porque a API é a mesma origem.

### Por que o túnel e não um IP

A MetaMask **só se injecta em contexto seguro** — HTTPS ou `localhost`. Abrir
`http://192.168.1.50:8787` deixa o botão de conectar a carteira ausente e o
login não funciona. Nenhum IP gratuito resolve isso sozinho; o túnel entrega
HTTPS em um comando, sem conta, sem cartão e sem abrir porta.

O túnel é **só de saída**: sua máquina nunca recebe conexão, e por isso o
firewall do macOS não pede autorização.

---

## O Mac mais adiante

Três coisas que só mordem aqui.

**A máquina não pode dormir.** O túnel morre junto com o processo. Para um
teste longo, trave o sono:

```sh
caffeinate -dimsu
```

E ligue na tomada.

**A memória.** O passo 3 é o pico: o Vite transforma cerca de 2 mil módulos,
depois o SSR, depois o Nitro. Com **8 GB** o build troca ou trava. Com
**16 GB** vai tranquilo. Se o seu for 8 GB, dá para contornar: builda uma vez,
e no dia do teste roda só `npm start` — que é leve.

**O túnel morre com o terminal.** Ele não é daemon. Deixe a janela aberta e
não feche.

---

## Se algo não abrir

| sintoma | o que é |
|---|---|
| o front abre mas o mapa fica preto | o `jogo.html` não está sendo servido; confira o `curl /health` |
| a tela de entrada não tem botão de carteira | não está em HTTPS; use a URL do `trycloudflare`, não o IP |
| o login não passa, conta vazia | falta o `SEGREDO_DO_TOKEN` no `.env` da raiz |
| `502` com "O front (Nitro) nao respondeu" | o terminal do `node .output/server/index.mjs` não está rodando, ou está na porta errada |
| o `.output/nitro.json` diz `cloudflare-module` | apague a pasta `.output` e builde de novo |

---

## O que está exposto

Isto é teste, e o texto acima assume isso. Ainda assim:

- **O CORS está em `*`.** Qualquer pessoa com a URL pode chamar a API do
  servidor. A URL é aleatória e muda a cada reinício do túnel, o que reduz o
  estrago — mas não fecha a porta. Para produção, isto tem que virar a lista
  de domínios.
- **Não existe revogação de sessão.** O token de conta vive 30 dias e só é
  cancelado apagando o `localStorage` do navegador. O servidor continua
  aceitando.
- **Os dados ficam no seu disco**, em `server/data/`. `Ctrl+C` no `npm start`
  não apaga nada.
- A URL do túnel morre quando o processo morre, e o `cloudflared` limpa o
  registro depois de alguns minutos desconectado.
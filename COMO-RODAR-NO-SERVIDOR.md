# Rodar no servidor Debian e acessar pelo PC

Guia de **teste**. Não é um guia de produção: aqui não tem HTTPS, não tem
proxy, e a carteira tem uma limitação que só aparece fora do `localhost`.

Escrevi para o caso mais comum: um servidor Debian em casa, no escritório ou
na VPS, e o navegador na sua máquina.

---

## O que é este projeto

São **dois apps** que sobem juntos:

| app | onde | porta | o que é |
|---|---|---|---|
| jogo | raiz do repositório | 5173 | o mapa, o HUD, o motor |
| servidor | raiz do repositório | 8787 | API de conta e WebSocket |
| front | pasta `front_rpg` | 3000 | a vitrine, o login, a seleção de personagem |

O front **não** contém o jogo. A rota `/jogo` dele monta um `<iframe>` que
carrega o mapa. Por isso os dois precisam estar no ar ao mesmo tempo.

---

## O problema que decide tudo: a MetaMask

A carteira é a identidade do jogador agora, e a MetaMask **só se injecta em
contexto seguro** — HTTPS ou `localhost`.

Se você abrir `http://192.168.1.50:3000`, o botão de conectar a carteira não
aparece e o login não funciona. Não é bug do projeto: é a MetaMask se
recusando a rodar fora de `localhost` sem TLS.

Por isso o caminho recomendado não é abrir a porta e digitar o IP. É fazer o
navegador achar que ele está na sua própria máquina.

---

## Caminho A — túnel SSH (recomendado)

O navegador continua em `localhost`. A MetaMask funciona. **Não precisa
mudar nenhum arquivo do projeto.**

### 1. No Debian

```sh
git clone <url> rpg-2d-prototype
cd rpg-2d-prototype

npm install
npm --prefix front_rpg install

# o segredo que assina o token de entrada. SEM ele as contas nao funcionam:
# o servidor sobe, mas o `contas` fica `null` e ninguem consegue logar
echo 'SEGREDO_DO_TOKEN=algum-texto-aleatorio-grande' > .env
```

### 2. No Debian, os dois processos

Em um terminal:

```sh
npm run dev
```

Esse comando já sobe **duas coisas** ao mesmo tempo (o `concurrently` do
projeto): o servidor Node na 8787 e o jogo na 5173.

Em um segundo terminal:

```sh
npm --prefix front_rpg run dev
```

### 3. No seu PC, o túnel

```sh
ssh -L 8787:localhost:8787 -L 5173:localhost:5173 -L 3000:localhost:3000 usuario@IP_DO_DEBIAN
```

O `-L` de cada porta diz: "toda vez que alguém abrir essa porta aqui na minha
máquina, leve para a mesma porta no Debian". Deixe o terminal aberto.

### 4. No seu PC, o navegador

```
http://localhost:3000
```

Só isso. A carteira funciona, o login funciona, e o mapa carrega pelo túnel.

### Encerrando

`Ctrl+C` nos dois terminais do Debian e no do túnel. Nada fica rodando.

---

## Caminho B — abrir direto pelo IP

Funciona para **ver o jogo**, mas **a carteira não vai funcionar** (veja o
problema acima). Se o que você quer testar agora é a carteira, use o caminho A.

Se ainda assim quiser, são quatro mudanças:

**1. O front precisa escutar em todas as interfaces.** Hoje o script dele é
`vite dev --port 3000`, que só aceita conexão da própria máquina.

```json
// front_rpg/package.json
"dev": "vite dev --port 3000 --host 0.0.0.0"
```

**2. A API precisa apontar para o Debian.** Em `front_rpg/.env`:

```
VITE_API_URL=http://IP_DO_DEBIAN:8787
```

Esse valor é **embutido no bundle no momento do build/start**. Se ficar
`localhost`, o navegador do seu PC vai procurar a API na sua própria máquina e
não vai achar.

**3. O mapa precisa apontar para o Debian.** O `urlDoJogo()` cai para
`http://localhost:5173` quando está em desenvolvimento. Para mudar, acrescente
no mesmo `.env`:

```
VITE_JOGO_URL=http://IP_DO_DEBIAN:5173
```

**4. Liberar as portas no firewall do Debian:**

```sh
sudo ufw allow 3000/tcp
sudo ufw allow 5173/tcp
sudo ufw allow 8787/tcp
```

A 5173 e a 3000 só precisam estar abertas para a **sua** rede. Se o Debian
estiver na internet pública, pense duas vezes antes de abrir a 8787 — é a
porta que cria conta e assina token.

Depois de mudar o `.env`, reinicie o `npm --prefix front_rpg run dev`: essas
variáveis são lidas no boot do Vite.

---

## Se algo não abrir

| sintoma | o que é |
|---|---|
| a página abre mas o mapa fica preto | o `npm run dev` (jogo) não está no ar, ou o túnel esqueceu a 5173 |
| "sem token" ou a tela de entrada não sai | o front não recebeu o token; confira se o túnel tem a 8787 |
| o login não tem botão de carteira | você abriu pelo IP em vez de usar o túnel — é a MetaMask recusando |
| `SEGREDO_DO_TOKEN` no console do servidor | o `.env` da raiz não existe, ou está sem esse valor |
| a conta abre mas os personagens não listam | o token de entrada está expirando; ele vale 60 segundos |

---

## Uma nota sobre segurança

Isto aqui é teste, e o texto acima assume isso. Ainda assim, vale saber o que
está aberto no caminho A:

- O CORS está em `*` (`server/src/index.js`). Isso deixa qualquer site da
  internet mandar requisição para a sua API com o token de outra pessoa. Para
  uso local não muda nada; se o Debian estiver na internet pública, vale
  fechar.
- Não existe revogação de sessão. O token de conta vive 30 dias e não pode ser
  cancelado pelo lado do servidor.
- Colar o token na URL é o que o projeto **não** faz: ele vai no
  `sessionStorage` e é repassado ao `iframe` por `postMessage`. Deixe assim.
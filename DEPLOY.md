# Deploy em produção

Como instalar, gerar os builds e deixar o jogo no ar num IP público.

Este guide é para **produção de verdade**: build de produção nos dois apps,
segredo próprio e os dois processos sob um gerenciador.

---

## 1. O que é este projeto

São **dois apps** que sobem juntos:

| app | o que é | onde roda |
|---|---|---|
| raiz | o jogo (canvas), a API e o WebSocket | Node na **8787** |
| `front_rpg/` | o site (SSR, landing, login, seleção de personagem) | Nitro na **3000** |

O Node da raiz serve o build do jogo e **faz proxy do front**. O jogador
acessa **um endereço só** (a 8787, ou o Nginx na frente) e nunca sabe que o
front está em outra porta.

Isso significa que em produção são **dois processos**, não um. Ver o passo 9.

### O caminho de uma requisição

```
navegador  →  :8787  →  /api/*   ,  /health*        respondidas pelo Node
                     →  /ws                             WebSocket no Node
                     →  /*  (o resto)                repassado ao Nitro :3000
                     →  /jogo.html e /assets/*        servidos do dist/
```

Duas regras que decorrem disso e que aparecem o tempo todo neste guide:

- **`/api` nunca vai para o front.** O proxy do Node vem *depois* das rotas
  de API. Invertido, `/api/conta` responderia HTML onde o front espera JSON, e
  o sintoma é "a tela não carrega", longe da causa.
- **O front e o jogo precisam ser a mesma origem.** O WebSocket sai de
  `window.location.host` (`useGameClient.js`), sem configuração nenhuma. Se o
  front estiver em outro domínio, o jogador procura o socket no host errado.

---

## 2. Requisitos

- **Node 20 ou superior.** O `package.json` exige `>=20` e o projeto usa
  `node --env-file-if-exists`, que só existe a partir do 20.
- `npm` (o repositório traz `package-lock.json`; use npm nos dois apps).
- Um domínio **ou** o IP público direto.
- Para HTTPS: um domínio e o Nginx.

Checando a versão:

```bash
node -v
```

---

## 3. Copiar o projeto e instalar

```bash
# na VPS
git clone <seu-repo> jogo
cd jogo

# o jogo
npm ci

# o front
cd front_rpg
npm ci
cd ..
```

Use `npm ci` e não `npm install`: ele instala exatamente o que está travado
no `package-lock.json`, e é o que garante que a VPS rode o mesmo que você
testou.

> O `front_rpg/` tem um `bun.lock` no repositório. **Use npm** e apague o
> `bun.lock` do controle de versão, ou os dois gerenciadores vão divergir na
> próxima instalação de alguém.

---

## 4. Gerar o segredo do token

**Este passo é obrigatório.** Sem ele o front não consegue entrar.

O `SEGREDO_DO_TOKEN` assina o token de entrada com `HMAC-SHA256`. Com o valor
padrão (`123`) qualquer pessoa cria uma conta na sua VPS.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Guarde a saída. São 64 caracteres hex. Ela **não aparece mais** — se perder,
gere outra e reinicie o servidor.

> Trocar o segredo **invalida toda conta existente**: a assinatura do token de
> conta também usa ele. Só isso faz sentido junto com um reset da base.

---

## 5. O `.env` da raiz

O arquivo é na raiz do projeto e é lido sozinho pelo `start`
(`node --env-file-if-exists=.env`). Não precisa exportar nada no shell.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" > /tmp/segredo
nano .env
```

```ini
# OBRIGATORIO. Assina o token de entrada (HMAC-SHA256).
SEGREDO_DO_TOKEN=cole_aqui_o_hex_de_64_caracteres

# --- o servidor (Node) ---
PORT=8787
HOST=::
TICK_RATE=20
MAX_PLAYERS=50

# --- o jogo servindo o proprio build ---
# `dist` e o que o `npm run build` gera. Sem este arquivo, o mapa fica preto.
JOGO_DIR=dist

# --- onde os dados ficam ---
# Nao versionado. Apagar estas duas pastas = resetar a base inteira.
SAVE_DIR=server/data/personagens
CONTA_DIR=server/data/contas

# --- o front (Nitro), que o Node faz proxy ---
FRONT_PORT=3000
SEGUNDO_DO_TOKEN=60
```

Os valores acima são os que o código já usa por padrão, com duas exceções
escritas na mão de propósito:

- **`JOGO_DIR=dist`** precisa existir. Sem o `dist/` gerado, o proxy ainda
  responde, mas a rota `/jogo` mostra o mapa preto.
- **`SAVE_DIR` e `CONTA_DIR`** ficam explícitos porque eles são os dois lugares
  que você vai apagar quando quiser resetar. Ver o passo 6.

---

## 6. Resetar a base

A base são os JSON em `server/data/`: `contas/` (diamantes e personagens por
carteira) e `personagens/` (o save de cada personagem).

```bash
# veja o que existe antes
ls -R server/data

# backup, se você quiser um
# cp -r server/data server/data.bak-$(date +%Y%m%d-%H%M%S)

# limpe
rm -rf server/data
```

**Não precisa recriar as pastas.** `AccountStore` e `CharacterStore` fazem
`mkdirSync(dir, { recursive: true })` no boot, e `GuildSave` também.

O que **não** se perde no reset: o segredo do `.env` (a menos que você troque),
os builds e o código.

> Isto apaga saldo de diamantes e progresso de quem jogou. Quem tinha conta de
> carteira real perde os dois. Faça o `cp` acima se a base ainda importa.

---

## 7. O `.env` do front

O front tem **um arquivo próprio**, em `front_rpg/.env`. Ele é lido **no
momento do build** e o valor fica embutido no JavaScript do navegador — não dá
para mudar depois sem refazer o build.

Para produção, **deixe vazio**:

```ini
# ONDE ESTA O SERVIDOR DO JOGO
#
# VAZIO DE PROPOSITO EM PRODUCAO.
#
# Sem este valor, o `urlDaApi()` cai em `window.location.origin` — ou seja,
# a origem de quem esta acessando. Como o Node e o front estao na mesma
# origem (o Node faz proxy), isso aponta para o endereco certo sozinho.
#
# So preencha se a API estiver em um dominio SEPARADO do site.
VITE_API_URL=
```

### Por que preencher com `localhost` quebra o jogo

Este é o erro de deploy mais comum, e ele **não dá erro visível**: a tela de
login simplesmente nunca carrega.

O valor é embutido no bundle. Com `VITE_API_URL=http://localhost:8787`, o
JavaScript que chega no navegador manda o jogador falar com o `localhost`
**da máquina dele**, e não com o seu servidor. Funciona na sua máquina e falha
para qualquer outra pessoa.

Para conferir o que ficou embutido, antes de subir:

```bash
grep -r "localhost:8787" front_rpg/.output/public/ && echo "VAZOU: refaca o build com VITE_API_URL vazio"
```

### O `localhost:8787` que aparece no bundle **é esperado**

Mesmo com o `.env` vazio, `localhost:8787` aparece em `api-*.js`. É o
`urlDaApi()` do front, e ele tem esta forma:

```js
typeof window === "undefined" ? ""
  : window.location.port === "3000" ? "http://localhost:8787"
  : window.location.origin
```

São dois fallbacks que **não disparam em produção**:

- `typeof window === "undefined"` — só no SSR, dentro do Node.
- `window.location.port === "3000"` — é o Vite do front em dev. Em produção
  quem está na 3000 é o Nitro, e ele responde na **8787**, não na 3000.

Quem está de verdade na 3000 em produção é o próprio Nitro, que nunca chama
`urlDaApi()`. Então o `localhost` do bundle é inerte.

**O quePUXE se pensar no que:** a API respondendo na 3000. Confira com:

```bash
curl -sI localhost:3000/api/capabilities | head -1   # tem que ser 404/502, nunca 200
```

O mesmo vale para o `dist/` do jogo, que traz `ws://localhost:8787/ws` em
`urlDoServidor()` — atrás de `typeof window === "undefined"`, é fallback de SSR
e o navegador nunca usa.

---

## 8. Gerar os builds

```bash
# o jogo
npm run build          # gera dist/ (jogo.html, index.html, assets/)

# o front
cd front_rpg
npm run build          # gera .output/ (Nitro, SSR)
cd ..
```

Confira:

```bash
ls dist/jogo.html                      # o jogo dentro do iframe
ls dist/index.html                     # o jogo aberto direto
ls front_rpg/.output/server/index.mjs  # o servidor do front
```

> Faça o build do front **depois** de acertar o `front_rpg/.env`. O valor do
> `.env` é lido no build, não no boot.

---

## 9. Rodar

**Dois processos.**

```bash
# 1) o front (Nitro), na 3000
node front_rpg/.output/server/index.mjs

# 2) o jogo, na 8787 — este faz proxy do front
npm start
```

A ordem não importa muito, mas se o Node subir primeiro e alguém entrar antes
do Nitro, o proxy responde um **502 com "O site nao subiu"** — que é uma
mensagem legível, não um crash.

Para manter os dois no ar depois de desconectar, use o **pm2**:

```bash
npm i -g pm2

pm2 start front_rpg/.output/server/index.mjs --name rpg-front
pm2 start npm --name rpg-jogo -- start
pm2 save
pm2 startup     # segue o comando que ele imprimir
```

### Em desenvolvimento (não é produção)

São **três** processos, porque o mapa vem do Vite e não do `dist/`:

```bash
npm run dev:web     # 5173, o iframe do mapa, com HMR
npm run start       # 8787, API + WebSocket, via proxy do Vite
cd front_rpg && npm run dev   # 3000, o navegador entra por aqui
```

Sem o `dev:web`, o iframe da rota `/jogo` aponta para a 5173 e não acha o
`jogo.html` — mapa preto, sem erro no console.

---

## 10. Abrir a porta

O Node escuta em todas as interfaces (`HOST=::`). Só falta o firewall:

```bash
sudo ufw allow 22/tcp      # SSH — não tranque a si mesmo
sudo ufw allow 8787/tcp
sudo ufw enable
```

Ou, se a VPS está atrás de um firewall de nuvem (AWS/GCP/Azure), abra a
porta 8787 também no painel — o `ufw` não é o único lugar.

A porta 3000 **não** precisa estar aberta: quem fala com ela é o Node, na
máquina mesma, via `127.0.0.1`.

---

## 11. Testar no IP público

```
http://SEU_IP:8787
```

E o que verificar, em ordem:

```bash
curl -s localhost:8787/health         # o processo responde
curl -s localhost:8787/health/laco    # o loop de 20Hz está rodando
curl -s localhost:8787 | head -c 200  # devolve HTML do front?
curl -sI localhost:8787/jogo.html     # o build do jogo existe?
```

`/health` e `/health/laco` não são o mesmo: o primeiro responde `ok` mesmo com
o mundo congelado, o segundo diz se o tique está andando.

---

## 12. HTTPS (recomendado)

**Não é luxo: a MetaMask exige um contexto seguro.** Ela só conecta
automaticamente em `localhost` e `127.0.0.1`. Num IP público em HTTP, o
usuário precisa aprovar a conexão na mão a cada vez — e em alguns navegadores
o botão de conectar nem aparece, porque o site é tratado como não confiável.

Com Let's Encrypt isso são poucos minutos:

```bash
sudo apt install -y certbot python3-certbot-nginx nginx
```

`/etc/nginx/sites-available/rpg`:

```nginx
server {
    listen 80;
    server_name SEU_DOMINIO;

    # O WebSocket do jogo. Sem este bloco, o proxy HTTP derruba a conexao
    # e o mapa fica carregando para sempre.
    location /ws {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host       $host;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/rpg /etc/nginx/sites-enabled/
sudo certbot --nginx -d SEU_DOMINIO
sudo nginx -t && sudo systemctl reload nginx
```

O WebSocket precisa do `Upgrade` e do `proxy_read_timeout` alto: uma partida
parada sem input por mais de um minuto derruba a conexão padrão do Nginx.

Depois do certificado, a porta 8787 pode ser fechada do exterior — o Nginx é
a única entrada pública.

Com Nginx na frente, deixe `VITE_API_URL` **vazio** de novo: o front vai usar
a origem de quem acessa, que já é o HTTPS certo.

---

## 13. Checklist

```bash
node -v                                     # >= 20
grep -qE '^SEGREDO_DO_TOKEN=[0-9a-f]{64}$' .env && echo "segredo ok" \
  || echo "SEGREDO_DO_TOKEN ausente ou fora do formato"
grep -q '^VITE_API_URL=$' front_rpg/.env && echo "front ok: vazio"
ls dist/jogo.html
ls front_rpg/.output/server/index.mjs
pm2 status
curl -sf localhost:8787/health/laco >/dev/null && echo "loop ok"
curl -s localhost:8787 | head -c 200
curl -sI localhost:3000/api/capabilities | head -1   # 404/502, nunca 200
```

> **Não** use `grep -r "localhost:8787" front_rpg/.output/` como verificação: o
> fallback de dev e de SSR está no bundle de propósito e o grep acusa sempre.
> O que importa é se a API está respondendo na 3000 — última linha do checklist.

---

## 14. Problemas comuns

**"O site nao subiu"**
O Node subiu, o Nitro não. Confira `pm2 logs rpg-front`.

**A tela de login não conecta com a MetaMask**
Falta HTTPS, ou o `VITE_API_URL` está apontando para algum lugar errado.
Na dúvida, confira no navegador o que está embutido: abra o DevTools, aba
Network, e veja para qual host a chamada `/api/...` está indo.

**A tela não carrega e o console mostra CORS**
Acontece quando o front é aberto direto na porta 3000, em vez de passar pelo
8787. O servidor manda `Access-Control-Allow-Origin: *` justamente para o
desenvolvimento — em produção o jogador entra pelo 8787 e não há CORS.

**O mapa fica preto em `/jogo`**
O `dist/` não foi gerado, ou o `JOGO_DIR` aponta para outro lugar.

**"SEGREDO_DO_TOKEN nao configurado"**
O `.env` não está na raiz, ou a variável está sem valor. Sem ele o jogo sobe,
mas contas e login ficam desligados.

**A conexão do jogo cai**
Falta o bloco `location /ws` no Nginx.

**Personagens sumiram depois do deploy**
`server/data/` não foi copiado. Ele **não** está no versionamento — e não deve
estar: ele guarda endereço de carteira e saldo de diamantes.

**O jogador ficou perto demais do mouse para mirar**
Isso é o `.env` do front com `localhost` embebido: o `build` precisa ser
refeito com `VITE_API_URL=` vazio.

---

## 15. Atualizar uma versão já no ar

```bash
cd jogo
git pull
npm ci

cd front_rpg && npm ci && npm run build && cd ..
npm run build

pm2 restart rpg-front
pm2 restart rpg-jogo
```

O `server/data/` fica intacto: nenhum build o toca, e nenhum `git pull`
traz de volta o que não está versionado.
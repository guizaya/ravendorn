# Deploy em uma VPS Ubuntu

Como instalar, gerar os builds e deixar o jogo no ar num IP público.

Este guia é para **produção de verdade**: build de produção nos dois apps, token
com segredo próprio e os dois processos sob um gerenciador.

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

Isso significa que em produção são **dois processos**, não um. Ver o passo 8.

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

Gerando:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Guarde a saída. Ela **não aparece mais** — se perder, é só gerar outra e
reiniciar o servidor.

---

## 5. O `.env` da raiz

Crie o arquivo na raiz do projeto:

```bash
nano .env
```

Conteúdo:

```ini
# OBRIGATORIO. Assina o token de entrada (HMAC-SHA256).
# Gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SEGREDO_DO_TOKEN=cole_aqui_o_hex_de_64_caracteres

# Opcional, com os valores que o codigo usa por padrao
PORT=8787
HOST=::
TICK_RATE=20
MAX_PLAYERS=50
JOGO_DIR=dist
CONTA_DIR=server/data/contas
FRONT_PORT=3000
SEGUNDO_DO_TOKEN=60
```

O `start` usa `node --env-file-if-exists=.env`, então o arquivo é lido
automaticamente. Não precisa exportar nada no shell.

**Onde os dados ficam:** `server/data/`. São arquivos JSON — `contas/` e
`personagens/`. É isso que você quer preservar entre deploys. Para começar
do zero, apague o conteúdo (veja o passo 6).

---

## 6. Resetar a base

A base inteira são os JSON em `server/data/`.

```bash
# confira o que existe antes
ls -R server/data

# faça um backup antes — isto é irreversível
cp -r server/data server/data.bak-$(date +%Y%m%d-%H%M%S)

# e limpe
rm -rf server/data
mkdir -p server/data/contas server/data/personagens
```

O servidor recria os arquivos no primeiro uso.

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
# origem (o Node faz proxy), isso aponta para o endereco certo sozinho, e
# o jogo funciona tanto em dev quanto em producao sem editar nada.
#
# So preencha se a API estiver em um dominio SEPARADO do site.
VITE_API_URL=
```

Com o valor preenchido como `http://localhost:8787`, o bundle vai tentar
falar com o `localhost` **do navegador do jogador**, e nada funciona.

---

## 8. Gerar os builds

```bash
# o jogo
npm run build          # gera dist/ (jogo.html, assets/)

# o front
cd front_rpg
npm run build          # gera .output/ (Nitro, SSR)
cd ..
```

Confira:

```bash
ls dist/jogo.html
ls front_rpg/.output/server/index.mjs
```

> Não faça isso logo depois de instalar com `npm ci`: o `dist/` e o
> `.output/` são artefatos de build, não entram no versionamento.

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

---

## 11. Testar no IP público

```
http://SEU_IP:8787
```

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

Depois do certificado, a porta 8787 pode ser fechada do exterior — o Nginx é
a única entrada pública.

Com Nginx na frente, deixe `VITE_API_URL` **vazio** de novo: o front vai usar
a origem de quem acessa, que já é o HTTPS certo.

---

## 13. Checklist

```bash
node -v                              # precisa ser >= 20
grep SEGREDO_DO_TOKEN .env            # existe e tem 64 chars?
[ -z "$(grep VITE_API_URL front_rpg/.env)" ] && echo "front ok: vazio"
ls dist/jogo.html
ls front_rpg/.output/server/index.mjs
pm2 status
curl -s localhost:8787 | head -c 200 # responde HTML?
```

---

## 14. Problemas comuns

**"O site nao subiu"**
O Node subiu, o Nitro não. Confira `pm2 logs rpg-front`.

**A tela de login não conecta com a MetaMask**
Falta HTTPS, ou o `VITE_API_URL` está apontando para algum lugar errado.
Na dúvida, confira no navegador o que está embutido: abra o DevTools, aba
Network, e veja para qual host a chamada `/api/...` está indo.

**O mapa fica preto em `/jogo`**
O `dist/` não foi gerado, ou o `JOGO_DIR` aponta para outro lugar.

**"SEGREDO_DO_TOKEN nao configurado"**
O `.env` não está na raiz, ou a variável está sem valor. Sem ele o jogo sobe,
mas contas e login ficam desligados.

**A conexão do jogo cai**
Falta o bloco `location /ws` no Nginx. O WebSocket precisa do `Upgrade` e o
`proxy_read_timeout` alto, porque uma partida parada sem input por mais de um
minuto derruba a conexão padrão.

**Personagens sumiram depois do deploy**
`server/data/` não foi copiado. Ele **não** está no versionamento.

---

## 15. Atualizar uma versão já no ar

```bash
cd jogo
git pull
npm ci --omit=dev=false
cd front_rpg && npm ci && npm run build && cd ..
npm run build

pm2 restart rpg-front
pm2 restart rpg-jogo
```

O `server/data/` fica intacto: nenhum build o toca.
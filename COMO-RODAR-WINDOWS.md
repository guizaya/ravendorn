# Rodar no Windows

O guia equivalente ao `COMO-RODAR.md`, que é escrito para Mac. O jogo é o
mesmo; o que muda é a instalação, o shell e três ferramentas que no mac
existem de graça e aqui não.

Não é teste de produção: não tem domínio, não tem TLS próprio, e o túnel
depende de um terceiro.

---

## 0. A versão do Node — leia antes de tudo

O `package.json` diz `node: ">=20"`, mas **isso está errado** e vai te
mudar o primeiro erro.

O script `start` é:

```json
"start": "node --env-file-if-exists=.env server/src/index.js"
```

A flag `--env-file-if-exists` só existe a partir do **Node 22.9**. No Node
20 o `npm start` morre antes de ler qualquer coisa sua:

```
node: bad option: --env-file-if-exists
```

O `--env-file` sozinho (sem o `-if-exists`) existe desde o 20.6, mas **sem**
ele o servidor não sobe quando o `.env` não existe — e ele é opcional de
propósito, para rodar o jogo sem segredo nenhum.

**Instale o Node 22.9 ou mais novo.** O LTS atual já atende. Para conferir:

```powershell
node --version
```

---

## 1. Instalar

No **PowerShell**, na raiz do repositório:

```powershell
git clone https://github.com/guizaya/ravendorn.git
cd ravendorn

npm install
npm --prefix front_rpg install
```

Não existe `brew` aqui. O túnel se instala direto:

- **ngrok** — baixe o `.zip` em ngrok.com/download, extraia e use o
  `ngrok.exe`
- **cloudflared** — baixe o `.exe` em developers.cloudflare.com

Coloque o executável em qualquer pasta e chame pelo caminho completo, ou
adicione a pasta ao `PATH`. No PowerShell, o `PATH` do usuário:

```powershell
$env:PATH += ";$HOME\bin"
```

---

## 2. O segredo do servidor

Crie o `.env` na raiz. O PowerShell **não** tem o comando `echo >`:

```powershell
node -e "require('fs').writeFileSync('.env','SEGREDO_DO_TOKEN='+require('crypto').randomBytes(32).toString('hex')+'\n')"
```

**Sem isso o servidor sobe mas ninguém consegue logar.** É o erro mais
confuso do projeto: o jogo aparece, a vitrine aparece, e a tela de entrada
simplesmente nunca passa.

---

## 3. Build

```powershell
npm run build
npm --prefix front_rpg run build
```

O build é o pico de memória do projeto. Com 8 GB ele troca ou trava; com
16 GB vai tranquilo.

Depois do build o `front_rpg\.output\nitro.json` precisa dizer
`"preset": "node-server"`:

```powershell
Get-Content front_rpg\.output\nitro.json | Select-String preset
```

Se voltar a dizer `cloudflare-module`, apague a pasta `.output` e builde de
novo — build incremental reaproveita o preset antigo.

---

## 4. Subir

**Dois processos, em duas janelas do PowerShell.**

**Terminal 1** — a raiz do repositório. API, WebSocket e o `jogo.html`:

```powershell
npm start
```

**Terminal 2** — dentro de `front_rpg`. O front (Nitro):

```powershell
cd front_rpg
node .output/server/index.mjs
```

O Nitro já escuta na 3000 por padrão, então o `PORT=3000` do guia do Mac
não é necessário aqui. **E se você precisar forçar a porta, a sintaxe é
diferente** — `PORT=3000 node ...` é bash e não funciona no PowerShell nem
no `cmd`:

```powershell
# PowerShell
$env:PORT=3000; node .output/server/index.mjs

# cmd.exe
set PORT=3000 && node .output/server/index.mjs
```

Confira os três, nesta ordem:

```powershell
curl http://localhost:8787/health          # a API responde
curl http://localhost:3000                 # o front responde
curl http://localhost:8787/                # o Node repassa para o front
```

O `curl` existe no Windows 10 e 11. Se não estiver no PATH, use o
PowerShell:

```powershell
Invoke-WebRequest -Uri http://localhost:8787/health -UseBasicParsing
```

O terceiro é o que prova que o proxy está ligado. **Se ele devolver o
`jogo.html` em vez da vitrine, a tela fica preta** — foi um bug real do
servidor, corrigido em `server/src/index.js`.

---

## 5. Expor pela internet

Em **outro terminal**, com o `npm start` ainda rodando:

```powershell
ngrok http 8787
```

Em poucos segundos ele imprime uma URL:

```
https://alguma-coisa-aleatoria.ngrok-free.app
```

Abra essa URL. O plano gratuito do ngrok mostra uma tela de aviso antes da
primeira página — clica uma vez e o cookie dura 7 dias. Ele também tem cota
de **1 GB/mês** de transferência.

Para derrubar o túnel: `Ctrl+C` na janela.

**Só a 8787.** O túnel aponta para ela, e ela entrega o site inteiro: o
front chega por proxy, o WebSocket é dela, e o `jogo.html` também. A 3000
fica só na sua máquina.

A **MetaMask só se injeta em contexto seguro** — HTTPS ou `localhost`.
Por isso o túnel entrega HTTPS, e por isso abrir
`http://192.168.1.50:8787` deixa o botão de carteira ausente.

---

## Se algo não abrir

| sintoma | o que é |
|---|---|
| `node: bad option: --env-file-if-exists` | Node abaixo de 22.9. **A causa número um aqui.** |
| a tela de entrada não tem botão de carteira | não está em HTTPS; use a URL do túnel, não o IP |
| o login não passa, conta vazia | falta o `SEGREDO_DO_TOKEN` no `.env` da raiz |
| `502` com "O front (Nitro) nao respondeu" | o terminal do `node .output/server/index.mjs` não está rodando, ou está na porta errada |
| tela preta ao abrir `/` | o `express.static` está servindo o `jogo.html` na raiz; confira a rota `app.get("/", ...)` no `server/src/index.js` |
| `ENOENT` ou caminho estranho | o Windows tem limite de 260 caracteres; habilite caminhos longos no registro (`HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled` = 1) |
| `npm install` falha em pasta profunda | o Defender está segurando os arquivos; libere a pasta temporariamente |

---

## Derrubar um processo travado

Não existe `pkill` nem `lsof`. Ache o PID pela porta e mate:

```powershell
# achar o PID da 8787
netstat -ano | findstr :8787

# matar (use o número da última coluna)
taskkill /PID 12345 /F
```

O `Ctrl+C` na janela do terminal é melhor e sempre funciona. O `taskkill` é
para quando a janela morreu e o processo ficou órfão.

---

## O que é diferente do Mac

| | Mac | Windows |
|---|---|---|
| instalar pacote | `brew install` | download manual ou `winget` |
| variável de ambiente pontual | `PORT=3000 node app.js` | `$env:PORT=3000; node app.js` |
| achar processo na porta | `lsof -ti :8787` | `netstat -ano \| findstr :8787` |
| matar processo | `kill <pid>` | `taskkill /PID <pid> /F` |
| impedir o sono | `caffeinate -dimsu` | Configurações > Sistema > Energia > **nunca** suspender |
| sistema de arquivos | sensível a caixa | **não** sensível — o projeto não tem nomes que só diferem em maiúsculas, então clonar funciona |

O resto — os dois processos, o proxy, o `postMessage` do token, o WebSocket
derivando o endereço de `window.location` — é idêntico.

---

## O que está exposto

Isto é teste, e o texto acima assume isso:

- **O CORS está em `*`** (`server/src/index.js`). Qualquer pessoa com a URL
  pode chamar a API. A URL do ngrok é aleatória e muda a cada reinício, o
  que reduz o estrago — mas não fecha a porta.
- **Não existe revogação de sessão.** O token vive 30 dias e só é cancelado
  apagando o `localStorage` do navegador.
- **Os dados ficam no seu disco**, em `server\data\`. Não vão para o git:
  o `.gitignore` cobre `server/data/personagens` e `server/data/contas`.
- A URL do túnel morre quando o processo morre.

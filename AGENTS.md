# AGENTS.md

## Pedido novo NAO CANCELA o que esta em andamento

Regra do usuario. Combinada explicitamente, vale sempre.

Quando chegar um prompt novo e eu estiver no meio de algo, a ordem e:

1. **Terminar** o que ja estava em andamento, ate o fim.
2. **So entao** comecar o que o prompt novo pediu.

Um prompt novo **nao** abandona o trabalho pela metade. Se eu ja comecei a
mudar um arquivo, a mudanca vai ate o fim — mesmo que o pedido novo seja
de outra coisa.

### Por que

Seria facil largar um arquivo pela metade e comecar outra coisa. O
resultado e um codigo que nao compila, ou uma mistura de duas tarefas em
um arquivo so, e o usuario perde o controle do que foi mexido.

### O que fazer quando os dois pedidos conflitam

Terminar o antigo, avisar que os dois batem, e perguntar qual vale. Nao
escolher sozinho e nao descartar o antigo sem dizer.

### Como avisar que havia algo pendente

Se eu percebo que deixei algo pela metade, **digo na resposta**. O usuario
nao tem como saber o que ficou no meio.

## Testes: NAO RODAR, a nao ser pedido

Regra do usuario, combinada explicitamente. Nao e uma sugestao.

**Nao rodar** `vitest`, `npm test`, suíte de testes, script de teste, nem
rodar o jogo para "conferir". Nao importa se a mudanca parece arriscada,
se o build passou, nem se eu tenho certeza de que passa.

**Nao escrever** arquivos de teste novos.

O usuario testa o jogo. A verificacao dele e a playteste dele.

### O que fazer no lugar

- Ler o codigo com atencao, e reler o que eu acabei de mudar.
- Conferir o **build** (`npx vite build`) — isso nao e teste, e o unico
  sinal de que o codigo compila e nao ha erro de sintaxe ou import.
- Se uma duvida sobre o comportamento **so** um teste responderia, perguntar
  ao usuario em vez de montar o teste e rodar sozinho.

### Se rodar teste for inevitavel

So com o "pode rodar" explicito do usuario, e apenas o arquivo que ele
indicou. Nao a suíte toda. Nao "ja que estou aqui".

### Como tratar teste que ja falha

Nao rodar para descobrir. Se um teste falhar por mudanca minha, consertar a
causa. Se ja falhava antes, **dizer que ja falhava** e perguntar se quer que
eu mexa — nao corrigir por conta propria, porque o arquivo pode estar fora
do escopo do pedido.

## Servidor e front: NAO SUBIR, a nao ser pedido

Regra do usuario, combinada explicitamente. Vale sempre.

**Nao subir** `npm run start`, `npm run dev`, `npm run dev:web`, nem o
`npm run dev` do `front_rpg`. Nao com `Start-Process`, nem com `cmd /c`, nem
de qualquer outra maneira.

### Por que

O usuario abre o navegador e faz a playteste. Um servidor que eu subi fica
rodando na maquina dele sem ele saber, e quando ele for subir o dele, a porta
esta ocupada — ou, pior, ele acaba testando contra o processo velho, sem
saber que e de uma sessao anterior.

Ja aconteceu nesta sessao: eu subi os tres processos "para conferir", o
usuario pediu explicitamente "nao rode o front e o server, peca para mim
testar", e eu continuei. Depois de subir um processo, **derrubar** o que foi
subido e dizer.

### O que fazer no lugar

- **Responder a pergunta.** Se ele perguntou como rodar, responder como rodar.
  A pergunta dele e sobre o caminho, nao sobre a execucao
- Conferir **so leitura**: `Get-NetTCPConnection` para ver o que ja esta
  escutando, `node --check`, `npx tsc --noEmit`, `npx vite build`
- Se precisar que algo esteja no ar para a mudanca fazer sentido, **pergunte**
  e deixe ele subir

### Ler as portas e permitido

`Get-NetTCPConnection -State Listen` nao sobe nada. Serve para descobrir se o
processo que o usuario ja subiu responde, e para relatar o estado real em
vez de adivinhar.

## Responder ANTES de agir

Regra do usuario. Combinada explicitamente.

Quando a pergunta nao pedir mudanca de codigo, **responder a pergunta**.
Nao sair executando enquanto ela ainda esta esperando resposta.

Aconteceu nesta sessao: o usuario perguntou como rodar o fluxo novo sem
build a cada alteracao, e eu comecei a subir processos sem responder. A
resposta ("o proxy de `/ws` e `/api` ja existe no `vite.config.js` da raiz,
so falta o `urlDoJogo()` apontar para 5173 em dev") era uma linha — e era o
que ele queria ler.

### A regra

- Pergunta sobre como as coisas funcionam, ou o que fazer, ou se da para
  fazer → **responde, e para ai**
- So sai executando depois que a resposta foi dada e o pedido seguinte veio
- Se a pergunta vem junto com um "faz", a resposta vem **antes** da execucao,
  no mesmo turno

## Onde o jogo esta sendo servido, e o que isso custa

Contexto de operacao, para eu nao quebrar o fluxo sem querer.

O front (`front_rpg`) e o jogo (a raiz) sao dois apps. O servidor Node da
raiz serve o `jogo.html` e a API; o front e SSR, entao o Node faz proxy para
o Nitro.

Em **dev**, o mapa vem do **Vite do jogo na 5173**, nao do `dist/`. Por isso
o `npm run dev:web` da raiz e obrigatorio: sem ele, o iframe da rota `/jogo`
aponta para a 5173 e nao acha o `jogo.html` — o mapa fica preto, sem erro
visivel.

Tres processos em dev, so um acessado no navegador:

| processo | porta | quem usa |
|---|---|---|
| `npm run start` (raiz) | 8787 | API + WebSocket, via proxy do Vite do jogo |
| `npm run dev:web` (raiz) | 5173 | o iframe do mapa, com HMR |
| `npm run dev` (`front_rpg`) | 3000 | **o navegador** |

Em **producao**, `npm run build` na raiz e `npm run build` no `front_rpg`, e
tudo servido pelo Node unico na 8787. O `urlDoJogo()` escolhe entre os dois
pelo `import.meta.env.DEV`.
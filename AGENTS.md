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
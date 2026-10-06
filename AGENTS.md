# AGENTS.md

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
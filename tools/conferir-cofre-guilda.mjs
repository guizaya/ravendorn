/**
 * O QUE ESTE ARQUIVO CONFERE
 *
 * O cofre da guilda recusava MOEDA e ITEM com a mesma mensagem: "O cofre nao
 * aceitou esse pedido". Duas acoes com uma causa so e uma pista precisa: o
 * defeito nao estava no cofre, e sim no caminho do pedido entre o painel e o
 * servidor
 *
 * A causa: o `parsePanel` reconstroi a mensagem campo a campo por uma lista
 * fechada, e `moeda`, `item` e `quantidade` NAO estavam nela. Eles saiam
 * apagados, sem erro e sem aviso — e o servidor, vendo `pedido.moeda` e
 * `pedido.item` como `undefined`, caia no `if` do item e devolvia
 * `cofreInvalido` para as duas coisas
 *
 * Estes testes existem porque o defeito e INVISIVEL: nao ha excecao, nao ha
 * log, e a mensagem que o jogador ve fala de "cofre" quando o cofre esta
 * inocente
 */

import {
  parseCommand,
  createCommand,
  CLIENT_COMMANDS,
  PANEL_OPS,
} from "../src/shared/protocol.js";

let passou = 0;
let falhou = 0;

function conferir(descricao, condicao) {
  if (condicao) {
    passou += 1;
    console.log(`  ok   ${descricao}`);

    return true;
  }

  falhou += 1;
  console.log(`  FALHA ${descricao}`);

  return false;
}

/**
 * O QUE CHEGA AO SERVIDOR, depois da lista fechada.
 *
 * E o mesmo caminho do jogo: monta pelo `createCommand`, joga no
 * `parseCommand`, e olha o payload resultante. Sem o `JSON.parse` do meio o
 * teste estaria medindo o objeto original, e nao a mensagem
 */
function Traveling(extra) {
  const cmd = createCommand(CLIENT_COMMANDS.PANEL, {
    op: PANEL_OPS.GUILD_COFRE,
    guildId: "g1",
    cofreAcao: "depositar",
    ...extra,
  });

  const lido = parseCommand(JSON.parse(JSON.stringify(cmd)));

  return lido.ok ? lido.payload : null;
}

/**
 * O QUE O SERVIDOR FAZ COM O QUE CHEGOU.
 *
 * E a traducao das duas guardas do `GameServer`, reescrita aqui para poder
 * conferir sem subir um servidor. Se as guardas mudarem, este trecho precisa
 * mudar junto — e e esse acoplamento que o teste quer tornar visivel
 */
function oQueOServidorFaz(pedido) {
  if (!pedido) return { ok: false, motivo: "cofreInvalido" };

  if (pedido.moeda !== undefined && pedido.moeda !== null) {
    const moedas = Math.floor(Number(pedido.moeda) || 0);

    if (moedas <= 0) return { ok: false, motivo: "quantidade" };

    return { ok: true, tipo: "moeda", valor: moedas };
  }

  if (pedido.item === undefined || pedido.item === null) {
    return { ok: false, motivo: "cofreInvalido" };
  }

  return { ok: true, tipo: "item", valor: pedido.item };
}

console.log("\nCOFRE DA GUILDA: O PEDIDO CHEGA\n");

/* ------------------------------------------------------------------ *
 * 1. DEPOSITAR MOEDA
 * ------------------------------------------------------------------ */
console.log("1. depositar moeda\n");

{
  const pedido = Traveling({ moeda: 100 });
  const r = oQueOServidorFaz(pedido);

  conferir("a moeda sobrevive a mensagem", pedido?.moeda === 100);
  conferir("o servidor ve o caminho das moedas", r.ok && r.tipo === "moeda");
  conferir("e com o valor certo", r.valor === 100);
}

/* ------------------------------------------------------------------ *
 * 2. DEPOSITAR ITEM
 * ------------------------------------------------------------------ */
console.log("\n2. depositar item\n");

{
  const pedido = Traveling({
    item: "couro_goblin#common#1",
    quantidade: 3,
  });

  const r = oQueOServidorFaz(pedido);

  conferir("o item sobrevive a mensagem", pedido?.item === "couro_goblin#common#1");
  conferir("a quantidade sobrevive", pedido?.quantidade === 3);

  /**
   * O CASO QUE QUEBRAVA JUNTO COM A MOEDA.
   *
   * Com a lista fechada, um pedido de item chega com `moeda: null`. Um
   * `if (pedido.moeda !== undefined)` seria verdadeiro aqui, e o item
   * entraria no ramo do dinheiro com valor zero
   */
  conferir("o item NAO entra no ramo das moedas", r.ok && r.tipo === "item");
  conferir("e com a chave da pilha", r.valor === "couro_goblin#common#1");

  conferir(
    "campo ausente vira null, e nao some",
    pedido.moeda === null,
  );
}

/* ------------------------------------------------------------------ *
 * 3. SEM QUANTIDADE
 * ------------------------------------------------------------------ */
console.log("\n3. depositar sem quantidade\n");

{
  const pedido = Traveling({ item: "couro_goblin#common#1" });

  conferir("o item segue la", pedido?.item === "couro_goblin#common#1");
  conferir(
    "a quantidade ausente vira null, e o servidor trata como padrao",
    pedido?.quantidade === null,
  );
}

/* ------------------------------------------------------------------ *
 * 4. SAQUE
 * ------------------------------------------------------------------ */
console.log("\n4. retirar do cofre\n");

{
  const cmd = createCommand(CLIENT_COMMANDS.PANEL, {
    op: PANEL_OPS.GUILD_COFRE,
    guildId: "g1",
    cofreAcao: "retirar",
    uid: "slot_1",
    quantidade: 2,
  });

  const pedido = parseCommand(JSON.parse(JSON.stringify(cmd))).payload;

  conferir("o uid sobrevive", pedido?.uid === "slot_1");
  conferir("a quantidade do saque sobrevive", pedido?.quantidade === 2);

  /**
   * O `uid` JA ESTAVA NA LISTA desde antes deste defeito. Era por isso que o
   * saque de item passava da primeira guarda e quebrava na segunda, com a
   * quantidade faltando — um defeito diferente com a mesma causa
   */
  conferir(
    "o item continua ausente num saque",
    pedido.item === null || pedido.item === undefined,
  );
}

/* ------------------------------------------------------------------ *
 * 5. NUMERO QUEbrADO NAO VIRA DINHEIRO
 * ------------------------------------------------------------------ */
console.log("\n5. numero quebrado\n");

{
  for (const valor of [0, -500, Infinity, NaN, "abc", null]) {
    const pedido = Traveling({ moeda: valor });

    conferir(`moeda ${String(valor)} vira null`, pedido?.moeda === null);
  }

  const r = oQueOServidorFaz(Traveling({ moeda: -500 }));

  conferir(
    "e o pedido recusa, em vez de creditar",
    r.ok === false,
  );

  const grande = Traveling({ moeda: 5_000_000_000 });

  conferir("moeda acima do teto vira null", grande?.moeda === null);
  conferir(
    "e o limite cabe num deposito legitimo",
    Traveling({ moeda: 5_000_000 })?.moeda === 5_000_000,
  );

  conferir(
    "quantidade acima da pilha vira null",
    Traveling({ item: "x", quantidade: 500 })?.quantidade === null,
  );

  conferir(
    "e 99 cabe",
    Traveling({ item: "x", quantidade: 99 })?.quantidade === 99,
  );

  conferir(
    "item enorme vira null",
    Traveling({ item: "z".repeat(500) })?.item === null,
  );
}

/* ------------------------------------------------------------------ *
 * 6. O QUE NAO PODE QUEBRAR
 * ------------------------------------------------------------------ */
console.log("\n6. o bau continua igual\n");

{
  const cmd = createCommand(CLIENT_COMMANDS.PANEL, {
    op: PANEL_OPS.BAU,
    bauAcao: "depositar",
    uid: "couro_goblin#common#1",
    count: 5,
  });

  const pedido = parseCommand(JSON.parse(JSON.stringify(cmd))).payload;

  conferir("o bau segue mandando uid", pedido?.uid === "couro_goblin#common#1");
  conferir("e count", pedido?.count === 5);
}

console.log(`\n${passou} ok, ${falhou} falhas\n`);

if (falhou) process.exit(1);
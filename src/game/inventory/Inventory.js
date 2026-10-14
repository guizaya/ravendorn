import {
  baseRarityOf,
  getItem,
  isStackable,
} from "../../data/items/index.js";
import { MOCHILA_SLOTS_BASE } from "../../data/inventory/capacidade.js";

/**
 * A CAPACIDADE DA MOCHILA, e ela CRESCE.
 *
 * Este e o valor de partida, e vem do arquivo das regras — o mesmo que o
 * servidor e a tela de expansao leem. Escrever `20` aqui tambem criaria uma
 * segunda fonte: a expansao subiria a mochila para 30 enquanto o construtor
 * ainda nasceria em 20, e o save sobrescreveria a compra na proxima entrada
 */
export const INVENTORY_CAPACITY = MOCHILA_SLOTS_BASE;

let instanceSequence = 0;

function nextInstanceId(itemId, rarity) {
  instanceSequence += 1;

  return `${itemId}#${rarity}#${instanceSequence}`;
}

/**
 * QUANTOS SLOTS UM ITEM PRECISA, sem colocar nada.
 *
 * E a MESMA conta que o `add` faz — funde nas pilhas que ja existem e
 * sobe o numero de pilhas novas — so que respondendo "quantas" em vez
 * de "quantas couberam". Sem isto, a unica forma de saber se o item
 * cabe e tentar, e o Tentar ja custou a moeda
 *
 * Considera a MESMA raridade que o `add` consideraria, porque funde so
 * com pilhas de raridade igual. E por isso que 200 unidades de um
 * material que voce nao tem precisam de 3 slots (99 por pilha) e as
 * mesmas 200 de um material que voce ja tem cabem em 0
 *
 * E uma funcao PURA, e nao um metodo, porque os dois lados precisam da
 * mesma conta: o servidor para recusar a compra e o painel para
 * desabilitar o botao. Duas copias desta conta divergem na primeira
 * regra que alguem afrouxar
 */
export function slotsNecessarios(
  stacks,
  itemId,
  count = 1,
  rarity = null,
) {
  const item = getItem(itemId);

  if (!item || count <= 0) return 0;

  const target = rarity ?? baseRarityOf(itemId);
  const stackable = isStackable(item);
  const maxStack = item.maxStack ?? 1;

  let remaining = Math.floor(count);

  if (stackable) {
    for (const stack of stacks) {
      if (remaining <= 0) break;

      if (stack.itemId !== itemId) continue;
      if ((stack.rarity ?? baseRarityOf(itemId)) !== target) {
        continue;
      }

      const room = maxStack - stack.count;

      if (room <= 0) continue;

      remaining -= Math.min(room, remaining);
    }
  }

  let slots = 0;

  while (remaining > 0) {
    remaining -= stackable ? Math.min(maxStack, remaining) : 1;
    slots += 1;
  }

  return slots;
}

export class Inventory {
  constructor(capacity = INVENTORY_CAPACITY) {
    this.capacity = capacity;
    this.stacks = [];
    this.coins = 0;

    /**
     * O STEEL, que comeca em zero.
     *
     * E um numero solto como o `coins`, e nao uma `stack` de item: nao da
     * para gastar em loja, nao ocupa vaga, nao vira icone no inventario.
     * E so um saldo que a mineracao soma e a HUD mostra
     *
     * Quem escreve nele e so o servidor, pelo `GameServer`, no tick de
     * mineracao. O cliente recebe o valor pronto no `summary` e nunca
     * soma nada por conta propria
     */
    this.steel = 0;

    /**
     * O DIAMANTE, que comeca em zero.
     *
     * E o terceiro saldo, e o unico que o mercado usa como MOEDA DE ANUNCIO
     * alem do ouro. Como o `steel`, e um numero solto: nao da para gastar em
     * loja, nao ocupa vaga, nao vira icone no inventario
     *
   * ## POR QUE ELE EXISTE E O QUE AINDA NAO EXISTE
   *
   * Ele existe porque o mercado entre jogadores vende em duas moedas, e o
   * preco do anuncio precisa saber em qual delas.
   *
   * ## AS DUAS LOJAS, E POR QUE SAO MOEDAS DIFERENTES
   *
   * A loja do NPC vende pocao e livro, e e OURO: dinheiro que o jogador
   * ganha matando bicho, e por isso que ela e do mercador. A `LOJA` vende
   * pacote e evento, e e DIAMANTE — e o `comprarProduto` do servidor ja
   * cobra em `spendDiamonds`
   *
   * A divisao nao e o preco, e QUEM produz a moeda. Ouro tem origem no jogo;
   * diamante ainda nao tem, e por isso a loja de diamante e a de coisa cara
   *
   * ## O QUE AINDA NAO EXISTE
   *
   * Nenhuma fonte de diamante: nao ha drop, nem missao, nem recompensa que
   * pague nele. E a regra de conversao (quanto vale em ouro) tambem nao
   * existe — ate ela existir, o filtro de moeda do mercado mostra o
   * diamante e nenhum anuncio usa
   */
    this.diamonds = 0;

    this.overflow = 0;

    /**
     * O `Equipment` QUE ESTA VESTIDO, para a contagem de espaco.
     *
     * E uma referencia, e nao uma copia: o mesmo objeto que o `Equipment`
     * da sessao usa. Se fosse uma copia, vestir uma peca nao mudaria a
     * contagem da mochila, e o loot voltaria a recusar item com a tela
     * mostrando espaco
     *
     * E `null` no `bau` — o bau nao veste peca, e `pilhasVestidas` ja
     * devolve conjunto vazio sem ele
     */
    this.equipment = null;
  }

  /**
   * APONTA A MOCHILA PARA O EQUIPAMENTO DA MESMA SESSAO.
   *
   * Existe como metodo, e nao so como parametro do construtor, porque a
   * sessao monta o `equipment` ANTES do `inventory` e os dois se referenciam:
   * quem passa primeiro nao consegue injetar no outro pelo construtor
   */
  usarEquipment(equipment) {
    this.equipment = equipment ?? null;
  }

  get usedSlots() {
    return this.stacks.length;
  }

  get isFull() {
    return this.stacks.length >= this.capacity;
  }

  get freeSlots() {
    return Math.max(0, this.capacity - this.stacks.length);
  }

  /**
   * AS PILHAS QUE NAO OCUPAM A MOCHILA: as vestidas.
   *
   * ## O BUG QUE ESTA LISTA ARRUMA
   *
   * A HUD mostrava `7/20` com a mochila quase vazia e o loot do mob nao entrava
   * — o aviso dizia "mochila cheia". Duas contagens do mesmo numero discordavam:
   *
   * - a HUD (o `summary`) desconta o que esta VESTIDO, e por isso mostrava 7
   * - o `freeSlots` usava `stacks.length` CRU, que inclui o vestido, e via
   *   `capacity - stacks.length` chegar a zero com 13 espacos livres na tela
   *
   * O `cabe()` — que e o que decide se o drop entra — le `freeSlots`. Com as
   * duas contas errando para lados opostos, o jogador via 7/20 e o motor dizia
   * que nao cabia. Nenhum dos dois numeros estava errado: cada um media uma
   * coisa diferente, e so um deles era o que o loot precisava
   *
   * ## E O BUG QUE A PRIMEIRA VERSAO DESTE METODO DEIXOU
   *
   * A primeira versao filtrava por `equipment.isEquipped(stack.itemId)` e
   * guardava o resultado num `Set` de `itemId` — e o `isEquipped` responde
   * SO por `itemId`, sem olhar a raridade. Entao um `Set` de ids descartava
   * TODAS as pilhas daquele item:
   *
   *   20 pilhas de arco, sendo 4 lendarias, com 1 lendario vestido
   *   `isEquipped("willow_bow")` e verdadeiro
   *   o Set tinha `"willow_bow"`, e as 20 pilhas saiam do calculo
   *   a tela mostrava 0/20 e o `cabe` dizia "mochila cheia"
   *
   * Era o mesmo sintoma do bug original, com a causa invertida: aqui o espaco
   * sumia, e antes ele faltava. Por isso a chave e o PAR
   *
   * ## POR QUE O PAR `itemId` + `raridade`
   *
   * Porque e EXATAMENTE o par que o `add` usa para dizer que duas pilhas sao
   * pilhas diferentes — o mesmo `slotsNecessarios` e o mesmo `fundePilha`
   * comparam. Se a roupa da tela usasse uma chave e a do `add` usasse outra,
   * um slot da tela deixaria de bater com um slot do motor, que e o bug de
   * volta com outro nome
   *
   * E nao o `uid`: o `Equipment` nao guarda o `uid` da peca vestida, e o
   * guarda-lo seria mexer na estrutura dos slots por causa de uma contagem de
   * espaco
   *
   * ## E POR QUE CONTA, E NAO PROCURADA
   *
   * Porque o par sozinho ainda erra. Quatro arcos lendarios na mochila tem o
   * MESMO par, e `willow_bow|legendary` no Set excludes os quatro quando so
   * um esta vestido: a tela pulava de 20 para 16, e nao de 20 para 19
   *
   * Um `Map` de chave para QUANTOS slots usam aquela peca resolve: para cada
   * chave, sao excluidas no maximo tantas pilhas quantas pecas com aquele par
   * estao no corpo. E o que faz a conta fechar — um slot vestido remove UM
   * slot da mochila, nunca a pilha inteira
   *
   * ## E POR QUE A ORDEM NAO IMPORTA
   *
   * Porque o jogo nao sabe QUAL dos quatro arcos lendarios foi vestido, e nao
   * precisa saber: os quatro sao a mesma peca para a contagem de espaco, e o
   * `Equipment` responde pelo par tambem. Escolher a ultima pilha seria uma
   * regra que so pareceria precisa
   *
   * ## E POR QUE ISTO VIVE AQUI E NAO SO NO `summary`
   *
   * Porque o `summary` recebe o `equipment` por PARAMETRO, e quem chama pode
   * nao passar — e o `cabe` nao tem parametro nenhum. Se a correcao ficasse
   * so no `summary`, a tela passaria a mostrar um numero e o `cabe` continuaria
   * usando o outro
   */
  pilhasVestidas(equipment = this.equipment) {
    if (!equipment) return new Set();

    /**
     * QUANTOS SLOTS USAM CADA PECA, e nao so quais.
     *
     * Sao dois slots com o mesmo par possivel — um `ring` e um `ring2` com
     * o mesmo anel. O `Set` contaria 1 e esvaziaria as duas pilhas
     */
    const porChave = new Map();

    for (const slot of equipment.slots ?? []) {
      if (!slot?.itemId) continue;

      const chave = chaveDePilha(slot.itemId, slot.rarity);

      porChave.set(chave, (porChave.get(chave) ?? 0) + 1);
    }

    if (porChave.size === 0) return new Set();

    const resta = new Map(porChave);
    const vestidas = new Set();

    for (const stack of this.stacks) {
      const chave = chaveDePilha(
        stack.itemId,
        stack.rarity ?? baseRarityOf(stack.itemId),
      );

      const disponiveis = resta.get(chave) ?? 0;

      if (disponiveis <= 0) continue;

      resta.set(chave, disponiveis - 1);
      vestidas.add(stack.uid);
    }

    return vestidas;
  }

  /**
   * QUANTOS SLOTS A MOCHILA USA DE VERDADE.
   *
   * E o numero que a HUD mostra e o numero que o loot respeita. Sao o mesmo
   * por construcao: os dois vem daqui
   *
   * ## E POR QUE FILTRA POR `uid`, E NAO POR `itemId`
   *
   * Porque `pilhasVestidas` devolve um Set de `uid`. Filtrar de novo por
   * `itemId` aqui desfaria o trabalho la dentro: o Set tem o `uid` das pilhas
   * que sao a MESMA peca vestida, e comparar `itemId` traria de volta todas
   * as pilhas daquele item — que e o bug que o `pilhasVestidas` acabou de
   * arrumar
   */
  /**
   * QUANTOS SLOTS A MOCHILA USA, segundo o `equipment` QUE VIER.
   *
   * E a funcao que resolve a divergencia: o `equipment` e um PARAMETRO, e nao
   * uma referencia guardada. Quem tem o corpo na ma — o loot, com o dono do
   * abate — passa, e a conta sai igual a da tela
   *
   * Sem o parametro cai na referencia da sessao (`usarEquipment`), que e o
   * que serve para o bau e para o mercado, onde nao ha dono de abate
   *
   * ## E POR QUE FILTRA POR `uid`, E NAO POR `itemId`
   *
   * Porque `pilhasVestidas` devolve um Set de `uid`. Filtrar de novo por
   * `itemId` aqui desfaria o trabalho la dentro: o Set tem o `uid` das pilhas
   * que sao a MESMA peca vestida, e comparar `itemId` traria de volta todas
   * as pilhas daquele item — que e o bug que o `pilhasVestidas` acabou de
   * arrumar
   */
  usadosCom(equipment = this.equipment) {
    const vests = this.pilhasVestidas(equipment);

    return vests.size === 0
      ? this.stacks.length
      : this.stacks.filter((stack) => !vests.has(stack.uid)).length;
  }

  /**
   * QUANTOS SLOTS AINDA DA PARA USAR, com o equipamento dado.
   *
   * E este, e nao o `freeSlots` cru, que o `cabe` e o `hasSpace` devem ler.
   * O `freeSlots` cru continua existindo para o `add` — que escreve em
   * `stacks` de verdade e precisa contar a pilha que vai nascer, vestida ou
   * nao. Sao dois numeros diferentes sobre a mesma bolsa, e cada um serve a um
   * proposito
   */
  livresCom(equipment = this.equipment) {
    return Math.max(0, this.capacity - this.usadosCom(equipment));
  }

  get usedSlotsNaMochila() {
    return this.usadosCom(this.equipment);
  }

  get freeSlotsNaMochila() {
    return this.livresCom(this.equipment);
  }

  /**
   * CABEM `lista` de itens na mochila, sem perder nenhum?
   *
   * ## POR QUE EXISTE
   *
   * Porque `isFull` responde "cabe mais UM?", e a compra de um CONJUNTO
   * precisa de outra pergunta: "cabem TRES?". A loja vende pacotes de ate
   * quatro itens, e sem esta checagem o jogador pagava por tres e recebia
   * um, com o dinheiro ja debitado
   *
   * ## POR QUE CONTA PILHAS NOVAS, E NAO ITENS
   *
   * Porque e PILHA que ocupa lugar. `freeSlots` e `capacity` contam
   * `stacks.length`, e um material que o jogador ja tem 10 vira 40 na MESMA
   * pilha — nao em quatro. Contar "40 unidades" contra `freeSlots` daria
   * "Mochila cheia" num pacote que cabia inteiro, e o jogador pagaria para
   * receber um erro
   *
   * ## POR QUE OLHA O QUE JA EXISTE NA MOCHILA
   *
   * Porque um item que ja tem pilha nao cria pilha nova — ele cresce
   * dentro dela. E o que faz um pacote de 12 materiais ser aceito com 3
   * espacos livres, e nao recusado por causa de 12
   *
   * E por isso que quem chama passa a LISTA e nao um numero: a contagem de
   * pilhas novas so existe depois de saber quais itens ja tem pilha
   *
   * ## POR QUE A MOEDA NAO ENTRA NESTA CONTA
   *
   * Porque ouro e steel somam em saldo e nao ocupam pilha nenhuma. Quem
   * chama precisa tirar a moeda da lista antes
   */
  hasSpace(lista = []) {
    const comPilha = new Set(
      this.stacks.map((pilha) => pilha.itemId),
    );

    const novasPilhas = lista.filter(
      (entrada) => !comPilha.has(entrada.itemId),
    ).length;

    return novasPilhas <= this.freeSlotsNaMochila;
  }

  /**
   * QUANTOS SLOTS UM ITEM PRECISA, sem colocar nada na mochila.
   *
   * E a MESMA conta que o `add` faz — funde nas pilhas que ja tem e
   * sobe o numero de pilhas novas — so que respondendo "quantas" em vez
   * de "quantas couberam". Sem isto, a unica forma de saber se o item
   * cabe e tentar: o dinheiro ja tinha sido gasto, o `add` tinha
   * devolvido metade no `overflow`, e o jogador recebia um "mochila
   * cheia" sem nunca ter visto o numero que explicaria
   *
   * Considera a MESMA raridade que o `add` consideraria, porque funde
   * so com pilhas de raridade igual. E por isso que 5 unidades de um
   * material novo podem precisar de 1 slot e as mesmas 5 de um material
   * que voce ja tem cabem em 0
   */
  slotsNeeded(itemId, count = 1, rarity = null) {
    return slotsNecessarios(this.stacks, itemId, count, rarity);
  }

  /**
   * ESTE ITEM CABE NA MOCHILA AGORA?
   *
   * O `slotsNeeded` e o `freeSlots` juntos. E o que a compra do mercado
   * pergunta ANTES de gastar a moeda, para o "mochila cheia" chegar
   * com o numero que explica em vez de uma negativa seca
   *
   * ## E POR QUE O `equipment` E ULTIMO PARAMETRO
   *
   * Porque quem tem o corpo na ma precisa dizer QUAL e. O loot conhece o
   * equipamento do dono do abate e passa aqui; sem isso o `cabe` cairia na
   * referencia da sessao, que pode nao estar ligada depois de um restore de
   * save — e a tela dizia 15/20 com o drop recusado por "mochila cheia"
   *
   * Fica no fim para nao quebrar quem ja chama com tres argumentos
   */
  cabe(itemId, count = 1, rarity = null, equipment = this.equipment) {
    return (
      this.slotsNeeded(itemId, count, rarity) <= this.livresCom(equipment)
    );
  }

  addCoins(amount) {
    if (amount <= 0) return 0;

    this.coins += Math.floor(amount);

    return this.coins;
  }

  spendCoins(amount) {
    if (amount <= 0) return true;
    if (this.coins < amount) return false;

    this.coins -= Math.floor(amount);

    return true;
  }

  /**
   * O STEEL GANHO NUMA BATIDA NA PEDIDA.
   *
   * ## POR QUE FICA NO `Inventory` E NAO NUMA VARIAVEL DA SESSAO
   *
   * Porque steel e moeda: ele viaja no `summary`, entra no save e aparece
   * na HUD do lado do gold. Deixar numa variavel a parte obrigaria o
   * `summary` a puxar de fora, e o inventario e o unico lugar onde a HUD
   * ja busca o que e dinheiro
   *
   * ## POR QUE NAO USA `addCoins`
   *
   * Porque sao saldos separados. Se o steel entrasse em `coins`, o jogador
   * veria um numero so, o mercado gastaria steel sem o jogador pedir, e o
   * `coins` do save passaria a guarda duas moedas com regras diferentes
   *
   * ## POR QUE SO CRESCER — E AGORA NAO E SO CRESCER
   *
   * Ate aqui nada no jogo gastava steel, e `addSteel` sem `spendSteel` era
   * uma decisao explicita, nao um esquecimento. O aprimoramento foi a
   * primeira compra, e o `spendSteel` entrou logo abaixo — o par completo
   */
  addSteel(amount) {
    if (amount <= 0) return this.steel;

    this.steel += Math.floor(amount);

    return this.steel;
  }

  /**
   * O STEEL GASTO NUMA COMPRA.
   *
   * ## POR QUE EXISTE E POR QUE E O MESMO DO `spendCoins`
   *
   * Porque e a unica outra forma de `addSteel` ter recorrido, e porque e a
   * MESMA guarda do `spendCoins`: `addSteel(-n)` nao debita nada — a
   * primeira linha e `if (amount <= 0) return this.steel` — entao um
   * `addSteel` negativo deixaria o aprimorar de graca com o preco na tela
   *
   * E o `steel < amount` volta `false` sem mexer no saldo, e nao lanca nem
   * avisa: quem chama ja comparou os dois numeros para montar a mensagem, e
   * um segundo aviso aqui repetiria o mesmo texto em dois lugares, um dos
   * quais acabaria com a mensagem errada depois de uma mudanca de preco
   *
   * ## POR QUE O SALDO NAO FICA NEGATIVO NEM QUEBRADO
   *
   * Porque nao ha caminho no jogo que produza steel negativo: ou o saldo
   * cobre o custo e ele debita, ou nao cobre e nada acontece. E o
   * `CharacterSave` ja tem o `Math.max(0, ...)` como segunda linha de
   * defesa para o save antigo
   */
  spendSteel(amount) {
    if (amount <= 0) return true;
    if (this.steel < amount) return false;

    this.steel -= Math.floor(amount);

    return true;
  }

  /**
   * O DIAMANTE GANHO.
   *
   * ## POR QUE `addDiamonds` E NAO `addDiamond`
   *
   * Porque o saldo e plural no codigo inteiro — `coins` e `steel` tambem — e
   * um metodo no singular ao lado de dois no plural faria o leitor procurar
   * qual dos dois e o certo
   *
   * ## POR QUE AINDA NAO CHAMA NINGUEM
   *
   * Nenhuma parte do jogo concede diamante ainda. O metodo existe porque o
   * mercado ja precisa saber o saldo para mostrar a barra e filtrar por
   * moeda, e um saldo so de leitura seria um campo nu: quando a primeira
   * recompensa em diamante existir, e este metodo que ela chama, e o par
   * `add`/`spend` ja fica completo
   */
  addDiamonds(amount) {
    if (amount <= 0) return this.diamonds;

    this.diamonds += Math.floor(amount);

    return this.diamonds;
  }

  /**
   * O DIAMANTE GASTO NUMA COMPRA.
   *
   * A MESMA guarda do `spendCoins` e do `spendSteel`, pelos mesmos motivos
   * documentados nos dois: `amount <= 0` nao debita nada, e saldo insuficiente
   * volta `false` sem mexer no numero e sem lancar
   */
  spendDiamonds(amount) {
    if (amount <= 0) return true;
    if (this.diamonds < amount) return false;

    this.diamonds -= Math.floor(amount);

    return true;
  }

  /**
   * Total do item em TODAS as raridades. E o que a receita olha:
   * o jogador tem os materiais, e a raridade deles nao entra na
   * conta.
   */
  count(itemId) {
    let total = 0;

    for (const stack of this.stacks) {
      if (stack.itemId === itemId) {
        total += stack.count;
      }
    }

    return total;
  }

  /** total do item naquela raridade exata */
  countAt(itemId, rarity) {
    const target =
      rarity ?? baseRarityOf(itemId);

    let total = 0;

    for (const stack of this.stacks) {
      if (stack.itemId !== itemId) continue;
      if ((stack.rarity ?? baseRarityOf(itemId)) !== target) {
        continue;
      }

      total += stack.count;
    }

    return total;
  }

  has(itemId, count = 1) {
    return this.count(itemId) >= count;
  }

  hasAt(itemId, count, rarity) {
    return this.countAt(itemId, rarity) >= count;
  }

  findStack(itemId, rarity = null) {
    if (rarity !== null) {
      const target =
        rarity ?? baseRarityOf(itemId);

      return (
        this.stacks.find(
          (stack) =>
            stack.itemId === itemId &&
            (stack.rarity ?? baseRarityOf(itemId)) === target,
        ) ?? null
      );
    }

    return (
      this.stacks.find(
        (stack) => stack.itemId === itemId,
      ) ?? null
    );
  }

  findByUid(uid) {
    return (
      this.stacks.find((stack) => stack.uid === uid) ??
      null
    );
  }

  takeUid(uid, count = 1) {
    const stack = this.findByUid(uid);

    if (!stack) return null;

    const taken = Math.min(stack.count, Math.max(1, count));

    stack.count -= taken;

    const result = {
      uid: stack.uid,
      itemId: stack.itemId,
      rarity: stack.rarity ?? baseRarityOf(stack.itemId),
      count: taken,
      equipped: stack.equipped,

      /**
       * O afixo viaja com a peca que saiu.
       *
       * O `equipItem` do motor tira a peca da mochila, veste no slot e
       * devolve a que estava vestida com `inventory.add`. Se o
       * enchantamento nao estivesse aqui, ele morreria nessa ida: a
       * peca voltaria da mochila sem afixo, e o jogador veria um arco
       * encantado perder o afixo so por trocar de lugar
       */
      enchant: stack.enchant ?? null,

      /**
       * O APRIMORAMENTO viaja com a peca que saiu, pelo mesmo motivo do
       * afixo acima.
       *
       * O motor veste no slot com este quinto campo e, ao tirar a peca
       * de volta, grava nele o valor que estava no slot. Sem esta linha
       * o numero se perderia na ida — que e o que acontecia antes, porque
       * ele so existia no slot
       */
      enhance: stack.enhance ?? 0,
    };

    if (stack.count <= 0) {
      this.stacks.splice(
        this.stacks.indexOf(stack),
        1,
      );
    }

    return result;
  }

  take(itemId, count = 1, rarity = null) {
    return this.takeUid(
      this.findStack(itemId, rarity)?.uid,
      count,
    );
  }

  /**
   * `rarity` nulo significa a raridade de catalogo do item, entao
   * loot, missao e os testes antigos continuam produzindo o item
   * cru. O craft e o unico que passa raridade explicita.
   */
/**
 * COLOCA UM ITEM NA MOCHILA.
 *
 * ## OS DOIS PARAMETROS NOVOS
 *
 * `comercializavel` e `enhance` entram por aqui porque o drop ja chega
 * decidido do `LootSystem`: a chance de virar mercadoria e o sorteio do afixo
 * sao do MOMENTO em que a peca cai, e nao do momento em que ela entra na
 * bolsa. Adivinhar aqui faria o mesmo drop virar mercadoria em uma hora e nao
 * na outra
 *
 * E o `add` continua aceitando so os tres primeiros argumentos, porque quem
 * chama sem os novos e o loot comum, a loja, o mercado e a entrega — todos
 * esses caminhos nao sorteiam nada
 */
add(itemId, count = 1, rarity = null, opcoes = {}) {
  const item = getItem(itemId);

  if (!item || count <= 0) {
    return { added: 0, dropped: count };
  }

  const {
    comercializavel = false,
    enhance = 0,
    enchant = null,
  } = opcoes ?? {};

  const target = rarity ?? baseRarityOf(itemId);
  const stackable = isStackable(item);
  const maxStack = item.maxStack ?? 1;

/**
 * PILHA COM AFIXO NAO FUNDE.
 *
 * E o limite que o proprio `add` ja tinha antes desta regra, escrito no
 * campo `enhance` de baixo: duas pecas iguais na mesma raridade com afixos
 * diferentes nao cabem numa pilha so, porque a pilha tem UM afixo. Uma peca
 * que cai com afixo ja entra na bolsa como peca solitaria, e o que sobra e
 * descartado pelo `overflow` — que e o mesmo destino de qualquer mochila
 * cheia
 *
 * ## E POR QUE AGORA TAMBEM O `enchant`, E NAO SO O `enhance`
 *
 * Porque as duas regras se cruzavam. O `enhance` era o unico campo que
 * segurava o "esta peca tem algo proprio", e o `enchant` — o afixo de verdade,
 * o que o jogador ve escrito na peca — nao participava da decisao. Uma peca
 * de mob com afixo e `enhance: 0` (que e o caso comum, porque o
 * aprimoramento tem 8% e o afixo tem 100%) entrava FUSINDO numa pilha:
 *
 * - a pilha existente, sem afixo, absorvia a peca
 * - o afixo do drop sumia, e o jogador nunca viu o item encantado
 * - o `summary` devolvia uma pocao com afixo que so existia no primeiro slot
 *
 * E o `enchant` nao podia entrar na regra como esta: ele nao impede fusao de
 * material, e material nunca tem afixo. Um afixo e uma peca solitaria
 */
const fundePilha = stackable && enhance <= 0 && !enchant;

  let remaining = Math.floor(count);
  let added = 0;

  if (fundePilha) {
    for (const stack of this.stacks) {
      if (stack.itemId !== itemId) continue;
      if ((stack.rarity ?? baseRarityOf(itemId)) !== target) {
        continue;
      }

      const room = maxStack - stack.count;

      if (room <= 0) continue;

      const moved = Math.min(room, remaining);

      stack.count += moved;
      remaining -= moved;
      added += moved;
    }
  }

    while (remaining > 0) {
      if (this.stacks.length >= this.capacity) {
        break;
      }

      const moved = stackable
        ? Math.min(maxStack, remaining)
        : 1;

      this.stacks.push({
        uid: nextInstanceId(itemId, target),
        itemId,
        rarity: target,
        count: moved,
        equipped: false,

        /**
         * O ENCANTAMENTO, ou `null`.
         *
         * E `null` no nascimento, e nao `undefined`: o painel e o save
         * leem este campo, e a diferenca entre "sem afixo" e "afixo
         * desconhecido" precisa ser uma so coisa
         *
* Material nunca recebe um, porque material e empilhavel e uma
         * pilha de 99 nao tem um afixo por peca. Nao e por Luck: e que
         * `add` funde duas pilhas do MESMO item e MESMA raridade, e as
         * duas nao poderiam ter afixos diferentes
         *
         * E o valor vem do PARAMETRO, e nao de um sorteio aqui dentro: quem
         * sabe QUAL afixo sorteado e quem montou a peca. O `LootSystem`
         * sorteia uma vez no rollout do drop, e o painel de encantar sorteia
         * no clique. Sortear aqui faria o mesmo item vir com afixo diferente
         * conforme o caminho por onde ele entrou na mochila
         */
        enchant: enchant ?? null,

          /**
           * O APRIMORAMENTO, ou `0`.
           *
           * Mesmo tratamento do afixo acima: `0` e nao `undefined`, para o
           * painel e o save lerem um campo so
           *
           * E `add` funde duas pilhas do MESMO item e MESMA raridade, o que
           * e o mesmo limite do afixo: duas pilhas fundidas com niveis de
           * aprimoramento diferentes nao teriam como guardar os dois. Por
           * isso quem chama `add` devolve a peca que ja vinha de um slot e
           * o motor garante de nao misturar
           */
          enhance: Math.max(0, Math.floor(enhance)),

          /**
           * A COMERCIALIZAVEL, ou `false`.
           *
           * `false` e nao `undefined`: o mercado le este campo para decidir se
           * a peca pode ser anunciada, e um `undefined` seria lido como "ainda
           * nao se sabe" — que nao e um estado que este jogo tem
           *
           * Material nunca e comercializavel por aqui, e o motivo e o mesmo do
           * afixo: ele e empilhavel, entao a pilha inteira e de uma vez
           */
          comercializavel: Boolean(comercializavel),
        });

      remaining -= moved;
      added += moved;
    }

    this.overflow = remaining;

    return { added, dropped: remaining };
  }

  /**
   * Sem `rarity`, varre qualquer variante do item. A receita usa
   * esta forma: o ingrediente e "o item", nao "aquele item
   * naquela raridade".
   */
  remove(itemId, count = 1, rarity = null) {
    const target = Math.floor(count);

    if (target <= 0) return 0;

    let remaining = target;

    for (
      let index = this.stacks.length - 1;
      index >= 0;
      index -= 1
    ) {
      const stack = this.stacks[index];

      if (stack.itemId !== itemId) continue;

      if (rarity !== null) {
        const wanted = rarity ?? baseRarityOf(itemId);

        if ((stack.rarity ?? baseRarityOf(itemId)) !== wanted) {
          continue;
        }
      }

      const taken = Math.min(stack.count, remaining);

      stack.count -= taken;
      remaining -= taken;

      if (stack.count <= 0) {
        this.stacks.splice(index, 1);
      }

      if (remaining <= 0) break;
    }

    return target - remaining;
  }

clear() {
      this.stacks = [];
      this.coins = 0;
      this.steel = 0;
      this.diamonds = 0;
      this.overflow = 0;
    }

  summary(equipment = null) {
/**
   * O SLOT DA MOCHILA, e a PECA VESTIDA NAO O USA.
   *
   * ## POR QUE ISTO PRECISA DO `equipment`
   *
   * Porque a peca vestida CONTINUA em `stacks`: ela so ganha um `slotId` no
   * equipamento, e nao sai da lista. Sem esta conta, um jogador com 19 pilhas
   * e o peito vestido veria "20/20" na mochila — cheio, sem ter nenhum lugar
   * livre para pegar o drop que esta no chao embaixo dele
   *
   * ## POR QUE UM `Set` DE IDS E NAO UMA CONTAGEM DE FLAGS
   *
   * Porque o `equipment` responde por `itemId`, e duas pilhas do mesmo item
   * (mesmo `itemId`, raridades diferentes) sao DUAS pilhas. Contando flags
   * `isEquipped` linha a linha, uma peca vestida e uma pilha da mesma
   * variante que ficou na bolsa seriam contadas as duas — e o slot sumiria da
   * mochila sem que nenhuma peca tivesse saido dela
   *
   * E o mesmo par `itemId` + `raridade` que o `add` usa — e o `Set` e de
   * `uid`, que identifica a peca exata. Filtrar por `itemId` traria de volta
   * todas as pilhas daquele item: o `isEquipped` responde so por `itemId`, e
   * 20 pilhas de arco com uma vestida sumiriam as 20
   */
  /**
 * O `equipment` DESTA CONTA.
 *
 * ## POR QUE ISTO EXISTE
 *
 * Porque o `summary` aceita `equipment` por parametro E a sessao guarda um
 * `this.equipment`. Sao as duas metades do mesmo dado, e quem chama precisa
 * poder escolher: o servidor passa o da sessao em foco a cada painel, e o
 * resto chama sem nada e usa o guardado
 *
 * Sem esta linha, `summary()` sem parametro recebia `null`, o `pilhasVestidas`
 * devolvia conjunto vazio, e TODA peca saia com `equipped: false` — que e o
 * que o painel le para esconder o que esta no corpo. O contador `used`
 * continuava certo (15), porque ele vinha do getter, e era por isso que a tela
 * dizia 15/20 enquanto a grade mostrava as pecas vestidas como se estivessem
 * na bolsa
 */
const quemConta = equipment ?? this.equipment;

  const vests = this.pilhasVestidas(quemConta);

  /**
   * O MESMO `usedSlotsNaMochila`, e nao uma segunda conta.
   *
   * Porque o `summary` recebe o `equipment` por PARAMETRO — quem chama pode
   * passar o da sessao em foco, que e o certo no servidor — e o getter usa o
   * que a sessao guardou. Sao o mesmo numero nos dois casos, e escrever a
   * conta duas vezes e o que deixou as duas divergirem
   */
  const usadosNaMochila =
    quemConta !== this.equipment
      ? this.stacks.filter((stack) => !vests.has(stack.uid)).length
      : this.usedSlotsNaMochila;

        return {
      coins: this.coins,

      /**
       * O STEEL VAI NO MESMO PACOTE QUE O GOLD, E NAO EM OUTRO.
       *
       * Porque a HUD le `snapshot.inventory` uma vez so, e o badge do steel
       * fica ao lado do gold. Se o steel viesse em `snapshot.steel`, a HUD
       * buscaria em dois lugares e o `bauSnapshot` — que monta um resumo
       * proprio — teria de lembrar do segundo
       */
steel: this.steel,

        /**
         * O DIAMANTE VAI NO MESMO PACOTE QUE OS OUTROS DOIS.
         *
         * Pela mesma razao do `steel`: o mercado le `snapshot.inventory` uma
         * vez so, e a barra de saldo do `MarketModal` mostra as tres moedas na
         * mesma linha. Um `snapshot.diamonds` faria o mercado buscar em dois
         * lugares, e o `bauSnapshot` — que monta o resumo dele — teria de
         * lembrar do terceiro
         */
        diamonds: this.diamonds,

used: usadosNaMochila,
      capacity: this.capacity,
      isFull: usadosNaMochila >= this.capacity,
      items: this.stacks.map((stack) => ({
        uid: stack.uid,
        itemId: stack.itemId,
        rarity:
          stack.rarity ?? baseRarityOf(stack.itemId),
        count: stack.count,
        /**
     * A PILHA ESTA VESTIDA?
     *
     * ## POR QUE NAO PODE SER O `equipment.isEquipped(itemId)`
     *
     * Porque o `isEquipped` responde so por `itemId`, sem olhar a raridade.
     * Com `willow_bow|uncommon` no corpo, as TRES pilhas de arco incomum da
     * mochila recebiam `equipped: true` — e o `InventoryPanel` tem um
     * `if (entry.equipped) continue` para nao repetir a peca no boneco e na
     * grade. Duas palavras, tres pilhas escondidas
     *
     * No seu save isso dava 20 pilhas no snapshot, 13 escondidas pelo painel e
     * 7 visiveis — com o contador em `15/20`, que e a conta certa. A tela
     * dizia uma coisa, a grade mostrava outra, e o jogador via "7 itens" num
     * lugar que dizia 15
     *
     * ## POR QUE O PAR E NAO O `uid`
     *
     * Porque o `Equipment` nao guarda o `uid` da peca vestida, e o guarda-lo
     * seria mexer na estrutura dos slots por causa de um campo do painel.
     * O par `itemId` + `raridade` identifica a peca, e e o mesmo par que o
     * `add` usa para separar pilhas — entao o que o painel esconde e o que o
     * motor contou como ocupado
     *
     * E NAO O MESMO `Set` do `pilhasVestidas`: aquele e uma CONTAGEM (tres
     * slots de arco excluem tres pilhas), e aqui a pergunta e binaria — "esta
     * pilha e a peca do corpo?". Umbos contam certo com dados diferentes
     */
    equipped: vests.has(stack.uid),

        /**
         * O afixo, para o painel de encantar e para o inventario
         * mostrar a peca ja encantada
         *
         * Vai no `summary` e nao no `stack` cru porque o `summary` e
         * o que o painel consome, e e ele que e serializado no
         * snapshot de rede. O objeto vai como `null` quando a peca nao
         * tem afixo, e o painel trata os dois do mesmo jeito
         */
        enchant: stack.enchant ?? null,

        /**
         * O APRIMORAMENTO, pelo mesmo motivo do afixo acima.
         *
         * Sem esta linha o badge do `InvSlotView` receberia
         * `undefined` em toda peca da mochila e nunca apareceria — so
         * apareceria no boneco, que tem o dado pelo caminho do
         * `equipment`
         */
enhance: stack.enhance ?? 0,

          /**
           * A COMERCIALIZAVEL, pelo mesmo motivo do afixo acima.
           *
           * Vai no `summary` porque e o que o mercado le para saber se a peca
           * pode ser anunciada, e o mercado le do `summary` e nao do objeto
           * interno. Sem esta linha toda peca pareceria nao comercializavel e
           * nenhum anuncio aceitaria o drop
           */
comercializavel: stack.comercializavel ?? false,
          })),
      };
    }
  }

/**
 * A CHAVE QUE DIZ QUE DUAS PILHAS SAO A MESMA PECA.
 *
 * E `itemId` + `raridade`, e o MESMO par que o `slotsNecessarios` e o
 * `fundePilha` do `add` comparam. Um separador que nao pode aparecer em nenhum
 * dos dois lados — e por isso que e uma barra, e nao um ponto: o `itemId` do
 * catalogo usa underscore, e um separador ambiguo faria `a_b` + `c` colidir
 * com `a` + `b_c`
 */
function chaveDePilha(itemId, rarity) {
  return `${itemId}|${rarity}`;
}

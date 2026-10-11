import { randomBetween } from "../math.js";
import { BALANCE } from "../balance.js";
import { isCollected, isCollectedId } from "./lootFilter.js";
import {
  getItem,
  isStackable,
  RARITY,
} from "../../data/items/index.js";
import { sortearComercializavel } from "../rules/regrasDoItem.js";
import { rollEnchantDeDrop } from "../../data/enchant/index.js";

/**
 * O ITEM VAI PARA O INVENTARIO VESTIDO?
 *
 * E o que separa "material que o jogador usa ou vende" de "peca que o jogador
 * veste". As duas regras novas — comercializavel e afixo — so fazem sentido em
 * peca: material ja e livre e nao tem onde receber afixo
 *
 * ## POR QUE NAO REUSAR O `EQUIPABLE_TYPES` DO `Equipment.js`
 *
 * Porque aquele e o filtro do SLOT — a peca tem onde entrar. Aqui a pergunta e
 * outra: a peca tem os ATRIBUTOS que a regra do drop olha. Reusar o outro
 * criaria ciclo entre loot e equipamento, e o loot e lido pelo servidor antes
 * de qualquer sessao existir
 *
 * ## E POR QUE ISTO E MAIS ESTREITO QUE O `ENCHANTABLE_TYPES`
 *
 * Porque aqui a pergunta nao e "o item aceita encantamento pelo menu?", e
 * "essa drop VAI ser encantado?". O `ENCHANTABLE_TYPES` (arma e armadura)
 * responde a primeira; um colar tem slot e pode ser encantado pela tela, mas
 * nao entra afixo de drop — porque o `rollEnchantDeDrop` decide isso, e ele
 * barra pelo tipo. Sao dois filtros com perguntas diferentes, e usar o mesmo
 * aqui faria um colar de mob nascer com afixo que a tela de encantar depois
 * nao aceitaria
 */
const TIPOS_DE_PECA = new Set([
  "weapon",
  "armor",
  "trinket",
]);

function isEquipavel(item) {
  return Boolean(item?.type) && TIPOS_DE_PECA.has(item.type);
}

export const MAX_GROUND_DROPS = 60;
export const PICKUP_RADIUS = 46;

/**
 * AS PROPRIEDADES QUE O SORTEIO DECIDIU, PARA O `Inventory.add`.
 *
 * ## POR QUE EXISTE ISTO E NAO UM `add` COM OS CAMPOS ESPALHADOS
 *
 * Porque tres chamadores precisam das mesmas tres coisas — `collectFrom`,
 * `grantItems` e `collectNear` — e as tres esqueceram pelo menos uma. A
 * chamada inline de cada uma repetia a lista de campos, e a lista de campos e
 * a que cresce quando uma regra nova entra: o `enchant` foi o quarto campo,
 * e ele nasce `null` em material, que nao pode virar afixo
 *
 * ## E POR QUE SO OS TRES, E NAO O `itemId`
 *
 * Porque `itemId` e `count` vao como argumento, nao dentro do objeto: eles
 * sao a identidade do item e a quantidade, e o `opcoes` existe para o que
 * SOUBE do item. Misturar os doisaria um objeto que parece completo e nao e
 *
 * ## E POR QUE O `?? 0` E O `?? false`
 *
 * Porque `rollItems` escreve `null` explicitamente em material, e `null` em
 * `enhance` passaria pelo `Number.isFinite` do `Inventory` como ausencia —
 * por sorte. O `??` transforma a ausencia declarada no MESMO valor que a
 * ausencia nao declarada viraria, e o `add` nao precisa saber a diferenca
 */
function opcoesDoDrop(entry) {
  return {
    comercializavel: entry.comercializavel ?? false,
    enhance: entry.enhance ?? 0,
    enchant: entry.enchant ?? null,
  };
}

/**
 * O MESMO, PARA O DROP NO CHAO.
 *
 * ## POR QUE UM SPREAD E NAO `opcoesDoDrop`
 *
 * Porque o `spawnGroundDrop` cria o objeto do drop e o `collectNear` le
 * direto dele — nao ha `add` no meio. Mas os CAMPOS sao os mesmos pelos
 * mesmos motivos, e uma funcao que devolve o objeto inteiro impede que o
 * `collectNear` leia `drop.enhance` sem o `?? 0` que o `add` colocaria
 *
 * ## E O `afixo` DO `collectNear` SUMIU
 *
 * Era um segundo nome para a mesma coisa: o `collectNear` sorteava o afixo
 * em `drop.afixo` e depois lia `drop.afixo`. Com o afixo ja vindo do
 * `rollItems`, ele viraria um segundo sorteio — e a peca mudaria de afixo
 * conforme quem pegasse primeiro
 */
function propriedadesDoDrop(entry) {
  return {
    comercializavel: entry.comercializavel ?? false,
    enhance: entry.enhance ?? 0,
    enchant: entry.enchant ?? null,
  };
}

export class LootSystem {
  constructor(world) {
    this.world = world;
    this.sequence = 0;
    this.filter = null;
  }

  /**
   * O filtro PADRAO deste sistema de loot.
   *
   * Ele nao e mais o filtro do mundo: online cada jogador tem o seu,
   * e o sorteio recebe o filtro de quem vai receber o drop. Este
   * campo sobra para o single player e para os testes, que chamam
   * `roll` e `setFilter` sem sessao no meio.
   *
   * Deixar um filtro so no motor era o jeito de um jogador mudar o
   * loot de todo mundo no mesmo mapa.
   */
  setFilter(filter) {
    this.filter = filter;

    return this.pruneDrops(filter);
  }

  /**
   * itens barrados pelo filtro saem do pool antes do sorteio: assim
   * nunca viram drop, nunca vao para o chao e nunca entram na mochila.
   */
  allowedPool(pool, filter = this.filter) {
    if (!filter) return pool;

    return pool.filter((entry) =>
      isCollected(getItem(entry.id), filter),
    );
  }

  /**
   * limpa do chao o loot que parou de passar no filtro.
   *
   * Com `ownerId`, limpa SO o drop daquele dono. Sem ele, limpa
   * tudo, que e o comportamento do single player e dos testes.
   */
  pruneDrops(filter = this.filter, ownerId = null) {
    if (!filter) return 0;

    const drops = this.world.drops;
    let removed = 0;

    for (
      let index = drops.length - 1;
      index >= 0;
      index -= 1
    ) {
      const drop = drops[index];

      if (drop.kind !== "item") continue;

      // So o drop do dono conta. Um drop SEM dono tambem conta: e o
      // do single player e o drop antigo de antes desta regra, e no
      // servidor ele pertence a ninguem, entao ninguem o recolhe e
      // ele ficaria no chao para sempre
      if (
        ownerId !== null &&
        drop.ownerId &&
        drop.ownerId !== ownerId
      ) {
        continue;
      }

      if (isCollectedId(drop.itemId, filter)) {
        continue;
      }

      removed += drop.count ?? 1;
      drops.splice(index, 1);
    }

    return removed;
  }

  spawnGroundDrop(drop) {
    const list = this.world.drops;

    if (list.length >= MAX_GROUND_DROPS) {
      list.shift();
    }

    this.sequence += 1;

    list.push({
      uid: `drop_${this.sequence}`,
      ...drop,
      age: 0,
    });
  }

  scatter(x, y, amount, spread = 26) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * spread;

    return {
      x: x + Math.cos(angle) * radius,
      y: y + Math.sin(angle) * radius,
    };
  }

  /**
   * Sorteia o loot de uma criatura.
   *
   * O `filter` e o de QUEM vai receber. Sem ele, usa o filtro padrao
   * do sistema, que e o caso do single player e dos testes. Online
   * o filtro chega pela sessao do matador, e e por isso que dois
   * jogadores no mesmo mapa podem ter filtros opostos: o drop e
   * sorteado para o dono, nao para o mundo
   */
  roll(creature, filter = this.filter) {
    const table = creature.loot;

    if (!table) {
      return { coins: 0, items: [] };
    }

    const coins = this.rollCoins(table.coins);
    const items = this.rollItems(table, filter);

    return { coins, items };
  }

  rollCoins(range) {
    if (!range) return 0;

    const min = range.min ?? 0;
    const max = range.max ?? min;

    return Math.floor(randomBetween(min, max + 1));
  }

  rollItems(table, filter = this.filter) {
    const pool = this.allowedPool(table.items ?? [], filter);

    if (pool.length === 0) return [];

    const roll = Math.random();
    let chance = table.itemChance ?? 0;

    for (const boost of table.luck ?? []) {
      if (roll < boost.bonus) {
        chance += boost.bonus;
        break;
      }
    }

    if (Math.random() > chance) return [];

    const quantity = this.rollQuantity(table);
    const picked = [];

    for (let index = 0; index < quantity; index += 1) {
      const item = this.pickWeighted(pool);

      if (!item) continue;

      /**
       * A COMERCIALIZAVEL E O AFIXO SAEM AQUI, NO SORTEIO.
       *
       * E o unico lugar onde o drop e decidido — o `LootSystem` le o que o
       * chão da, e o `GameServer` so entrega. Se a chance fosse decidida no
       * `Inventory.add`, o mesmo item cairia comercializavel numa hora e
       * nao na outra, e o jogador aprenderia que o numero do mercado e
       * aleatorio duas vezes
       */
      const catalogo = getItem(item.id);

      /**
       * A PECA QUE NASCE, E UMA PECA COM AFIXO.
       *
       * ## POR QUE O AFIXO SAI AQUI E NO `collectNear`
       *
       * Era no `collectNear` — e o `collectNear` so roda quando o drop esta
       * NO CHAO. O abate comum entrega direto na mochila pelo `collectFrom`, e
       * esse caminho nunca passou pelo `collectNear`. O resultado era que
       * `rollEnchant` estava importado e configurado, e nenhuma peca de mob
       * chegava com afixo: ele era decidido num lugar que o drop comum
       * nao visitava
       *
       * E o lugar certo e aqui pelo mesmo motivo do `comercializavel`: o
       * `LootSystem` sorteia, o `Inventory` guarda. Sortear no meio da entrega
       * faria a mesma peca nascer diferente conforme o caminho
       *
       * ## E A TABELA E A DO DROP, NAO A DO MENU
       *
       * `rollEnchantDeDrop` e nao `rollEnchant` porque o afixo de drop e de
       * graca: se usasse a tabela do menu, o lendario de 0.6 viraria 0.3 de
       * graça e o diamante do menu nao compraria nada melhor
       */
      picked.push({
        itemId: item.id,
        count: this.rollCount(item),

        /**
         * O `undefined` QUANDO NAO E EQUIPAMENTO.
         *
         * E o que mantem o `Inventory`_guardando o campo so onde ele vale. Um
         * material com `comercializavel` nao faria sentido nenhum: material e
         * sempre livre para o mercado, e o campo so existe para separar o
         * item pessoal
         */
        comercializavel: isEquipavel(catalogo)
          ? sortearComercializavel("dropEquipamento")
          : null,

        /**
         * APRIMORADO SEMPRE ZERO. O DROP DE MOB NUNCA APRIMORA.
         *
         * ## O QUE ESTAVA AQUI, E POR QUE ESTAVA ERRADO
         *
         * Era `enhance: isEquipavel(catalogo) ? sortearAfixoDrop() : 0`. O
         * `sortearAfixoDrop` tem um nome que promete afixo e devolve um
         * NIVEL de 1 a 3 — e esse nivel era escrito em `enhance`, que e
         * APRIMORAMENTO, nao afixo
         *
         * ## POR QUE ISSO COMBATE O QUE O JOGADOR PEDIU
         *
         * Porque `enhance` e um multiplicador de verdade, e o motor le:
         * `Equipment.bonuses` faz `1 + entry.enhance * 0.12`. Um drop com
         * `enhance: 3` nascia com **+36% de stat de graça**, que e mais forte
         * que qualquer aprimoramento pago na aba
         *
         * ## E POR QUE O NOME ENGANAVA
         *
         * A regra nasceu para ser "a chance de o drop vir com afixo", e o
         * `enhance > 0` era o flag de "veio com afixo". Quando o AFIXO de
         * verdade passou a existir (`rollEnchantDeDrop`), esse portador ficou
         * sem servico — e o que ele escrevesse no `enhance` deixaria de ser
         * afixo e viraria aprimoramento indevido
         *
         * ## POR QUE O CAMPO CONTINUA AQUI, E VALENDO ZERO
         *
         * Porque o `Inventory.add` le `enhance` do `opcoes`, e a ausencia ja
         * daria zero. A linha fica como declaracao explicita do que o drop
         * NAO traz, porque o proximo que mexer aqui vai ler `sortearAfixoDrop`
         * e achar que ele ainda serve para alguma coisa
         *
         * ## E POR QUE O AFIXO ABAIXO NAO USA `sortearAfixoDrop`
         *
         * Porque afixo e `{stat, rarity, power}` e vem do catalogo de
         * encantamento. O `sortearAfixoDrop` devolve um inteiro de 1 a 3, que
         * nao serve para nada do lado do afixo
         */
        enhance: 0,

        /**
         * O AFIXO, E TODO DROP DE PEÇA TEM UM.
         *
         * E o unico "valor special" que um drop de mob traz. A taxa e a
         * tabela de drop — lendario a 0.3, metade da do menu — e estao em
         * `PESO_AFIXO_DROP`, no modulo de encantamento
         *
         * O `?? null` nao e necessario aqui: `rollEnchantDeDrop` ja devolve
         * `null` para material, e `null` e o que o `Inventory` quer ler
         */
        enchant: isEquipavel(catalogo) ? rollEnchantDeDrop(item.id) : null,
      });
    }

    return picked;
  }

  rollQuantity(table) {
    const max = table.maxItems ?? 1;

    if (max <= 1) return 1;

    return 1 + Math.floor(Math.random() * max);
  }

  /** materiais empilhavel chegam em pilhas, nunca em unidade solitaria */
  rollCount(item) {
    const max = BALANCE.stackableDropMax ?? 1;

    if (!isStackable(item) || max <= 1) return 1;

    return 1 + Math.floor(Math.random() * max);
  }

  /**
   * peso autoral corrigido pelos biais de balance: comum pesa muito mais
   * que lendario e item de missao ganha um empurrao extra.
   */
  effectiveWeight(entry) {
    const item = getItem(entry.id);

    if (!item) return entry.weight ?? 1;

    const rarityWeight =
      BALANCE.rarityDropWeight?.[item.rarity] ?? 1;

    const questWeight = item.quest
      ? (BALANCE.questItemBonus ?? 1)
      : 1;

    return (entry.weight ?? 1) * rarityWeight * questWeight;
  }

  pickWeighted(pool) {
    let total = 0;

    for (const entry of pool) {
      total += this.effectiveWeight(entry);
    }

    if (total <= 0) return null;

    let roll = Math.random() * total;

    for (const entry of pool) {
      roll -= this.effectiveWeight(entry);

      if (roll <= 0) {
        return getItem(entry.id);
      }
    }

    return getItem(pool[pool.length - 1]?.id);
  }

  /**
   * O inventario que recebe o loot.
   *
   * `owner` e a SESSAO de quem matou, e nao a entidade do jogador: o
   * `inventory` mora na sessao. Passar a entidade do jogador aqui
   * fazia o `owner?.inventory` dar `undefined` e cair no do mundo,
   * que no servidor e o do jogador em foco no fim do tick. O
   * fallback existe para o single player e para os testes, que
   * chamam sem dono.
   */
  inventoryOf(owner) {
    return owner?.inventory ?? this.world.inventory;
  }

  /**
   * O DONO DO LOOT, e o `equipment` DELE.
   *
   * ## POR QUE ISTO EXISTE, E A QUE DUAS METADES DA MOCHILA DISCORDAM
   *
   * A tela mostrava `15/20` e o drop dizia "mochila cheia". Nenhum dos dois
   * numeros estava errado: cada um media com uma informacao diferente.
   *
   * - a HUD recebe o `equipment` por PARAMETRO no `summary(...)`
   * - o `cabe()`, que decide se o drop entra, lia uma REFERENCIA guardada na
   *   sessao — e ela so existe se alguem chamou o `usarEquipment`
   *
   * Quem restaura o save monta a sessao e preenche as pilhas, mas o
   * `equipment` do corpo so existe depois disso. Se a referencia nao estiver
   * ligada, o `cabe` ve `20/20` — pilhas cruas, com o vestido contado — e
   * recusa o drop com 5 espacos livres na tela
   *
   * ## POR QUE O LOOT NAO CONFIA NA REFERENCIA
   *
   * Porque o loot tem o dono na ma: `owner.equipment` e a MESMA coisa que a
   * sessao guardou, e vem do pedido, nao de um estado que pode ter ficado para
   * tras. A referencia continua util para quem nao tem dono nenhum — o bau, o
   * mercado — mas o caminho do abate nao depende dela
   *
   * ## E POR QUE UM METODO, E NAO `owner?.equipment` NO `add`
   *
   * Porque `cabe` esta dentro do `Inventory`, e ele nao conhece o dono. E
   * porque o mesmo dono passa por `collectFrom` E `grantItems`, e os dois
   * precisam do mesmo numero — a conta written duas vezes divergiria de novo
   */
  equipmentDoDono(owner) {
    return owner?.equipment ?? null;
  }

  /**
   * Sorteia o loot e entrega no inventario de quem matou.
   *
   * `owner` e a SESSAO de quem deu o ultimo golpe (ver
   * `inventoryOf`). No single player ela e sempre a do jogador local
   * e nada muda. Online, o drop transbordado leva o id do dono para
   * que ninguem mais encaixe a mao.
   */
  collectFrom(creature, owner = null) {
    const inventory = this.inventoryOf(owner);

    // o filtro e o do DONO. `owner` e a sessao de quem matou, e e
    // ela que tem o `lootFilter`; sem este argumento o sorteio usaria
    // o filtro padrao do sistema e o filtro de um jogador mudaria o
    // loot de todo mundo
    const { coins, items } = this.roll(
      creature,
      owner?.lootFilter ?? this.filter,
    );

    const collected = {
      coins: 0,
      items: [],
      descartados: 0,
      ownerId: owner?.id ?? null,
    };

    if (coins > 0) {
      inventory.addCoins(coins);
      collected.coins = coins;
    }

    for (const entry of items) {
      /**
       * O DROP ENTRA COM TUDO QUE O SORTEIO DECIDIU.
       *
       * ## O QUE ESTAVA FALTANDO
       *
       * A chamada era `add(entry.itemId, entry.count)` — dois argumentos. O
       * `comercializavel`, o `enhance` e o `enchant` que o `rollItems` sorteia
       * VINHAM DESCARTADOS. O drop do mob chegava na mochila sem nenhuma das
       * tres informacoes que ele carregava — e sem AFIXO nenhum, que e o
       * sintoma que o jogador viu
       *
       * ## POR QUE REPASSA OS TRES E NAO SO O AFIXO
       *
       * Porque os tres perderam o mesmo transporte. Consertar so o `enchant`
       * deixaria a peca com afixo e ainda comercializavel=false e enhance=0,
       * e o mercado continuaria pagando peca lisa como se fosse Unique
       */
      /**
       * ## A MOCHILA CHEIA DESCARTA O ITEM — E NAO O JOGA NO CHAO
       *
       * Era `if (result.dropped > 0) spawnGroundDrop(...)`: o que nao cabia
       * virava drop no chao, e o jogador via o item la, com o nome, flutuando
       * a uns dez passos do bicho morto — invariavelmente sem ter espaco
       * para pegá-lo. Um drop no chao que o jogador nao pode recolher nao e
       * recompensa, e o unico efeito dele era entulhar a tela
       *
       * E o `cabe()` ANTES do `add`, e nao o `dropped` DEPOIS: o `dropped`
       * e o que sobrou de uma entrega que ja happened, e a essa altura o item
       * ja foi criado. A pergunta correta e "cabe?" — feita antes, e o item
       * simplesmente nao existe
       */
      if (!inventory.cabe(
        entry.itemId,
        entry.count,
        null,
        this.equipmentDoDono(owner),
      )) {
        collected.descartados += entry.count;
        continue;
      }

      const result = inventory.add(
        entry.itemId,
        entry.count,
        null,
        opcoesDoDrop(entry),
      );

      if (result.added > 0) {
        collected.items.push({
          itemId: entry.itemId,
          count: result.added,
        });
      }

      /**
       * O `add` AINDA PODE DEVOLVER `dropped`, e ele nao vira mais drop.
       *
       * O `cabe` acima e o filtro do ITEM INTEIRO, e ele nao cobre o caso de
       * uma pilha existente estar no limite: o `add` funde ate `maxStack`, e
       * o resto nao tem onde ir. Esse resto e a MESMA situacao que o `cabe`
       * recusou — falta espaco — entao conta como descartado
       */
      if (result.dropped > 0) {
        collected.descartados += result.dropped;
      }
    }

    return collected;
  }

  /**
   * Entrega itens JA SORTREADOS na mochila de um jogador.
   *
   * Existe separado do `collectFrom` porque a divisao por party sorteia
   * UMA vez e depois distribui: quem chama o `collectFrom` de novo
   * sorteia de novo, e ai um abate vira tres itens em tres gente
   *
   * O transbordo de inventario vai para o chao com o `ownerId` de quem
   * recebeu, nunca sem dono
   */
  grantItems(creature, owner = null, items = []) {
    const inventory = this.inventoryOf(owner);
    const given = { items: [], descartados: 0 };

    for (const entry of items) {
      /**
       * O MESMO `add` DO `collectFrom`, E PELA MESMA RAZAO.
       *
       * A divisao por party entrega a peca na mochila de outro jogador, e esse
       * caminho tinha a chamada de dois argumentos igual. A peca chegava no
       * segundo jogador do grupo sem afixo, o que fazia a mesma peca valer
       * mais para quem matou do que para quem dividiu
       *
       * ## E A MOCHILA CHEIA DESCARTA, IGUAL AO `collectFrom`
       *
       * Pelo mesmo motivo: o drop no chao do dono da divisao seria um item
       * que o jogador do grupo nao consegue pegar — o `ownerId` e dele, e a
       * regra de `collectNear` so deixa o proprio dono recolher
       */
      if (!inventory.cabe(
        entry.itemId,
        entry.count,
        null,
        this.equipmentDoDono(owner),
      )) {
        given.descartados += entry.count;
        continue;
      }

      const result = inventory.add(
        entry.itemId,
        entry.count,
        null,
        opcoesDoDrop(entry),
      );

      if (result.added > 0) {
        given.items.push({
          itemId: entry.itemId,
          count: result.added,
        });
      }

      if (result.dropped > 0) {
        given.descartados += result.dropped;
      }
    }

    return given;
  }

  dropFrom(creature, owner = null) {
    const { coins, items } = this.roll(
      creature,
      owner?.lootFilter ?? this.filter,
    );
    const ownerId = owner?.id ?? null;

    for (const entry of items) {
      const position = this.scatter(
        creature.x,
        creature.y,
        entry.count,
      );

      this.spawnGroundDrop({
        kind: "item",
        itemId: entry.itemId,
        count: entry.count,
        x: position.x,
        y: position.y,
        ownerId,
        ...propriedadesDoDrop(entry),
      });
    }

    if (coins > 0) {
      const position = this.scatter(
        creature.x,
        creature.y,
        coins,
        34,
      );

      this.spawnGroundDrop({
        kind: "coins",
        coins,
        x: position.x,
        y: position.y,
        ownerId,
      });
    }

    return { coins, items };
  }

  update(deltaTime) {
    const drops = this.world.drops;

    for (
      let index = drops.length - 1;
      index >= 0;
      index -= 1
    ) {
      drops[index].age += deltaTime;
    }
  }

  /**
   * Recolhe o que esta no chao perto do jogador.
   *
   * `player` e a ENTIDADE (precisa de `x`, `y` e `id` para a
   * distancia e para a checagem de dono), mas o `inventory` mora na
   * SESSAO. Por isso o inventario pode ser passado explicitamente:
   * sem isso ele sairia do `inventoryOf`, que cai no do jogador em
   * foco. Passando, a recolha nao depende de quem o motor tem em foco
   * no momento, que e a mesma armadilha que fazia o loot do abate
   * ir para a pessoa errada.
   */
  collectNear(
    player,
    radius = PICKUP_RADIUS,
    inventory = null,
  ) {
    const drops = this.world.drops;
    const destino = inventory ?? this.inventoryOf(player);
    const collected = { coins: 0, items: [], rejected: 0 };

    for (
      let index = drops.length - 1;
      index >= 0;
      index -= 1
    ) {
      const drop = drops[index];

      // Loot de mob tem dono. Sem esta checagem, um jogador que
      // passasse em cima do chao de um abate alheio pegaria o
      // item, e o "last hit" nao valeria nada. `ownerId` nulo e
      // loot sem dono (o do proprio jogador no single player, ou
      // o drop antigo de antes desta regra): sempre recolhivel.
      if (
        drop.ownerId !== undefined &&
        drop.ownerId !== null &&
        drop.ownerId !== player.id
      ) {
        continue;
      }

      const dx = drop.x - player.x;
      const dy = drop.y - player.y;

      if (dx * dx + dy * dy > radius * radius) {
        continue;
      }

      if (drop.kind === "coins") {
        destino.addCoins(drop.coins);

        collected.coins += drop.coins;
        drops.splice(index, 1);
        continue;
      }

if (drop.kind === "item") {
          /**
           * O AFIXO VIEM DO SORTEIO, E NAO DAqui.
           *
           * ## O QUE MUDOU
           *
           * Era `if (!drop.afixo && drop.enhance > 0) drop.afixo = rollEnchant(...)`
           * seguido de `opcoes.enchant = drop.afixo ?? null`. Duas coisas
           * quebradas nessa linha:
           *
           * 1. `rollEnchant` era a tabela do MENU, e nao a do drop
           * 2. o sorteio dependia de `drop.enhance > 0`, e o `enhance`
           *    NUNCA chegava no chao — `dropFrom` e os dois
           *    `spawnGroundDrop` de transbordo montavam o objeto sem ele.
           *    A condicao era permanentemente falsa
           *
           * ## E POR QUE O AFIXO NAO PODE SER RESORTADO AQUI
           *
           * Porque o `drop` fica no chao, com dono, ate alguem pegar. Se o
           * afixo fosse sorteado no recolhimento, a peca teria um afixo
           * enquanto o primeiro jogador passava por cima e outro quando o
           * segundo pegasse — o mesmo item valendo duas coisas no mesmo lugar
           */
          /**
           * ## A MOCHILA CHEIA DEIXA O DROP NO CHAO, E CONTA COMO RECUSA
           *
           * Aqui o drop JA esta no chao, feito pelo `dropFrom` — que e o
           * unico caminho de drop no chao por proposito. Nao ha "nao criar o
           * item" neste ponto: ele ja existe
           *
           * O `cabe` antes do `add` evita o meio-termo que o `add` produz: ele
           * entrega parte e devolve o resto, e o resto voltava para o chao
           * como um drop menor. Com o `cabe` antes, o drop fica INTEIRO no
           * chao ou e recolhido INTEIRO, e a proxima vez que o jogador passar
           * ele ve a mesma peca com o mesmo nome
           */
          if (
            !destino.cabe(
              drop.itemId,
              drop.count,
              drop.rarity ?? null,
              this.equipmentDoDono(player),
            )
          ) {
            collected.rejected += drop.count ?? 1;
            continue;
          }

          const result = destino.add(
            drop.itemId,
            drop.count,
            drop.rarity ?? null,
            opcoesDoDrop(drop),
          );

          /**
           * A RARIDADE DO DROP VOLTA COM ELE.
           *
           * Sem isso o drop do mob perderia a variante: o `add` receberia
           * `null` e cairia no `baseRarityOf` do catalogo, e um drop de raridade
           * comum viraria a rara natural do item no chao
           */
          if (result.added > 0) {
            collected.items.push({
              itemId: drop.itemId,
              count: result.added,
            });
          }

        /**
           * ## O DROP SAI DO CHAO INTEIRO, SEM DEVOLVER PARTE
           *
           * O `else` que diminuia `drop.count` para o que sobrou foi removido.
           * Com o `cabe` antes do `add`, o `dropped` e zero sempre: o `add`
           * so entrega o que coube porque ja garantimos que coube
           *
           * Deixar o `drop.count = result.dropped` ali seria codigo morto que
           * parece funcionar — e na pior hipotese, se o `cabe` e o `add`
           * divergirem um dia, ele cortaria o drop pela metade sem ninguem
           * avisar
           */
          drops.splice(index, 1);
        }
    }

    return collected;
  }
}

export const LOOT_CONSTANTS = {
  MAX_GROUND_DROPS,
  PICKUP_RADIUS,
  RARITY,
  rarityDropWeight: BALANCE.rarityDropWeight,
  questItemBonus: BALANCE.questItemBonus,
  stackableDropMax: BALANCE.stackableDropMax,
};

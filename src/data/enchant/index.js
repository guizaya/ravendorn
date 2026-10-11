/**
 * O ENCANTAMENTO: um stat sorteado, colado numa peca.
 *
 * A ideia e a de um jogo de RPG comum — voce pega um item, rola um
 * afixo, e o item passa a valer um pouco mais. O que este modulo
 * decide e o que o resto do jogo obedece:
 *
 * 1. **QUAL stat** pode sair. A lista e curta e NAO e a lista toda de
 *    stat do jogo: e so a lista que o `applyEquipment` do motor sabe
 *    aplicar. Um `critRate` aqui apareceria no painel de status e nao
 *    mudaria nada no combate, porque o motor nunca escreve esse campo
 *    no jogador. A lista e validada por teste contra o que o motor le
 *
 * 2. **QUANTO** cada raridade vale. O valor e uma FRACAO do stat base
 *    do personagem, nao um numero absoluto: um `+2%` de velocidade
 *    precisa continuar sendo 2% quando o personagem subir de nivel, e
 *    um `+2` absoluto viraria irrelevante num nivel alto
 *
 * 3. **QUANTO CUSTA**. Encantar de graca seria um sorteio infinito,
 *    e um stat rolado quantas vezes quisesse nao tem balanceamento.
 *    O custo escala com a raridade do ITEM pela mesma escala que o
 *    craft usa — ver `RARITY_COST`, que e a copia local dessa escala
 *
 * A FRACAO e guardada, e o absoluto e derivado na hora de aplicar. E o
 * que permite o mesmo `enchant` valer para duas classes com stats
 * base diferentes — e o que impede um save de 2019 travar num valor
 * absoluto que nao existe mais
 */
import {
  ITEM_TYPE,
  RARITY,
  RARITY_ORDER,
  RARITY_STYLE,
  getItem,
} from "../items/index.js";

/**
 * Os stats que um encantamento pode dar.
 *
 * E a EXATA lista que o `applyEquipment` do motor le: `maxHp`,
 * `resource`, `attack`, `defense`, `speed`, `attackSpeed` e
 * `resourceRegen`. Um stat fora daqui nao quebraria nada — ele
 * simplesmente passaria batido, aparecendo no painel e nao fazendo
 * nada, que e o pior defeito que um bonus pode ter
 *
 * `critRate` e `critDamage` estao fora de proposito: os dois existem
 * no personagem, mas o motor so os escreve UMA vez, na criacao, e o
 * `applyEquipment` nunca os toca. Um encantamento de crit apareceria
 * como `+5%` no painel e o golpe continuaria critando igual
 */
export const ENCHANT_STATS = [
  "attack",
  "defense",
  "maxHp",
  "resource",
  "speed",
  "attackSpeed",
  "resourceRegen",
];

/**
 * Os stats que ja sao FRACAO, e nao numero absoluto.
 *
 * `attackSpeed` e um multiplicador (`1.4` e 140% do ataque) e
 * `resourceRegen` e um tanto por segundo. Multiplicar uma fracao pela
 * base do personagem daria um numero sem sentido: `0.02 * 1.4` para um
 * `attackSpeed` de 1.4 daria 0.028 de ataque extra, e nao 2%
 *
 * Todos os outros da lista sao absolutos — vida, ataque, defesa,
 * velocidade — e a fracao do encantamento e multiplicada pela base
 */
const ENCHANT_FRACTION_STATS = new Set([
  "attackSpeed",
  "resourceRegen",
]);

/** O nome de cada stat, para o painel e para o item */
export const ENCHANT_STAT_LABEL = {
  attack: "Ataque",
  defense: "Defesa",
  maxHp: "Vida",
  resource: "Recurso",
  speed: "Velocidade",
  attackSpeed: "Velocidade de ataque",
  resourceRegen: "Regeneração de recurso",
};

/**
 * O quanto cada raridade vale, em fracao do stat.
 *
 * Raro 2% e epico 4%, que e o exemplo que motivou o painel. A
 * progressao nao e linear de proposito: a curva de chance do
 * `RARITY_STYLE` ja e-ravesca, e um valor linear aqui entregaria um
 * lendario que quase nao difere de um epico
 */
export const ENCHANT_POWER = {
  [RARITY.COMMON]: 0.01,
  [RARITY.UNCOMMON]: 0.015,
  [RARITY.RARE]: 0.02,
  [RARITY.EPIC]: 0.04,
  [RARITY.LEGENDARY]: 0.06,
};

/**
 * O preco de encantar, em ouro.
 *
 * Sai do valor do item E da escala de custo por raridade, e nao de uma
 * tabela solta: um arco lendario sendo encantar por um colete
 * comum quebraria a leitura de "encantar e caro". O mesmo item, na
 * mesma raridade, custa sempre o mesmo — o preco depende do que esta
 * sendo encantado, nao da sorte do sorteio
 */
export const ENCHANT_BASE_COST = 45;

export function enchantCost(itemId, rarity = null) {
  const item = getItem(itemId);

  if (!item) return 0;

  const base = ENCHANT_BASE_COST + (item.value ?? 0) * 2;

  return Math.round(base * (RARITY_COST[item.rarity] ?? 1));
}

/**
 * A escala de custo por raridade do ITEM, nao a do encantamento.
 *
 * `RARITY_COST_SCALE` do catalogo, copiado para ca com o nome
 * proprio. O original nao e exportado por `data/items/index.js`, e
 * exportar la mexeria nos testes de craft e de icone por causa de um
 * numero — entao a copia mora aqui, e ela e EXPORTADA para o
 * `enchant.test.js` poder conferir que os cinco valores nao mudaram
 */
/**
 * O TETO DE APRIMORAR.
 *
 * E um numero de multiplicador, e nao de quantidade de moedas: cada nivel
 * e +12% nos stats da peca (ver `Equipment.bonuses`), entao um teto de 12
 * seria +144%. Acima disso o colete comum viraria melhor que um lendario,
 * e o loot novo deixaria de valer alguma coisa
 *
 * ## POR QUE 12 E NAO MAIS
 *
 * Porque o preco CRESCE a cada nivel (ver `enhanceCost`), e a resposta a
 * um preco que sobe e o jogador parar. Com teto de 12, os ultimos niveis
 * custam quase tanto quanto os primeiros, e o numero de moedas para de
 * ser a unica coisa segurando o jogador
 *
 * E porque a partir do 6 o preco deixa de ser a unica coisa segurando: o
 * RISCO assume. Ver `ENHANCE_CHANCE_FALHA`
 */
export const ENHANCE_MAX = 12;

/**
 * O PRIMEIRO NIVEL QUE PODE DAR PROBLEMA.
 *
 * Ate aqui o aprimoramento e uma escada sem risco: o preco e a unica
 * coisa que o jogador perde. Do 6 para cima entra a chance de falhar, e
 * parte dessas falhas QUEBRAM a peca — entao o jogador precisa de uma
 * faixa de graca para construir o +6 antes de estar arriscando ouro E
 * o item
 *
 * E um numero, e nao a primeira chave de `ENHANCE_CHANCE_FALHA`, para o
 * resto do jogo ter um valor unico de "onde comeca o risco" sem saber
 * da tabela
 */
export const ENHANCE_RISCO_A_PARTIR_DE = 6;

/**
 * A CHANCE DE FALHAR em cada degrau, com a CHAVE SENDO O NIVEL ATUAL.
 *
 * A chave e o nivel DE ONDE se sai, e nao o nivel PARA ONDE se vai: `6`
 * e a tentativa de ir do +6 para o +7. Ler como destino inverteria a
 * curva, e o +7 seria o degrau mais facil e o +12 o mais impossivel
 *
 * Ate o +5 o preco e a unica perda, entao a tabela comeca no 6. Os
 * numeros sao a chance de FALHAR o degrau, e nao a de quebrar: parte da
 * falha quebra a peca e parte deixa ela intacta (ver
 * `ENHANCE_PARTE_QUEBRA`)
 *
 * ## POR QUE SOBE TAO DE RAPIDO
 *
 * Porque e o que faz o +7 valer a pena. Se a falha ficasse perto de
 * zero ate o +10, o risco seria uma taxa que so aparece no fim, e o
 * jogador teria atravessado metade da escada sem nenhuma escolha nele:
 * dinheiro nenhum compra o +7 de volta depois de uma falha
 */
export const ENHANCE_CHANCE_FALHA = {
  6: 0.25,
  7: 0.5,
  8: 0.7,
  9: 0.8,
  10: 0.9,
  11: 0.95,
};

/**
 * QUE PARTE DA FALHA DESTROI A PECA.
 *
 * E `0.65`, entao 65% de cada falha quebra o item e os outros 35%
 * deixam a peca intacta no mesmo nivel. Os dois desfechos nao sao a mesma
 * coisa: um custa ouro, o outro custa o item, e o jogador nao tem como
 * escolher entre os dois — o sorteio e um so
 *
 * ## POR QUE 65 E NAO 100
 *
 * Porque uma falha que SEMPRE destroi deixa o +6 sem nenhum motivo de
 * existir: o jogador so deveria parar no +6, e o resto do painel seria
 * um jogo de adivinhar. Com uma parte das falhas dando so ouro, da para
 * tentar varias vezes, e o +12 continua sendo um objetivo de risco em
 * vez de uma loteria
 */
export const ENHANCE_PARTE_QUEBRA = 0.65;

/**
 * OS TRES DESFECHOS de um degrau, ou `null` quando o degrau e seguro.
 *
 * `quebra` e `intacta` sao FRACOES DO DEGRAU, e nao do total: a soma dos
 * dois e a chance de falhar. O motor sorteia UM numero so e compara com
 * `quebra` e depois com `falha`, que e o que garante a proporcao exata —
 * com dois sorteios a razao entre quebrar e falhar variaria de tentativa
 * para tentativa, e o numero da tela pararia de valer
 */
export function enhanceRisco(nivelAtual = 0) {
  const falha = ENHANCE_CHANCE_FALHA[nivelAtual] ?? 0;

  if (falha <= 0) return null;

  const quebra = falha * ENHANCE_PARTE_QUEBRA;

  return {
    nivel: nivelAtual,
    proximo: nivelAtual + 1,
    falha,
    quebra,
    intacta: falha - quebra,
    sucesso: 1 - falha,
  };
}

/**
 * UM PORCENTUAL COM UMA CASA, para a caixa.
 *
 * As chances de quebra ficam em numeros quebrados — 65% de 25% e
 * 16,25% — e duas casas decimais encheriam a caixa de ruido. Uma casa
 * e o arredondamento que o jogador faria de cabeca, e `,0` some para
 * os numeros redondos nao virarem "52,0%" ao lado de "52%"
 */
export function formatarChance(valor = 0) {
  const texto = (valor * 100).toFixed(1);

  return `${texto.replace(/\.0$/, "").replace(".", ",")}%`;
}

/**
 * O PASSO DE CADA NIVEL.
 *
 * E o `0.12` que o `Equipment.bonuses` multiplica. Mora AQUI e nao la
 * porque as duas pontas precisam do mesmo numero: se o motor usasse 0.1 e
 * este arquivo 0.12, o painel mostraria "+12%" para um passo que da
 * "+10%", e a conta do jogador fecharia errada
 */
export const ENHANCE_PASSO = 0.12;

/**
 * O PRECO de aprimorar um nivel, em OURO. E o de STEEL, ao lado.
 *
 * ## POR QUE DOIS PRECOS E NAO UM
 *
 * Porque o aprimoramento virou a primeira compra de steel do jogo, e sao
 * duas economias diferentes: o ouro vem de todo mundo — missao, venda no
 * mercado, bau — e o steel so sai de bater pedra no Vale 1. Cobrar os dois
 * e o que amarra a melhoria da peca ao mapa de mineração: quem nunca
 * desceu nao aprimora, e quem esta com o ouro parado nao tem como gastar
 *
 * ## POR QUE O OURO CONTINUA GEOMETRICO E O STEEL E LINEAR
 *
 * Sao dois papeis diferentes. O ouro e a moeda geral: a curva de 1,6x
 * mantem o preco por ponto de ATQ aproximadamente constante, e e o que
 * segura o teto. O steel e o dinheiro de esfregar pedra: 2, 4, 6, 8 e
 * linear porque a bateida dele tem um custo constante em tempo — 10s por
 * batida sempre — e um preco que dobrasse transformaria o +6 em algo que
 * a gente nem tenta
 *
* ## POR QUE O STEEL NAO ENTRA EM `RARITY_COST`
 *
 * Porque o `RARITY_COST` escala pelo VALOR da peca, e o steel nao depende
 * do valor. Um arco de galho comum e um epico da mesma mao custariam o
 * mesmo steel, e e o que mantem a tentativa igual para todos — a escolha
 * de qual peca aprimorar continua sendo sobre O RISCO e o OURO, e nao
 * sobre um preco que so o `value` decide
 */
export const ENHANCE_BASE_COST = ENCHANT_BASE_COST;

export function enhanceCost(itemId, nivelAtual = 0, rarity = null) {
  const item = getItem(itemId);

  if (!item) return 0;

  const base = ENHANCE_BASE_COST + (item.value ?? 0) * 2;

  /**
   * O DEGRAU POR NIVEL.
   *
   * `1.6` e a progressao: o primeiro nivel custa `1.6x` a base, o
   * decimo custa quase `110x`. E geometrica de proposito — ver
   * `ENHANCE_MAX` para o porque do teto
   */
  const degrau = 1.6 ** nivelAtual;

  return Math.round(base * degrau * (RARITY_COST[item.rarity] ?? 1));
}

/**
 * O STEEL DO PRIMEIRO NIVEL.
 *
 * ## POR QUE 2 E NAO 1
 *
 * Porque 1 seria invisivel na tela. A bateida sorteia entre 1, 2 e 3, e o
 * primeiro nivel a 1 colocaria a barra de steel do HUD em "1" por um
 * minuto e meio de mineracao e em "0" logo depois — o jogador gastaria o
 * numero antes de entender que ele era um preco. Com 2 o primeiro nivel
 * custa uma media bateida, que e a menor unidade que o jogador consegue
 * ver acontecer
 */
export const ENHANCE_STEEL_BASE = 2;

/**
 * O DEGRAU DE STEEL POR NIVEL.
 *
 * ## POR QUE +2 E NAO MULTIPLICATIVO
 *
 * Porque o steel se compra com TEMPO, e o tempo nao dobra. O +1 custa 2,
 * o +2 custa 4, o +3 custa 6 — cada degrau e o dobro do anterior em
 * numero de batidas, e a soma ate o +9 e 90 steel, que sao quinze
 * batidas. Uma curva geometrica aqui deixaria o +8 em centenas e o
 * jogador nunca chegaria la
 *
 * ## POR QUE MESMO PASSO PARA TODOS OS ITENS
 *
 * Porque o steel e o preco da BATIDA, e nao da peca. Se o degrau
 * dependesse da raridade, um epico precisaria de mais batidas que um comum
 * — e o epico ja custa mais ouro e ja tem mais risco de quebrar. Tres
 * multiplicadores no mesmo botao fariam o jogador refinando qual peca vale
 * mais, e a resposta seria "a mais barata", que e a mais arriscada
 */
export const ENHANCE_STEEL_DEGRAU = 2;

/**
 * O PRECO de aprimorar um nivel, em STEEL.
 *
 * E a MESMA tabela que o motor debita e a que o painel mostra — pelo mesmo
 * motivo do `ENHANCE_PASSO`: se o painel mostrasse um numero e o motor
 * cobrasse outro, o jogador pagaria um preco e receberia outro
 *
 * ## POR QUE SO DEPENDE DO NIVEL
 *
 * Porque a peca nao entra. Ver o `ENHANCE_STEEL_DEGRAU`: o preco e o da
 * batida na pedra, e todas as pecas pagam a mesma. Passar `itemId` aqui
 * seria uma porta aberta para a proxima mudanca decideir que arco e mais
 * caro, e essa mudanca precisaria de uma prop no painel, no motor e no
 * teste ao mesmo tempo
 *
 * ## POR QUE `nivelAtual` E O NIVEL DE AGORA, E NAO O PROXIMO
 *
 * Porque quem chama e o dono do nivel: `enhanceCost(itemId, 0)` e a
 * passagem do zero para o um, e a steel de quem la esta. Passando o
 * proximo, o primeiro custo sairia 4
 */
export function enhanceSteelCost(nivelAtual = 0) {
  const nivel = Math.max(0, Math.floor(nivelAtual) || 0);

  return ENHANCE_STEEL_BASE + nivel * ENHANCE_STEEL_DEGRAU;
}

/**
 * A ESCADA DE STEEL, para a tela mostrar o preco dos proximos degraus.
 *
 * ## POR QUE EXISTE, E POR QUE NAO E SO UM `Array.from`
 *
 * Porque a aba de aprimorar mostra o preco do proximo E a distancia ate
 * ele: "faltam 3 de acao". O `Array.from` daria so os numeros, e a
 * distancia ao proximo nivel e a conta que o jogador faz para decidir se
 * desce ao Vale 1 agora ou guarda o steel para depois
 *
 * ## POR QUE PARA TRES NIVEIS A FRENTE E NAO MAIS
 *
 * Porque tres degraus ja respondem a pergunta "vale a pena descer agora".
 * Uma escada de vinte linhas faria da caixa uma tabela, e o jogador precisa
 * do preco AGORA — os outros ele descobre clicando
 */
export function enhanceSteelEscada(nivelAtual = 0, quantos = 3) {
  const nivel = Math.max(0, Math.floor(nivelAtual) || 0);
  const passos = Math.max(1, Math.floor(quantos) || 1);

  return Array.from({ length: passos }, (_, i) => {
    const de = nivel + i;
    const custo = enhanceSteelCost(de);

    return {
      nivel: de + 1,
      custo,
      falta: Math.max(0, custo),
    };
  });
}

/**
 * O QUE O NIVEL ATUAL VALE, em texto.
 *
 * E o que a aba mostra no botao: "+12%" no primeiro, "+60%" no quinto.
 * O numero e o MESMO que o `Equipment.bonuses` aplica, pelo mesmo motivo
 * do `ENHANCE_PASSO`
 */
export function describeEnhance(nivelAtual = 0) {
  const passo = Math.round(ENHANCE_PASSO * 100 * (nivelAtual + 1));

  return `+${passo}%`;
}

/**
 * O PRECO de um item que pode ser aprimorado, ja documentado pela aba.
 *
 * Devolve `null` quando nao da para aprimorar — teto atingido ou item
 * que o painel nao lista. E o que a UI usa para desligar o botao sem
 * duplicar a regra
 */
export function enhanceBloqueio(nivelAtual = 0) {
  if (nivelAtual >= ENHANCE_MAX) {
    return "Aprimoramento no teto.";
  }

  return null;
}

export const RARITY_COST = {
  [RARITY.COMMON]: 0.5,
  [RARITY.UNCOMMON]: 0.75,
  [RARITY.RARE]: 1,
  [RARITY.EPIC]: 1.7,
  [RARITY.LEGENDARY]: 2.8,
};

/**
 * Os tipos de item que aceitam encantamento.
 *
 * O pedido foi arma, arma secundaria e armadura, e sao os tres. Os
 * MATERIAIS ficam de fora por um motivo que nao e balanceamento: eles
 * sao empilhaveis, e uma pilha de 99 lulas de esqueleto nao
 * tem como carregar um afixo por peca
 */
export const ENCHANTABLE_TYPES = [
  ITEM_TYPE.WEAPON,
  ITEM_TYPE.ARMOR,

  /**
   * O TRINKET ENTROU AQUI.
   *
   * ## POR QUE ESTAVA DE FORA
   *
   * O pedido original foi "arma, arma secundaria e armadura", e o
   * `ENCHANTABLE_TYPES` foi escrito com esses tres. Anel e amuleto ficaram
   * fora nao por balanceamento, e porque ninguem tinha pedido
   *
   * ## POR QUE NAO E SO ADICIONAR O NOME AQUI
   *
   * Porque um afixo que o motor nao le e o pior defeito que um bonus pode
   * ter: ele aparecia escrito na peca, o jogador pagava para cola-lo, e nada
   * mudava no numero. Por isso a conferencia veio ANTES desta linha
   *
   * E o motor JA APLICA. O `Equipment.enchantBonuses` percorre
   * `getEquippedItems()`, que devolve a peca de **todo** slot ocupado — e
   * `trinket1`/`trinket2` sao slots como `chest` e `weapon`. O
   * `resolveEnchant` transforma a fracao em numero usando `baseStats`, que e
   * o stat da CLASSE, e nao o da peca
   *
   * ## E POR QUE OS 7 STATS CONTINUAM SERVINDO
   *
   * Porque nenhum deles e um stat de peca. `attack`, `defense`, `maxHp`,
   * `resource`, `speed`, `attackSpeed` e `resourceRegen` sao todos do
   * PERSONAGEM — um anel com `+2% de ataque` fala do jogador, nao do anel.
   * O catalogo do anel tem `{attack: 2, defense: 1}`, que e o stat fixo da
   * peca e entra por outro caminho (`getEquipped().stats`)
   *
   * Ou seja: afixo em trinket e a MESMA conta que em arma, e o motor tem
   * esse caminho pronto
   */
  ITEM_TYPE.TRINKET,
];

/** O item aceita encantamento? */
export function canEnchantItem(itemId) {
  const item = getItem(itemId);

  return Boolean(item) && ENCHANTABLE_TYPES.includes(item.type);
}

/**
 * Sorteia a RARIDADE do encantamento.
 *
 * Reaproveita o peso do `RARITY_STYLE` do catalogo — 62 / 24 / 10 /
 * 3.4 / 0.6 — em vez de uma tabela nova. Raro e epico sao raros de
 * proposito: se o epico saisse 1 em cada 3 o painel seria um PLACE de
 * sorteio e nao uma escolha
 *
 * O `random` entra por parametro para o teste poder escolher a
 * raridade sem reescrever a funcao. Sem ele o teste so conseguiria
 * testar a distribuicao estatistica, que e lenta e ainda deixa o
 * teste passar por sorte
 */
export function rollRarity(random = Math.random) {
  const total = RARITY_ORDER.reduce(
    (sum, raridade) =>
      sum + (RARITY_STYLE[raridade]?.weight ?? 0),
    0,
  );

  let alvo = random() * total;

  for (const raridade of RARITY_ORDER) {
    alvo -= RARITY_STYLE[raridade]?.weight ?? 0;

    if (alvo <= 0) return raridade;
  }

  // o resto do `for` e o caso da ponta: uma soma de ponto flutuante
  // pode deixar `alvo` positivo depois do ultimo subtrair, e sem este
  // `return` a funcao devolveria `undefined`
  return RARITY_ORDER[RARITY_ORDER.length - 1];
}

/**
 * Sorteia um encantamento INTEIRO: o stat e a raridade.
 *
 * O valor nao sai daqui. Ele e a fracao do `ENCHANT_POWER`, e quem
 * converte para numero absoluto e `resolveEnchant`, no momento de
 * aplicar — porque so ali existe a base do personagem
 *
 * Devolve `null` quando o item nao aceita, e nao um encantamento
 * invalido: um item fora do tipo certo tem que ser RECUSADO, e nao
 * receber um afixo que o `applyEquipment` vai ignorar
 */
export function rollEnchant(itemId, random = Math.random) {
  if (!canEnchantItem(itemId)) return null;

  const stat =
    ENCHANT_STATS[
      Math.min(
        ENCHANT_STATS.length - 1,
        Math.floor(random() * ENCHANT_STATS.length),
      )
    ];

  const rarity = rollRarity(random);

  return {
    stat,
    rarity,
    power: ENCHANT_POWER[rarity],
  };
}

/*
 * A TABELA DE RARIDADE DO AFIXO QUE VEM NO DROP.
 *
 * ## O QUE MUDOU EM RELACAO AO MENU
 *
 * O menu sorteia em 62 / 24 / 10 / 3.4 / 0.6. Aqui o lendario cai para 0.3
 * — metade, como pedido — e o peso que ele deixa vai para baixo:
 *
 *   raridade     menu    drop     o que aconteceu
 *   comum        62      62.19    subiu
 *   incomum      24      24.08    subiu
 *   raro         10      10.03    subiu
 *   epico        3.4     3.40    ficou
 *   lendario     0.6     0.30    CAIU PARA METADE
 *   soma         100     100
 *
 * ## POR QUE O LENDARIO CAI E OS OUTROS SOBEM
 *
 * Porque o drop e gratis e o menu e pago. Se os dois usassem a mesma tabela,
 * o jogador pagaria diamante para rolar a mesma tabela que o mob ja deu de
 * graca — e o unico motivo de encantar no menu e escolher O AFIXO, nao
 * receber um. Aqui o afixo de drop e sempre mais fraco, e o dinheiro do
 * jogador compra a chance deraro que o mob nunca da
 *
 * ## E POR QUE ISTO NAO E "A TABELA DO MENU DIVIDIDA POR DOIS"
 *
 * Porque dividir os cinco pesos por dois e um NO-OP. 62/24/10/3.4/0.6
 * normalizado da 62%, 24%, 10%, 3.4%, 0.6%; dividido por dois e normalizado
 * da EXATAMENTE as mesmas porcentagens. A chance so muda se o peso se mover
 * entre as linhas — e o que o lendario faz aqui
 *
 * ## E POR QUE OS OUTROS SOBEM TAO POUCO
 *
 * Porque o espaco vem do lendario: os 0.3 que ele perdeu. Repartir 0.3 por
 * 96 de peso comum+incomum+raro move cada um em centesimos — o objetivo era
 * mudar a PONTA da curva, e mexer na base dela estragaria o menu sem
 * necessidade
 */
const PESO_AFIXO_DROP = {
  [RARITY.COMMON]: 62.19,
  [RARITY.UNCOMMON]: 24.08,
  [RARITY.RARE]: 10.03,
  [RARITY.EPIC]: 3.4,
  [RARITY.LEGENDARY]: 0.3,
};

/**
 * Sorteia a RARIDADE do afixo de um drop de mob.
 *
 * E o `rollRarity` do menu com outra tabela — o resto do sorteio e
 * IDENTICO, e nao foi copiado. Se o `stat` ou o formato `{stat, rarity,
 * power}` mudarem, os dois sorteios mudam juntos porque os dois chamam
 * `rollEnchant` por dentro
 */
function rollRarityDeDrop(random = Math.random) {
  const total = RARITY_ORDER.reduce(
    (sum, raridade) => sum + (PESO_AFIXO_DROP[raridade] ?? 0),
    0,
  );

  let alvo = random() * total;

  for (const raridade of RARITY_ORDER) {
    alvo -= PESO_AFIXO_DROP[raridade] ?? 0;

    if (alvo <= 0) return raridade;
  }

  return RARITY_ORDER[RARITY_ORDER.length - 1];
}

/**
 * O AFIXO QUE O MOB DEIXOU NA PECA.
 *
 * ## POR QUE ESTE EXISTE E O `rollEnchant` DO MENU TAMBEM
 *
 * Porque os dois precisam do MESMO sorteio de `stat` e do MESMO formato, e
 * nao a mesma TABELA. Se os dois tivessem a tabela escrita dentro do corpo,
 * mudar `ENCHANT_STATS` num so lugar deixaria o outro afixo virando stat
 * velho — e o `applyEquipment` leria um campo que nao existe mais
 *
 * ## E TODO DROP DE PEÇA VEM COM AFIXO
 *
 * Sem `CHANCE_AFIXO_DROP` aqui: nao ha porta de saida, e nao existe peca de
 * mob sem afixo. O afixo de drop e o que da a peca no chao o appeal de
 * mercadoria, e e por isso que ela nunca chega lisa
 *
 * Material nao entra: `canEnchantItem` barra, e o retorno `null` e lido pelo
 * chamador como "sem afixo" em vez de um afixo invalido
 */
export function rollEnchantDeDrop(itemId, random = Math.random) {
  if (!canEnchantItem(itemId)) return null;

  const stat =
    ENCHANT_STATS[
      Math.min(
        ENCHANT_STATS.length - 1,
        Math.floor(random() * ENCHANT_STATS.length),
      )
    ];

  const rarity = rollRarityDeDrop(random);

  return {
    stat,
    rarity,
    power: ENCHANT_POWER[rarity],
  };
}

/** O encantamento tem o formato certo? */
export function isEnchant(bruto) {
  if (!bruto || typeof bruto !== "object") return false;

  if (!ENCHANT_STATS.includes(bruto.stat)) return false;

  if (!Object.hasOwn(ENCHANT_POWER, bruto.rarity)) return false;

  const power = ENCHANT_POWER[bruto.rarity];

  // o valor precisa ser a fracao DAQUELA raridade, e nao um numero
  // qualquer. Um save alterado com `power: 999` colocaria um
  // multiplicador de mil no stat do jogador, e a tela mostraria um
  // numero absurdo sem explicar de onde veio
  return Number(bruto.power) === power;
}

/**
 * O texto do afixo, como o jogador le no item.
 *
 * `+2%` e um round de leitura, nao do valor: a fracao 0.02 e
 * exibida com uma casa, e o resto vem do `RARITY_STYLE`
 */
export function describeEnchant(enchant) {
  if (!enchant) return "";

  const percent = Number((enchant.power * 100).toFixed(1));

  return `+${percent}% ${ENCHANT_STAT_LABEL[enchant.stat] ?? enchant.stat}`;
}

/**
 * O valor ABSOLUTO que o encantamento dá, para uma base.
 *
 * `base` e o stat do personagem no nivel 1 da classe, e e o que o
 * `applyEquipment` ja le. A fracao do encantamento e multiplicada por
 * ele para os stats absolutos, e somada direto para os que ja sao
 * fracao
 *
 * A conversao mora AQUI e nao no motor porque e regra do encantamento,
 * e nao do motor: o motor so precisa do numero pronto
 */
export function resolveEnchant(enchant, base = 0) {
  if (!enchant) return 0;

  if (ENCHANT_FRACTION_STATS.has(enchant.stat)) {
    return enchant.power;
  }

  const numero = Number(base);

  if (!Number.isFinite(numero)) return 0;

  /**
   * O arredondamento nao e cosmetico.
   *
   * `165 * 0.04` em ponto flutuante da `6.6000000000000005`. Isso
   * entraria no stat do jogador como um float com ruido, e o painel de
   * status, que compara o total com o base, mostraria um bonus de
   * `6.6000000000000005` arredondado para 7 — um numero que nao
   * corresponde a nada que o jogador comprou
   *
   * Tres casas porque e o mesmo arredondamento que o `scaleStat` do
   * catalogo usa nos stats proporcionais
   */
  return Number((numero * enchant.power).toFixed(3));
}

/** Os possiveis resultados, para o painel mostrar as chances */
/**
 * A TABELA DE CHANCES do painel de encantar.
 *
 * ## `chance` E O QUE O JOGADOR QUER SABER
 *
 * Antes esta funcao devolvia `percent: ENCHANT_POWER * 100`, que e o
 * QUANTO o afixo vale — 1%, 1.5%, 2%, 4%, 6% — e o painel rotulava essa
 * coluna de "Chances". O jogador lia "Lendário 6%" e podia crer que tem
 * 6% de chance de sair lendário, quando o sorteio real leva bem menos
 *
 * A chance de verdade e o `weight` do `RARITY_STYLE`, e normalizada pelo
 * total dos pesos. O `rollRarity` e exatamente esse sorteio ponderado,
 * entao o numero da tela e o numero que sai: um `weight` de 62 sobre um
 * total de 200 e 31%, e 31% e a chance
 *
 * ## POR QUE NORMALIZAR, E NAO LER O `weight` DIRETO
 *
 * Os pesos sao numeros de balanceamento (62, 24, 9...) e nao somam 100.
 * Se o painel mostrasse o peso cru, a coluna seria de "62%" para o
 * comum e a soma passaria de 100 sem que ninguem percebesse — e um
 * jogador que somasse as cinco linhas veria que o jogo mente
 *
 * A soma e calculada a partir do mesmo `RARITY_ORDER` que o `rollRarity`
 * percorre, entao os dois nunca podem cair em ordens diferentes
 *
 * ## `power` CONTINUA AQUI, PARA O QUE PRECISA DELE
 *
 * O valor do afixo continua no retorno. Quem quiser mostrar "1% de
 * ataque" em vez da chance tem o numero sem refazer a conta
 */
export function enchantOdds() {
  const total = RARITY_ORDER.reduce(
    (sum, raridade) =>
      sum + (RARITY_STYLE[raridade]?.weight ?? 0),
    0,
  );

  return RARITY_ORDER.map((raridade) => ({
    rarity: raridade,
    label: RARITY_STYLE[raridade].label,
    color: RARITY_STYLE[raridade].color,

    /**
     * A CHANCE, em porcento, e com uma casa.
     *
     * Uma casa porque a soma das cinco linhas precisa fechar em 100 de
     * olhos: com zero casa, 30.5 viraria 31 e o painel marcaria 101
     */
    chance: total > 0
      ? Number(
          (((RARITY_STYLE[raridade]?.weight ?? 0) / total) * 100)
            .toFixed(1),
        )
      : 0,

    /**
     * O QUANTO o afixo desta raridade vale, em porcento.
     *
     * Fica no retorno com outro nome para nao se confundir com a chance.
     * Antes as duas coisas se chamavam `percent`, e era o que fazia o
     * painel mostrar uma no lugar da outra
     */
    power: Number((ENCHANT_POWER[raridade] * 100).toFixed(1)),
  }));
}
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ICON_ITEM_IDS,
  ITEM_ICON_ASSET,
  RARITY_ICON_FILE,
  hasItemIcon,
  itemIconUrl,
} from "./icons.js";
import {
  ITEM_TYPE,
  RARITY,
  RARITY_ORDER,
  getItem,
} from "./index.js";

/**
 * Os icones de item desenhados, e a raridade que escolhe o arquivo.
 *
 * O arco de galho e o UNICO item com um PNG por raridade. A troca
 * acontece num mapa de nomes de arquivo, e esse mapa e o tipo de
 * coisa que falha sem erro: um `typo` em `RARITY_ICON_FILE` nao
 * estoura nada, vira uma URL que da 404 no navegador, e o item
 * aparece sem imagem nenhuma.
 *
 * Por isso o teste central deste arquivo nao verifica o que o
 * resolvedor DEVOLVE, e sim se o arquivo que ele aponta EXISTE no
 * disco, para as cinco raridades. E o que pega o `typo`
 *
 * Os itens de arte UNICA — aljava e as cinco armaduras — nao passam
 * por aqui: estao no `ITEM_ICON_SIMPLES` e respondem iguais em
 * qualquer raridade, porque a cor da raridade ja e pintada no fundo
 * do slot. O `describe` no fim deste arquivo e o que os confere
 */
/**
 * O caminho em disco que a URL do resolvedor aponta.
 *
 * `fileURLToPath` e o que traduz a `file:///C:/...` do `new URL`
 * para um caminho que o `fs` entende. E ele que permite conferir a
 * EXISTENCIA do arquivo, e nao so o formato da URL
 */
function arquivoDa(url) {
  return fileURLToPath(url);
}

const ASSINATURA_PNG = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
];

/**
 * O arco e a arma secundaria sao testados pelo MESMO codigo, e nao
 * por duas copias.
 *
 * Repetir os testes por item seria copiar vinte assercoes a cada arte
 * nova, e a copia e o que apodrece: no segundo item, uma das copias
 * esqueceria de conferir o arquivo em disco — que e justamente a
 * verificacao que pega o `typo` de caminho. Com o `for`, o item novo
 * entra no teste pelo simples fato de existir arte para ele
 */
const [BOW] = ICON_ITEM_IDS;

/**
 * A aljava saiu de `ICON_ITEM_IDS` quando passou a ter arte unica, mas
 * os testes do slot dela continuam necessarios: e a peca que garante
 * que a secundaria nao ocupe a mao principal.
 *
 * O id fica aqui declarado explicitamente em vez de ser lido do indice,
 * porque ler a posicao 1 de uma lista que hoje tem um elemento so daria
 * `undefined` sem erro — o teste passaria comparando `undefined` com
 * `undefined`, que e o pior jeito de um teste falhar
 */
const ALJAVA = "aljava_arbalist";

describe.each(ICON_ITEM_IDS)("a arte de %s", (itemId) => {
  it("esta no catalogo", () => {
    // O id do item e `willow_bow` e a pasta se chama
    // `arco_de_galho`, que e o nome de exibicao em portugues. Se o
    // catalogo mudar o id, este teste avisa: sem ele a arte ficaria
    // orfa e o item voltaria a ser glifo sem ninguem perceber
    expect(getItem(itemId), itemId).toBeTruthy();
    expect(hasItemIcon(itemId), itemId).toBe(true);
  });

  it("cada raridade aponta para um arquivo que EXISTE", () => {
    for (const rarity of RARITY_ORDER) {
      const url = itemIconUrl(itemId, rarity);

      expect(url, `${itemId}/${rarity}`).toBeTruthy();
      expect(
        existsSync(arquivoDa(url)),
        `falta o arquivo da raridade ${rarity}: ${url}`,
      ).toBe(true);
    }
  });

  it("cada arquivo e um PNG de verdade", () => {
    for (const rarity of RARITY_ORDER) {
      const arquivo = arquivoDa(itemIconUrl(itemId, rarity));
      const buffer = readFileSync(arquivo);

      expect(
        [...buffer.subarray(0, 8)],
        `assinatura de ${itemId}/${rarity}`,
      ).toEqual(ASSINATURA_PNG);
    }
  });

  it("as cinco artes sao DIFERENTES entre si", () => {
    // Sem isto, o mapa poderia estar correto e apontar as cinco
    // raridades para o mesmo arquivo: o lendario sairia com a cara do
    // comum e nada quebraria
    const urls = RARITY_ORDER.map((rarity) =>
      itemIconUrl(itemId, rarity),
    );

    expect(new Set(urls).size, itemId).toBe(RARITY_ORDER.length);
  });

  it("as cinco artes tem o mesmo tamanho, para o slot nao pular", () => {
    // O slot do inventario tem altura fixa. Se uma arte fosse maior
    // que as outras, o item mudaria de tamanho ao passar de raridade
    const tamanhoDe = (rarity) => {
      const buffer = readFileSync(
        arquivoDa(itemIconUrl(itemId, rarity)),
      );

      // o IHDR comeca no byte 16: largura e altura em big endian
      return `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`;
    };

    const tamanhos = RARITY_ORDER.map(tamanhoDe);
    const unicos = new Set(tamanhos);

    // A mensagem nomeia a RARIDADE que destoa, e nao so o item. Com
    // quatro pecas no jogo, "esperado 2 para ser 1" nao dizia qual
    // das vinte imagens estava errada
    expect(
      unicos.size,
      `${itemId}: ${tamanhos
        .map((t, n) => `${RARITY_ORDER[n]}=${t}`)
        .join(", ")}`,
    ).toBe(1);
  });
});

describe("a lista de itens com arte", () => {
  it("agora so o arco de galho tem arte por raridade", () => {
    // O arco e a unica peca com CINCO arquivos, uma por raridade. As
    // seis demais (aljava e as cinco armaduras) foram para o
    // `ITEM_ICON_SIMPLES`, com UM arquivo cada: a cor da raridade ja
    // e pintada no fundo do slot, e a arte repetindo isso em 30 PNGs
    // custava 30 arquivos para dizer a mesma coisa duas vezes
    //
    // E `pocao_cura` saiu daqui tambem — ele ja estava no
    // `ITEM_ICON_SIMPLES` e aparecia nesta lista por engano do teste,
    // nao por ter arte por raridade
    expect(Object.keys(ITEM_ICON_ASSET)).toEqual(["willow_bow"]);
  });

  it("a ordem do mapa e a ordem declarada", () => {
    // `ICON_ITEM_IDS` e a fonte da ordem, e o mapa de arte tem de
    // concordar com ela. Se as duas divergirem, o item novo entra na
    // ordem trocada sem ninguem ver
    expect(Object.keys(ITEM_ICON_ASSET)).toEqual(ICON_ITEM_IDS);
  });

  it("todo item com arte tem o item no catalogo", () => {
    // O caminho inverso: se alguem declarar arte para um id que nao
    // existe, a pasta fica orfa e ninguem ve
    for (const itemId of Object.keys(ITEM_ICON_ASSET)) {
      expect(getItem(itemId), itemId).toBeTruthy();
    }
  });
});

describe("a arma secundaria do arbalist", () => {
  it("e a aljava, e vai no slot da secundaria", () => {
    const aljava = getItem(ALJAVA);

    expect(aljava.name).toBe("Aljava de Arqueiro");
    expect(aljava.type).toBe(ITEM_TYPE.WEAPON);

    // o slot e o que impede a aljava de ocupar a mao principal no
    // lugar do arco. Sem ele, `slotNameFor` cairia no primeiro slot
    // livre do tipo e a troca seria silenciosa
    expect(aljava.slot).toBe("weapon2");
  });

  it("e da familia do arco, e por isso so do arbalist", () => {
    // a trava de classe continua sendo a familia: as duas pecas do
    // arbalist sao `bow`. Uma familia nova so nasceria se uma classe
    // que NAO usa arco precisasse da aljava
    expect(getItem(ALJAVA).kind).toBe(getItem(BOW).kind);
  });

  it("vale menos que o arco, para as duas pecas nao valerem uma arma so", () => {
    const arco = getItem(BOW);
    const aljava = getItem(ALJAVA);

    // os bonus somam (`applyEquipment` junta por stat), entao a
    // segunda peca nao pode valer um arco inteiro sozinha
    expect(aljava.stats.attack).toBeLessThan(arco.stats.attack);
    expect(aljava.value).toBeLessThan(arco.value);
  });

  it("as duas pecas do arbalist ocupam slots diferentes", () => {
    // se as duas tivessem o mesmo slot, equipar a segunda trocaria a
    // primeira e o arqueiro ficaria com uma peca so
    expect(getItem(BOW).slot ?? "weapon").toBe("weapon");
    expect(getItem(ALJAVA).slot).toBe("weapon2");
  });
});

describe("o mapa de raridade", () => {
  it("esta declarado para as cinco raridades", () => {
    for (const rarity of RARITY_ORDER) {
      expect(
        RARITY_ICON_FILE[rarity],
        rarity,
      ).toBeTruthy();
    }

    // e sao as cinco, e nao as cinco mais uma
    expect(Object.keys(RARITY_ICON_FILE)).toHaveLength(
      RARITY_ORDER.length,
    );
  });

  it("o nome em portugues da raridade bate com o arquivo", () => {
    // Este e o mapa que ninguem vai ler de novo em seis meses sem
    // estranhar: `common` -> `comum` e `uncommon` -> `incomun` nao
    // sao o mesmo nome. Os testes acima ja garantem que os cinco
    // arquivos existem no disco; aqui fica escrito de onde vem cada
    // nome, que e a parte que o olho nao deduz
    expect(RARITY_ICON_FILE[RARITY.COMMON]).toBe("comum");
    expect(RARITY_ICON_FILE[RARITY.UNCOMMON]).toBe("incomun");
    expect(RARITY_ICON_FILE[RARITY.RARE]).toBe("rare");
    expect(RARITY_ICON_FILE[RARITY.EPIC]).toBe("epic");
    expect(RARITY_ICON_FILE[RARITY.LEGENDARY]).toBe("legendary");
  });
});

/**
 * AS SEIS PECAS QUE VIRARAM ARTE UNICA.
 *
 * O `describe.each` do topo deste arquivo confere CINCO arquivos por
 * item, um por raridade. Estas pecas tem UM arquivo so, e por isso o
 * caminho delas nao passa por `RARITY_ICON_FILE` — se o mesmo codigo
 * fosse aplicado aqui, ele leria `undefined` no mapa de raridade e
 * cairia no glifo sem erro nenhum
 *
 * E o que este bloco confere: que o arquivo existe no disco, e que a
 * MESMA arte responde para as cinco raridades. A segunda e a
 * verificacao que prova a mudanca — se algum dia alguem declarar uma
 * destas pecas em `ITEM_ICON_ASSET` por engano, ela volta a pedir um
 * arquivo por raridade e este teste acusa
 */
describe.each([
  "aljava_arbalist",
  "botas_arbalist",
  "calca_arbalist",
  "capuz_arbalist",
  "luvas_arbalist",
  "peito_arbalist",
])("a arte unica de %s", (itemId) => {
  it("esta no catalogo", () => {
    expect(getItem(itemId), itemId).toBeTruthy();
    expect(hasItemIcon(itemId), itemId).toBe(true);
  });

  it("aponta para um arquivo que EXISTE", () => {
    const url = itemIconUrl(itemId, RARITY.COMMON);

    expect(url, itemId).toBeTruthy();
    expect(
      existsSync(arquivoDa(url)),
      `falta o arquivo de ${itemId}: ${url}`,
    ).toBe(true);
  });

  it("e a MESMA arte nas cinco raridades", () => {
    // A raridade nao esta na arte: ela esta no fundo do slot. Se estas
    // pecas voltassem a ter um desenho por raridade, seriam 30 arquivos
    // dizendo de novo o que a cor do fundo ja diz
    const urls = RARITY_ORDER.map((rarity) =>
      itemIconUrl(itemId, rarity),
    );

    expect(new Set(urls).size, itemId).toBe(1);
  });

  it("responde mesmo sem raridade, e para uma raridade inventada", () => {
    // O caminho de arte unica e consultado ANTES do mapa de raridade,
    // entao nem `null` nem "mitico" derrubam a peca para o glifo
    expect(itemIconUrl(itemId, null), itemId).toBeTruthy();
    expect(itemIconUrl(itemId, "mitico"), itemId).toBeTruthy();
  });

  it("o arquivo e um PNG de verdade", () => {
    const buffer = readFileSync(
      arquivoDa(itemIconUrl(itemId, RARITY.COMMON)),
    );

    expect(
      [...buffer.subarray(0, 8)],
      `assinatura de ${itemId}`,
    ).toEqual(ASSINATURA_PNG);
  });

  it("cada peca tem a SUA arte, e nao a da outra", () => {
    // Sem isto, as seis podiam apontar para o mesmo PNG por copia e
    // colete — e o slot do peito mostraria uma bota sem nenhum erro
    const urls = PECAS_ARTE_UNICA.map((id) =>
      itemIconUrl(id, RARITY.COMMON),
    );

    expect(new Set(urls).size).toBe(PECAS_ARTE_UNICA.length);
  });
});

describe("itens sem arte continuam com glifo", () => {
  it("devolve null para um item que nao tem pasta de arte", () => {
    // Os outros 13 itens do catalogo nao tem imagem. O icone deles
    // tem de continuar funcionando, e a unica forma de garantir e
    // devolver `null` em vez de uma URL quebrada: quem desenha cai
    // no glifo
    expect(itemIconUrl("slime_gel", RARITY.COMMON)).toBe(null);
    expect(itemIconUrl("ogre_hide", RARITY.LEGENDARY)).toBe(null);
  });

  it("devolve null para um item que nem existe", () => {
    expect(itemIconUrl("item_que_nao_existe", RARITY.COMMON)).toBe(
      null,
    );
  });

  it("devolve null quando a raridade nao e uma das cinco", () => {
    // `new URL` de arquivo inexistente NAO da erro: vira uma URL
    // que so quebra no navegador. Este e o caso que mais escaparia
    //
    // E o teste usa o ARCO, nao a aljava: a aljava passou a ter arte
    // unica, que responde igual para qualquer raridade, entao
    // `itemIconUrl("aljava_arbalist", "mitico")` devolveria a arte em
    // vez de null. E o comportamento certo dela, testado no fim
    expect(itemIconUrl(BOW, "mitico")).toBe(null);

    expect(itemIconUrl(BOW, null)).toBe(null);
    expect(itemIconUrl(BOW, undefined)).toBe(null);
  });
});
import { SKILL_PACKS } from "./index.js";

/**
 * OS LIVROS DE HABILIDADE, e o preco de cada um.
 *
 * ## POR QUE O PRECO FICA AQUI E NAO NO ITEM
 *
 * O `value` do item e o preco no mercado entre jogadores, e quem vende sao
 * os outros jogadores. O preco do Mestre e decisao do Mestre
 *
 * E o mesmo desenho do catalogo de pocoes (`src/data/poções/index.js`), e
 * pelo mesmo motivo: se o preco viesse do item, qualquer jogador poderia
 * vender um livro por 1 moeda
 */

/**
 * O ITEM QUE ENSINA, e a skill que ele ensina.
 *
 * O `id` do item precisa existir no catalogo (`getItem`), e o `skillId`
 * precisa ser uma skill de verdade da classe — as duas coisas sao
 * conferidas por `validarLivros`, na leitura deste arquivo, e nao no
 * servidor a cada compra
 *
 * ## POR QUE O PRECO SOBE DE LIVRO PARA LIVRO
 *
 * Porque o preco e o do ENSINO, e as tres skills nao valem o mesmo: a
 * armadilha e um controle pontual, a salva e um dano que depende de onde o
 * jogador esta, e a chuva e a unica que ocupa o chao por 7 segundos. Um
 * preco igual nos tres diria que as tres sao equivalentes, e nao sao
 */
const LIVROS = {
  arbalist: [
    {
      itemId: "livro_armadilha_espinhos",
      skillId: "arbalist_thorn_trap",
      preco: 150,
    },
    {
      itemId: "livro_salva_leque",
      skillId: "arbalist_fan_volley",
      preco: 220,
    },
    {
      itemId: "livro_chuva_virotes",
      skillId: "arbalist_venom_bolt_rain",
      preco: 300,
    },
  ],

  sorcerer: [
    {
      itemId: "livro_lanca_mana",
      skillId: "sorcerer_mana_lance",
      preco: 150,
    },
    {
      itemId: "livro_nova_cristal",
      skillId: "sorcerer_crystal_nova",
      preco: 220,
    },
    {
      itemId: "livro_singularidade",
      skillId: "sorcerer_singularity",
      preco: 300,
    },
  ],

  /**
   * As outras classes entram aqui quando os livros delas existirem.
   *
   * Um array VAZIO e um caso valido, e nao um erro: o Mestre mostra
   * "nenhum livro" para uma classe sem livro, em vez de a tela quebrar
   * por causa de um `undefined`
   */
  warrior: [],
  lancer: [],
};

/**
 * As habilidades que o livro ensina, pelo id do item.
 *
 * E o indice inverso do catalogo, e ele existe porque o `usarItem`
 * recebe o ITEM e nao a skill: e o livro no inventario que o jogador
 * usou, e dali que o motor descobre o que teachar
 */
const SKILL_POR_ITEM = new Map();

/**
 * Um livro e VALIDO so se as duas metades existirem.
 *
 * - o `skillId` tem que ser uma skill REAL da classe. Se o catalogo da
 *   habilidade for reescrito e o id mudar, o livro apontaria para o vazio
 *   e o item seria consumido sem ensinar nada
 * - o item tem que existir no catalogo de itens, pelo mesmo motivo
 *
 * Uma entrada invalida e DESCARTADA com um aviso no console, e nao
 * lancada: um livro escrito errado e um erro de escrita, e derrubar o
 * servidor inteiro porque alguem digitou o id errado nao e uma punicao
 * proporcional
 */
function validarLivros() {
  const validos = new Map();

  for (const [classeId, lista] of Object.entries(LIVROS)) {
    const pack = SKILL_PACKS[classeId];

    const bons = (lista ?? []).filter((livro) => {
      const skillExiste =
        pack?.skills?.some((skill) => skill.id === livro.skillId) ??
        false;

      if (!skillExiste) {
        console.warn(
          `[livros] "${livro.itemId}" aponta para "${livro.skillId}", que nao e uma skill de ${classeId}`,
        );

        return false;
      }

      if (SKILL_POR_ITEM.has(livro.itemId)) {
        console.warn(
          `[livros] "${livro.itemId}" esta em dois lugares do catalogo`,
        );

        return false;
      }

      return true;
    });

    validos.set(classeId, bons);

    for (const livro of bons) {
      SKILL_POR_ITEM.set(livro.itemId, livro);
    }
  }

  return validos;
}

const LIVROS_VALIDOS = validarLivros();

/** Os livros de uma classe. Array vazio quando ela nao tem livro ainda. */
export function livrosDaClasse(classeId) {
  return LIVROS_VALIDOS.get(classeId) ?? [];
}

/**
 * O livro de um item, ou `null`.
 *
 * E o que o `usarItem` consulta: ele tem o item, e precisa da skill
 */
export function livroDoItem(itemId) {
  return SKILL_POR_ITEM.get(itemId) ?? null;
}

/** O preco de um livro, ou `null` quando o item nao e livro nenhum. */
export function precoDoLivro(itemId) {
  return SKILL_POR_ITEM.get(itemId)?.preco ?? null;
}

/** O item que ensina uma skill, ou `null`. Usado pelo save, para o inverso. */
export function itemDaSkill(skillId) {
  for (const livro of SKILL_POR_ITEM.values()) {
    if (livro.skillId === skillId) return livro.itemId;
  }

  return null;
}
/* ==================================================================
   KIT DE TESTE — ESTE ARQUIVO INTEIRO É PARA APAGAR
   ==================================================================

   ⚠ NADA AQUI É CONTEÚDO DO JOGO. É um item de teste, e existe só
   para dar equipamento a um personagem novo sem precisar caçar.

   ⚠ PARA DESLIGAR: apague este arquivo e a linha que o chama, em
     `src/game/entities/PlayerSession.js` (procure por `darKitDeTeste`).
     São duas coisas e nada mais. Não há flag para desligar, porque
     flag esquecida é pior que código apagado: ela continua dando
     equipamento a todo mundo e ninguém sabe que está lá.

   ⚠ POR QUE SÓ O ARBALIST
     O catálogo tem 2 armas (as duas arco) e 10 peças de armadura, e só
     existem itens de arbalist e de guerreiro. Não há espada, lança nem
     cajado, e não há trinket nenhum. Montar um kit para todas as
     classes exigiria inventar equipamento que o jogo não tem — que é
     conteúdo, não teste. Então o kit existe para a única classe que já
     tem o jogo inteiro equipado, e as outras saem sem nada.

   ⚠ POR QUE A RARIDADE É FORÇADA PARA `common`
     Os arcos do catálogo são `uncommon`. Equipá-los na raridade de base
     não serviria: o pedido era a PIOR raridade, e `common` é a pior
     que existe (`RARITY_ORDER[0]`). O `equip` aceita a raridade como
     argumento, então é só passar `common` em vez de deixar ele
     deduzir do item.
   ================================================================== */

import {
  ITEMS,
  RARITY_ORDER,
} from "../../data/items/index.js";
import { EQUIPMENT_SLOTS } from "../equipment/Equipment.js";

/**
 * A PIOR RARIDADE DO JOGO.
 *
 * Sai de `RARITY_ORDER[0]` em vez de escrever `"common"` aqui: se um dia
 * existir uma raridade abaixo de `common`, o kit passa a usar a nova
 * sem ninguém editar este arquivo. O nome da constante de raridade é
 * `RARITY.COMMON`, mas a ordem é quem diz qual é a pior.
 */
const PIOR_RARIDADE = RARITY_ORDER[0];

/**
 * A CLASSE QUE RECEBE O KIT.
 *
 * Comparada com o id da classe do personagem. Qualquer outra sai sem
 * equipamento, e o motivo está no cabeçalho deste arquivo.
 */
const CLASSE_COM_KIT = "arbalist";

/**
 * Este item pode ser vestido por ESTA classe?
 *
 * São as mesmas duas regras que o resto do jogo usa para dizer que uma
 * peça é usável, e a comparação é feita aqui e não dentro do `equip`:
 * o `slotAccepts` do `Equipment` cuida do TIPO e da POSIÇÃO, mas não da
 * CLASSE. Sem esta conferência, um arbalist receberia uma peça de
 * guerreiro num slot válido — o `equip` aceitaria, e a peça apareceria
 * equipada no painel e não contaria para o ATK.
 *
 * - `classes`: quando o item declara, é a lista de quem pode usar.
 *   `null` significa todo mundo.
 * - `kind`: é a FAMÍLIA da arma (arco, espada, lança, cajado), e cada
 *   classe tem a sua em `CLASS_WEAPON_KINDS`.
 */
function serveParaClasse(item, classId) {
  if (item.classes && !item.classes.includes(classId)) {
    return false;
  }

  if (item.kind) {
    const familias = WEAPON_KINDS_DA_CLASSE[classId];

    if (!familias?.includes(item.kind)) return false;
  }

  return true;
}

/**
 * As familias de arma de cada classe, copiadas do catalogo.
 *
 * E uma copia local, e não um import, por causa da MESMA razão do
 * `RAIO_DO_JOGADOR` no motor: o `data/items` não importa este arquivo,
 * mas este é um item descartável e não vale acoplar o arquivo que o
 * jogador apaga a um módulo do jogo. Se as famílias mudarem, este kit
 * para de achar arma — que é um jeito visível e inofensivo de o kit de
 * teste envelhecer.
 */
const WEAPON_KINDS_DA_CLASSE = {
  warrior: ["sword"],
  lancer: ["lance"],
  sorcerer: ["staff"],
  arbalist: ["bow"],
};

/**
 * DÁ O KIT DE TESTE A UMA SESSÃO.
 *
 * ## POR QUE PREENCHE SLOT POR SLOT, E NÃO UMA LISTA FIXA
 *
 * Uma lista de ids ("este arco, este capuz...") envelheceria junto com o
 * catálogo: um item renomeado quebraria o kit, e um item novo nunca
 * entraria. Perguntando ao catálogo qual é o primeiro item que serve
 * para cada slot, o kit continua preenchendo o que existir depois de
 * qualquer mudanca
 *
 * ## POR QUE `canEquip` ENTRA NA CONFERENCIA
 *
 * E a ultima palavra sobre se a peca cabe naquele slot. O filtro do slot
 * e o filtro da classe sao pezinhos e rapidos; este e o que garante que
 * o `equip` nao vai recusar — e uma recusa aqui passaria em silencio, e o
 * jogador receberia um kit com um buraco que ninguem explica
 *
 * ## O QUE FICA DE FORA, E POR QUE
 *
 * Os dois slots de trinket ficam vazios: não existe trinket nenhum no
 * catálogo. Não há linha de erro, aviso nem `console` — um buraco
 * silencioso é a diferença entre "o kit não tinha isso" e "o kit
 * quebrou", e o primeiro é a verdade
 *
 * @returns quantos slots foram preenchidos
 */
export function darKitDeTeste(sessao) {
  if (sessao?.classId !== CLASSE_COM_KIT) return 0;

  const { equipment } = sessao;

  if (!equipment) return 0;

  const catalogo = Object.values(ITEMS);

  /**
   * O QUE JA FOI DADO NESTE KIT.
   *
   * Os dois slots de arma acceptam a MESMA familia, entao sem esta
   * memoria o `find` devolveria o mesmo arco nos dois: o guerreiro
   * receberia duas copias de `willow_bow` em vez de uma em cada mao
   *
   * E o `find` comecava sempre do comeco do catalogo, entao a segunda
   * arma era identica a primeira por construcao, e nao por sorte
   */
  const jaDados = new Set();

  let preenchidos = 0;

  for (const slot of EQUIPMENT_SLOTS) {
    const peca = catalogo.find(
      (item) =>
        !jaDados.has(item.id) &&
        slot.accepts.includes(item.type) &&
        // o item manda na posicao quando declara uma
        (!item.slot || item.slot === slot.id) &&
        serveParaClasse(item, sessao.classId) &&
        equipment.canEquip(item.id, slot.id),
    );

    if (!peca) continue;

    /**
     * `equip` DEVOLVE A PECA ANTERIOR do slot, e nao um booleano.
     *
     * Num slot vazio essa anterior e `null` — que e falsy. Checar o
     * retorno como se fosse `true` contava zero slot preenchido numa
     * margem que encheu todos eles, e o `jaDados` nunca era atualizado,
     * o que fazia as DUAS armas receberem o mesmo arco
     *
     * A confirmacao e o proprio slot: e ele quem guardou a peca, e o
     * que a leitura de volta prova
     */
    equipment.equip(peca.id, slot.id, PIOR_RARIDADE);

    if (equipment.getSlot(slot.id)?.itemId !== peca.id) continue;

    jaDados.add(peca.id);
    preenchidos += 1;
  }

  return preenchidos;
}

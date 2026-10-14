/**
 * O NOME LEGIVEL DE CADA PAINEL, para o botao do tutorial.
 *
 * E um mapa e nao um rotulo generico ("ABRIR") porque o botao que abre o
 * CRAFT e o que abre a COLECAO precisam dizer onde vao. Um "ABRIR" em sete
 * botoes identicos obriga o jogador a lembrar o nome de cada aba, que e
 * exatamente o que o tutorial deveria ensinar
 *
 * A chave e o `PAINEL` do `HUD`, e o valor e o que o `data/quests`
 * declara como `painel` no passo
 *
 * ## POR QUE ESTE MAPA VIVE SOZINHO, E NAO NO `QuestPanel.jsx`
 *
 * Porque o `QuestPanel.jsx` exporta um COMPONENTE, e este mapa nao e um
 * componente. O Fast Refresh do React so consegue atualizar um modulo se
 * tudo que ele exporta for componente: um objeto comum na porta junto e o
 * Vite desiste do hot update e recarrega a pagina inteira, com este aviso
 * no console:
 *
 *     Could not Fast Refresh ("ROTULO_DO_PAINEL" export is incompatible)
 *
 * O sintoma nao e o aviso: e o F5 silencioso. Voce edita o painel de
 * missao, o navegador recarrega inteiro, e o estado do jogo (o socket, a
 * posicao na briga) se perde — sem erro nenhum alem da linha do console
 *
 * ## E POR QUE UM ARQUIVO SO, E NAO UM `data/quests`
 *
 * Porque este mapa e a PONTE entre dois paineis: o botao do tutorial no
 * `QuestPanel` e a box do HUD. Ele nao descreve uma missao, e nao tem
 * lugar em `data/quests` — que e o catalogo delas. Ficar com quem usa
 * deixa o motivo de existir visivel
 *
 * Sao dois botoes para a mesma acao, e e por isso que eles leem o mesmo
 * mapa: se um disser "ABRIR CRAFT" e o outro "ABRIR", o jogador leria
 * como dois botoes diferentes para coisas diferentes
 */
export const ROTULO_DO_PAINEL = {
  craft: "ABRIR CRAFT",
  enchant: "ENCANTAR",
  collection: "COLEÇÃO",
  loja: "LOJA",
};

/**
 * O ROTULO POR TIPO DE TUTORIAL, que tem a palavra do PAINEL acima.
 *
 * ## POR QUE PRECISA DOS DOIS
 *
 * Porque `enchant` e um painel com duas abas, e os dois tutorials apontam
 * para o mesmo `painel`. Pelo mapa de painel, a missao de aprimorar
 * escrevia "ENCANTAR" — e mandava o jogador para a aba errada do painel
 * certo. O rotulo por tipo e o que resolve os dois de uma vez: ele sabe
 * qual tutorial esta em jogo, coisa que o painel nao sabe
 *
 * ## POR QUE O NPC NAO ENTRA NESTE MAPA
 *
 * Porque `npc` nao e painel nenhum: nao existe aba para abrir. O rotulo do
 * NPC vem do proprio `npc`, porque "IR ATE O NPC" so faz sentido com um NPC
 * ao lado — e `IR ATE A LOJA" na loja seria mentira
 */
export const ROTULO_DO_TUTORIAL = {
  craft: "ABRIR CRAFT",
  enchant: "ENCANTAR",
  enhance: "APRIMORAR",
  deliver: "COLEÇÃO",
  buy: "LOJA",
  learnSkill: "IR ATÉ O NPC",
};

/**
 * O ROTULO DE UM TUTORIAL, ja com a palavra do destino pronta.
 *
 * A ordem e a do mais especifico para o mais geral: o NPC primeiro, porque
 * so ele tem destino que nao e aba; depois o tipo, que e o que diferencia
 * os dois/tutorials do `enchant`; e o painel por ultimo, como rede de
 * seguranca para um tutorial novo que ainda nao entrou no mapa de tipo
 */
export function rotuloDoTutorial({ tipo, painel, npc } = {}) {
  if (npc) return "IR ATÉ O NPC";

  if (tipo && ROTULO_DO_TUTORIAL[tipo]) return ROTULO_DO_TUTORIAL[tipo];

  if (painel) return ROTULO_DO_PAINEL[painel] ?? "ABRIR";

  return null;
}
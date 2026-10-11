/**
 * Os sprites de inimigo: layout + imagem.
 *
 * Mesma razao de `./index.js`: `new URL(..., import.meta.url)`
 * em vez de `import url from "slime.png"`, para o modulo poder ser
 * importado pelo motor tambem no servidor.
 */
import {
  BONECO_MADEIRA_SPRITE,
  GHOUL_FAMINTO_SPRITE,
  GOBLIN_SAQUEADOR_SPRITE,
  GOBLIN_SPRITE,
  KAELEN_SPRITE,
  NYLARA_SPRITE,
  HULK_SPRITE,
  OGRE_PREDEIRA_SPRITE,
  RATO_DA_TOCA_SPRITE,
  
  ESQUELETO_SPRITE,
} from "./enemyLayout.js";

/**
 * O `folha()` que abria `assets/sprites/enemies/<nome>.png` foi removido.
 *
 * Ele existia para as criaturas que ainda usavam a arte antiga, uma
 * folha de 32px de tres linhas. NAO sobrou nenhuma: as onze criaturas do
 * registro tem folha direcional de 68px. Deixar o helper aqui seria uma
 * porta de volta para a arte antiga, e ele nao daria erro nenhum ao ser
 * chamado — o arquivo existiria e o bicho voltaria a andar de frente
 *
 * Pelo mesmo motivo o `createEnemySpriteDefinition` saiu do import
 * daqui. Ele continua vivo dentro de `./enemyLayout.js`, onde as
 * criaturas SEM arte ainda caem nele
 */
export const ENEMY_SPRITES = {
  /**
   * O ESQUELETO — que ainda e a criatura `slime`.
   *
   * A chave continua `slime` por causa do `slime_gel` e do `slime_core`:
   * eles sao o loot deste bicho, sao ingrediente de craft e sao
   * recompensa de missao, e o save do jogador guarda esses ids. Um
   * `slime` novo aqui quebraria os dois
   *
   * ## A FOLHA E A `esqueleto-sheet.png`, E NAO MAIS A DO LIMO
   *
   * Celulas de 88px desta vez (a arte veio maior que as outras do
   * jogo): nove colunas, dezessete linhas — oito de caminhada, uma de
   * idle e oito de golpe. O golpe e novo, e ele existe porque a criatura
   * agora retalia quem a bate
   */
  slime: {
    ...ESQUELETO_SPRITE,
    src: new URL(
      "../../assets/sprites/esqueleto-sheet.png",
      import.meta.url,
    ).href,
  },


  // O GOBLIN SAQUEADOR NAO USA MAIS `enemies/goblin.png`. A arte
  // antiga era uma folha de 32px de tres linhas, e o goblin andava
  // sempre de frente para o jogador. Agora sao oito direcoes de 68px
  // (linhas 0 a 7) e uma de idle de verdade (linha 8), sem golpe
  //
  // A chave e o `id` da CRIATURA, que e `goblin`. A pasta de arte se
  // chama `hulk`, que e o nome da arte e nao da criatura, e o arquivo
  // gerado usa o nome de exibicao "Goblin Saqueador", como o ghoul usa
  // "ghoul_faminto-sheet.png"
  goblin: {
    ...GOBLIN_SAQUEADOR_SPRITE,
    src: new URL(
      "../../assets/sprites/goblin_saqueador-sheet.png",
      import.meta.url,
    ).href,
  },

  // A SENTINELA ESQUELETICA NAO USA MAIS `enemies/skeleton.png`. A
  // arte antiga era uma folha de 32px de tres linhas, e o esqueleto
  // andava sempre de frente para o jogador. Agora sao oito direcoes de
  // 68px (linhas 0 a 7) e uma de idle de verdade (linha 8).
  //
  // O `id` da criatura continua `skeleton` — e ele que esta no save,
  // no bestiario e nas missoes de cacada. `folha("skeleton")` foi
  // deixado de fora de proposito
  /**
   * O KAELEN, que era a Sentinela Esqueletica.
   *
   * ## O ID CONTINUA `skeleton`
   *
   * Como no goblin: o id e a chave do save, das tres cacadas de bestiario
   * e das entregas de colecao. No mapa 2 a sentinela e o resultado da
   * substituicao dos dois ogres, entao trocar o id mudaria o registro de
   * abate de quem ja matou a sentinela
   *
   * ## A FOLHA VELHA SAIU DE CIRCULACAO
   *
   * `sentinela_esqueletica-sheet.png` era de celula 68 e 17 linhas, sem
   * morte. A nova e de celula 88 e 25 linhas, com idle por direcao e a
   * animacao de morte. A pasta de arte `sentinela` continua no disco: e a
   * origem antiga, e some quando nao for mais usada por nenhum layout
   */
  skeleton: {
    ...KAELEN_SPRITE,
    src: new URL(
      "../../assets/sprites/kaelen-sheet.png",
      import.meta.url,
    ).href,
  },

  // O RATO DA TOCA NAO USA MAIS `enemies/rat.png`. A arte antiga era
  // uma folha de 32px de tres linhas, e o bicho andava sempre de frente
  // para o jogador. Agora sao oito direcoes de 68px (linhas 0 a 7) e uma
  // de idle de verdade (linha 8), sem golpe — ele e PASSIVO e nao
  // ataca.
  //
  // A pasta de origem da arte nova se chama `urso`, e `folha("rat")`
  // foi entao deixado de fora de proposito. A chave do registro e o
  // `id` da CRIATURA, que e `rat`
  rat: {
    ...RATO_DA_TOCA_SPRITE,
    src: new URL(
      "../../assets/sprites/rato_da_toca-sheet.png",
      import.meta.url,
    ).href,
  },

  // O ghoul NAO usa mais `enemies/ghoul.png`. A arte antiga era uma
  // folha de 32px de tres linhas, e o ghoul andava sempre de frente
  // para o jogador. Agora sao oito direcoes de 68px (linhas 0 a 7) e
  // uma de idle de verdade (linha 8), sem golpe.
  //
  // A chave e o `id` da CRIATURA, que e `ghoul`. "Ghoul Faminto" e o
  // nome de exibicao, e nao uma segunda criatura: existe um ghoul so
  ghoul: {
    ...GHOUL_FAMINTO_SPRITE,
    src: new URL(
      "../../assets/sprites/ghoul_faminto-sheet.png",
      import.meta.url,
    ).href,
  },

  /**
   * O GOBLIN DA PEDREIRA.
   *
   * ## O ID FICOU `ogre` E A ARTE DEIXOU DE SER A DO OGRE
   *
   * A criatura se chama `Goblin` na tela e continua com id `ogre`. O
   * id e a chave do bestiario, das missoes de cacada e dos `mix` de
   * zona das cinco degraus da pedreira, entao trocar ele apagaria o
   * registro de abate de quem ja matou o ogre
   *
   * A arte e a folha nova, `goblin-sheet.png`, que e de 25 linhas e
   * de celula 84. Antes, o `ogre` usava
   * `ogre_da_predeira-sheet.png` — a mesma do `ogre_da_predeira`, o
   * outro ogre do jogo, que continua usando a dele
   *
   * ## POR QUE ESTE BLOCO TEM A PROPRIA `src` E O LAO DEBAIXO NAO
   *
   * As duas criaturas usavam o MESMO layout (`OGRE_PREDEIRA_SPRITE`)
   * e so mudavam o arquivo. Aqui os layouts sao diferentes: o goblin
   * tem idle por direcao, celula de 84 e a animacao de morte, e o
   * `ogre_da_predeira` tem idle unico e celula de 68
   */
  ogre: {
    ...GOBLIN_SPRITE,
    src: new URL(
      "../../assets/sprites/goblin-sheet.png",
      import.meta.url,
    ).href,
  },

  // os direcionais nao usam a pasta `enemies/`: a folha deles e de
  // oito direcoes, montada pelos gifs da pasta de cada um
  /**
   * A NYLARA, que era o Arqueiro Zumbi.
   *
   * ## O ID CONTINUA `zumbi_arbalist`
   *
   * Como no goblin e no Kaelen: o id e a chave do save, das cacadas de
   * bestiario e das entregas de colecao. No mapa 2 ela vem da regra
   * `slime: "zumbi_arbalist"`, entao o registro de abate de quem ja matou
   * o arqueiro zumbi continua valendo
   *
   * ## A FOLHA ANTIGA SAIU DE CIRCULACAO
   *
   * `zumbi_arbalist-sheet.png` era de celula 68 e 17 linhas — 8 de
   * caminhada, 1 de idle e 8 de tiro — e sem animacao de morte. A nova e
   * de celula 88 e 25 linhas, com idle por direcao e a animacao de morte
   *
   * A pasta de origem se chama `nida`, que e o nome da arte e nao da
   * criatura. As duas folhas ficam no disco: a antiga e a folha velha, e
   * somem quando nenhuma layout apontar para elas
   */
  zumbi_arbalist: {
    ...NYLARA_SPRITE,
    src: new URL(
      "../../assets/sprites/nylara-sheet.png",
      import.meta.url,
    ).href,
  },

  /**
   * O GOBLIN DO CAMPO DE PROVAS.
   *
   * ## O ULTIMO OGRE DO MAPA 1
   *
   * Este era o "Ogre da Predeira", o bicho do Campo de Provas — o campo
   * do meio, onde ele aparecia ao lado do esqueleto. O campo tem esqueleto
   * e goblin agora, e o goblin e o MESMO goblin da pedreira: mesma folha,
   * mesmo idle por direcao, mesma animacao de morte
   *
   * ## POR QUE ELE USA `GOBLIN_SPRITE` E NAO O DELE
   *
   * Havia uma folha so para ele, `ogre_da_predeira-sheet.png`, com 17
   * linhas e celula de 68. Ela fica no disco: e a folha antiga, gerada de
   * uma arte que so tem um `idle.gif` e o golpe em 5 das 8 direcoes
   *
   * Se este bicho continuasse com ela, o jogador veria um goblin no
   * Campo de Provas e outro na pedreira, com nomes iguais e caras
   * diferentes — e sem animacao de morte em nenhum dos dois
   *
   * O `id` segue `ogre_da_predeira` no save, nas cacadas de bestiario, na
   * missao do nivel 7 e na entrega do couro `ogre_hide`
   */
  ogre_da_predeira: {
    ...GOBLIN_SPRITE,
    src: new URL(
      "../../assets/sprites/goblin-sheet.png",
      import.meta.url,
    ).href,
  },

/**
   * 8 linhas so: o boneco de madeira tem as oito direcoes e mais
   * nada. Sem golpe, sem idle
   *
   * O caminho e `../../assets` e nao `../assets`: este arquivo vive em
   * `src/data/sprites/`, entao um nivel de `..` aponta para
   * `src/data/`, e `src/data/assets/` nao existe. Com o caminho errado
   * o `new URL` nao falha — ele resolve para uma URL que simplesmente
   * devolve 404 quando o `Image` tenta carregar, e o boneco de treino
   * aparecia invisivel
   */
  dummy_warrior: {
    ...BONECO_MADEIRA_SPRITE,
    src: new URL(
      "../../assets/sprites/boneco_de_madeira-sheet.png",
      import.meta.url,
    ).href,
  },

  /**
   * O HULK, o chefe da arena.
   *
   * A arte de origem e a MESMA pasta do Goblin Saqueador
   * (`src/assets/sprites/hulk`), e a folha e uma saida nova do mesmo
   * material: `hulk-sheet.png`
   *
   * A diferenca que importa e que a folha DO HULK tem a linha de golpe
   * (17 linhas: 8 de caminhada, 1 de idle e 8 de golpe), e a do goblin
   * nao tem — o `goblin_saqueador` esta declarado com `shoot: false`
   * acima. Sao duas folhas do mesmo par de gifs, com numeros de layout
   * diferentes, e e por isso que as duas precisam do proprio `src`
   */
  hulk: {
    ...HULK_SPRITE,
    /**
     * DOIS NIVEIS PARA CIMA, e nao um.
     *
     * Este arquivo mora em `src/data/sprites/`, entao `../assets` cai em
     * `src/data/assets` — que nao existe — e o navegador pedia uma imagem
     * que nunca existiu. O chefe aparecia sem sprite nenhum, e a folha
     * nem chegava a ser copiada para o `dist`
     *
     * `../../assets` e o que leva de volta para `src/assets`, que e onde
     * `hulk-sheet.png` esta. E o mesmo caminho das outras creature
     */
    src: new URL(
      "../../assets/sprites/hulk-sheet.png",
      import.meta.url,
    ).href,
  },
};

export function getEnemySprite(creatureId) {
  return ENEMY_SPRITES[creatureId] ?? null;
}

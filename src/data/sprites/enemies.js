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
  HULK_SPRITE,
  OGRE_PREDEIRA_SPRITE,
  RATO_DA_TOCA_SPRITE,
  SENTINELA_ESQUELETICA_SPRITE,
  LIMO_PREGUICOSO_SPRITE,
  ZUMBI_SPRITE,
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
  // O LIMO NAO USA MAIS `enemies/slime.png`. A arte antiga era uma
  // folha de 32px de tres linhas, e o limo andava sempre de frente
  // para o jogador. Agora sao oito direcoes de 68px (linhas 0 a 7) e uma
  // de idle de verdade (linha 8), sem golpe — ele e PASSIVO.
  //
  // A pasta de origem da arte nova se chama `guerreiro_2`, e
  // `folha("slime")` foi deixado de fora de proposito.
  //
  // Este e o bicho mais comum do jogo e a origem do `slime_gel` e do
  // `slime_core`, que o craft e as missoes pedem. A chave do registro
  // continua `slime` por causa disso
  slime: {
    ...LIMO_PREGUICOSO_SPRITE,
    src: new URL(
      "../../assets/sprites/limo_preguicoso-sheet.png",
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
  skeleton: {
    ...SENTINELA_ESQUELETICA_SPRITE,
    src: new URL(
      "../../assets/sprites/sentinela_esqueletica-sheet.png",
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

  // O `ogre` NAO usa mais `enemies/ogre.png`. Ele e o `ogre` da
  // pedreira, e aparecia no jogo com a arte antiga ao lado do ogre
  // da predeira; os dois passam a usar a folha direcional de 68px.
  // `folha("ogre")` foi entao deixado de fora de proposito
  ogre: {
    ...OGRE_PREDEIRA_SPRITE,
    src: new URL(
      "../../assets/sprites/ogre_da_predeira-sheet.png",
      import.meta.url,
    ).href,
  },

  // os direcionais nao usam a pasta `enemies/`: a folha deles e de
  // oito direcoes, montada pelos gifs da pasta de cada um
  zumbi_arbalist: {
    ...ZUMBI_SPRITE,
    src: new URL(
      "../../assets/sprites/zumbi_arbalist-sheet.png",
      import.meta.url,
    ).href,
  },

  // 17 linhas: 8 de caminhada, 1 de idle e 8 de golpe
  ogre_da_predeira: {
    ...OGRE_PREDEIRA_SPRITE,
    src: new URL(
      "../../assets/sprites/ogre_da_predeira-sheet.png",
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

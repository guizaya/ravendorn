import {
  getMainQuest,
  getSideQuest,
  isAutoCompletable,
  MAIN_QUESTS,
  meetsRarity,
  normalizeRewards,
  QUEST_SCOPE,
  QUEST_TYPE,
  SIDE_QUESTS,
  temDestinoDeAuto,
  TIPOS_DE_TUTORIAL,
} from "../../data/quests/index.js";
import { mapaDaZona } from "../../data/maps/index.js";

/**
 * Um abate conta para esta missao?
 *
 * ## POR QUE O NIVEL E PARTE DA REGRA
 *
 * O `target` sozinho nao distingue os degraus da progressao: o mesmo
 * `slime` nasce no nivel 1 no Pantano e no nivel 6 no Brejo. Uma missao
 * de "matar 5 limos de nivel 1" que contasse qualquer limo seria cumprida
 * no Brejo, e o jogador nunca precisaria descer ao Pantano
 *
 * `minLevel` e um PISO, e nao uma igualdade: a missao aceita o nivel 1 e
 * tudo acima. E assim que o objetivo sobrevive a um mundo que subiu de
 * nivel
 */
function contaPara(quest, typeId, level) {
  if (quest.target !== typeId) return false;

  // sem nivel informado, so o `target`: e o que mantem quem chama sem
  // nivel — o painel e o auto — funcionando como antes
  if (level === undefined || level === null) return true;

  return level >= (quest.minLevel ?? 1);
}

/**
 * O log de missoes: a campanha e a secundaria ativa.
 *
 * ## POR QUE A CAMPANIA E POR MAPA
 *
 * A campanha e uma lista sequencial, e o mapa entra pelo `location` da
 * missao. O painel agrupa por mapa na lateral, e cada mapa tem a sua
 * lista aqui
 */
export class QuestLog {
  constructor() {
    this.mainIndex = 0;
    this.mainProgress = 0;
    this.mainDone = false;

    /**
     * O nivel do jogador, para as missoes de nivel.
     *
     * A missao "Alcance o nivel 5" se compara com ISTE numero, e
     * nao com uma contagem de quantas vezes o jogador subiu de
     * nivel. A diferencia aparece quando ele chega no nivel antes da
     * missao virar a atual
     */
    this.playerLevel = 1;

    this.sideId = null;
    this.sideProgress = 0;
    this.sideCompleted = 0;

    this.autoEnabled = false;
    this.objectiveId = null;

    this.completedSide = new Set();

    /**
     * As recompensas CONCLUIDAS E NAO RESGATADAS.
     *
     * Cada entrada e `{ questId, reward, scope }`, e o `questId` e o
     * que torna o resgate unico: e por ele que o botao [RECEBER]
     * encontra a recompensa, e e por ele que o segundo clique nao
     * paga de novo. Uma missao so entra aqui uma vez, entao a lista
     * nunca tem duas linhas do mesmo `questId`
     */
    this.pending = [];
  }

  get currentMain() {
    if (this.mainDone) return null;

    return getMainQuest(this.mainIndex) ?? null;
  }

  get currentSide() {
    if (!this.sideId) return null;

    return getSideQuest(this.sideId) ?? null;
  }

  get mainProgressValue() {
    return this.mainProgress;
  }

  progressOf(questId) {
    if (questId === this.currentSide?.id) {
      return this.sideProgress;
    }

    if (questId === this.currentMain?.id) {
      return this.mainProgress;
    }

    return 0;
  }

  get currentObjective() {
    const quest =
      getMainQuest(this.mainIndexOf(this.objectiveId)) ??
      getSideQuest(this.objectiveId);

    if (!quest) return null;

    return {
      ...quest,
      progress: this.progressOf(quest.id),
    };
  }

  mainIndexOf(questId) {
    return MAIN_QUESTS.findIndex(
      (quest) => quest.id === questId,
    );
  }

  objective() {
    if (!this.autoEnabled) return null;

    const quest = this.currentObjective;

    if (!quest) return null;

    /**
     * `temDestinoDeAuto` E NAO `isAutoCompletable`, E A DIFERENCA IMPORTANTE
     *
     * Este metodo responde "o auto tem para onde ir?", e nao "o auto fecha
     * isso sozinho?". Uma missao de NPC tem destino e nao tem auto que a
     * conclua: o auto leva ate o mestre e para, e o jogador compra o livro
     * com a mao
     *
     * Com `isAutoCompletable` aqui, o `objective()` devolvia `null` para os
     * sete tutorials, e o `toggleQuestAuto` desligava o auto de novo assim
     * que ele era ligado — o botao "IR ATE O NPC" nao fazia nada
     *
     * O card continua dizendo que a missao e manual: quem monta esse texto
     * e o `autoCompletable` do snapshot, que ainda usa o predicado strict
     */
    if (!temDestinoDeAuto(quest)) return null;

    return quest;
  }

  setAuto(enabled) {
    this.autoEnabled = Boolean(enabled);

    if (this.autoEnabled) {
      this.objectiveId ??= this.currentMain?.id;
    }

    return this.autoEnabled;
  }

  toggleAuto() {
    return this.setAuto(!this.autoEnabled);
  }

  focusQuest(questId) {
    const quest =
      getMainQuest(this.mainIndexOf(questId)) ??
      getSideQuest(questId);

    if (!quest) return false;

    this.objectiveId = questId;

    return true;
  }

  clearObjective() {
    this.objectiveId = null;
  }

  acceptsSide(questId) {
    if (this.sideId) return false;

    return Boolean(getSideQuest(questId));
  }

  acceptSide(questId) {
    if (!this.acceptsSide(questId)) return false;

    this.sideId = questId;
    this.sideProgress = 0;

    return true;
  }

  abandonSide() {
    if (!this.sideId) return false;

    this.sideId = null;
    this.sideProgress = 0;

    return true;
  }

  /**
   * A missao terminou: a recompensa entra na fila de resgate.
   *
   * Ela NAO e paga aqui. O painel mostra [RECEBER] e o pagamento
   * acontece quando o jogador clica, o que muda duas coisas: ele ve
   * o que ganhou antes de receber, e o resgate pode ser conferido
   * contra o que a missao de fato promete
   *
   * O `questId` e obrigatorio de proposito. Sem ele nao haveria como
   * ligar um botao a uma recompensa, e o resgate voltaria a ser
   * "paga tudo que estiver na fila", que e exatamente o que o segundo
   * clique precisa NAO fazer
   */
  complete(reward, scope, questId) {
    if (!questId) return null;

    const entrada = {
      questId,
      scope: scope ?? QUEST_SCOPE.MAIN,
      reward: normalizeRewards(reward),
    };

    const indice = this.pending.findIndex(
      (item) => item.questId === questId,
    );

    // a mesma missao nunca entra duas vezes. Trocar no lugar em vez
    // de empilhar mantem o resgate unico mesmo se um `complete`
    // escapingasse por algum caminho
    if (indice >= 0) {
      this.pending[indice] = entrada;
    } else {
      this.pending.push(entrada);
    }

    return entrada;
  }

  /** Esta missao tem recompensa esperando o clique em [RECEBER]? */
  isClaimable(questId) {
    return this.pending.some((item) => item.questId === questId);
  }

  /**
   * Tira a recompensa da fila e devolve.
   *
   * E o UNICO caminho que paga. `splice` remove a linha do mesmo
   * passo que a devolve, entao o segundo clique do mesmo botao nao
   * encontra mais o que pagar e devolve `null`. E por isso que a
   * protecao contra clique duplo nao precisa de memoria do painel:
   * ela esta no lugar onde o dinheiro sai
   */
  claim(questId) {
    const indice = this.pending.findIndex(
      (item) => item.questId === questId,
    );

    if (indice < 0) return null;

    const [entrada] = this.pending.splice(indice, 1);

    return entrada;
  }

  /** Quantas missoes tem recompensa nao resgatada. */
  get claimableCount() {
    return this.pending.length;
  }

  /** A linha da fila de um `questId`, ou `null`. */
  pendingOf(questId) {
    return (
      this.pending.find((item) => item.questId === questId) ??
      null
    );
  }

  focusNextMain() {
    if (this.mainDone) return false;

    const next = this.currentMain;

    if (!next) return false;

    this.objectiveId = next.id;

    return true;
  }

  advanceMain() {
    const quest = this.currentMain;

    if (!quest) return false;

    if (this.mainProgress < quest.count) {
      return false;
    }

    this.complete(
      quest.rewards,
      QUEST_SCOPE.MAIN,
      quest.id,
    );
    this.mainProgress = 0;
    this.mainIndex += 1;

    if (this.mainIndex >= MAIN_QUESTS.length) {
      this.mainDone = true;

      if (this.objectiveId === quest.id) {
        this.clearObjective();
      }

      if (this.autoEnabled) {
        this.setAuto(false);
      }

      return true;
    }

    if (this.autoEnabled) {
      this.focusNextMain();
    }

    return true;
  }

  advanceSide() {
    const quest = this.currentSide;

    if (!quest) return false;

    if (this.sideProgress < quest.count) {
      return false;
    }

    this.complete(
      quest.rewards,
      QUEST_SCOPE.SIDE,
      quest.id,
    );

    this.completedSide.add(quest.id);
    this.sideCompleted += 1;
    this.sideId = null;
    this.sideProgress = 0;

    return true;
  }

  /**
   * Um abate conta para as missoes de cacada.
   *
   * O `level` e o que separa os degraus: e opcional, e sem ele o
   * comportamento e o de sempre — so o `target`. Ver `contaPara`
   */
  onKill(typeId, amount = 1, level = null) {
    if (amount <= 0) return [];

    const quests = [];

    for (const quest of [
      this.currentMain,
      this.currentSide,
    ]) {
      if (!quest) continue;

      if (
        quest.type !== QUEST_TYPE.HUNT &&
        quest.type !== QUEST_TYPE.KILL
      ) {
        continue;
      }

      if (!contaPara(quest, typeId, level)) continue;

      const isSide = quest.id === this.sideId;

      if (isSide) {
        this.sideProgress = Math.min(
          quest.count,
          this.sideProgress + amount,
        );

        if (this.advanceSide()) {
          quests.push(quest);
        }

        continue;
      }

      this.mainProgress = Math.min(
        quest.count,
        this.mainProgress + amount,
      );

      if (this.advanceMain()) {
        quests.push(quest);
      }
    }

    return quests;
  }

onEquipRarity(rarity) {
      const main = this.currentMain;

      if (
        !main ||
        main.type !== QUEST_TYPE.EQUIP ||
        !meetsRarity(rarity, main.rarity)
      ) {
        return [];
      }

      this.mainProgress = 1;

      if (this.advanceMain()) {
        return [main];
      }

      return [];
    }

    /**
     * UMA ACAO DE TUTORIAL ACONTECEU.
     *
     * E o metodo unico para os seis tutorials, em vez de um `onCraft`,
     * `onEnchant`, `onMine` e mais tres. A razao e que eles tem a MESMA
     * forma: o jogador fez uma coisa, o `target` da missao e o nome
     * daquela coisa, e se casou o progresso sobe
     *
     * ## POR QUE UM SO METODO E NAO SEIS
     *
     * Porque seis metodos que fazem a mesma coisa sao seis lugares para
     * esquecer um. E o esquecimento nao aparece como erro: o metodo que
     * ninguem ligou no motor simplesmente nunca conta, e o jogador fica
     * preso numa missao que ele ja cumpriu. Com um metodo so, o motor tem
     * UM ponto de chamada para os seis tutorials, e ele e o mesmo
     *
     * ## O `alvo` E O QUE FAZ A DIFERENCA ENTRE DOIS TUTORIAIS
     *
     * O `target` da missao e o nome da acao: `craft`, `enchant`, `enhance`,
     * `mine`, `deliver`, `learnSkill`, `buy`, `breakdown`. O jogador que
     * fez `craft` nao cumpre o tutorial de `enhance`, porque so um dos dois
     * esta em foco e so um dos dois casa
     *
     * ## POR QUE ELE AVANÇA SO A MISSÃO EM FOCO
     *
     * Porque a campanha e uma escada, e so uma missao esta em foco. Um
     * jogador que fez `craft` antes de a missao aparecer nao pode ter a
     * missao cumprida retroativamente — o `syncLevel` existe para o
     * `LEVEL`, que e o unico objetivo que faz sentido checar contra o que o
     * jogador JA TEM. Craft nao se guarda, entao nao ha o que conferir
     */
    onAcao(alvo, amount = 1) {
      if (amount <= 0) return [];

      const main = this.currentMain;

      if (!main) return [];

      /**
       * O TIPO TEM DE SER DE TUTORIAL.
       *
       * Sem esta trava, `onAcao("craft")` contaria para uma missao de
       * cacada cujo `target` por acaso fosse a string `"craft"` — e o
       * `contaPara` so compara o `target`, sem olhar o `type`
       */
      if (!TIPOS_DE_TUTORIAL.has(main.type)) return [];

      if (main.target !== alvo) return [];

      /**
       * O `count` DE UM TUTORIAL E SEMPRE 1.
       *
       * "Crie 1 item" e o que se ensina com uma acao. Um tutorial de
       * "crie 3 itens" nao ensina nada novo no segundo e no terceiro, e
       * transforma o primeiro erro — o jogador que errou a receita — em
       * duas repeticoes do mesmo erro
       */
      this.mainProgress = Math.min(
        main.count,
        this.mainProgress + amount,
      );

      if (this.advanceMain()) {
        return [main];
      }

      return [];
    }

  /**
   * Confere a missao de NÍVEL contra o nivel ATUAL do jogador.
   *
   * A missao "Alcance o nivel 5" era contada por EVENTO: so
   * `onLevelUp` a completava. Quem chegou no nivel 5 antes de a
   * missao virar a atual ficava preso nela: o objetivo ja estava
   * cumprido, o painel mostrava 0 de 5, e nada mais disparava. No
   * pior caso e Permanente: se a missao e "Alcance o nivel 10" e o
   * jogador ja esta no maximo, nenhum level-up acontece nunca mais.
   *
   * Aqui o nivel e lido do personagem, entao a missao compara com o
   * que ele TEM, e nao com o que ele deixou de acontecer. O laco
   * importa: quem farmou ate o nivel 12 de uma vez cumpre
   * `nivel_5` e `nivel_10` de uma vez, em vez de ficar preso na
   * primeira ate o proximo level-up.
   *
   * Devolve as missoes concluidas, para o aviso e a recompensa sairem
   * pelo mesmo caminho de sempre.
   */
  syncLevel(level) {
    this.playerLevel = Math.max(1, Math.floor(level ?? 1));

    const concluidas = [];

    // few missoes de nivel no total, entao o laco termina rapido.
    // O `mainDone` e o guarda: sem ele, um `currentMain` nulo
    // entraria aqui e o laco sairia pela lista, nao pela condicao
    for (let passo = 0; passo < MAIN_QUESTS.length; passo += 1) {
      const main = this.currentMain;

      if (!main || main.type !== QUEST_TYPE.LEVEL) break;

      if (this.playerLevel < main.count) break;

      this.mainProgress = main.count;
      this.advanceMain();
      concluidas.push(main);
    }

    return concluidas;
  }

  /** so o nivel que a sessao conhece; usado para o painel */
  get levelConhecido() {
    return this.playerLevel;
  }

  /**
   * Confere o tutorial de HABILIDADE contra o que o jogador JA APRENDEU.
   *
   * ## O PROBLEMA QUE ESTE METODO FECHA
   *
   * O tutorial de skill era contado por EVENTO, pelo `onAcao("learnSkill")`.
   * Quem ja tinha aprendido a habilidade antes de a missao virar a atual
   * ficava preso nela para sempre: o objetivo ja estava cumprido, o painel
   * mostrava 0 de 1, e nada mais disparava. Nao havia `learnSkill`
   * para acontecer de novo
   *
   * E o caso mais provavel do jogo, porque o save guarda
   * `habilidadesAprendidas`: um save antigo, um jogador que voltou, ou
   * um `onAcao` que se perdeu num carregamento. Nos tres casos o tutorial
   * era um no permanente
   *
   * ## POR QUE E UM `sync` E NAO UM EVENTO
   *
   * Porque aqui a pergunta e "o que o jogador JA TEM", e nao "o que
   * aconteceu". A resposta esta no `Set` das habilidades, e ele e
   * consultavel. Uma habilidade aprendida nao se desfaz — o que o
   * `onAcao` contava, e o `sync` confere
   *
   * E o mesmo desenho do `syncLevel`, pelos mesmos dois motivos: o laco
   * termina em uma passada, e o `mainDone` impede que um `currentMain`
   * nulo saia pela lista em vez da condicao
   *
   * ## POR QUE SO `learnSkill` E NAO OS OUTROS TUTORIAIS
   *
   * Porque so este da para conferir contra um estado guardado. Craft nao
   * se guarda — o jogador fez, o item existe, e o item ser devolvido por
   * engano seria outra missao. Enhance tambem nao: o `+1` de uma peca pode
   * ter sido dela, e contar retroativamente seria dar o tutorial de graca
   *
   * Skill e o unico cujo estado e "eu sei isso" — e "eu sei" e permanente
   */
  syncHabilidades(aprendidas) {
    const lista = Array.isArray(aprendidas) ? aprendidas : [];

    if (lista.length === 0) return [];

    const concluidas = [];

    for (let passo = 0; passo < MAIN_QUESTS.length; passo += 1) {
      const main = this.currentMain;

      if (!main || main.type !== QUEST_TYPE.LEARN_SKILL) break;

      /**
       * O `target` DO TUTORIAL E O NOME DA HABILIDADE.
       *
       * O catalogo escreve `target: "learnSkill"`, e nao o id da skill. Entao
       * o cruzamento e por tipo de missao, e nao por `main.target` — e
       * qualquer habilidade aprendida cumpre o tutorial
       *
       * E o que o torna retroativo de verdade: o jogador pode ter aprendido
       * a Quick Shot, e o tutorial falar de habilidade. Ele nao esta aprendendo
       * a habilidade do tutorial; ele ja sabia uma
       */
      if (lista.length < main.count) break;

      this.mainProgress = main.count;
      this.advanceMain();
      concluidas.push(main);
    }

    return concluidas;
  }

  onLevelUp(level) {
    return this.syncLevel(level);
  }

  /**
   * A fila de resgate, do jeito que o painel desenha.
   *
   * Cada linha traz o NOME e o RESUMO junto da recompensa. O painel
   * precisa dos dois para montar o card [RECEBER], e ele nao pode
   * procurar a missao no catalogo: a do jogador pode ser a principal
   * ou a secundaria, e as duas tem nomes diferentes
   */
  claimableSnapshot() {
    return this.pending.map((entrada) => {
      const quest =
        getMainQuest(this.mainIndexOf(entrada.questId)) ??
        getSideQuest(entrada.questId);

      return {
        id: entrada.questId,
        scope: entrada.scope,
        name: quest?.name ?? entrada.questId,
        summary: quest?.summary ?? "",

        /**
         * O MAPA DA MISSAO, e ele faltava.
         *
         * Sem este campo o painel so conseguia separar principal de
         * secundaria: as duas abas do mapa 1 e as duas do mapa 2 entravam
         * na mesma lista. O [RECEBER] de um cartao continuava certo — ele
         * e por `id` — mas o "RECEBER TUDO" da aba nao teria como saber o
         * que pertence a ela, e pagaria as missoes do outro mapa junto
         */
        location: quest?.location ?? null,

        rewards: entrada.reward,
      };
    });
  }

  /**
   * OS IDS RESGATAVEIS DE UMA ABA, e nao as entradas inteiras.
   *
   * ## POR QUE SO O ID
   *
   * Porque quem paga e o `claimQuestReward` do motor, e ele ja sabe
   * encontrar a recompensa pela id. Devolver a entrada inteira aqui seria
   * mandar a recompensa pela rede duas vezes — uma no snapshot e outra no
   * pedido do "receber tudo" — e qualquer divergencia entre as duas copias
   * viraria pagamento errado
   *
   * ## POR QUE UM COPIA E NAO UM `filter` DIRETO
   *
   * Porque o `pending` e a fila do SERVIDOR, e o filtro acontece dos dois
   * lados com dados diferentes: aqui e pelo mapa, e o `claim` do motor
   * confirma que a linha ainda esta na fila. Um `filter` em cima de
   * `this.pending` devolveria referencia viva, e o `claim` mutando a lista
   * durante o laco mostraria linhas puladas
   */
  claimablesDe(scope, mapa) {
    return this.pending
      .filter((entrada) => {
        if (scope && entrada.scope !== scope) return false;

        if (!mapa) return true;

        const quest =
          getMainQuest(this.mainIndexOf(entrada.questId)) ??
          getSideQuest(entrada.questId);

        return mapaDaZona(quest?.location) === mapa;
      })
      .map((entrada) => entrada.questId);
  }

  isSideDone(questId) {
    return this.completedSide.has(questId);
  }

  snapshot() {
    const main = this.currentMain;
    const side = this.currentSide;
    const objective = this.currentObjective;

    return {
      auto: {
        enabled: this.autoEnabled,
        objectiveId: this.objectiveId,
        quest: objective
          ? {
              id: objective.id,
              name: objective.name,
              type: objective.type,
              summary: objective.summary,
              count: objective.count,
              progress: objective.progress,
              target: objective.target ?? null,
              location: objective.location ?? null,
              autoCompletable:
                isAutoCompletable(objective),
            }
          : null,
      },

      /**
       * As recompensas esperando o clique em [RECEBER].
       *
       * A lista e do JOGADOR, nao do catalogo: e o que ele ganhou e
       * ainda nao recebeu. Uma missao ja resgatada nao aparece aqui,
       * e por isso que o segundo clique encontra uma lista vazia em
       * vez de pagar de novo
       */
      claimable: this.claimableSnapshot(),

      main: {
        index: this.mainIndex,
        total: MAIN_QUESTS.length,
        done: this.mainDone,
current: main
            ? {
                id: main.id,
                name: main.nomeCurto ?? main.name,
                nameCompleto: main.name,
                type: main.type,
                summary: main.summary,
                count: main.count,
                progress: this.mainProgress,
                target: main.target ?? null,
location: main.location ?? null,
                  rarity: main.rarity ?? null,

                  /**
                  * O CHEFE, e ele precisa viajar porque o `auto` le este objeto
                  *
                  * O `destinoDoChefe` do motor decide o destino do auto
                  * lendo `objective.chefe` — e este e o mesmo objeto que
                  * atravessa o socket. Sem o campo aqui, o auto receberia uma
                  * missao de chefe sem nada que a identificasse, e cairia no
                  * `getQuestZone`, que devolve `null` para a arena
                  */
                  chefe: main.chefe ?? null,
                  autoCompletable: isAutoCompletable(main),
                rewards: normalizeRewards(main.rewards),

                /**
                 * OS CAMPOS DO TUTORIAL, AQUI TAMBEM.
                 *
                 * Eles foram posto no `steps`, e essa segunda copia e
                 * precisa porque a CAIXA da HUD le o `main.current` — e nao a
                 * lista. Sem estes quatro aqui, o botao da caixa ficava
                 * `disabled` num tutorial: ele decide por `tutorial` e por
                 * `painel`, e os dois chegavam `undefined`
                 */
                tutorial: main.tutorial === true,
                dica: main.dica ?? null,
                painel: main.painel ?? null,
                aba: main.aba ?? null,
                npc: main.npc ?? null,
                icone: main.icone ?? null,
              }
            : null,
steps: MAIN_QUESTS.map((quest, index) => ({
            id: quest.id,
            name: quest.nomeCurto ?? quest.name,
            nameCompleto: quest.name,
            summary: quest.summary,
            type: quest.type,
            count: quest.count,

            /**
             * OS TRES CAMPOS DO TUTORIAL.
             *
             * `tutorial` e a trava que o painel usa para mostrar a dica
             * so nos tutoriais, `dica` e o texto do COMO fazer, e `painel` e
             * a aba que a dica manda abrir
             *
             * Os tres vao no `steps` e nao so no `current` porque a lista
             * lateral mostra o passo futuro com o nome e o resumo: o jogador
             * ve "Aprendendo a criar" na lista antes de chegar nele, e sem
             * a dica ali ele so descobre o que e quando a missao vira atual
             */
            tutorial: quest.tutorial === true,
            dica: quest.dica ?? null,
            painel: quest.painel ?? null,
            aba: quest.aba ?? null,
            npc: quest.npc ?? null,
            icone: quest.icone ?? null,

            /**
             * A ZONA do passo, e por ela que o painel sabe a qual mapa o
             * passo pertence.
           *
           * Sem este campo a aba do mapa 2 nao teria o que mostrar: o
           * painel so recebe os passos, e o `location` e o unico dado
           * do passo que aponta para um mapa — o `id` da missao tem o
           * mapa no texto, mas isso e ler string, e nao dado
           */
          location: quest.location,
          progress:
            index === this.mainIndex
              ? this.mainProgress
              : 0,
          /**
           * `claimable` e um estado do PASSO, e nao da missao: o
           * passo ja foi concluido e a recompensa ainda esta na
           * fila. Sem este campo o painel mostraria o passo como
           * `done`, e o botao [RECEBER] nao teria onde aparecer
           */
          claimable: this.isClaimable(quest.id),
          rewards: normalizeRewards(quest.rewards),
          state:
            index < this.mainIndex
              ? "done"
              : index === this.mainIndex
                ? "active"
                : "locked",
        })),
      },

      side: {
        activeId: this.sideId,
        completed: this.sideCompleted,
        current: side
          ? {
              id: side.id,
              name: side.name,
              summary: side.summary,
              count: side.count,
              progress: this.sideProgress,
              target: side.target,
              location: side.location ?? null,
              rewards: normalizeRewards(side.rewards),
            }
          : null,
        available: SIDE_QUESTS.map((quest) => ({
          id: quest.id,
          name: quest.name,
          summary: quest.summary,
          count: quest.count,
          target: quest.target,
          location: quest.location ?? null,
          done: this.isSideDone(quest.id),
          active: this.sideId === quest.id,
          claimable: this.isClaimable(quest.id),
          rewards: normalizeRewards(quest.rewards),
        })),
      },
    };
  }
}

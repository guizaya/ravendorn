import { createPlayer } from "../entities/Player.js";
import { Inventory } from "../inventory/Inventory.js";
import { Equipment } from "../equipment/Equipment.js";
import { QuestLog } from "../quests/QuestLog.js";
import { Bestiary } from "../bestiary/Bestiary.js";
import { Craft } from "../craft/Craft.js";
import { Collection } from "../collection/Collection.js";
import {
  passLogDoSave,
  premiumLogDoSave,
} from "../pass/passLog.js";
import { PASSE_PADRAO } from "../../data/passes/index.js";
import { AUTO_POCAO_LIMIAR_PADRAO } from "../../data/potions/index.js";
import { estadoInativo } from "../progression/OfflineFarm.js";

/**
 * QUANTOS SLOTS o bau da base tem.
 *
 * ## POR QUE 60, E NAO O MESMO 20 DA MOCHILA
 *
 * Porque o bau e para o que NAO cabe na mochila. Com o mesmo tamanho, o
 * jogador nao teria para onde levar o excesso: ele esbarraria no limite
 * nos dois lugares ao mesmo tempo, e o bau seria um segundo lugar onde a
 * coisa nao cabe
 *
 * Tres vezes a mochila faz o baU ler como "espaco de sobra" e nao como
 * "outra mochila". E 60 continua cabendo em um painel de duas colunas sem
 * a coluna do bau virar uma lista sem fim
 *
 * ## POR QUE FICA AQUI E NAO NO `Inventory`
 *
 * Porque e o bau que e 60. O `INVENTORY_CAPACITY` e a mochila, e mudar o
 * numero la mudaria a mochila junto — que e o lugar onde um numero
 * solto estraga mais coisa
 */
export const BAU_CAPACITY = 60;


/**
 * Tudo o que pertence a UM jogador, e nao ao mundo.
 *
 * No single player o motor guardava inventario, equipamento,
 * missoes, bestiario e craft em `world`, e havia um so jogador.
 * Online isso quebra de dois jeitos: dois jogadores com o mesmo
 * inventario (o loot de um apareceria no do outro) e o estado de
 * um contaminando o do outro.
 *
 * A sessao e esse "por jogador": o servidor cria uma por conexao,
 * joga no `world.players` e o resto do motor le dela em vez de
 * ler do mundo.
 */
export function createPlayerSession(
  classDefinition,
  options = {},
) {
  const {
    spawn = { x: 1200, y: 800 },
    id,
    name,
    input,
    donoKey = null,
    farmOffline = null,
  } = options;

  const player = createPlayer(
    classDefinition,
    spawn,
    { id: id ?? `p_${classDefinition.id}`, name },
  );

const equipment = new Equipment();

/**
 * SEM KIT INICIAL.
 *
 * Havia aqui uma chamada de `darKitDeTeste` que vestia o personagem novo com
 * a primeira peca do catalogo que coubesse em cada slot — sete pecas de
 * graaca, na pior raridade, sem o jogador caçar nada. O proprio bloco se
 * declarava "kit de teste, apague estas duas linhas"
 *
 * Someu com a chamada e com o import. O arquivo `entities/kitDeTeste.js` foi
 * apagado junto, em vez de ficar no projeto desligado: um modulo de teste
 * sem quem o chama parece conteudo, e alguem ia religa-lo achando que era
 * conteudo de verdade
 *
 * ## O QUE AINDA EXISTE PARA O PERSONAGEM NOVO
 *
 * A `createPlayer` acima, que monta o boneco com a classe escolhida, e o
 * `gold`/`steel` do objeto da sessao. Sao os numeros base do personagem, e nao
 * itens: nenhuma peca, nenhum material e nenhum livro entra no inventario de
 * um personagem recem-criado
 *
 * O primeiro item do jogo vem do loot, de um drop ou de uma entrega de
 * colecao — que e o que o `equipment` vazio faz o jogador buscar
 */
const returnObjeto = {
    id: player.id,
    name: player.name,
    classId: classDefinition.id,
    classDefinition,

    /**
     * A chave do PERSONAGEM, estavel entre conexoes.
     *
     * O `id` acima e da sessao e muda a cada entrada — e ele que o
     * mundo usa. Esta chave e quem o jogador e para fins de
     * propriedade: e por ela que o mercado acha o dono de um anuncio
     * depois que ele saiu, e que o pagamento de uma venda offline
     * encontra a sessao nova quando ele volta. No single player fica
     * `null`, porque ninguem sai do jogo e nao ha a quem pagar depois
     */
    donoKey,

    // a entidade que anda, leva dano e aparece no snapshot
    player,

    // o estado privado deste jogador
inventory: new Inventory(),

    equipment,
    quests: new QuestLog(),
    bestiary: new Bestiary(),
    craft: new Craft(),

    /**
     * A GUILDA deste jogador, e so o que E DELE.
     *
     * `pontos` e `ultimoPontoEm` moram aqui, e nao no `GuildStore`, por
     * um motivo que ja custaria horas de espera de alguem: sao estado
     * POR JOGADOR. Se estivessem no store e a sessao fosse recriada ao
     * reconectar, os pontos voltariam a zero e o jogador que passou
     * a noite offline para juntar 24 voltaria com zero
     *
     * `ultimoPontoEm` e o que faz o accrue offline funcionar sem
     * ninguem de guarda: e o relogio, e nao um contador que alguem
     * incrementa. Guardar QUANDO foi o ultimo ponto, e nao QUANTOS
     * tem, e o que faz o tempo com o jogo fechado contar
     */
    guilda: {
      pontos: options.pontos ?? 0,
      ultimoPontoEm: options.ultimoPontoEm ?? null,
    },

    /**
     * O FARM OFFLINE deste jogador.
     *
     * ## O MESMO DESENHO DA GUILDA, E DE PROPOSITO
     *
     * `ultimoEm` e um RELOGIO, nao um contador. E o que faz o accrue
     * funcionar sem ninguem de guarda: o servidor nao roda nenhum timer
     * enquanto o jogador esta fora, ele so compara as duas horas quando
     * o jogador volta a entrar. Guardar QUANDO o farm comecou, e nao
     * QUANTO rendeu, e o que faz o tempo com o jogo fechado contar
     *
     * ## POR QUE FICA NA SESSAO E NAO NO `GameServer`
     *
     * Pelo mesmo motivo da guilda, e com o mesmo custo: a sessao e
     * destruida no `removePlayer` a cada desconexao. Se o estado vivesse
     * no servidor, o jogador que iniciasse o farm e fechasse o jogo
     * voltaria com o farm ligado e o relogio reiniciado a cada entrada
     *
     * ## E POR QUE `relatorio` FICA AQUI
     *
     * Porque ele e o que o jogador ainda nao viu. O accrue acontece antes
     * do primeiro pacote, o modal so aparece depois, e entre um e outro o
     * relatorio tem de sobreviver em algum lugar. A sessao e esse lugar:
     * ela viaja no painel, e some quando o jogador confirma que viu
     */
    farmOffline: farmOffline ?? estadoInativo(options.mapId ?? null),

    /**
     * A COLECAO: as entregas.
     *
     * Vive aqui, e nao no `GameEngine`, pelo mesmo motivo de todo o
     * resto desta lista: e estado privado. Duas sessoes compartilhando
     * o mesmo `Collection` fariam uma entrega de um jogador fechar a
     * colecao do outro
     */
    collection: new Collection(),

    /**
     * O PASSE: os resgates e se o premium esta ligado.
     *
     * ## POR QUE FICA AQUI E NAO NO `GameEngine`
     *
     * Pelo mesmo motivo de todo o resto desta lista: e estado privado. Duas
     * sessoes com o mesmo objeto compartilhado fariam o resgate de um jogador
     * marcar o dia como pego no passe do outro
     *
     * ## POR QUE `resgatados` E UM OBJETO COMUM E NAO UMA CLASSE
     *
     * Porque nao ha regra alem de "adicionar um dia" e "perguntar se o dia
     * esta la" — e `src/game/pass/passLog.js` ja tem as duas. Uma classe aqui
     * seria um embrulho em volta de `Array.includes` que ainda teria de ser
     * ensinado a se gravar e se ler do JSON de gra
     *
     * ## E POR QUE O PREMIUM EH PARTE DO MESMO BLOCO
     *
     * Porque `premium` responde a pergunta "os dias premium podem ser
     * resgatados", e o resgate usa a MESMA resposta do painel: se o painel
     * desenhasse "Resgatar" num dia premium com o interruptor desligado, o
     * servidor recusaria o clique e o jogador veria o botao morrer na mao
     * dele. Os dois precisam ler o mesmo lugar, entao moram juntos
     */
passe: {
    /**
     * O PREMIUM E POR PASSE, e nao um booleano da sessao.
     *
     * Era `premium: options.passePremium ?? false` — um campo so, e valia
     * para os tres passes do jogo. Pagar os dias pagos da Praga abria tambem
     * os da Cripta e os do Arsenal de graca
     *
     * `options.passePremium` continua aceito porque e o nome que o save usa,
     * e um save antigo tem `premium: true` la. Ele vira `{ praga: true }`:
     * o passe padrao e o que o jogador tem na ma quando abre o painel pela
     * primeira vez, entao e a leitura menos enganosa de um save que nao
     * sabia a qual passe o premium pertencia
     */
    premium: premiumLogDoSave(
      options.passePremiumPorPasse ??
        (options.passePremium ? { [PASSE_PADRAO.id]: true } : null),
    ),
    resgatados: passLogDoSave(options.passeResgatados),
    },

    /**
     * O BAU DA BASE: o que o jogador deixou guardado.
     *
     * ## POR QUE UM `Inventory` E NAO UM ARRAY DE PILHAS
     *
     * Porque o baU e uma SEGUNDA MOCHILA, e ele precisa das mesmas tres
     * coisas que a primeira tem: contar slots, recusar o que nao cabe e
     * dizer o que sobrou. Reimplementar as tres em um array proprio
     * seria a terceira versao da mesma regra neste arquivo — o
     * `Collection` e o `Craft` ja fazem o que sabem, e o `Inventory` faz
     * tudo isso
     *
     * E o `overflow` que salva a operacao: um deposito que estoura o bau
     * devolve a peca pela `mochila.cabe`, e o painel mostra "guardou 3 de
     * 5" em vez de sumir com o que nao coube
     *
     * ## POR QUE O `coins` FICAM AQUI E NAO SAO USADOS
     *
     * Porque o `Inventory` sempre teve moedas, e o bau e um inventario.
     * Guardar ouro no bau e uma feature que precisa de decisao — se o
     * ouro sobrevive a um servidor trocar, se duas sessoes do mesmo
     * personagem dividem a mesma moeda. Ate essa decisao existir, o
     * `bauSnapshot` NAO manda `coins`, e o painel nao mostra lugar nenhum
     * para depositar moeda
     *
     * ## POR QUE VIVE NA SESSAO E NAO NUM STORE
     *
     * Porque o bau e POR PERSONAGEM, e a sessao e o que o save do
     * personagem le e escreve. O cofre de guilda precisou de um store
     * porque e COMPARTILHADO entre jogadores; o bau nao tem com quem
     * compartilhar, entao um store seria estado global sem nenhum
     * consumidor
     */
    bau: new Inventory(BAU_CAPACITY),

    // a ultima intencao recebida do cliente. e o que o motor
    // consome no tick: o cliente manda para ONDE quer ir, nunca
    // a posicao final
    intent: {
      seq: 0,
      moveX: 0,
      moveY: 0,
      aimX: 0,
      aimY: 0,
    },

    // o teclado e o mouse tambem sao por jogador. no navegador so
    // existe um, e ele e o jogador local; no servidor cada um
    // recebe a intencao que mandou. se o input ficasse no motor,
    // o segundo jogador andaria junto com o primeiro
    input: input ?? {
      keys: new Set(),
      pointer: {
        x: classDefinition.stats.range + 100,
        y: 0,
        inside: false,
      },
    },

    // alvo escolhido, cacada e o modo automatico tambem sao por
    // jogador. o motor le e escreve estes campos atraves de
    // acessorios que apontam para a sessao em foco, entao eles
    // PRECISAM existir aqui.
    //
    // `engagedTargetId` e o que faz o personagem andar ate o alvo
    // depois de um clique. Sem ele no servidor, o ataque saia sem
    // ninguem chegar perto e o golpe nao conectava.
    selectedTargetId: null,
    engagedTargetId: null,
    autoPlay: false,
    bestiaryTargetType: null,

    // quais skills deste jogador foram arrastadas para baixo.
    // fica NA sessao, e nao num `Map` de modulo: no servidor um
    // `Map` de modulo e compartilhado por todos, e arrastar uma
    // skill na Ana ligava o automatico dela no Bento tambem
    skillAuto: new Set(),

    /**
     * AS HABILIDADES QUE ESTE JOGADOR APRENDEU.
     *
     * Nasce VAZIO, e essa e a mudanca de regra: o personagem comeca sem
     * nenhuma habilidade. Quem ensina e o livro, comprado com o Mestre de
     * Habilidades — nao o nivel
     *
     * E um `Set` pelo mesmo motivo do `skillAuto` acima: no servidor um
     * `Set` de modulo seria compartilhado por todos, e a Ana aprender
     * uma skill ligaria a do Bento tambem
     *
     * Guarda o ID da skill (`"arbalist_quick_shot"`), e nao o slot: o
     * slot e a posicao no array da classe e muda se a ordem do catalogo
     * mudar, e um save antigo apontaria para a habilidade errada
     *
     * A ULTIMATE NAO ENTRA AQUI. Ela e liberada pelo nivel 6, e nao por
     * livro — ver `ULTIMATE_NIVEL` em `src/data/skills/index.js`
     */
    habilidadesAprendidas: new Set(),

  /**
   * OS PRODUTOS DA LOJA QUE ESTE JOGADOR JA COMPROU.
   *
   * ## POR QUE FICA NA SESSAO E NAO NA TELHA
   *
   * Porque um `Set` na tela se perde no F5. O card desativava, o jogador
   * recarregava, e o pacote voltava a ficar compravel — e ele podia pagar
   * duas vezes pelo mesmo bau sem nunca ter visto o primeiro
   *
   * E o servidor quem escreve: o `comprarProduto` marca aqui, e o card le
   * o que veio no snapshot. Nenhum dos dois lados guarda a resposta
   *
   * ## POR QUE UM PRODUTO COMPRADO NAO VOLTA
   *
   * Porque todo produto da loja e um CONJUNTO fechado — bau, pacote,
   * moeda. Nao ha "comprar de novo" que faça sentido: o bau ja esta na
   * mochila, e o ouro ja esta no saldo
   */
  lojaComprados: new Set(),

    /**
     * O USO AUTOMATICO DA POCAO DE CURA.
     *
     * Nasce DESLIGADO, e isso e regra e nao esquecimento: beber sozinho
     * tira do jogador a decisao de quando gastar um item, e o jogo nao
     * pode decidir isso por ele antes de ele pedir
     *
     * ## `itemId` E NAO `uid`
     *
     * Porque a pilha da pocao muda de `uid` toda vez que o jogador muda de
     * mapa, deposita no bau ou pega de volta. Guardar o `uid` faria o
     * automatico quebrar sozinho: o jogador deixava o bao com a pocao
     * equipada, voltava, e a flag apontava para uma pilha que nao existia
     * mais. O `itemId` sobrevive a isso, e o `uid` e resolvido na hora de
     * beber pelo `findStack`
     *
     * ## `limiar` E PORCENTAGEM, E NAO HP
     *
     * Porque o `maxHp` muda com nivel, com equipamento e com pocao de
     * recurso. Um limiar guardado em HP absoluto deixaria de valer sozinho
     * na metade da carreira, e o jogador teria de mexer nele de novo sem
     * nenhuma mudanca no jogo
     */
autoPocao: {
        ligado: false,
        limiar: AUTO_POCAO_LIMIAR_PADRAO,
        itemId: null,
      },

      /**
       * O RELOGIO DO DASH, e nao um contador.
       *
       * E um instante ABSOLUTO do `world.time`, e nao "faltam 3 segundos".
       * Um contador decrementado por quadro erra a cada travamento do
       * servidor: com o tick atrasado, o contador cairia mais devagar e o
       * jogador ganharia tempo de recarga de graca
       *
       * E o mesmo relogio do resto do estado privado, entao o icone da HUD e
       * o `useDash` do motor leem o mesmo numero e nunca discordam
       *
       * Vive na sessao e nao no jogador porque o cooldown e do CONTROLE, e
       * nao do boneco: trocar de mapa nao recarrega o dash
       */
      dashAte: 0,

    // o caminho que o auto esta percorrendo
    autoWaypoint: null,
    autoMoveDirection: null,
    autoFacing: null,
    autoDecisionTimer: 0,
    autoLeashRange: 1500,

    /**
     * A VIAGEM: a fila de etapas para chegar no objetivo.
     *
     * ## POR QUE NAO CABE EM `autoWaypoint`
     *
     * `autoWaypoint` e um PONTO, e e reescrito a cada 0.25s pelo
     * `autoPlayTarget`. Um destino em outro mapa nao cabe nele por dois
     * motivos independentes:
     *
     * 1. `setMap` ZERA o campo (`GameEngine.setMap`), e trocar de mapa e
     *    justamente o meio da viagem. O plano precisaria sobreviver ao
     *    `setMap` que ele proprio provocou;
     * 2. o ponto e resolvido no mapa em que o jogador ESTA. Apos
     *    atravessar o portal, a mesma linha de codigo continuaria
     *    apontando para a coordenada antiga, agora em outro mapa
     *
     * ## O FORMATO
     *
     * Cada etapa e `{ mapId, x, y, portalId, caminho }`:
     *
     * - `mapId` — o mapa em que a etapa acontece. E o que permite
     *   perceber que o plano ficou velho;
     * - `x`/`y` — o ponto a alcancar nesta etapa: o portal a atravessar,
     *   ou o destino final;
     * - `portalId` — o portal a atravessar ao chegar. `null` na ultima
     *   etapa, que e a unica que termina numa zona em vez de noutro mapa;
     * - `caminho` — os pontos do A* ate `x`/`y`, ja simplificados. Vem
     *   preenchido na hora de comecar a etapa e vai sendo consumido
     *
     * Vive na sessao pelo mesmo motivo do resto: no servidor dois
     * jogadores com planos diferentes nao podem compartilhar um campo
     */
    travelPlan: [],

    /**
     * DE ONDE O JOGADOR VEIO PARA O MAPA DE TESTE, ou `null`.
     *
     * O botao da HUD e um `op` so, e o servidor decide o sentido pelo
     * mapa em que o jogador esta. Para isso ele precisa saber qual era o
     * mapa e a posicao ANTES da primeira troca — e e isto que guarda
     *
     * O `arenaOrigem` e o mesmo campo para a arena, e nao foi declarado
     * em nenhum lugar: ele aparecia como propriedade solta, o que faz um
     * erro de digitacao criar um segundo campo em vez de tocar este
     *
     * Vive na sessao e nao no motor pelo mesmo motivo do `travelPlan`:
     * no servidor dois jogadores com origens diferentes nao podem
     * compartilhar um campo
     */
    mapaTesteOrigem: null,

    /**
     * A PEDIDA EM QUE O JOGADOR ESTA ENCOSTADO, ou `null`.
     *
     * ## O QUE FICA AQUI E O QUE FICA NO MUNDO
     *
     * Aqui nesta sessao: para ONDE o jogador esta indo, o que ainda falta
     * e quando da a proxima batida. Um campo so, e o servidor e o unico
     * que escreve nele
     *
     * No mundo, no `GameServer`: QUANTAS batidas a PEDIDA tem, e ate que
     * hora ela volta. A pedida e do mapa, nao do jogador — dois jogadores
     * na mesma pedra veem o mesmo numero de batidas, senao a segunda
     * pessoa a minerar veria o painel mentindo
     *
     * ## POR QUE `null` E NAO UM OBJETO VAZIO
     *
     * Porque `null` e o estado de nao estar minerando, e o painel inteiro
     * gira em torno disso. Com um objeto vazio, `mineracao.batidasRestantes`
     * seria 0 e o painel abriria mostrando "0 batidas" para quem nao
     * esta minerando nada
     *
     * ## POR QUE O TEMPO E ABSOLUTO E NAO UM CONTADOR
     *
     * `proximoGolpeEm` e um relogio, nao um "faltam 8". O servidor roda a
     * 20 Hz e o painel chega a 4 Hz: se o estado fosse um contador
     * descontado no tick, o cliente mostraria um numero que so muda a
     * cada 250ms, com tres quartos de segundo parado entre um numero e o
     * seguinte. Guardando o instante, o painel calcula o que falta a
     * partir do relogio dele e anda sozinho
     */
    mineracao: null,

    /**
     * O CAMINHO QUE O MOTOR JA CALCOU PARA ENCOSTAR NA PEDIDA.
     *
     * Vive ao lado do `cacadaCaminho` e pelo mesmo motivo: e um caminho
     * caro de se refazer, e o A* de 40px sobre o campo inteiro levava o
     * jogador a recalcular a cada 0.5s enquanto ele atravessava o vale. A
     * diferenca e que este caminho e CONSUMIDO com `shift()`, igual ao do
     * `travelPlan`: ele descreve uma ida, e no fim dele o jogador esta
     * encostado
     */
    mineracaoCaminho: [],
    mineracaoRecalcula: 0,

    /**
     * A MENOR DISTANCIA A PEDIDA QUE O JOGADOR JA ALCANCOU, e ha quanto
     * tempo ele nao melhora esse numero.
     *
     * E o que mede AVANCO na caminhada, e nao tempo de mineracao. Um
     * jogador esbarrado num espaco estreito entre duas pedras nao ganha
     * distancia e nao ganha batida: ele simplesmente empurra. Sem estes dois
     * campos o pedido ficaria aberto com a locomocao travada, e o sintoma
     * visivel e o boneco tremendo contra a rocha
     *
     * `Infinity` e "ainda nao andou nada", e e o estado de partida
     */
    mineracaoMelhor: Infinity,
    mineracaoTravado: 0,

    /**
     * O `random` DA MINERACAO, e o que a ultima batida rendeu.
     *
     * O `random` e um `createRandom` criado pelo servidor no instante em
     * que o jogador encostou na pedra. Fica na sessao porque e o HISTORICO
     * daquela pedra: trocar o sorteio no meio da mineracao faria a mesma
     * pedra render duas vezes sem que o jogador pudesse notar
     *
     * Os dois ultimos sao o que o painel usa para piscar o numero do steel
     * na hora da batida. Eles sao ZERADOS a cada tique pelo servidor, e
     * por isso o painel so mostra o ganho quando o tique em que ele
     * chegou era o tique da batida
     */
    mineracaoRandom: null,
    mineracaoSteelNoTique: 0,
    mineracaoSteelEm: 0,

    /**
     * O JOGADOR QUE ESTE ESTA SEGUINDO, ou `null`.
     *
     * E um id de SESSAO, e nao uma posicao: o seguido anda, e o plano
     * precisa ser refeito a cada vez que ele muda de lugar. Guardar a
     * coordenada faria o seguidor ir para o ponto onde ele estava e
     * parar la
     *
     * Vive na sessao como o `travelPlan`, pelo mesmo motivo: dois
     * jogadores podem estar seguindo gente diferente ao mesmo tempo
     */
    seguindoId: null,

    /**
     * O TEMPO ate o plano ser refeito enquanto se segue.
     *
     * O seguido se mexe varias vezes por segundo, e refazer o A* a cada
     * quadro custaria um BFS e uma montagem de plano por quadro. Como o
     * plano tambem tem de se atualizar logo apos uma travessia de portal,
     * este e o piso: enquanto ele nao vence, o plano segue válido
     */
    seguindoRelogio: 0,

    /**
     * O SEGUIR LIGOU O AUTO, e nao o jogador.
     *
     * Sem este flag o `pararDeSeguir` desligaria um Auto que o jogador
     * tinha ligado antes de pedir para seguir, e ele voltaria do
     * primeiro passo para a cacada que tinha montado
     */
    seguindoAuto: false,

    /**
     * CHEGOU DO LADO E ESTA PARADO.
     *
     * Differe de "nao esta seguindo": o acompanhamento acabou, mas o
     * piloto fica suspenso para o personagem NAO voltar a cacar o que
     * esta em volta. E o que faz o pedido "seguir e ao chegar ficar
     * parado no ponto final"
     *
     * Some quando o jogador aperta T ou liga a cacada de novo
     */
    seguindoParado: false,

    /**
     * O MAPA DESTE JOGADOR.
     *
     * E o que impede todo mundo de atravessar o portal junto. O mapa e
     * um campo do MOTOR — `world.map`, `world.enemies`, `world.collision`
     * — e nao da sessao, entao sem este campo o `setMap` de um jogador
     * trocava o mapa de todo mundo: o outro recebia o snapshot com o id
     * novo e o cliente dele desenhava o outro mapa
     *
     * Vive na sessao porque e o unico lugar que o motor nao troca
     */
    mapId: null,

    /**
     * FOCAR O MESMO INIMIGO DO LIDER.
     *
     * Quando ligado, o Auto deste jogador nao escolhe alvo proprio: ele
     * ataca o que o lider esta batendo. E quando o lider nao esta
     * batendo em ninguem, este tambem nao bate — que e o pedido, e o
     * oposto de "cada um caça o mob mais perto"
     *
     * Vive na sessao porque e uma ESCOLHA do jogador, e nao uma regra
     * do grupo: o lider nao precisa disso para ele mesmo, e cada
     * membro liga e desliga na sua hora
     */
    focarLider: false,

    /**
     * O TEMPO que o jogador passou parado durante a viagem.
     *
     * O plano pode ficar velho sem ninguem tocar nele: um inimigo empurra
     * o jogador, o `shoveEnemiesOffPlayer` resolve, ou o alvo sai do
     * caminho no meio da etapa. Quando isso empurra o boneco para tras
     * do ultimo ponto do A*, o piloto ficaria andando para um ponto que
     * ele ja passou
     *
     * E o contador que faz o motor replanejar. Acima de um limite, o
     * passo e refeito do zero e o numero volta a zero
     */
    travelParado: 0,

    /**
     * O CAMINHO de perseguicao, e ha quanto tempo ele foi calculado.
     *
     * ## A MESMA COISA QUE A VIAGEM, SO QUE PARA UM ALVO QUE ANDA
     *
     * O `approachTarget` apontava direto para o alvo e andava em linha
     * reta. Com uma arvore no meio, o boneco empurrava contra o tronco e
     * nunca chegava na distancia de tiro — o arqueiro (alcance 550) ficava
     * olhando um limo a 800px sem disparar uma flecha so
     *
     * ## POR QUE FICA NA SESSAO E POR QUE TEM RELOGIO
     *
     * Na sessao pelo mesmo motivo do resto: no servidor dois jogadores
     * perseguindo alvos diferentes nao podem compartilhar um caminho
     *
     * E o `cacadaRelogio` porque o alvo ANDA. Um caminho calculado uma
     * vez so serve enquanto o alvo nao se moveu; recalcular a cada quadro
     * custaria ate 80ms de A* por quadro por jogador
     */
    cacadaCaminho: null,
    cacadaRelogio: 0,

    /**
     * O aviso de tela ("+16 moedas", "missao concluida").
     *
     * Era um campo do MOTOR, e por isso TODO mundo connected via a
     * receber no painel: quando a Ana matava um slime, o "+16 moedas"
     * aparecia na tela do Bento tambem, e parecia que a recompensa
     * tinha ido para os dois. O premio em si ja era do dono (o
     * `lastHitBy` decide); o que vazava era o AVISO.
     *
     * O aviso e por sessao pelo mesmo motivo do resto: e informacao
     * privada de quem ganhou.
     */
    /**
     * O filtro de coleta DESTE jogador.
     *
     * `null` e o estado inicial, que e "pega tudo". Antes o filtro
     * vivia no MOTOR, entao um so filtro valia para o mundo inteiro:
     * o jogador que ajustasse o dele mudava o loot de todo mundo no
     * mesmo mapa, e online o ajuste nao valia nem para si, porque o
     * loot e decidido no servidor.
     */
    lootFilter: null,

    /**
     * O RESULTADO DA BUSCA DE GUILDA deste jogador.
     *
     * ## POR QUE VIVE AQUI, E NAO NO MOTOR
     *
     * Era `this.searchResults`, um campo do MOTOR: a busca da Ana
     * aparecia na aba Buscar do Bento, que nem tinha digitado nada. No
     * servidor o motor e compartilhado por todo mundo conectado, entao
     * um campo dele e a ultima busca que alguem fez — e nao a do dono da
     * sessao que esta recebendo aquele painel
     *
     * E o mesmo motivo do resto desta sessao: a lista e privada do
     * jogador, e dois jogadores buscando guilda ao mesmo tempo nao
     * podem compartilhar um campo
     *
     * ## COMECA VAZIA DE PROPOSITO
     *
     * A aba Buscar e a mais importante para quem ainda nao tem guilda, e
     * ela abre mostrando a lista. O termo vai no pedido, nao aqui: o que
     * mora na sessao e o RESULTADO
     */
    guildaBusca: [],

    /**
     * A MORTE, e o PRAZO para escolher.
     *
     * ## POR QUE ISTO EXISTE
     *
     * O painel da morte (o `DeathPanel`) le UM campo so, `morte.morto`,
     * e o servidor manda esse campo no painel a cada pacote. Ele nunca
     * existiu: o componente esta no disco e o HUD o renderiza, mas o
     * motor nao produzia o estado — entao o painel vivia fechado, sem
     * erro nenhum, que e a pior forma de sumir
     *
     * ## POR QUE VIVE NA SESSAO E NAO NO MOTOR
     *
     * Pelos mesmos motivos de `lootFilter` e `message`: sao estado
     * PRIVADO. No servidor dois jogadores podem estar mortos ao mesmo
     * tempo, cada um com o proprio relogio correndo. Um campo do motor
     * faria o prazo de um cair para o outro, e um deles seria puxado de
     * volta a base enquanto ainda lia o preco da outra saida
     *
     * `restante` e o relogio em SEGUNDOS, e o motor e quem decrementa.
     * O painel so exibe: um cliente que calculasse o prazo mostraria 5s
     * com os botoes liberados enquanto o servidor ja estava voltando o
     * jogador para a base
     */
    morte: {
      ativo: false,
      restante: 0,
    },

message: null,
    messageRemaining: 0,
    messageTick: null,
    };

  /**
   * A MOCHILA APONTA PARA O `Equipment` DESTA SESSAO.
   *
   * ## O QUE ISSO CONSERTA
   *
   * A tela mostrava `7/20` e o loot nao entrava, com o aviso de "mochila
   * cheia". Duas contagens do mesmo numero discordavam:
   *
   * - o `summary` da HUD desconta o que esta VESTIDO, e por isso via 7
   * - o `cabe`, que decide se o drop entra, usava `stacks.length` CRU — que
   *   inclui o vestido — e via zero espaco
   *
   * O `cabe` nao tem parametro para receber o `equipment`, entao ele nao
   * tinha como saber o que estava vestido. A referencia e o que fecha isso:
   * a partir daqui as DUAS contagens leem a mesma pilha de vests
   *
   * ## E POR QUE UM `return` ANTES, E NAO NO CONSTRUTOR
   *
   * Porque os dois se referenciam: o `inventory` e criado com `new` dentro do
   * objeto de sessao e nao existe antes dele. O `equipment` ja existia, e o
   * `new Inventory()` acontece na mesma expressao — nao ha linha entre os
   * dois onde um `usarEquipment` caberia
   */
  const sessao = returnObjeto;

  sessao.inventory.usarEquipment(sessao.equipment);

  return sessao;
}

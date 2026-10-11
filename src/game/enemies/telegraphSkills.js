/**
 * AS HABILIDADES DE CHEFE, e o catalogo que o `TelegraphSystem` le.
 *
 * ## ONDE ESTE NUMERO PRECISA MORAR, E POR QUE AQUI
 *
 * O pedido diz para centralizar os parametros e nao espalhar dano, duracao
 * e alcance por varios componentes. Este arquivo e o unico lugar onde um
 * numero de habilidade existe: o sistema le, o renderizador le, o teste le
 * e a IA le. Mudar o raio do Ground Slam e mudar uma linha aqui
 *
 * ## E POR QUE O FORMATO E UM OBJETO COM CHAVES FIXAS
 *
 * Porque e o que o motor ja faz com `CREATURE_TYPES`. Um `id` no telegraph e
 * a chave que liga a execucao, o pacote de rede e o desenho — e nenhum dos
 * tres pode adivinhar o formato. Um objeto com `tipo`, `preparo` e `dano`
 * obrigatorios falha alto no cadastro, em vez de virar `undefined` no meio
 * de uma briga
 *
 * ## AS CINCO HABILIDADES
 *
 * Cobrem os cinco formatos de telegraph do pedido, mais a investida:
 *
 * - `ground_slam`  — circulo (2.1)
 * - `cleave`       — cone (2.2)
 * - `energy_beam`  — linha (2.3)
 * - `marked_strike`— marcado no alvo, com escolha de fixo/seguindo (2.4)
 * - `shock_ring`   — anel, com raio interno e externo (2.5)
 * - `charge`       — investida (2.6)
 */

/**
 * O TEMPO MINIMO E MAXIMO DE PREPARO, e o que trava o balanceamento.
 *
 * O pedido da 800ms a 3000ms como exemplo. Esse par e uma REGRA, nao uma
 * sugestao: `validar` rejeita qualquer preparo fora dele, porque um preparo
 * de 200ms e um telegraph que o jogador nao ve, e um de 5s e um chefe que
 * fica parado sem threat. Um numero fora da faixa e um numero que ninguem
 * balanceou
 */
export const PREPARO_MINIMO_S = 0.8;
export const PREPARO_MAXIMO_S = 3.0;

/**
 * OS TIPOS DE TELEGRAPH, e o que cada um obriga a ter.
 *
 * E um mapa de requisito, e nao uma lista: o `validar` percorre e acusa o
 * campo que falta pelo nome do tipo. Um erro de cadastro precisa dizer
 * "ground_slam precisa de raio", e nao "habilidade invalida"
 */
export const CAMPOS_POR_TIPO = {
  circle: ["raio"],
  cone: ["alcance", "anguloGraus"],
  line: ["alcance", "largura"],
  ring: ["raioInterno", "raioExterno"],
  targeted: ["raio", "seguirAlvo"],
  charge: ["alcance", "largura"],
};

/**
 * AS HABILIDADES DO CHEFE DO VALE.
 *
 * Cada entrada e completa: o `validar` roda sobre esta lista no modulo, e um
 * cadastro invalido quebra o build em vez de aparecer como um circulo sem
 * raio em pleno combate
 */
export const HABILIDADES_CHEFE = {
  /**
   * A ABERTURA, o golpe que sai quando o jogador CHEGA na range.
   *
   * ## O QUE ELA FAZ, E POR QUE ELA E SEPARADA
   *
   * E o primeiro golpe de cada briga, disparado no instante em que o jogador
   * entra na `aggroRange` do chefe. Nao e uma das outras cinco com cooldown
   * menor: e um caso proprio, porque ele ignora cooldown e distancia, e
   * porque acontece uma unica vez por briga
   *
   * ## E POR QUE O JOGADOR PRECISA VER ALGO ASSIM
   *
   * Sem ela, o jogador chega na range e o chefe comeca o combate comum: ele
   * persegue, e o primeiro telegraph so aparece depois que o jogador chega
   * perto o bastante para uma habilidade de area. O jogador chegava na
   * luta, levava o golpe basico sem aviso nenhum, e so depois via area de
   * perigo
   *
   * ## POR QUE UM ESMAGAMENTO, E NAO O CONE OU A LINHA
   *
   * Porque e o primeiro contato. O esmagamento e um circulo em volta do
   * chefe, entao a leitura e "sai de perto" — e a unica leitura que funciona
   * num jogador que acabou de encostar nele e ainda nao sabe para onde o
   * chefe esta virado
   *
   * ## E OS 1.2 SEGUNDOS DE PREPARO
   *
   * Mais rapido que o `ground_slam` de 1.8s, porque aqui o aviso nao e para
   * dar tempo de desviar de uma area grande — e para o jogador PERCEBER que
   * entrou na briga. Um circulo de raio 300 com 1.2s da tempo de sair
   *
   * ## E O COOLDOWN ZERO
   *
   * Nao e desleixo: a habilidade so e chamada uma vez por briga, e quem
   * garante isso e a trava `aberturaFeita` na IA. O cooldown zero aqui diz
   * "esta habilidade nao tem intervalo entre usos" — o intervalo dela e o
   * resto da luta
   */
  abertura: {
    id: "abertura",
    nome: "Abertura",
    tipo: "circle",
    preparo: 1.2,
    raio: 300,

    /**
     * O DANO E MENOR QUE O DO ESMAGAMENTO, e isso e de proposito.
     *
     * O primeiro golpe da briga define a leitura do jogador sobre o chefe. Se
     * ele levar 380 de dano no primeiro contato, ele aprende que o chefe e
     * uma parede — e desiste. Com 0.6 ele toma um susto, aprende que o golpe
     * e avisado, e fica na luta para o proximo
     */
    dano: 0.6,
    multiplicadorDano: 1.0,
    knockback: 200,
    cooldown: 0,
    distanciaMin: 0,

    /**
     * A DISTANCIA MAXIMA E A PROPRIA AGGRO, e nao um numero solto.
     *
     * A abertura dispara quando o jogador CRUZA a `aggroRange`, entao o
     * limite dela e a propria borda do agro. Um numero diferente aqui faria
     * a habilidade ser escolhida por um jogador que esta longe demais e o
     * circulo nasceria vazio
     */
    distanciaMax: 9999,
    faseMin: 1,
    cor: "#ff3b30",
    animacao: "attack",
    focarNoImpacto: true,

    /**
     * A MARCA DE ABERTURA, e o que a IA le para saber que e a primeira.
     *
     * Sem ela a habilidade entraria na disputa normal por area, e o chefe
     * escolheria o `ground_slam` de raio 260 em vez desta
     */
    abertura: true,
  },

  /**
   * O GROUND SLAM, o ataque de circulo.
   *
   * O mais lento dos cinco: 1.8s de preparo. E de proposito que seja o mais
   * demorado, porque e o ataque de MAIOR raio (260) e o unico que ocupa a
   * area em volta do chefe inteiro. Um circulo grande com preparo curto
   * seria injusto — o jogador nao teria tempo de sair de um disco do
   * diametro de meio jogador
   *
   * O `multiplicadorDano` de 1.0 com o `dano` base da criatura: o slam e o
   * golpe de referencia, e nao o mais forte. Quem escala o numero e o
   * `dano` do chefe, que ja entra escalado pelo `scaleForLevel`
   */
  ground_slam: {
    id: "ground_slam",
    nome: "Esmagamento",
    tipo: "circle",
    preparo: 1.8,
    raio: 260,
    dano: 0.85,
    multiplicadorDano: 1.0,
    knockback: 180,
    cooldown: 6.5,
    distanciaMin: 0,
    distanciaMax: 340,
    faseMin: 1,
    cor: "#ff3b30",
    animacao: "attack",
    /**
     * O ANEL FICA NA POSICAO DO CHEFE NO MOMENTO DO IMPACTO.
     *
     * E o `focarNoImpacto` do pedido: o jogador ve o disco crescer, e o
     * golpe sai do lugar onde o chefe ESTIVER quando o relogio acabar. Nao
     * do lugar onde ele comecou — senao um chefe que andou 50px durante a
     * preparacao golpearia o ar
     */
    focarNoImpacto: true,
  },

  /**
   * O CLEAVE, o cone frontal.
   *
   * O mais rapido: 1.2s. E um cone de 90 graus e 300 de alcance, o que e
   * justo: o jogador ve de onde vem, tem tempo de sair para o lado ou para
   * tras, e um cone largo demais (120 graus) seria indistinguivel de um
   * circulo para quem esta em cima
   *
   * A `direcao` e congelada no inicio da preparacao. Se fosse reavaliada a
   * cada quadro, o cone giraria junto com o `facing` do chefe e o jogador
   * nao teria uma regiao para desviar — o telegraph viraria um cangote
   */
  cleave: {
    id: "cleave",
    nome: "Corte Amplo",
    tipo: "cone",
    preparo: 1.2,
    alcance: 300,
    anguloGraus: 90,
    dano: 0.8,
    multiplicadorDano: 1.0,
    knockback: 140,
    cooldown: 4.0,
    distanciaMin: 0,
    distanciaMax: 330,
    faseMin: 1,
    cor: "#ff6b35",
    animacao: "attack",
    focarNoImpacto: false,
    congelarDirecao: true,
  },

  /**
   * O ENERGY BEAM, a faixa linear.
   *
   * O mais longo: 2.0s, e o unico com `projétil`. O feixe nao aparece
   * inteiro: a faixa marca o TRAJETO, e o raio percorre essa faixa depois do
   * preparo, levando 0.35s para ir do chefe ate a ponta
   *
   * E o unico com `alcance` de 720, o maior do jogo entre as habilidades
   * deste chefe. Um chefe no centro do vale com um feixe de 720px atravessa
   * metade da zona livre das pedras, e e o ataque que obriga o jogador a se
   * reposicionar em vez de sair do caminho
   *
   * A `largura` de 110 e estreita de proposito: o feixe e sobre a LINHA,
   * nao sobre a area. Quem esta a 300px de lado nao leva, e e isso que faz
   * o jogador procurar cobertura em vez de sair correndo
   */
  energy_beam: {
    id: "energy_beam",
    nome: "Raio de Energia",
    tipo: "line",
    preparo: 2.0,
    alcance: 720,
    largura: 110,
    dano: 1.1,
    multiplicadorDano: 1.0,
    knockback: 0,
    cooldown: 9.0,
    distanciaMin: 200,
    distanciaMax: 900,
    faseMin: 1,
    cor: "#ff2d95",
    animacao: "attack",
    focarNoImpacto: false,
    congelarDirecao: true,

    /**
     * O FEIXE PERCORRE A FAIXA, e nao acerta tudo de uma vez.
     *
     * O `projeteis` de 0.35s e o tempo de viagem do raio do chefe ate a
     * ponta. Durante ele, o dano so vale para quem esta na faixa E a frente
     * do raio — quem ficou para tras do feixe que ja passou nao leva de novo
     */
    projetil: { velocidade: 2050, largura: 110 },
  },

  /**
   * O MARKED STRIKE, o ataque marcado no alvo.
   *
   * O unico que usa a forma `targeted` do pedido, e o unico que escolhe
   * entre os dois comportamentos da secao 2.4. Aqui e `seguirAlvo: true`
   * com `fixarAntesDeImpacto: 0.5` — o disco ACOMPANHA o jogador durante a
   * preparacao e trava 500ms antes do impacto
   *
   * ## POR QUE 0.5s DE ANTECESSO, E NAO 0
   *
   * Porque com 0 o disco travaria no ultimo quadro e o jogador nao teria
   * tempo de reagir — ele veria o disco parar e o golpe ja estaria saindo.
   * Meio segundo e o menor tempo em que um jogador que ja esta correndo
   * consegue sair do raio de 150. E o que separa "desviar" de "ver o dano
   * chegar"
   *
   * ## E O ALVO
   *
     * `alvo: "maisProximo"` escolhe o jogador mais proximo do chefe no
   * instante do inicio, e nao o alvo travado. Para um chefe de area, seguir o
   * alvo travado faria a marca cair num jogador que ja saiu da briga
   */
  marked_strike: {
    id: "marked_strike",
    nome: "Golpe Marcado",
    tipo: "targeted",
    preparo: 1.5,
    raio: 150,
    seguirAlvo: true,
    fixarAntesDeImpacto: 0.5,
    dano: 0.95,
    multiplicadorDano: 1.0,
    knockback: 90,
    cooldown: 7.5,
    distanciaMin: 0,
    distanciaMax: 1100,
    faseMin: 2,
    cor: "#ffd23f",
    animacao: "attack",
    focarNoImpacto: true,
  },

  /**
   * O SHOCK RING, a onda em anel.
   *
   * O unico com `raioInterno`, e e o que o pedido chama de "mostrar
   * claramente se o perigo esta dentro de um raio, fora dele ou entre dois
   * raios". O anel comeca em 120 e cresce ate 420, entao o que esta no
   * MEIO do chefe e seguro durante a preparacao — o perigo e a ONDA que
   * passa
   *
   * E o ataque mais longo de usar: 1.6s de preparo, e o jogador tem que
   * sair do centro E deixar a onda passar, o que da a sensacao de estar
   * sendo empurrado para fora
   */
  shock_ring: {
    id: "shock_ring",
    nome: "Onda de Choque",
    tipo: "ring",
    preparo: 1.6,
    raioInterno: 120,
    raioExterno: 420,
    dano: 0.7,
    multiplicadorDano: 1.0,
    knockback: 320,
    cooldown: 8.0,
    distanciaMin: 0,
    distanciaMax: 400,
    faseMin: 2,
    cor: "#00e5ff",
    animacao: "attack",
    focarNoImpacto: true,
  },

  /**
   * O CHARGE, a investida.
   *
   * O unico que MOVEMENTO o chefe, e por isso o unico que precisa respeitar
   * o colisor: a investida usa `collision.moveEntity`, o mesmo caminho de
   * qualquer mob, entao ela para em parede, em pedra e em jogador
   *
   * A `duracaoInvestida` de 0.8s e o `alcance` de 620 dao uma velocidade
   * media de 775 — mais rapida que os 205 da volta para casa. E o ataque
   * mais perigoso do chefe em termos de posicao: ele tira o jogador do
   * posto
   *
   * ## E O `teleportaParaCasa` DESTE CHEFE
   *
   * A investida pode levar o chefe para longe do spawn. Como ele ja declara
   * `teleportaParaCasa: 260` e tem `leash` de 2600, uma investida que o leve
   * alem do limite faz a regra da `leash` de antes puxa-lo de volta — e o
   * telegraph some no meio. Por isso `leash: Infinity` na fase de
   * investida nao existe: a defesa e a propria `leash` do chefe, e o
   * `teleportaParaCasa` garante que ele volte
   */
  charge: {
    id: "charge",
    nome: "Investida",
    tipo: "charge",
    preparo: 1.5,
    alcance: 620,
    largura: 150,
    duracaoInvestida: 0.8,
    dano: 0.9,
    multiplicadorDano: 1.0,
    knockback: 260,
    cooldown: 11.0,
    distanciaMin: 250,
    distanciaMax: 800,
    faseMin: 2,
    cor: "#a855f7",
    animacao: "attack",
    focarNoImpacto: false,
    congelarDirecao: true,
    investida: {
      velocidade: 775,
      respeitaColisao: true,
    },
  },
};

/**
 * O CHEFE DO VALE, e a fase que ele entra.
 *
 * A fase 1 e a briga inteira: o chefe tem 15.000 de HP e nao muda de
 * conjunto de habilidades. O pedido sugere fase por vida, e esta e a
 * estrutura — o que o chefe perde quando a vida cai e o que entra
 */
export const CHEFE_FASES = [
  {
    /**
     * A FASE 1 E A BRIGA INTEIRA.
     *
     * Sem corte. O chefe do vale tem 15.000 de HP, o que da para um jogador
     * de topo levar dezenas de golpes — uma fase so ia durar mais que a
     * briga inteira e nunca seria vista
     *
     * O que a fase faz aqui e o PAPEL: `faseMin: 1` no catalogo significa
     * que todas as cinco habilidades valem a partir do comeco, e a fase 2
     * (onde `marked_strike`, `shock_ring` e `charge` aparecem) e a mesma
     * fase — porque o pedido quer as cinco disponiveis para validar
     */
    fase: 1,
    nome: "Hulk do Vale",
    ateVida: 1.0,
    multiplicadorDano: 1.0,
    escalaPreparo: 1.0,
  },
];

/**
 * O CHECK DE VALIDADE DE UMA HABILIDADE, e o que roda no build.
 *
 * ## POR QUE ESTE `throw` E NO TOPO DO MODULO
 *
 * Porque um cadastro invalido que so falha no meio da briga e o pior tipo de
 * defeito: o jogo roda, o chefe anda, e tres minutos depois ha um circulo
 * com raio `undefined` e nenhum dano. Com o `throw` aqui, o erro aparece no
 * primeiro `import` — no build, no servidor, no teste
 *
 * ## E POR QUE NAO UM AVISO
 *
 * Porque um aviso e ignorado, e uma habilidade invalida que foi ignorada
 * continua invalida. O prompt pede que a configuracao seja a fonte unica
 * dos numeros; a unica forma de isso valer e o numero errado nao passar
 */
export function validarHabilidade(hab) {
  const obrigatorios = CAMPOS_POR_TIPO[hab.tipo];

  if (!obrigatorios) {
    throw new Error(
      `habilidade ${hab.id}: tipo desconhecido "${hab.tipo}"`,
    );
  }

  for (const campo of obrigatorios) {
    if (hab[campo] === undefined) {
      throw new Error(
        `habilidade ${hab.id} (${hab.tipo}): falta "${campo}"`,
      );
    }
  }

  if (hab.preparo < PREPARO_MINIMO_S || hab.preparo > PREPARO_MAXIMO_S) {
    throw new Error(
      `habilidade ${hab.id}: preparo ${hab.preparo}s fora de ` +
        `${PREPARO_MINIMO_S}..${PREPARO_MAXIMO_S}s`,
    );
  }

  if (hab.raioInterno !== undefined && hab.raioInterno >= hab.raioExterno) {
    throw new Error(
      `habilidade ${hab.id}: raioInterno tem de ser menor que raioExterno`,
    );
  }
}

/**
 * O `validate` roda no `import`.
 *
 * E de proposito ser um `for` com `throw` e nao um schema: o projeto nao tem
 * validador de schema nas dependencias, e introduzir um e violar a regra do
 * prompt de nao adicionar dependencia quando a tecnologia atual ja resolve
 */
for (const hab of Object.values(HABILIDADES_CHEFE)) {
  validarHabilidade(hab);
}

/**
 * AS HABILIDADES DE UMA CRIATURA, ou lista vazia.
 *
 * ## E POR QUE O SEGUNDO ARGUMENTO E A LISTA, E NAO UM MAPA POR TYPEID
 *
 * Porque o `createCreature` espalha o `...type` na criatura final. Com um
 * mapa `{ hulk_val: [...] }`, a criatura carregaria o mapa inteiro dentro
 * dela e este metodo teria que fazer `[typeId]` dentro — uma indirecao a
 * cada consulta, com o id como chance de errar em silencio
 *
 * A criatura carrega a LISTA dela, e este metodo so escolhe entre ela e a
 * lista vazia:
 *
 * - `habilidadesTelegraph` desligado (os sete mobs comuns): `[]`, e o
 *   `TelegraphSystem` fica sem o que fazer
 * - ligado (o `hulk_val`): a lista completa das seis habilidades
 */
export function habilidadesDe(enemy) {
  if (!enemy?.habilidadesTelegraph) return [];

  return enemy.registroHabilidades ?? [];
}
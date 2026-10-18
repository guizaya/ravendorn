/**
 * OS KEYBINDS: o que cada tecla FAZ, e como o jogador troca.
 *
 * ## POR QUE UM CATALOGO, E NAO UM `if` POR TECLA
 *
 * Porque hoje o jogo tem a tecla escrita em tres lugares ao mesmo tempo: o
 * `CONTROLLED_CODES` do motor, o `CODES_DE_ORDEM` do `GameCanvas` e os
 * `if (event.code === ...)` do `handleKeyDown`. Trocar uma bind significava
 * caçar os tres e lembrar que o `GameCanvas` tem uma lista SEPARADA
 *
 * Aqui a tecla vira um NOME DE ACAO, e o `code` da tecla e um detalhe. O
 * motor e o canvas passam a perguntar "a acao `atacar` esta apertada?", e nao
 * "o `Space` esta apertado?"
 *
 * ## E POR QUE ISTO E LOCAL, E NAO NO SERVIDOR
 *
 * Porque binds sao uma preferencia de TECLADO, nao de conta. Dois jogadores
 * na mesma conta com teclados diferentes jogando lado a lado e o caso normal.
 * O que o servidor precisa saber — que o jogador mandou um ataque — continua
 * sendo o mesmo de sempre
 */

/**
 * AS ACOES, e o catalogo que o painel lista.
 *
 * ## POR QUE `teclas` E UM ARRAY, E NAO UM VALOR
 *
 * Porque movimento e ORDEM nao sao a mesma coisa. `KeyA` anda para a
 * esquerda, e `setas` tambem. Com um valor so, trocar a bind de andar
 * apagaria as setas
 *
* ## E POR QUE `slot1` A `slot3` SAO TRES ACOES, E NAO UMA
   *
   * Porque sao tres teclas de verdade, em slots de verdade, e o jogador pode
   * trocar so a segunda sem mexer nas outras. Uma acao "habilidades" com tres
   * valores seria uma so bind para tres slots
   *
   * ## POR QUE NAO VAI ATE O OITO
   *
   * Porque `MAX_SKILLS` e 3 em `data/skills/index.js`, e nenhuma classe tem a
   * quarta. Listar ate oito colocava no painel cinco linhas que o jogador nunca
   * usaria e que ele nao conseguiria nem deduzir a que botao correspondem
   *
   * O `slot4` saiu daqui junto com a quarta skill. Ele NAO foi renomeado nem
   * reaproveitado para outra coisa: um save antigo que tenha `slot4` gravado
   * continua com ele no `localStorage`, e `lerBinds` so le acoes que existem no
   * catalogo — entao ele para de ser usado sem erro
   *
 * ## E O QUE ACONTECE COM UM SAVE ANTIGO
 *
 * Nada: `lerBinds` so le acoes que existem no catalogo, entao um `slot5`
 * gravado antes fica no `localStorage` sem efeito e para de ser usado. Ele nao
 * volta a aparecer mesmo que o limite suba para oito de novo
 *
 * ## E O QUE `grupo` FAZ NO PAINEL
 *
 * E so a separacao visual. Nao muda o comportamento, e existe para o painel
 * nao virar uma parede de vinte linhas sem ritmo
 *
 * ## E O QUE `direcoes` FAZ, E SO NAS DUAS DE MOVIMENTO
 *
 * Porque uma tecla de andar nao e so "andar": e uma DIRECAO especifica. O
 * painel deixa trocar o `D` por `H`, e o `H` precisa continuar sendo "para a
 * direita" — sem esta lista, trocar o `D` viraria "o H anda para algum lado"
 *
 * E o array corre na MESMA ordem do `teclas`: a posicao 0 do `direcoes`
 * descreve a posicao 0 das teclas. E um `Map` por slot seria mais explicito,
 * mas custaria um objeto por tecla apertada, e isto roda a CADA quadro
 */
export const ACOES = [
  {
    id: "andar",
    grupo: "Movimento",
    teclas: ["KeyW", "KeyS", "KeyA", "KeyD"],
    padrao: ["KeyW", "KeyS", "KeyA", "KeyD"],
    direcoes: ["cima", "baixo", "esquerda", "direita"],
    rotulo: "Andar",
  },
  {
    id: "mirar",
    grupo: "Movimento",
    teclas: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"],
    padrao: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"],
    direcoes: ["cima", "baixo", "esquerda", "direita"],
    rotulo: "Mirar",
  },

  {
    id: "atacar",
    grupo: "Combate",
    teclas: ["Space"],
    padrao: ["Space"],
    rotulo: "Ataque basico",
  },
  {
    id: "dash",
    grupo: "Combate",
    teclas: ["KeyE"],
    padrao: ["KeyE"],
    rotulo: "Dash",
  },
  {
    id: "ultimate",
    grupo: "Combate",
    teclas: ["KeyR"],
    padrao: ["KeyR"],
    rotulo: "Ultimate",
  },

  {
    id: "slot1",
    grupo: "Habilidades",
    teclas: ["Digit1"],
    padrao: ["Digit1"],
    rotulo: "Habilidade 1",
  },
  {
    id: "slot2",
    grupo: "Habilidades",
    teclas: ["Digit2"],
    padrao: ["Digit2"],
    rotulo: "Habilidade 2",
  },
  {
    id: "slot3",
    grupo: "Habilidades",
    teclas: ["Digit3"],
    padrao: ["Digit3"],
    rotulo: "Habilidade 3",
  },

  {
    id: "auto",
    grupo: "Jogo",
    teclas: ["KeyT"],
    padrao: ["KeyT"],
    rotulo: "Auto-play",
  },
];

/**
 * O NOME DE UMA TECLA, para o painel mostrar.
 *
 * ## POR QUE TRADUZIR E NAO MOSTRAR O `code`
 *
 * Porque `KeyW` e um detalhe do navegador. O jogador conhece "W", e "KeyW"
 * na tela parece nome de variavel. E as teclas que nao tem letra — `Space`,
 * `ArrowUp` — precisam de um nome, senao apareceriam como texto vazio na
 * lista
 *
 * O `Digit1` vira "1" e o `Numpad1` vira "Num 1", porque sao teclas
 * diferentes no mesmo teclado e o jogador precisa poder ver a diferenca
 */
export function nomeDaTecla(code) {
  if (!code) return "";

  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;

  const nomes = {
    Space: "Espaco",
    ArrowUp: "Cima",
    ArrowDown: "Baixo",
    ArrowLeft: "Esquerda",
    ArrowRight: "Direita",
    ShiftLeft: "Shift Esq",
    ShiftRight: "Shift Dir",
    ControlLeft: "Ctrl Esq",
    ControlRight: "Ctrl Dir",
    AltLeft: "Alt Esq",
    AltRight: "Alt Dir",
    Tab: "Tab",
    Escape: "Esc",
    Enter: "Enter",
    Backspace: "Backspace",
    Delete: "Del",
    CapsLock: "Caps",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Semicolon: ";",
    Quote: "'",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Minus: "-",
    Equal: "=",
    Backquote: "`",
  };

  return nomes[code] ?? code;
}

/**
 * A CHAVE DE ARMAZENAMENTO.
 *
 * E versionada pelo nome da acao dentro da gravacao, nao pela chave
 * inteira — entao adicionar uma acao nova nao invalida a gravacao antiga, e
 * renomear uma acao invalida SO a dela
 */
const CHAVE = "rpg:keybinds:v1";

/**
 * O MAPA DE TECLAS SALVO, ou `null`.
 *
 * ## POR QUE LER TUDO E VALIDAR UMA POR UMA
 *
 * Porque a gravacao e do `localStorage`, e o `localStorage` e do
 * navegador: ele sobrevive a mudanca de versao do jogo, a um Ctrl+Z no
 * editor de saves, e a um import de um save antigo. Um objeto com uma
 * acao apagada no meio nao pode derrubar a tela — o painel cairia em
 * "sem binds" e o jogador perderia WASD
 *
 * E por isso a funcao nunca lanca: um `JSON.parse` de um valor quebrado e
 * um `localStorage` apagado pelo usuario tem de dar o MESMO resultado, que
 * e o mapa padrao
 */
export function lerBinds() {
  try {
    const bruto = globalThis.localStorage?.getItem(CHAVE);

    if (!bruto) return null;

    const salvo = JSON.parse(bruto);

    if (!salvo || typeof salvo !== "object") return null;

    const mapa = new Map();

    for (const acao of ACOES) {
      const valor = salvo[acao.id];

      if (!Array.isArray(valor)) continue;

      const teclas = valor.filter((t) => typeof t === "string");

      // so aceita o mesmo numero de teclas da acao. Uma acao de 4 que
      // chegou com 1 viraria um "andar" so para a frente
      if (teclas.length !== acao.teclas.length) continue;

      mapa.set(acao.id, teclas);
    }

    return mapa.size ? mapa : null;
  } catch {
    return null;
  }
}

/**
 * GRAVA O MAPA, e um silencio quando nao ha onde gravar.
 *
 * O `try` e porque o `localStorage` lanca em modo privado de alguns
 * navegadores, e um painel de keybind nao pode derrubar o jogo por causa
 * disso — ele so volta ao padrao
 */
export function gravarBinds(mapa) {
  try {
    const salvo = {};

    for (const [id, teclas] of mapa) salvo[id] = teclas;

    globalThis.localStorage?.setItem(CHAVE, JSON.stringify(salvo));
  } catch {
    // sem onde guardar: o jogo continua com o mapa da sessao
  }
}

/**
 * O MAPA DE TECLAS DA SESSAO, e o que o motor e o canvas leem.
 *
 * ## POR QUE UM `Map` E NAO UM OBJETO
 *
 * Porque a busca acontece a CADA tecla apertada, e um `Map` faz isso sem
 * prototipar nem converter `id` em string
 *
 * ## E POR QUE COMECA JA COM O SALVO
 *
 * Porque ler o `localStorage` em cada `keydown` seria um parse de JSON por
 * tecla. O mapa vive na sessao e e reescrito so quando o jogador troca
 */
let sessao = null;

/**
 * MONTA O MAPA DA SESSAO: o padrao, com o salvo por cima.
 *
 * ## POR QUE COMECA NO PADRAO E NAO NO SALVO
 *
 * ## O SALVO PODE ESTAR INCOMPLETO, E ISSO E O CASO NORMAL
 *
 * Nao por graxa: um save de uma versao anterior do jogo tem menos acoes do
 * que a versao de hoje. O `localStorage` sobrevive a atualizacao — foi o que
 * permitiu o `atacar` trocar de tecla e continuar salvo — e ele tambem
 * sobrevive a um CTRL+Z num arquivo de save
 *
 * Se o mapa da sessao fosse "o salvo, e o que nao estiver no salvo nao
 * existe", entao o primeiro save gravado depois de uma atualizacao do jogo
 * deixaria o jogador SEM a habilidade 7 e SEM o auto-play, sem ter trocado
 * tecla nenhuma. Ele abriu o painel, mexeu no dash, e perdeu sete botoes
 *
 * Por isso o padrao e a base e o salvo e a sobrescrita
 */
function montarMapa() {
  const mapa = new Map(ACOES.map((a) => [a.id, [...a.padrao]]));
  const salvo = lerBinds();

  if (!salvo) return mapa;

  for (const [id, teclas] of salvo) mapa.set(id, [...teclas]);

  return mapa;
}

export function iniciarBinds() {
  sessao = montarMapa();

  // mapa recem-carregado nao tem historico de troca: nenhum carimbo ainda
  carimbos = new Map();
  contador = 0;
  inversa = null;

  return sessao;
}

export function mapaDeBinds() {
  if (!sessao) iniciarBinds();

  return sessao;
}

/**
 * TROCA A TECLA DE UMA ACAO, e devolve o que ficou no lugar dela.
 *
 * ## POR QUE A LISTA CRESCE E NAO SUBSTITUI
 *
 * Porque `andar` tem quatro teclas. Trocar so a primeira e o que o jogador
 * quer quando ele mapeia "andar para cima" e nao "remover o W". A funcao
 * recebe o indice, entao o painel diz QUAL slot esta sendo trocado
 *
 * ## E O QUE VOLTA
 *
 * A tecla que saiu, para o painel poder dizer "o E ficou sem bind" quando
 * ela era a ultima da acao, ou "o E virou Shift" quando ela ainda tem
 * onde ir
 */
export function trocarTecla(acaoId, indice, novoCode) {
  const mapa = mapaDeBinds();

  const teclas = mapa.get(acaoId);

  if (!teclas) return { ok: false, motivo: "acaoDesconhecida" };

  if (indice < 0 || indice >= teclas.length) {
    return { ok: false, motivo: "slotInvalido" };
  }

  const anterior = teclas[indice];

  if (anterior === novoCode) return { ok: true, anterior, agora: novoCode };

  teclas[indice] = novoCode;

  /**
   * O carimbo deste slot vira o MAIOR contador do jogo.
   *
   * E o que faz a tecla passar a ser desta acao: a invertida e refeita no
   * proximo `acaoDaTecla`, e quem tiver o carimbo maior fica com a disputada
   */
  contador += 1;

  const revs = carimbos.get(acaoId) ?? teclas.map(() => 0);

  revs[indice] = contador;
  carimbos.set(acaoId, revs);

  gravarBinds(mapa);

  /**
   * O aviso vai DEPOIS da gravacao, e nao antes.
   *
   * A HUD lê o mapa quando o React chama o `getSnapshot`. Se a gravacao
   * falhasse e o aviso saisse mesmo assim, o indicador mostraria a tecla nova
   * enquanto o mapa da sessao ainda teria a antiga — e um F5 devolveria tudo
   */
  avisar();

  return { ok: true, anterior, agora: novoCode };
}

/**
 * APAGA O BIND DE UM SLOT, e e assim que uma acao fica orfa.
 *
 * ## POR QUE "APAGAR" E UM ESTADO, E NAO UM BIND VAZIO NA GRAVACAO
 *
 * Porque o slot continua existindo: `andar` tem quatro teclas, e apagar a
 * terceira NAO pode transformar a acao em uma acao de duas teclas. O slot fica
 * vazio no lugar, e o painel mostra "sem tecla" — que e a unica forma de o
 * jogador perceber que o que ele apagou e uma peca da acao, e nao a acao
 * inteira
 *
 * ## E POR QUE ISSO E NECESSARIO PARA O CONFLITO
 *
 * Porque o painel avisa "esta tecla e do Dash, o Dash vai ficar sem tecla" e
 * so honesto se o painel realmente apagar. Sem esta funcao, confirmar o
 * aviso deixaria as duas acoes com a mesma tecla e o motor entregaria a
 * ultima — o aviso seria mentira
 */
export function soltarTecla(acaoId, indice) {
  return trocarTecla(acaoId, indice, "");
}

/**
 * OS SLOTS VAZIOS DESTA ACAO, e e o que o painel marca de orfa.
 *
 * ## POR QUE ISTO E SEPARADO DE `conflitoDe`
 *
 * Porque sao perguntas diferentes: `conflitoDe` e "esta tecla tem dono agora",
 * e isto e "esta acao tem buraco agora". O painel usa as duas na mesma
 * tela — a primeira para avisar ANTES de trocar, a segunda para marcar DEPOIS
 */
export function slotsVaziosDe(acaoId) {
  const teclas = mapaDeBinds().get(acaoId);

  if (!teclas) return [];

  const vazios = [];

  for (let i = 0; i < teclas.length; i += 1) {
    if (!teclas[i]) vazios.push(i);
  }

  return vazios;
}

/**
 * A TECLA ESTA EM USO POR OUTRA ACAO?
 *
 * ## POR QUE "OUTRA" E NAO "ALGUMA"
 *
 * Porque o painel precisa dizer QUEM esta usando. Uma resposta de sim/nao
 * obrigaria o jogador a voltar a lista e procurar
 *
* ## E POR QUE O CONFLITO NAO E BLOQUEADO SO PARA AVISAR
 *
 * Porque duas acoes com a mesma tecla e uma escolha legitima em alguns
 * casos — e o que mais incomoda e o jogo DECIDIR por conta propria. O
 * painel avisa, o jogador confirma, e a acao que recebeu a tecla por ultimo
 * fica com ela
 *
 * E por isso que resolver o conflito e a regra mais simples que existe: o
 * carimbo maior vence. Sem isso seria preciso um sistema de prioridade, e o
 * jogador nao saberia qual tem
 */
export function conflitoDe(acaoId, code) {
  if (!code) return null;

  const mapa = mapaDeBinds();

  for (const [id, teclas] of mapa) {
    if (id === acaoId) continue;

    for (let i = 0; i < teclas.length; i += 1) {
      if (teclas[i] !== code) continue;

      const acao = ACOES.find((a) => a.id === id);

      return { acaoId: id, rotulo: acao?.rotulo ?? id, indice: i };
    }
  }

  return null;
}

/**
 * O VETOR DE MOVIMENTO DAS TECLAS QUE ESTAO APERTADAS AGORA.
 *
 * ## POR QUE ESTA FUNCAO EXISTE
 *
 * ## O MOVIMENTO ERA O UNICO LUGAR QUE A TECLA ERA LIDA PELO `code`
 *
 * O resto do jogo — ataque, dash, habilidades — ja perguntava "quem detem esta
 * tecla". O movimento perguntava "o `KeyD` esta apertado", e por isso trocar o
 * `D` no painel nao trocava o `D`: o painel gravava `H`, o motor continuava
 * olhando para `KeyD`, e o jogador ficava com uma tecla nova que nao
 * respondia e uma tecla velha que nao tinha para onde ir
 *
 * ## E POR QUE UM VETOR, E NAO QUATRO PERGUNTAS
 *
 * Porque quem chama isto e o motor, uma vez por quadro, com um `Set` de teclas
 * apertadas. Perguntar "cima esta apertado?" quatro vezes sao quatro buscas no
 * mapa de binds; percorrer as oito posicoes de movimento e uma
 *
 * ## E POR QUE AS DUAS ACOES, E NAO SO `andar`
 *
 * Porque no padrao as setas andam TANTO quanto o WASD: `KeyA` e `ArrowLeft`
 * entram na mesma conta. Se so `andar` contasse, o jogador que usa so setas
 * pararia de andar ao trocar uma tecla de habilidade — e ele nao teria
 * trocado nada
 */
export function vetorDeMovimento(teclasApertadas, mapa = mapaDeBinds()) {
  /**
   * As direcoes ativas, e nao os eixos somados.
   *
   * ## POR QUE UM CONJUNTO, E NAO SOMAR DIRETO
   *
   * ## W E A SETA CIMA SAO A MESMA DIRECAO
   *
   * No padrao, `KeyW` e `ArrowUp` andam para cima. Somando direto, o jogador
   * que segura os dois andaria duas vezes mais rapido para cima — e antes
   * disso ele nao andava duas vezes, porque o motor perguntava
   * `keys.has("KeyW") || keys.has("ArrowUp")`, que e um "OU"
   *
   * O "OU" e o que o conjunto reproduz: cada direcao entra uma vez, nao
   * importa quantas teclas differentes a pedem
   */
  const ativas = new Set();

  for (const acao of ACOES) {
    if (!acao.direcoes) continue;

    const teclasDaAcao = mapa.get(acao.id);

    if (!teclasDaAcao) continue;

    for (let i = 0; i < teclasDaAcao.length; i += 1) {
      const code = teclasDaAcao[i];

      // slot vazio e o painel apagando o bind: nao anda para lugar nenhum
      if (!code || !teclasApertadas.has(code)) continue;

      ativas.add(acao.direcoes[i]);
    }
  }

  let x = 0;
  let y = 0;

  if (ativas.has("esquerda")) x -= 1;
  if (ativas.has("direita")) x += 1;
  if (ativas.has("cima")) y -= 1;
  if (ativas.has("baixo")) y += 1;

  return { x, y };
}

/**
 * A TECLA DE UMA ACAO AGORA, e o que a HUD escreve no indicador.
 *
 * ## POR QUE ISTO PRECISA EXISTIR
 *
 * ## PORQUE A HUD PRECISA DESSE NOME DE NOVO
 *
 * Porque a HUD mostra a tecla embaixo de cada botao, e ela escrevia `E` e `R`
 * escritas no JSX. Trocar o dash para o espaco deixaria a HUD anunciando `E`
 * com um `E` nao funcionando embaixo — e o jogador nao teria como descobrir
 * qual das duas informacoes era a errada
 *
 * ## E POR QUE O INDICE E PADRAO ZERO
 *
 * Porque so o movimento tem mais de uma tecla por acao, e nenhuma peca da HUD
 * desenha o segundo slot de andar. `indice` existe para o painel, nao para
 * quem so mostra
 */
export function teclaDaAcao(acaoId, indice = 0) {
  const teclas = mapaDeBinds().get(acaoId);

  if (!teclas) return "";

  return teclas[indice] ?? "";
}

/**
 * O GLIFO DE UMA TECLA QUE NAO CABE NUM BADGE.
 *
 * ## POR QUE ISTO EXISTE
 *
 * Porque "Espaco" tem seis letras e o quadrado da HUD tem lugar para duas. A
 * alternativa — escrever o nome e encolher o quadrado — quebrava o alinhamento
 * dos oito slots, que e o que faz o jogador achar o slot certo de relance
 *
 * E o `␣` nao e decoracao: e o simbolo que o jogador ja viu em tecla de
 * editor de texto. Ele aprendeu a ler aquele desenho como "barra", e o nome
 * "Espaco" nunca foi informacao nova para ele
 *
 * ## E POR QUE O PAINEL DE TECLAS AINDA USA O `␣` DO ESPACO
 *
 * Porque aqui o texto e o texto: num aviso, num `aria-label` escrito a mao ou
 * num verificador, o glifo e a forma curta e economica de escrever "Espaco".
 * A HUD nao usa este glifo: ela desenha a barra em CSS, porque no quadrado de
 * 13px o simbolo fica ilegivel
 */
const GLIFO_DA_TECLA = {
  Space: "␣",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Enter: "⏎",
  Backspace: "⌫",
  Delete: "⌦",
  Tab: "⇥",
  CapsLock: "⇪",
  ShiftLeft: "⇧",
  ShiftRight: "⇧",
  ControlLeft: "⌃",
  ControlRight: "⌃",
  AltLeft: "⌥",
  AltRight: "⌥",
  Escape: "⎋",
};

/**
 * O NOME CURTO DE UMA TECLA, para caber num quadrado.
 *
 * ## A REGRA, E POR QUE O CORTE E EM DUAS LETRAS
 *
 * Uma letra (`E`) e o melhor formato que existe: cabe em qualquer lugar e nao
 * precisa de legenda. Duas (`F1`) ja e o limite. A partir de tres o quadrado
 * comeca a parecer uma etiqueta, e nao uma tecla
 *
 * ## E POR QUE O NOME COMPLETO CONTINUA EXISTINDO
 *
 * Porque o `␣` sozinho nao diz qual tecla e, e no `data-tip` do botao cabe o
 * nome inteiro. O glifo e para o quadrado; o nome e para o texto que o jogador
 * le quando para para pensar
 */
export function nomeCurtoDaTecla(code) {
  if (!code) return "";

  const nome = nomeDaTecla(code);

  if (nome.length <= 2) return nome;

  return GLIFO_DA_TECLA[code] ?? nome;
}

/* ------------------------------------------------------------------ *
 * A PARTE QUE FAZ A HUD ACOMPANHAR O PAINEL
 * ------------------------------------------------------------------ */

/**
 * A VERSAO DO MAPA, que e o que o React observa.
 *
 * ## POR QUE UM CONTADOR E NAO O PROPRIO MAPA
 *
 * Porque o mapa e o MESMO objeto desde o inicio da sessao: trocar uma tecla o
 * modifica no lugar. Um React que compara por referencia veria "nada mudou" em
 * todas as trocas, e a HUD continuaria mostrando a tecla antiga ate o jogador
 * recarregar a pagina
 */
export function versaoDosBinds() {
  return contador;
}

const ouvintes = new Set();

/**
 * OUVE AS TROCAS, e e o que segura a HUD atualizada.
 *
 * ## POR QUE UM ASSINANTE E NAO UM EVENTO
 *
 * Porque o mapa e um `Map` em memoria: ele nao tem como emitir um evento. Um
 * `CustomEvent` exigiria um `window` para o `localStorage` que o painel ja
 * exige, e o ganho seria zero
 *
 * ## E POR QUE UM CONJUNTO, E NAO UM LISTENER
 *
 * Porque sao varios indicadores — oito slots, a ultimate, o dash, o auto — e
 * cada um assina e desassina na montagem. Com listener unico seria preciso
 * contar quem saiu, e um indicador desmontado no meio da tela continuaria
 * recebendo chamada
 */
export function assinarBinds(ouvinte) {
  ouvintes.add(ouvinte);

  return () => {
    ouvintes.delete(ouvinte);
  };
}

/**
 * AVISA OS INDICADORES, e e a unica vez que um evento e preciso.
 */
function avisar() {
  for (const ouvinte of ouvintes) ouvinte();
}

/**
 * A LISTA INVERSA: `code -> acaoId`, e o que o motor consulta.
 *
 * ## E POR QUE E MEMORIZADA
 *
 * Porque o motor pergunta a CADA tecla apertada, e percorrer as 14 acoes e
 * 19 teclas por `keydown` e trabalho jogado fora. A lista e montada uma vez
 * por troca de bind, e nao por tecla
 *
 * ## E POR QUE CADA SLOT TEM UM CARIMBO
 *
 * Porque o conflito se resolve por "quem trocou por ultimo", e a tabela
 * precisa saber QUANDO cada tecla foi escrita. A maneira ingenua — "o primeiro
 * que achar no mapa e o dono" — erra justo ai: trocar uma tecla do `andar` nao
 * pode mexer em quem tem o `W`, e o `W` nem esta na posicao que o jogador
 * tocou
 *
 * E a ordem de insercao do `Map` nao serve como criterio: trocar a ultima
 * tecla do `andar` moveria a acao inteira para o fim do mapa, e ela passaria
 * a tomar o `Q` de outra acao sem o jogador ter tocado no `Q`
 */
let inversa = null;

/**
 * O contador de trocas, e o que invalida a invertida.
 *
 * Ele existe porque o carimbo precisa mudar quando o CONTEUDO muda: o mapa e
 * o mesmo objeto desde o inicio da sessao, e comparar a referencia — como se
 * fosse um `Map` novo — nunca acusaria a diferenca
 */
let contador = 0;

/**
 * Os carimbos de escrita: `acaoId -> [rev, rev, ...]`.
 *
 * E um `Map` paralelo ao de teclas porque os dois mudam juntos — toda vez que
 * uma posicao e reescrita, aquela posicao ganha o carimbo novo, e as outras
 * posicoes da mesma acao ficam como estavam. E por isso que o carimbo e por
 * SLOT e nao por acao
 */
let carimbos = new Map();

function inverter(mapa) {
  const tabela = new Map();

  for (const [id, teclas] of mapa) {
    const revs = carimbos.get(id);

    for (let i = 0; i < teclas.length; i += 1) {
      const code = teclas[i];

      // slot vazio e o painel apagando um bind: nao e tecla de ninguem
      if (!code) continue;

      const rev = revs?.[i] ?? 0;
      const atual = tabela.get(code);

      if (atual && atual.rev > rev) continue;

      tabela.set(code, { acaoId: id, rev });
    }
  }

  return tabela;
}

/**
 * A ACAO DESTA TECLA, ou `null`.
 *
 * E a funcao que o motor e o `GameCanvas` chamam. Ela mantem a invertida em
 * dia sozinha: se o jogador trocou alguma coisa desde a ultima tecla, o
 * carimbo muda e a tabela e refeita
 */
export function acaoDaTecla(code) {
  const mapa = mapaDeBinds();

  if (!inversa || inversa.contador !== contador || inversa.mapa !== mapa) {
    inversa = { contador, mapa, tabela: inverter(mapa) };
  }

  return inversa.tabela.get(code)?.acaoId ?? null;
}

/**
 * TODOS OS CODES QUE O JOGO CONSOME, e nao so os que tem bind.
 *
 * ## POR QUE EXISTE
 *
 * Porque o `CONTROLLED_CODES` do motor e o `CODES_DE_ORDEM` do canvas
 * precisam CONTINUAR Cancelando o evento do navegador em teclas como
 * `Space` e as setas, mesmo depois de o jogador trocar o bind delas
 *
 * Sem esta lista, trocar `atacar` de `Space` para `KeyF` faria o `Space`
 * voltar a rolar a pagina
 *
 * ## E POR QUE E O PADRAO, E NAO O MAPA ATUAL
 *
 * Porque sao as teclas que o NAVEGADOR usa: rolar a pagina com `Space`,
 * mover o cursor com as setas, apagar com `Backspace`. Trocar o bind nao
 * muda o que o navegador faz com elas
 */
export const TECLAS_DO_NAVEGADOR = [
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Backspace",
];

/**
 * AS TECLAS DO PADRAO, e o que o motor cancela no navegador.
 *
 * ## PARA QUE SERVE, JA QUE O CATALOGO JA SABE
 *
 * Para o `CONTROLLED_CODES` do motor. O motor precisa cancelar `Space`, as
 * setas, `1`-`8`, `R` e `T` — tanto quando o jogador tem bind para elas quanto
 * quando ele ja trocou e elas sobraram vazias
 *
 * Sem esta lista, trocar `atacar` de `Space` para `KeyF` tiraria o `Space` do
 * cancelamento e a pagina voltaria a rolar com a barra espacadora
 *
 * ## E POR QUE O PADRAO, E NAO O MAPA VIVO
 *
 * Porque o cancelamento e sobre o NAVEGADOR, e o navegador nao muda de ideia
 * quando o jogador troca um bind. `Space` rola a pagina com ou sem bind
 *
 * ## E POR QUE E SO O `padrao` DO CATALOGO, SEM NADA AVULSO
 *
 * Porque uma lista escrita a mao aqui seria uma segunda fonte da verdade.
 * Bastava uma tecla trocada no catalogo sem atualizarmos esta linha para o
 * motor comecar a rolar a pagina — e o `Set` e o que impede a duplicata
 */
export const TECLAS_ORDEM_PADRAO = [
  ...new Set(ACOES.flatMap((acao) => acao.padrao)),
];

/**
 * O MAPA PADRAO, para o "restaurar padroes" do painel.
 *
 * E um mapa novo a cada chamada, e nao o do modulo: o painel restaura e
 * depois o jogador troca de novo, e se o objeto fosse compartilhado a
 * segunda troca comecaria em cima da primeira
 */
export function mapaPadrao() {
  return new Map(ACOES.map((a) => [a.id, [...a.padrao]]));
}

/**
 * RESTAURA OS PADROES, e e o unico jeito de desfazer uma troca.
 *
 * ## POR QUE UM BOTAO E NAO UM CTRL+Z POR LINHA
 *
 * Porque desfazer uma troca de bind tem que desfazer a ORDEM: se o jogador
 * trocou "andar: W -> F" e "atacar: Space -> W", o Ctrl+Z da segunda tem
 * que devolver `Space` para o ataque E `W` para o andar, senao o andar fica
 * sem tecla. Um "restaurar tudo" nao tem esse problema
 */
export function restaurarPadroes() {
  const mapa = mapaPadrao();

  sessao = mapa;

  /**
   * Os carimbos vao com o mapa.
   *
   * Eles descrevem a ORDEM das trocas, e depois de restaurar o padrao essa
   * ordem nao vale mais nada: o que sobrou sao os padroes, sem ninguem ter
   * disputado nada
   */
  carimbos = new Map();
  contador = 0;
  inversa = null;

  gravarBinds(mapa);

  avisar();

  return mapa;
}
/**
 * O QUE ESTE ARQUIVO CONFERE
 *
 * O `keybinds` decide o que cada tecla faz, e uma falha aqui NAO aparece como
 * erro: aparece como "o dash nao funciona" ou "a pagina rola quando eu ataco".
 * Nenhum dos dois complains nao entrega a causa, e o motor tem 14 mil linhas
 *
 * Por isso o modulo tem verificador proprio, e ele cobre as quatro coisas que
 * quebram em silencio:
 *
 *   1. RESOLUCAO  — a tecla marcada leva a acao certa
 *   2. CONFLITO   — a ultima troca vence, e so a ultima
 *   3. ISOLAMENTO — trocar um slot nao muda quem tem os OUTROS
 *   4. ORFA       — confirmar um conflito deixa a acao perdedora sem tecla
 *
 * E a persistencia no fim, porque um bind que nao sobrevive ao F5 e um bind
 * que o jogador nao tem
 */

import {
  ACOES,
  iniciarBinds,
  lerBinds,
  mapaDeBinds,
  gravarBinds,
  trocarTecla,
  soltarTecla,
  slotsVaziosDe,
  conflitoDe,
  acaoDaTecla,
  nomeDaTecla,
  nomeCurtoDaTecla,
  teclaDaAcao,
  versaoDosBinds,
  assinarBinds,
  vetorDeMovimento,
  restaurarPadroes,
  mapaPadrao,
} from "../src/game/input/keybinds.js";

/**
 * O `localStorage` de mentira.
 *
 * ## POR QUE UM MAPA E SUFICIENTE
 *
 * Porque o modulo usa so `getItem` e `setItem`. E o suficiente para o teste
 * passo a passo sem instalar nada — e sem tocar no `localStorage` de verdade,
 * que e o do jogador
 */
const armazenamento = new Map();

globalThis.localStorage = {
  getItem: (chave) => armazenamento.get(chave) ?? null,
  setItem: (chave, valor) => armazenamento.set(chave, String(valor)),
  removeItem: (chave) => armazenamento.delete(chave),
};

let passou = 0;
let falhou = 0;

function conferir(descricao, condicao) {
  if (condicao) {
    passou += 1;
    console.log(`  ok   ${descricao}`);
    return true;
  }

  falhou += 1;
  console.log(`  FALHA ${descricao}`);

  return false;
}

console.log("\nKEYBINDS\n");

/**
 * O COMECIO DE TODO TESTE: mapa novo, sem rastro do teste anterior.
 *
 * E o que `restaurarPadroes` faz, e ele e chamado antes de cada bloco porque
 * o estado do modulo e global — sem isso o teste 2 comecaria em cima do que o
 * teste 1 deixou
 */
function recomecar() {
  armazenamento.clear();
  iniciarBinds();
}

/* ------------------------------------------------------------------ *
 * 1. RESOLUCAO: o estado inicial
 * ------------------------------------------------------------------ */
console.log("1. resolucao inicial\n");

recomecar();

conferir(
  "cada tecla do padrao leva a acao que a declara",
  ACOES.every((acao) =>
    acao.padrao.every((code, i) => acaoDaTecla(code) === acao.id) &&
    acao.padrao.length === acao.padrao.filter((code, i) => acao.padrao.indexOf(code) === i).length,
  ),
);

conferir("W e 'andar'", acaoDaTecla("KeyW") === "andar");
conferir("Espaco e 'atacar'", acaoDaTecla("Space") === "atacar");
conferir("E e 'dash'", acaoDaTecla("KeyE") === "dash");
conferir("R e 'ultimate'", acaoDaTecla("KeyR") === "ultimate");
conferir("T e 'auto'", acaoDaTecla("KeyT") === "auto");
conferir("1 e 'slot1'", acaoDaTecla("Digit1") === "slot1");
conferir("4 e 'slot4'", acaoDaTecla("Digit4") === "slot4");
conferir("seta e 'mirar'", acaoDaTecla("ArrowUp") === "mirar");
conferir("tecla solta devolve null", acaoDaTecla("F9") === null);

/* ------------------------------------------------------------------ *
 * 2. O SLOT: trocar UM, NAO A ACAO INTEIRA
 * ------------------------------------------------------------------ */
console.log("\n2. trocar um slot so\n");

recomecar();

trocarTecla("andar", 0, "KeyI");

conferir("W virou I", acaoDaTecla("KeyI") === "andar");
conferir("o W nao responde mais", acaoDaTecla("KeyW") === null);
conferir("o S continua andando", acaoDaTecla("KeyS") === "andar");
conferir("o A continua andando", acaoDaTecla("KeyA") === "andar");
conferir("o D continua andando", acaoDaTecla("KeyD") === "andar");
conferir(
  "a acao continua com quatro slots",
  mapaDeBinds().get("andar").length === 4,
);

conferir(
  "slot fora da faixa e recusado",
  trocarTecla("andar", 9, "KeyP").ok === false,
);

conferir(
  "acao desconhecida e recusada",
  trocarTecla("nao_existe", 0, "KeyP").ok === false,
);

/* ------------------------------------------------------------------ *
 * 2b. MOVIMENTO: o `code` trocado tem que ANDAR
 *
 * E o bloco que pegou o defeito reportado: o painel gravava a tecla nova, o
 * motor continuava lendo `keys.has("KeyD")`, e o jogador ficava com a tecla
 * velha funcionando e a nova morta
 * ------------------------------------------------------------------ */
console.log("\n2b. movimento depois de trocar\n");

recomecar();

const andando = (...codigos) => vetorDeMovimento(new Set(codigos));

conferir(
  "padrao: D vai para a direita",
  andando("KeyD").x === 1 && andando("KeyD").y === 0,
);

conferir(
  "padrao: A vai para a esquerda",
  andando("KeyA").x === -1,
);

conferir(
  "padrao: W vai para cima",
  andando("KeyW").y === -1,
);

conferir(
  "padrao: setas andam igual",
  andando("ArrowRight").x === 1 && andando("ArrowUp").y === -1,
);

conferir(
  "W e seta cima nao somam duas vezes",
  andando("KeyW", "ArrowUp").y === -1,
);

conferir("nenhuma tecla e parado", andando().x === 0 && andando().y === 0);

/**
 * O CASO QUE O JOGADOR REPORTOU.
 *
 * `andar` = [W, S, A, D] e `direcoes` = [cima, baixo, esquerda, direita]. A
 * posicao 3 e o D, entao o D e "direita" e o H trocado no lugar dele tambem
 */
trocarTecla("andar", 3, "KeyH");

conferir("D sozinho ja nao anda", andando("KeyD").x === 0);
conferir("H agora e a direita", andando("KeyH").x === 1);
conferir("H e so a direita, sem eixo vertical", andando("KeyH").y === 0);

conferir(
  "os outros slots do andar nao mudaram de sentido",
  andando("KeyW").y === -1 && andando("KeyA").x === -1 && andando("KeyS").y === 1,
);

conferir("as setas continuam andando", andando("ArrowRight").x === 1);

/**
 * A DIRECAO VIOLA DA LISTA, E NAO DA POSICAO NA PRATICA.
 *
 * Trocar `mirar` na posicao 0 (a seta cima) por `KeyF` tem de virar "F e
 * cima". E o que garante que trocar a tecla nunca vira trocar o sentido
 */
trocarTecla("mirar", 0, "KeyF");

conferir("F substitui a seta cima", andando("KeyF").y === -1);
conferir("a seta cima saiu", andando("ArrowUp").y === 0);

/**
 * SLOT VAZIO NO MOVIMENTO.
 *
 * O painel "limpar" apaga a acao inteira, e um boneco sem nenhuma tecla de
 * andar e o estado que o painel marca como orfa. Nao pode sobrar direcao
 * nenhuma
 */
recomecar();

soltarTecla("andar", 0);
soltarTecla("andar", 1);
soltarTecla("andar", 2);
soltarTecla("andar", 3);

conferir("andar sem tecla nao anda", andando("KeyW", "KeyA", "KeyS", "KeyD").x === 0 && andando("KeyW", "KeyA", "KeyS", "KeyD").y === 0);
conferir("as setas ainda andam", andando("ArrowDown").y === 1);

/* ------------------------------------------------------------------ *
 * 3. CONFLITO: quem ganha
 * ------------------------------------------------------------------ */
console.log("\n3. conflito\n");

recomecar();

conferir(
  "o conflito e detectado antes da troca",
  conflitoDe("atacar", "KeyE")?.acaoId === "dash",
);

conferir(
  "a propria acao nao e conflito dela mesma",
  conflitoDe("dash", "KeyE") === null,
);

conferir("tecla livre nao tem conflito", conflitoDe("atacar", "KeyF") === null);

/**
 * CONFLITO CONFIRMADO: a tecla PULA para a acao que pediu.
 *
 * O painel pergunta antes, o jogador confirma, e o dono da tecla passa a ser
 * quem recebeu o carimbo maior. O teste usa `KeyT`, que existe no padrao
 * mesmo — inventar uma tecla que ninguem tem nao testaria conflito nenhum
 */
trocarTecla("slot4", 0, "KeyT");

conferir("apos a troca, T e do slot 4", acaoDaTecla("KeyT") === "slot4");
conferir("o auto-play perdeu a tecla", acaoDaTecla("KeyT") !== "auto");
conferir("o 4 nao responde mais", acaoDaTecla("Digit4") === null);
conferir(
  "os outros slots continuam nos seus",
  acaoDaTecla("Digit1") === "slot1" &&
    acaoDaTecla("Digit2") === "slot2" &&
    acaoDaTecla("Digit3") === "slot3",
);

/**
 * ISOLAMENTO: trocar UM slot nao mexe em nenhum outro.
 *
 * E o defeito que a ordem de insercao do `Map` causaria. Trocar uma tecla do
 * `andar` — uma acao de quatro posicoes — nao pode fazer o `andar` tomar o
 * `E` do dash nem o `R` da ultimate, que ele nunca pediu
 */
const antes = new Map(
  ACOES.map((a) => [a.id, acaoDaTecla(a.padrao[0])]),
);

trocarTecla("andar", 0, "KeyI");

conferir("o dash nao foi roubado pelo andar", acaoDaTecla("KeyE") === "dash");
conferir("a ultimate nao foi roubada", acaoDaTecla("KeyR") === "ultimate");
conferir("o ataque nao foi roubado", acaoDaTecla("Space") === "atacar");

conferir(
  "so o slot trocado mudou de dono",
  ACOES.every((a) => {
    if (a.id === "andar") return true;

    const agora = acaoDaTecla(a.padrao[0]);

    return agora === antes.get(a.id);
  }),
);

/* ------------------------------------------------------------------ *
 * 4. ORFA: confirmar o aviso tem que apagar
 * ------------------------------------------------------------------ */
console.log("\n4. acao orfa\n");

recomecar();

conferir("dash nao tem buraco antes", slotsVaziosDe("dash").length === 0);

const conflito = conflitoDe("atacar", "KeyE");

conferir("o painel descobre o conflito", conflito?.acaoId === "dash");

soltarTecla("atacar", 0);
trocarTecla("dash", 0, "KeyE");

conferir("o ataque ficou sem tecla", slotsVaziosDe("atacar")[0] === 0);
conferir("o buraco do ataque nao e tecla de ninguem", acaoDaTecla("Space") === null);
conferir("o dash continua na sua tecla", acaoDaTecla("KeyE") === "dash");

/**
 * A PEÇA MAIS IMPORTANTE DO CONFLITO.
 *
 * Com o slot vazio, o painel mostra "sem tecla" E o motor devolve `null`.
 * Se o motor devolvesse a acao mesmo assim, o jogador apertaria o Espaco
 * esperando atacar e nao aconteceria nada — que e o mesmo defeito de um
 * bind quebrado, so mais chato de achar
 */
conferir(
  "apagar um slot NAO apaga a acao inteira",
  mapaDeBinds().get("atacar").length === 1,
);

/* ------------------------------------------------------------------ *
 * 5. O NOME DA TECLA
 * ------------------------------------------------------------------ */
console.log("\n5. nome da tecla\n");

conferir("KeyW vira W", nomeDaTecla("KeyW") === "W");
conferir("Space vira Espaco", nomeDaTecla("Space") === "Espaco");
conferir("ArrowUp vira Cima", nomeDaTecla("ArrowUp") === "Cima");
conferir("Digit3 vira 3", nomeDaTecla("Digit3") === "3");
conferir("Numpad3 vira Num 3", nomeDaTecla("Numpad3") === "Num 3");
conferir("tecla vazia nao vira texto", nomeDaTecla("") === "");

/* ------------------------------------------------------------------ *
 * 6. PERSISTENCIA
 * ------------------------------------------------------------------ */
console.log("\n6. persistencia\n");

recomecar();

trocarTecla("atacar", 0, "KeyF");

conferir("o mapa foi gravado", Boolean(armazenamento.size));

iniciarBinds();

conferir("a troca sobrevive a um recarregar", acaoDaTecla("KeyF") === "atacar");
conferir("e o padrao nao volta sozinho", acaoDaTecla("Space") === null);

/**
 * GRAVACAO CORROMPIDA.
 *
 * E o caso que derruba a tela se o modulo nao validar: o `localStorage` e
 * do navegador, sobrevive a versao do jogo e a import de save antigo. Um
 * objeto invalido tem de dar o MESMO resultado de um `localStorage` vazio —
 * que e o mapa padrao, nunca um `undefined` no meio do jogo
 */
armazenamento.set("rpg:keybinds:v1", "{isso nao e json");

conferir("lixo no storage devolve null", lerBinds() === null);

iniciarBinds();

conferir("com lixo, o jogo volta ao padrao", acaoDaTecla("Space") === "atacar");

/**
 * O MESMO MAPA COM METADE DAS ACOES.
 *
 * Um save de uma versao anterior pode ter `atacar` e nenhuma das oito
 * habilidades. As que faltaram tem de voltar ao padrao, e as que vieram sao
 * respeitadas — o que nao pode acontecer e `atacar` ficar sem tecla nenhuma
 */
armazenamento.set(
  "rpg:keybinds:v1",
  JSON.stringify({ atacar: ["KeyJ"] }),
);

iniciarBinds();

conferir("acao salva e respeitada", acaoDaTecla("KeyJ") === "atacar");
conferir("acao ausente volta ao padrao", acaoDaTecla("Digit3") === "slot3");

/**
 * O TAMANHO ERRADO.
 *
 * `andar` com uma tecla so viraria um "andar" so para a frente. O modulo
 * recusa e devolve o padrao inteiro, porque um andar com uma tecla e pior do
 * que um andar com quatro
 */
armazenamento.set(
  "rpg:keybinds:v1",
  JSON.stringify({ andar: ["KeyW"] }),
);

iniciarBinds();

conferir("andar com uma tecla so e recusado", acaoDaTecla("KeyA") === "andar");

/* ------------------------------------------------------------------ *
 * 7. RESTAURAR
 * ------------------------------------------------------------------ */
console.log("\n7. restaurar padroes\n");

recomecar();

trocarTecla("atacar", 0, "KeyF");
soltarTecla("dash", 0);
trocarTecla("andar", 0, "KeyI");

restaurarPadroes();

conferir("atacar voltou ao espaco", acaoDaTecla("Space") === "atacar");
conferir("dash voltou ao E", acaoDaTecla("KeyE") === "dash");
conferir("andar voltou ao W", acaoDaTecla("KeyW") === "andar");
conferir("o buraco do dash foi fechado", slotsVaziosDe("dash").length === 0);

/**
 * O MAPA PADRAO NAO E O MAPA DA SESSAO.
 *
 * Se fossem o mesmo objeto, o "restaurar padroes" do jogador sobrescreveria
 * o padrao do modulo — e a segunda troca do painel comecaria em cima da
 * primeira, sem o jogador ter feito nada
 */
const padrao = mapaPadrao();

trocarTecla("atacar", 0, "KeyK");

conferir(
  "mexer no mapa devolvido nao mexe no padrao",
  padrao.get("atacar")[0] === "Space",
);

/* ------------------------------------------------------------------ *
 * 8. GRAVAR NAO QUEBRA
 * ------------------------------------------------------------------ */
console.log("\n8. storage indisponivel\n");

const armazenamentoReal = globalThis.localStorage;

globalThis.localStorage = {
  getItem: () => {
    throw new Error("modo privado");
  },
  setItem: () => {
    throw new Error("modo privado");
  },
};

let gravouComErro = true;

try {
  gravarBinds(mapaPadrao());
  gravouComErro = false;
} catch {
  gravouComErro = true;
}

conferir("gravar num storage que lanca nao derruba o jogo", !gravouComErro);

globalThis.localStorage = armazenamentoReal;

/* ------------------------------------------------------------------ *
 * 9. O QUE O MOTOR USA
 * ------------------------------------------------------------------ */
console.log("\n9. a lista de cancelamento\n");

const { TECLAS_ORDEM_PADRAO, TECLAS_DO_NAVEGADOR } = await import(
  "../src/game/input/keybinds.js"
);

conferir(
  "todas as teclas do padrao sao canceladas",
  ACOES.every((acao) =>
    acao.padrao.every((code) => TECLAS_ORDEM_PADRAO.includes(code)),
  ),
);

conferir("Espaco e cancelado", TECLAS_ORDEM_PADRAO.includes("Space"));
conferir("as setas sao canceladas", TECLAS_ORDEM_PADRAO.includes("ArrowUp"));

conferir(
  "a lista nao repete tecla",
  TECLAS_ORDEM_PADRAO.length === new Set(TECLAS_ORDEM_PADRAO).size,
);

/**
 * O `Backspace` ESTA E ESTA CERTO.
 *
 * Ele nao e atalho de nada, e ele e uma tecla que o jogador precisa para
 * apagar num campo. Ele nao esta em `TECLAS_ORDEM_PADRAO` porque essa lista
 * vem do catalogo — e o `Backspace` esta em `TECLAS_DO_NAVEGADOR`, que e o
 * outro lado do mesmo `CONTROLLED_CODES` do motor
 */
conferir(
  "Backspace nao virou atalho",
  !TECLAS_ORDEM_PADRAO.includes("Backspace"),
);

conferir(
  "Backspace e cancelado mesmo assim",
  TECLAS_DO_NAVEGADOR.includes("Backspace"),
);

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * 10. O QUE A HUD ESCREVE
 * ------------------------------------------------------------------ */
console.log("\n10. o indicativo da HUD\n");

recomecar();

conferir("o dash anuncia E por padrao", teclaDaAcao("dash") === "KeyE");
conferir("a ultimate anuncia R", teclaDaAcao("ultimate") === "KeyR");
conferir("a habilidade 3 anuncia 3", teclaDaAcao("slot3") === "Digit3");

/**
 * O GLIFO, E O CASO QUE O JOGADOR PEDIU.
 *
 * "Espaco" tem seis letras e o quadrado da HUD tem lugar para duas. O glifo
 * e o simbolo que o jogador ja viu em editor de texto, entao ele nao esta
 * aprendendo nada — esta so deixando de ler
 */
conferir("Espaco vira o glifo", nomeCurtoDaTecla("Space") === "␣");
conferir("a seta vira seta", nomeCurtoDaTecla("ArrowUp") === "↑");
conferir("Shift vira o glifo de shift", nomeCurtoDaTecla("ShiftLeft") === "⇧");

conferir("uma letra fica como letra", nomeCurtoDaTecla("KeyE") === "E");
conferir("F1 fica como F1", nomeCurtoDaTecla("F1") === "F1");

conferir(
  "o nome por extenso continua existindo",
  nomeDaTecla("Space") === "Espaco",
);

/**
 * TECLA QUE NAO TEM GLIFO.
 *
 * Uma tecla inventada pelo painel pode nao ter desenho. O nome longo e melhor
 * do que um quadrado vazio, porque ainda diz o que apertar
 */
conferir(
  "tecla sem glifo cai no nome",
  nomeCurtoDaTecla("F12") === "F12",
);

conferir("sem tecla nao vira glifo", nomeCurtoDaTecla("") === "");

/**
 * A HUD ACOMPANHA A TROCA.
 *
 * O bug do jogador era o painel gravar e a HUD continuar anunciando a tecla
 * antiga. Aqui o `versaoDosBinds` precisa MUDAR quando a troca acontece — e e
 * ele que o React observa
 */
const versaoAntes = versaoDosBinds();

trocarTecla("dash", 0, "Space");

conferir("a versao mudou na troca", versaoDosBinds() !== versaoAntes);
conferir("o dash agora e espaco", teclaDaAcao("dash") === "Space");
conferir("e o quadrado mostrara o glifo", nomeCurtoDaTecla(teclaDaAcao("dash")) === "␣");

/**
 * O AVISO CHEGA NOS OUVINTES, E SO NOS QUE ESTAO INSCRITOS.
 *
 * O aviso e manual porque o mapa e um `Map` em memoria: nao existe evento para
 * ele emitir. Um `getSnapshot` sem `avisar` deixaria a HUD parada na tecla
 * antiga ate um F5
 */
let avisos = 0;

const parar = assinarBinds(() => {
  avisos += 1;
});

trocarTecla("atacar", 0, "KeyJ");

conferir("a troca avisou", avisos === 1);

parar();

trocarTecla("atacar", 0, "KeyK");

conferir("quem desassinou nao ouve mais", avisos === 1);

/**
 * A TROCA QUE NAO MUDA NADA NAO AVISA.
 *
 * `trocarTecla` com a mesma tecla e um no-op: uma gravacao e um aviso a toa
 * fariam a HUD piscar sem motivo
 */
const versaoEstavel = versaoDosBinds();

trocarTecla("atacar", 0, "KeyK");

conferir("trocar pela mesma tecla nao muda a versao", versaoDosBinds() === versaoEstavel);

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * 11. O CATALOGO NAO INVENTA SLOT QUE O JOGO NAO TEM
 * ------------------------------------------------------------------ */
console.log("\n11. o catalogo bate com o jogo\n");

recomecar();

const { SKILL_PACKS } = await import("../src/data/skills/index.js");

/**
 * AS QUATRO ACOES E AS QUATRO HABILIDADES.
 *
 * `MAX_SKILLS` vale 4 em `data/skills/index.js`, e nenhuma classe passa
 * disso. O catalogo tinha `slot5` ate `slot8` porque a barra foi desenhada
 * com pagina de oito — e essas quatro linhas apareciam no painel de teclas
 * sem nenhum botao na tela a que elas pudessem se ligar
 *
 * Este teste pega o caminho inverso tambem: se o limite das classes subir para
 * seis, o painel passa a ter seis linhas e a tecla do sexto slot e aceita,
 * sem ninguem lembrar de editar o catalogo
 */
const slotsDoCatalogo = ACOES.filter((a) => a.id.startsWith("slot")).map(
  (a) => Number(a.id.slice(4)),
);

conferir(
  "o catalogo tem um slot por habilidade do jogo",
  slotsDoCatalogo.length === 4,
);

conferir(
  "e sao os slots de 1 a 4, sem buraco",
  slotsDoCatalogo.join(",") === "1,2,3,4",
);

const maiorSlot = Math.max(
  ...Object.values(SKILL_PACKS).flatMap((p) =>
    p.skills.map((s) => s.slot),
  ),
);

conferir(
  "e o limite e o mesmo das classes",
  slotsDoCatalogo.at(-1) === maiorSlot,
);

conferir(
  "nenhuma classe passa do catalogo",
  Object.values(SKILL_PACKS).every((p) => p.skills.every(
    (s) => slotsDoCatalogo.includes(s.slot),
  )),
);

/**
 * UM SAVE COM O SLOT QUE NAO EXISTE MAIS.
 *
 * Quem tinha o painel aberto quando o limite caiu pode ter gravado um `slot5`.
 * Ele tem de ser ignorado em silencio: erro aqui derrubaria o jogo inteiro
 * por causa de uma preferencia antiga
 */
armazenamento.set(
  "rpg:keybinds:v1",
  JSON.stringify({ slot5: ["KeyJ"], atacar: ["Space"] }),
);

iniciarBinds();

conferir("o slot que sumiu e ignorado", acaoDaTecla("KeyJ") === null);
conferir("e as outras acoes sobrevivem", acaoDaTecla("Space") === "atacar");

/* ------------------------------------------------------------------ */

console.log(`\n${passou} ok, ${falhou} falhas\n`);

if (falhou) process.exit(1);
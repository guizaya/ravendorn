import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import express from "express";
import { WebSocketServer } from "ws";
import { ligarRedeDeSeguranca } from "./registroDeErros.js";
import { GameServer } from "./domain/GameServer.js";
import { Client } from "./domain/Client.js";
import {
  PASTA_PADRAO,
} from "./persistence/CharacterStore.js";
import { criarContas } from "./domain/Contas.js";
import { criarEmissorDeToken } from "./domain/TokenDeEntrada.js";
import {
  confirmarVinculo,
  pedirAssinatura,
  pedirAssinaturaDeEntrada,
  confirmarEntrada,
} from "./domain/Carteira.js";
import { SERVER_CONFIG } from "./config.js";
import {
  nameKey,
  validateName,
} from "../../src/data/characterName.js";
import {
  isReadableSave,
  saveClassOf,
} from "../../src/game/save/CharacterSave.js";
import { PROTOCOL_VERSION } from "../../src/shared/protocol.js";

const app = express();
const http = createServer(app);

/**
 * O CORS, POR ENQUANTO.
 *
 * ## POR QUE ELE E NECESSARIO AGORA
 *
 * Em dev o front roda no Vite dele (3000) e o servidor do jogo em outra porta
 * (8787). Origem diferente significa que o browser aplica a regra do CORS: a
 * resposta precisa dizer "pode ler". Sem o header, o `fetch` morre antes de
 * chegar no status — e o sintoma e um erro de CORS sem status nem corpo,
 * exatamente o que o painel do jogador ve
 *
 * O mesmo servidor tambem serve o front por proxy (quando o front sobe na
 * 3000 e o jogador entra pelo 8787), e nesse caminho NAO ha CORS: a origem e
 * a mesma. Este header e so para quando o front e aberto direto na 3000
 *
 * ## POR QUE `*`
 *
 * Temporario, e o usuario pediu assim para destravar. Em producao isso
 * permitira que qualquer site do navegador mandasse `POST /api/conta/...` com
 * o token de sessao de outra pessoa — o `Authorization` nao impede, porque o
 * navegador anexa o header que o codigo da pagina pediu
 *
 * ## A TROCA CORRETA
 *
 * `Access-Control-Allow-Origin: <origem exata>`, com a lista em env. A
 * origem e o esquema + host + porta, e o servidor compara com a que veio no
 * header `Origin`; se nao estiver na lista, nao devolve o header e o browser
 * bloqueia sozinho
 */
app.use((request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // o preflight e uma OPTIONS sem corpo: precisa da resposta antes da
  // requisicao de verdade, e e ela que o browser mostra como "CORS error"
  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json());

/**
 * AS CONTAS E O TOKEN, montados uma vez no boot.
 *
 * ## POR QUE SEM SEGREDO O SERVIDOR AINDA SOBE
 *
 * E o que mantem `npm run dev` funcionando para quem so quer mexer no
 * jogo. Sem `SEGREDO_DO_TOKEN`, nao ha contas e nao ha token: as rotas de
 * conta respondem 503 e o `GameServer` recebe `contas: null`, que e o
 * caminho antigo — o JOIN por nome, sem conta
 *
 * A alternativa era derrubar o servidor, que e melhor que servir um token
 * forjavel, mas derruba tambem quem esta so testando o mapa. O aviso vai
 * para o console, e quem for jogar de verdade precisa da variavel
 *
 * Em producao o segredo e obrigatorio, e quem liga o front tem que
 * configura-lo dos dois lados
 */
const segredoDoToken = process.env.SEGREDO_DO_TOKEN ?? null;

const contas = segredoDoToken
  ? criarContas({
      pasta: process.env.CONTA_DIR ?? undefined,
      segredoDoToken,
    })
  : null;

const emissor = segredoDoToken
  ? criarEmissorDeToken({
      segredo: segredoDoToken,
      segundosDeValidade: Number(process.env.SEGUNDO_DO_TOKEN ?? 60),
    })
  : null;

if (!segredoDoToken) {
  console.warn(
    "[contas] SEGREDO_DO_TOKEN nao definido: contas e token de entrada DESLIGADOS. " +
      "O jogo sobe, mas o front nao consegue entrar. Defina a variavel para ligar."
  );
}

/**
 * O TOKEN DA CONTA, e nao o token de entrada.
 *
 * Este e o que fica no navegador, em `localStorage`, e volta a cada
 * chamada do front. O de entrada (`emissor`) e outro, e vive segundos
 *
 * Sem este token a sessao morre com a aba. Com ele, o front recarrega e
 * ainda sabe quem e o jogador sem pedir o Google de novo
 */
const sessaoDeConta = new Map();

function emitirTokenDeConta(contaId, tipo) {
  const token = randomBytes(24).toString("base64url");
  const expiraEm = Date.now() + 30 * 24 * 60 * 60 * 1000;
  sessaoDeConta.set(token, { contaId, tipo, expiraEm });
  return { token, expiraEm };
}

/**
 * O token da conta -> a identidade, ou `null`
 *
 * ## POR QUE O TIPO VIA JUNTO
 *
 * `Contas.normalizarIdentidade` decide o prefixo do arquivo pelo `tipo`:
 * carteira vira `carteira_0x...`, Google vira o `sub` cru. Se o token
 * devolvesse so o `id`, a sessao procuraria `0x...` e nao acharia o
 * arquivo `carteira_0x...` — a conta existiria mas pareceria nao existir
 */
function identidadeDoTokenDeConta(token) {
  const registro = sessaoDeConta.get(token);

  if (!registro) return null;

  if (registro.expiraEm <= Date.now()) {
    sessaoDeConta.delete(token);
    return null;
  }

  return { tipo: registro.tipo, id: registro.contaId };
}

/** o header `Authorization: Bearer <token>`, como o front manda */
function identidadeDoPedido(request) {
  const header = request.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  return identidadeDoTokenDeConta(token);
}

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "rpg-2d-prototype-server",
    players: jogo.jogadores,
    protocolVersion: PROTOCOL_VERSION,
    timestamp: new Date().toISOString(),
  });
});

/**
 * A SAUDE DE VERDADE.
 *
 * O `/health` de cima responde `ok` mesmo com o mundo congelado: ele
 * so diz que o processo existe. Esta rota diz se o laco estaandando.
 *
 * A distincao importa porque `errosDeTick` parava o `setInterval` sem
 * derrubar o processo, e o health continuava verde. Um monitor que
 * so olha o `/health` nunca veria o jogo parado
 */
app.get("/health/laco", (_request, response) => {
  const tique = jogo.saudeDoLaco();

  response.status(tique.rodando ? 200 : 503).json({
    rodando: tique.rodando,
    tickRate: SERVER_CONFIG.tickRate,
    ...tique,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/version", (_request, response) => {
  response.json({
    protocolVersion: PROTOCOL_VERSION,
  });
});

app.get("/api/capabilities", (_request, response) => {
  response.json({
    ...SERVER_CONFIG.capabilities,
    players: jogo.jogadores,
  });
});

/**
 * O QUE JA EXISTE COM ESSE NICKNAME.
 *
 * E a consulta que o botao JOGAR faz antes de abrir o socket, e o que
 * transforma a recusa em aviso imediato na tela de selecao.
 *
 * Sem ela, o jogador so descobre que o personagem esta logado ou que a
 * classe nao bate depois de entrar no mundo, quando a tela do mapa ja
 * abriu e o socket ja conectou — e o aviso chega tarde, sozinho, num
 * canto da tela de jogo
 *
 * O nome vai pela mesma chave que o save usa (`nameKey`), entao
 * "Teste", "teste " e "TESTE" sao o mesmo personagem aqui e no disco.
 * E a MESMA regra que `GameServer.entrar` aplica: este endpoint ANTECIPA
 * o que o servidor faria, e nao substitui o servidor — um cliente
 * adulterado continua sendo recusado no JOIN
 */
app.get("/api/personagem/:nome", (request, response) => {
  const nome = request.params.nome ?? "";

  const checagem = validateName(nome);

  // nome invalido nao e consulta: e erro de digitacao, e a tela de
  // selecao ja cuida disso antes de consultar
  if (!checagem.ok) {
    response.status(400).json({
      ok: false,
      erro: checagem.reason,
    });
    return;
  }

  const chave = nameKey(checagem.value);

  // O MESMO NICKNAME, OUTRA SESSAO CONECTADA
  //
  // `.keys()` e nao `.values()`: o `clients` e um Map cuja CHAVE e o
  // client e o valor e um `true` de ocupacao. Ler os valores daria uma
  // lista de booleanos, e `true.joined` e `undefined` — o que fazia
  // esta consulta responder "ninguem logado" mesmo com o personagem
  // conectado. E `entrar` usa `keys()`, que e a razao de o servidor
  // recusar e a tela liberar
  const logado = [...jogo.clients.keys()].some(
    (client) =>
      client.joined &&
      client.session &&
      nameKey(client.session.name) === chave,
  );

  // O PERSONAGEM JA SALVO, E EM QUE CLASSE
  let classeDoSave = null;

  if (!logado) {
    const salvo = jogo.saves?.carregar(checagem.value) ?? null;

    if (salvo && isReadableSave(salvo)) {
      classeDoSave = saveClassOf(salvo) ?? null;
    }
  }

  response.json({
    ok: true,
    logado,
    existe: Boolean(classeDoSave),
    classe: classeDoSave,
  });
});

/**
 * AS ROTAS DA CONTA.
 *
 * ## POR QUE ESTAS ROTAS EXISTEM NO SERVIDOR DO JOGO
 *
 * Elas substituem o que o Supabase fazia no front antigo: guardar a conta,
 * os personagens e os diamantes. O `localStorage` sumiu — trocar de navegador
 * nao pode mais apagar ninguem, e o servidor ja era a autoridade do save do
 * personagem pelo outro lado
 *
 * ## O TOKEN DA CONTA, E O `Authorization: Bearer`
 *
 * O front guarda o token que ganha aqui e o manda em cada chamada. Ele e o
 * que diz "eu sou a conta tal". E o `identidadeDoPedido` que o le
 *
 * ## POR QUE O TOKEN DE ENTRADA E OUTRO
 *
 * O token de conta fica no navegador por 30 dias. O token de entrada vive
 * segundos e vai na URL do redirecionamento, uma vez so. Sao papeis
 * diferentes: um e o cracha, o outro e a passagem de uso unico
 */

/** a conta logada, ou `401` */
function exigeConta(request, response) {
  const identidade = identidadeDoPedido(request);

  if (!identidade) {
    response.status(401).json({ erro: "SEM_SESSAO" });
    return null;
  }

  return identidade;
}

/**
 * LOGIN PELA CARTEIRA, em duas etapas.
 *
 * 1. o front chama `/pedir-assinatura` e recebe a mensagem com o nonce
 * 2. a MetaMask assina, e o front devolve a assinatura aqui
 *
 * O endereco so vira conta DEPOIS que a assinatura prova que pertence a
 * quem esta conectando
 */
app.post("/api/conta/carteira", (request, response) => {
  const { endereco, assinatura } = request.body ?? {};

  const resultado = confirmarVinculo({ endereco, assinatura });

  if (resultado.erro) {
    response.status(400).json({ erro: resultado.erro });
    return;
  }

  // a conta e a CARTEIRA: o endereco verificado e a identidade, e nao um
  // campo que o cliente escreve
  const identidade = { tipo: "carteira", id: resultado.endereco };

  const conta = contas.criarSeNaoExiste(identidade);

  /**
   * A CONTA PRECISA EXISTIR ANTES DE EMITIR SESSAO.
   *
   * Sem esta checagem, um `criarSeNaoExiste` que falhasse por id invalido
   * devolveria `null`, o `resumo` viria `null`, e a rota responderia 200
   * com um token de sessao para uma conta que nao esta no disco — o
   * jogador entraria e a tela mostraria uma conta vazia que some ao
   * recarregar
   */
  if (!conta) {
    response.status(400).json({ erro: "IDENTIDADE_INVALIDA" });
    return;
  }

  const sessao = emitirTokenDeConta(identidade.id, "carteira");

  response.json({
    token: sessao.token,
    expiraEm: sessao.expiraEm,
    identidade: { tipo: "carteira", endereco: resultado.endereco },
    resumo: contas.resumo(identidade),
  });
});

/**
 * O PASSO 1 DA CARTEIRA: o servidor monta a mensagem e o nonce.
 *
 * O front leva `mensagem` para a MetaMask, que assina, e devolve a
 * assinatura para `/api/conta/carteira` acima
 */
app.post("/api/conta/carteira/pedir-assinatura", (request, response) => {
  const { endereco } = request.body ?? {};

  const resultado = pedirAssinatura(endereco);

  if (resultado.erro) {
    response.status(400).json({ erro: resultado.erro });
    return;
  }

  response.json({ endereco: resultado.endereco, mensagem: resultado.mensagem });
});

/**
 * A CONTA LOGADA.
 *
 * Devolve o resumo (diamantes, vagas, personagens) sem o email e sem o
 * endereco da carteira: o front so precisa do que desenha a tela
 */
app.get("/api/conta", (request, response) => {
  const identidade = exigeConta(request, response);

  if (!identidade) return;

  const resumo = contas.resumo(identidade);

  if (!resumo) {
    response.status(404).json({ erro: "CONTA_NAO_ENCONTRADA" });
    return;
  }

  response.json(resumo);
});

/** A LISTA DE PERSONAGENS da conta, que e o que a tela consome */
app.get("/api/conta/personagens", (request, response) => {
  const identidade = exigeConta(request, response);

  if (!identidade) return;

  response.json({ personagens: contas.personagens(identidade) });
});

/** CRIA UM PERSONAGEM. O nome e a classe passam pelas regras do SERVIDOR */
app.post("/api/conta/personagens", (request, response) => {
  const identidade = exigeConta(request, response);

  if (!identidade) return;

  const { nome, classe } = request.body ?? {};

  const resultado = contas.criarPersonagem(identidade, { nome, classe });

  if (resultado.erro) {
    response.status(400).json(resultado);
    return;
  }

  response.status(201).json({ personagem: resultado.personagem });
});

/** APAGA UM PERSONAGEM da conta */
app.delete("/api/conta/personagens/:id", (request, response) => {
  const identidade = exigeConta(request, response);

  if (!identidade) return;

  const apagado = contas.apagarPersonagem(identidade, request.params.id);

  if (!apagado) {
    response.status(404).json({ erro: "PERSONAGEM_NAO_ENCONTRADO" });
    return;
  }

  response.json({ ok: true });
});

/** DESBLOQUEIA A PROXIMA VAGA, debitando diamantes */
app.post("/api/conta/vaga", (request, response) => {
  const identidade = exigeConta(request, response);

  if (!identidade) return;

  const resultado = contas.desbloquearVaga(identidade);

  if (resultado.erro) {
    response.status(400).json(resultado);
    return;
  }

  response.json(contas.resumo(identidade));
});

/**
 * O TOKEN DE ENTRADA: a ponte para o jogo.
 *
 * ## O TOKEN DE SESSAO SOZINHO NAO ABRE MAIS O MAPA
 *
 * Esta rota so emite depois que a DONA DA CONTA assinou, na rota de baixo.
 * O token de sessao continua valendo por 30 dias e continua guardando a
 * conta — listar, criar e apagar personagem seguem funcionando sem carteira
 * — mas ele sozinho nao entrega mais um token de entrada
 *
 * E o que fecha o furo que o `Access-Control-Allow-Origin: "*"` abria: antes,
 * qualquer site da internet podia mandar `POST /api/entrada` com o token de
 * sessao de outra pessoa (o `Authorization` nao impede, porque o navegador
 * anexa o header que o codigo da pagina pediu) e entrar com o personagem
 * dela. Agora falta a assinatura, e a assinatura nao se rouba de um header
 *
 * ## POR QUE O PERSONAGEM E RESOLVIDO AQUI E NAO PELO CLIENTE
 *
 * Porque o token de sessao nao diz qual personagem. O front manda o
 * `personagemId`, e o `Contas` confirma que a conta TEM ele. O token sai
 * com o nome e a classe que o servidor leu — nao com os que o cliente
 * mandou
 */
app.post("/api/entrada", (request, response) => {
  const identidade = exigeConta(request, response);

  if (!identidade) return;

  const { personagemId, assinatura } = request.body ?? {};

  const personagens = contas.personagens(identidade);

  const personagem = personagens.find((p) => p.id === personagemId);

  if (!personagem) {
    response.status(404).json({ erro: "PERSONAGEM_NAO_ENCONTRADO" });
    return;
  }

  /**
   * SO CONTA DE CARTEIRA ENTRA ASSINANDO.
   *
   * Uma conta sem carteira nao tem nada para assinar. Recusar aqui e melhor
   * do que emitir token sem assinatura: o token de sessao e de 30 dias, e um
   * "deixa passar" silencioso viraria um buraco permanente
   */
  if (identidade.tipo !== "carteira") {
    response.status(403).json({ erro: "CONTA_SEM_CARTEIRA" });
    return;
  }

  /**
   * `identidade.id` E O ENDERECO, E ELE SAIU DO TOKEN.
   *
   * Para conta de carteira, o id da identidade e o endereco verificado na
   * assinatura do login (`index.js:333`). Ele nao vem do corpo do pedido, e
   * por isso que comparar contra ele prova alguma coisa — um `endereco` no
   * corpo seria o cliente provando a posse de si mesmo
   */
  const conferencia = confirmarEntrada({
    contaId: identidade.id,
    enderecoEsperado: identidade.id,
    personagemId,
    assinatura,
  });

  if (conferencia.erro) {
    response.status(400).json({ erro: conferencia.erro });
    return;
  }

  const token = emissor.emitir({
    contaId: identidade.id,
    tipoConta: identidade.tipo,
    nome: personagem.nome,
    classe: personagem.classe,
  });

  response.json({ token, personagem });
});

/**
 * O PASSO 1 DA ENTRADA: o servidor monta a mensagem e guarda o pedido.
 *
 * O front leva `mensagem` para a MetaMask, que assina, e devolve a assinatura
 * para `/api/entrada` acima
 *
 * ## POR QUE ESTA ROTA EXIGE O TOKEN DE SESSAO
 *
 * Porque ela precisa saber QUAL conta vai entrar. Sem o token, nao ha conta,
 * nao ha endereco dono para escrever na mensagem, e nao ha personagem para
 * amarrar a assinatura — a rota viria um pedido de assinatura que so o
 * jogador, com o servidor, poderia atender
 */
app.post("/api/entrada/pedir-assinatura", (request, response) => {
  const identidade = exigeConta(request, response);

  if (!identidade) return;

  if (identidade.tipo !== "carteira") {
    response.status(403).json({ erro: "CONTA_SEM_CARTEIRA" });
    return;
  }

  const { personagemId } = request.body ?? {};

  const personagens = contas.personagens(identidade);

  const personagem = personagens.find((p) => p.id === personagemId);

  if (!personagem) {
    response.status(404).json({ erro: "PERSONAGEM_NAO_ENCONTRADO" });
    return;
  }

  const resultado = pedirAssinaturaDeEntrada({
    contaId: identidade.id,
    endereco: identidade.id,
    personagem,
  });

  if (resultado.erro) {
    response.status(400).json({ erro: resultado.erro });
    return;
  }

  response.json({ mensagem: resultado.mensagem });
});

/**
 * O FRONT E O JOGO, PASSANDO PELO MESMO ENDERECO.
 *
 * ## POR QUE IMPORTAR SER O MESMO
 *
 * O jogo deriva o endereco do WebSocket de `window.location`
 * (`useGameClient.js`): `ws://` ou `wss://` + host + `/ws`. Se o front
 * rodasse em outro dominio, o jogador buscaria o socket no host errado
 *
 * ## POR QUE UM PROXY, E NAO ARQUIVOS ESTATICOS
 *
 * Porque o front e SSR: o TanStack Start gera o `index.html` em RUNTIME, e
 * nao existe HTML no build. O que sai em `.output/public` e so `assets`,
 * `favicon` e `robots`
 *
 * `express.static` serviria a pasta e o jogador receberia 404 em `/`, sem
 * documento nenhum. O que da certo e repassar a requisicao ao servidor do
 * Nitro e deixar ELE montar o HTML
 *
 * A alternativa seria virar o front em SPA, que perderia o SSR e a landing
 * page — que existe para ser indexada — cairia para um esqueleto
 *
 * ## A ORDEM IMPORTA
 *
 * Este bloco vem DEPOIS de todas as rotas de API e ANTES do 404. Se viesse
 * antes, `/api/conta` iria para o front e a tela de personagem receberia
 * HTML onde esperava JSON — erro que apareceria como "a tela nao carrega",
 * longe da causa
 *
 * ## QUANDO O NITRO NAO ESTA NO AR
 *
 * O proxy responde 502 com uma frase que diz o que fazer. Um 404 silencioso
 * seria pior: o jogador veria uma tela vazia e culparia o servidor
 */
const PORTA_DO_FRONT = Number(process.env.FRONT_PORT ?? 3000);

async function repassarParaOFront(request, response) {
  const destino = `http://127.0.0.1:${PORTA_DO_FRONT}${request.originalUrl}`;

  try {
    const resposta = await fetch(destino, {
      method: request.method,
      headers: {
        // o host original e o que o front usa para montar as URLs
        host: request.headers.host ?? `localhost:${SERVER_CONFIG.port}`,
        accept: request.headers.accept ?? "text/html",
      },
    });

    response.status(resposta.status);

    const tipo = resposta.headers.get("content-type");

    if (tipo) response.setHeader("content-type", tipo);

    const corpo = Buffer.from(await resposta.arrayBuffer());

    response.end(corpo);
  } catch (erro) {
    // o Nitro responde HTML, e este 502 precisa ser legivel no navegador
    response
      .status(502)
      .type("text/html")
      .send(
        "<h1>O site nao subiu</h1>" +
          "<p>O front (Nitro) nao respondeu na porta " +
          PORTA_DO_FRONT +
          ".</p>" +
          "<p>Rode <code>npm run dev</code> dentro de <code>front_rpg/</code> " +
          "e recarregue esta pagina.</p>" +
          `<p style="color:#888">${erro instanceof Error ? erro.message : String(erro)}</p>`
      );
  }
}

/**
 * O JOGO: `dist/` SERVIDO AQUI, E O IFRAME DO FRONT APONTANDO PARA ELE.
 *
 * ## POR QUE OS ARQUIVOS DO JOGO SAO SERVIDO AQUI
 *
 * O `jogo.html` e o bundle que o `vite build` da raiz produz. O iframe da
 * rota `/jogo` do front aponta para ele, e ele precisa sair da MESMA origem
 * que o WebSocket: assim o `urlDoServidor()` do jogo, que deriva o socket de
 * `window.location`, acerta o `/ws` sem configuracao e sem CORS
 *
 * ## POR QUE O `index.html` DO JOGO NAO E SERVIDO NA RAIZ
 *
 * Porque o `dist/` tem DOIS html: o `index.html` (o jogo aberto direto) e o
 * `jogo.html` (o jogo dentro do iframe). O `express.static` responderia
 * `index.html` na `/` e o site receberia a tela de selecao de classe em vez
 * da landing page — o sintoma seria "o site virou o jogo"
 *
 * E por isso que o `index` do static aponta para o `jogo.html`: nenhum
 * arquivo de entrada do jogo disputa a raiz com o proxy do front, e quem
 * responde `/` continua sendo o site
 */
const PASTA_DO_JOGO = process.env.JOGO_DIR ?? "dist";

/**
 * O `index.html` DO JOGO VIRA `jogo.html`.
 *
 * O `dist/` tem os dois html de entrada: o `index.html` (o jogo aberto
 * direto, util para desenvolver) e o `jogo.html` (o jogo dentro do iframe).
 * Os dois montam o mesmo bundle, entao responder `index.html` com o
 * `jogo.html` e o mesmo documento com o titulo certo
 *
 * Sem isso, `/index.html` devolveria a tela de selecao de classe no meio do
 * site, que e confuso sem ser um erro visivel
 */
app.get("/index.html", (_request, response) => {
  response.sendFile(resolve(PASTA_DO_JOGO, "jogo.html"));
});

/**
/**
/**
 * O ARQUIVO JA COMPRIMIDO, SEM NENHUMA MANIPULACAO DE STREAM.
 *
 * ## POR QUE NAO UM MIDDLEWARE DE GZIP COMUM
 *
 * ## Porque a versao que existia antes quebrou de tres jeitos seguidos
 *
 * A primeira versao trocava `res.write` e `res.end` para enfiar o `zlib` no
 * meio da resposta. E o caminho que todo mundo escreve, e ele tem tres armadilhas
 * que so aparecem em producao:
 *
 * 1. O `pipe` do Node nao guarda o `dest.write` no momento da ligacao — ele
 *    procura `dest.write` a cada pedaco. Como o destino era a propria resposta,
 *    que ja tinha o `write` trocado, o fluxo virava laco: o `gzip` escrevia,
 *    o `write` trocado recebia, devolvia para o `gzip`, e ele morria com
 *    "write after end"
 *
 * 2. O `pipe` tambem chama `dest.end()` quando acaba. Esse `end` era o trocado,
 *    que chamava `gzip.end()` sobre um `zlib` ja encerrado, e a conexao nunca
 *    fechava. Todo arquivo devolvia "timeout esperando cabecalho"
 *
 * 3. O `Content-Length` do Express e escrito DEPOIS do middleware. Com o
 *    cabecalho antigo no lugar, o navegador cortava a resposta no byte errado,
 *    e o sintoma era "erro de sintaxe" no bundle
 *
 * ## O QUE ESTA AQUI EM VEZ DISSO
 *
 * O arquivo comprimido ja e um arquivo. Nao entra stream nenhuma, nao se troca
 * `write` nem `end`, e o Express continua respondendo por `sendFile` — com o
 * mesmo `ETag`, o mesmo `Last-Modified` e o mesmo tratamento de `HEAD` de
 * antes
 *
 * O unico preco e um arquivo `.gz` no `dist/`, que o build gera junto do
 * original e ninguem pede sem `Accept-Encoding`
 */
function servirArquivoComprimido(request, response, next) {
  if (!String(request.headers["accept-encoding"] ?? "").includes("gzip")) {
    next();

    return;
  }

  /**
   * A BARRA DA FRENTE TEM QUE SAIR ANTES DO `resolve`.
   *
   * No Windows, `resolve("C:/jogo", "/assets/x.js")` devolve `C:\assets\x.js`:
   * a barra inicial e lida como raiz da unidade, e o caminho inteiro da pasta
   * do jogo se perde. O resultado era `existsSync` sempre falso e a compressao
   * nunca acontecia — silenciosamente, com o build verde
   *
   * E o `join` nao resolveria: ele normaliza, mas `resolve` e `join` divergem
   * justamente no `..` que o guarda abaixo precisa enxergar
   */
  const caminhoRelativo = request.path.replace(/^\/+/, "");

  const original = resolve(PASTA_DO_JOGO, caminhoRelativo);

  /**
   * O `startsWith` IMPORTA MAIS DO QUE PARECE.
   *
   * Sem ele, um caminho como `/../../server/src/index.js` montaria um
   * `original` fora da pasta do jogo, e o `existsSync` acharia o arquivo. A
   * checagem e o que impede o gzip de virar um caminho para ler arquivo
   * qualquer do servidor
   */
  if (!original.startsWith(resolve(PASTA_DO_JOGO))) {
    next();

    return;
  }

  const comprimido = `${original}.gz`;

  if (!existsSync(comprimido)) {
    next();

    return;
  }

response.setHeader("Content-Encoding", "gzip");
  response.setHeader("Vary", "Accept-Encoding");

  /**
   * O `Content-Type` VEM DO ARQUIVO ORIGINAL, E NAO DO `.gz`.
   *
   * ## O QUE ACONTECIA SEM ESTA LINHA
   *
   * O `sendFile` olha a EXTENSAO do arquivo que ele esta servindo. Servindo
   * `main-DqX0xFTT.js.gz`, eleRespondia `Content-Type: application/gzip` — que e
   * a verdade sobre os bytes, e a coisa mais inutil que um navegador pode ler
   * para decidir o que fazer com eles
   *
   * E o navegador obedece a letra:
   *
   * - no `.js`, ele recusa o modulo. O erro no console e "Expected a JavaScript
   *   module script but the server responded with a MIME type of
   *   'application/gzip'", e o `main.jsx` nunca roda
   * - no `.css`, ele ignora a folha de estilo
   * - no `.html`, ele BAIXA o arquivo em vez de mostrar, porque `text/html` e o
   *   que manda o navegador a renderizar
   *
   * Os tres sintomas sairam dai de uma vez: o jogo.html baixado em vez de
   * aberto, o mundo preso em "Carregando o mundo" — porque o jogo nunca
   * executou e nunca mandou o `pronto` —, e o CSS do front sem aplicar
   *
   * ## POR QUE `response.type` E NAO UM MAPA DE EXTENSAO
   *
   * Porque o proprio Express ja sabe transformar extensao em tipo, e e o mesmo
   * que ele usaria se estivesse servindo o arquivo sem gzip. Passando o caminho
   * ORIGINAL, o tipo sai certo por definicao e continua certo para qualquer
   * extensao nova
   */
  /**
   * SO O NOME DO ARQUIVO, E NAO O CAMINHO.
   *
   * O `res.type()` decide o que fazer olhando se o valor tem barra: com barra,
   * ele entende que voce JA passou um tipo MIME e usa a string como esta. Passar
   * `assets/main-X.js` fazia o servidor responder
   * `Content-Type: assets/main-X.js`, que e o arquivo inteiro no cabecalho
   *
   * Sem barra, ele procura a extensao. E por isso que o `.js` e o `.css` sairam
   * quebrados na primeira tentativa, e o `.html` saiu certo por acaso: era o
   * unico dos tres sem barra no caminho
   */
  response.type(basename(caminhoRelativo));

  /**
   * A TRAVA, E O QUE ELA EVITA.
   *
   * ## O QUE ACONTECEU
   *
   * Uma versao anterior desta funcao passou o caminho inteiro para o `res.type`,
   * e ele respondeu `Content-Type: application/gzip`. O navegador obedeceu: o
   * JavaScript foi recusado por ser do tipo errado, o CSS foi ignorado, e o
   * `jogo.html` foi BAIXADO em vez de aberto. O mundo travou em "Carregando o
   * mundo" porque o jogo nunca executou
   *
   * E o que piorou muito: `application/gzip` era servido com
   * `Cache-Control: immutable, max-age=31536000`. O navegador guardou a resposta
   * quebrada por UM ANO, em uma URL que nao mudou, porque o defeito estava no
   * servidor e nao no arquivo. Corrigir o servidor naocorrige o cache
   *
   * ## POR QUE ESTA TRAVA EXISTE
   *
   * Porque um `Content-Type` errado deixa de ser "o jogo nao abre" e vira "o
   * cache do jogador segura o defeito por um ano". Nenhum teste de build pega
   * isso: o arquivo sai certo, o hash e o mesmo, e o build verde
   *
   * Aqui o tipo errado nao chega na rede. O pedido cai para o `express.static`,
   * que serve o arquivo SEM gzip e com o tipo certo. O jogador paga alguns KB a
   * mais e o jogo abre — degradation em performance, nunca em funcionamento
   */
  const tipoDefinido = String(response.getHeader("Content-Type") ?? "");

  if (
    !tipoDefinido ||
    tipoDefinido.includes("gzip") ||
    tipoDefinido.includes("octet-stream")
  ) {
    next();

    return;
  }

  /**
   * O CACHE DE UM ANO TEM QUE VIR AQUI, E NAO SO NO `express.static`.
   *
   * ## O QUE ACONTECEU SEM ESTAS DUAS LINHAS
   *
   * O `immutable` estava configurado na montagem de `/assets`. Mas este caminho
   * responde pelo `sendFile`, ANTES dela — e o `sendFile` nao herda opcao de
   * `express.static`. O arquivo saia com `Cache-Control: public, max-age=0`:
   *
   *   - o navegador revalidava o `.gz` a cada visita
   *   - e, como e o `.gz` que ele pede, o cache de um ano nao valia para NADA
   *
   * Era o ganho maior do trabalho inteiro, e o furo estava no caminho que todo
   * navegador usa. Pior: nao dava erro nenhum, o gzip funcionava e o arquivo
   * chegava — so que o cache nunca segurava
   */
  if (caminhoRelativo.startsWith("assets/")) {
    response.setHeader(
      "Cache-Control",
      "public, max-age=31536000, immutable",
    );
  }

  response.sendFile(comprimido, (erro) => {
    /**
     * O `sendFile` SEM CALLBACK RESPONDE 404 COM HTML.
     *
     * E um comportamento padrao do Express que nao serve aqui: o arquivo existe,
     * e uma falha de disco neste ponto precisa aparecer no log, e nao como um
     * 404 que o jogador le como "o jogo saiu do ar"
     */
    if (erro && !response.headersSent) next();
  });
}

app.use(servirArquivoComprimido);

/**
 * O ASSET COM HASH, COM CACHE DE UM ANO.
 *
 * ## POR QUE SO `/assets`
 *
 * Porque o nome do arquivo dentro de `assets/` tem o hash do conteudo:
 * `new_grama_mapa_1-m-_bFaYb.webp`. Mudou o arquivo, mudou o hash, mudou o
 * nome — entao o nome novo e um arquivo que o navegador NUNCA viu, e o
 * `immutable` nao corre risco nenhum
 *
 * ## E POR QUE O HTML PRECISA FICAR DE FORA
 *
 * Porque `jogo.html` e o unico arquivo cujo nome nao muda quando o conteudo
 * muda. Com cache de um ano nele, um build novo continuaria servindo o bundle
 * antigo — e o jogador veria uma tela quebrada com o JS novo pedindo arquivo
 * que nao existe mais. E o pior defeito possivel num deploy: silencioso
 *
 * Por isso o `assets` tem uma montagem propria, e a raiz fica sem cache
 */
app.use(
  "/assets",
  express.static(resolve(PASTA_DO_JOGO, "assets"), {
    immutable: true,
    maxAge: "365d",
    fallthrough: true,
  }),
);

app.use(
  express.static(resolve(PASTA_DO_JOGO), {
    /**
     * `index: false`, E O COMMENTARIO ANTES DISSO ESTAVA AO CONTRARIO.
     *
     * ## O QUE ACONTECIA COM `index: "jogo.html"`
     *
     * A opcao `index` e o que faz o `express.static` responder a `/`. Com ela
     * ligada, a montagem da raiz ganhava de todo mundo: `GET /` batia no
     * `express.static`, servia o `jogo.html` e nunca chegava no
     * `repassarParaOFront`, que esta DEPOIS
     *
     * O jogo tomava a raiz do site. Quem abria `http://localhost:8787` recebia
     * o jogo direto, com a aba escrita "Eldoria" (o titulo do `jogo.html`),
     * em vez da landing page
     *
     * ## O QUE O PROPRIO CODIGO PROMETIA, E NAO CUMPRIA
     *
     * O comentario logo acima diz, textualmente:
     *
     *   "E por isso que o `index` do static aponta para o `jogo.html`: nenhum
     *    arquivo de entrada do jogo disputa a raiz com o proxy do front, e quem
     *    responde `/` continua sendo o site"
     *
     * A intencao estava escrita. So que apontar o `index` para um arquivo faz
     * exatamente o contrario: e ele que FAZ a raiz ser do jogo
     *
     * Para o arquivo nao disputar a raiz, ele nao pode ser o `index`
     *
     * ## POR QUE `false`, E NAO REMOVER A MONTAGEM
     *
     * Porque `/jogo.html` e `/assets/*` precisam continuar saindo daqui: e o
     * iframe da rota `/jogo` do front aponta para eles, e precisam ser da MESMA
     * origem do WebSocket. Com `index: false` a montagem continua servindo
     * arquivo por nome, e so a RAIZ deixa de ser dela
     */
    index: false,

    /**
     * O HTML SEM CACHE LONGO, MAS COM REVALIDACAO.
     *
     * O `etag` faz o trabalho: o navegador manda o arquivo em uma requisicao
     * de 304, que responde em bytes, e so baixa o HTML inteiro quando ele
     * mudou de verdade
     */
    maxAge: 0,
    etag: true,
    lastModified: true,
  }),
);

// as rotas do front sao tudo que NAO e api, health ou o proprio socket
app.get(/.*/, repassarParaOFront);

app.use((_request, response) => {
  response.status(404).json({
    error: "Rota nao encontrada",
  });
});

/**
 * O jogo.
 *
 * A persistencia fica LIGADA de proposito: o personagem e o nome, e
 * fechar o navegador nao pode apagar o trabalho. `PASTA_DE_SAVES`
 * deixa a pasta de fora do projeto, e `SAVE_DIR` aponta para ela.
 */
const jogo = new GameServer({
  persistencia: {
    pasta: process.env.SAVE_DIR ?? PASTA_PADRAO,
  },

  /**
   * AS CONTAS LIGADAS NO MUNDO.
   *
   * Com `contas` presente, o JOIN passa a exigir o token de entrada e o
   * nome e a classe sao lidos DELE, e nao do pacote. E o que fecha o
   * buraco do `JOIN { name, classId }` pelo console
   *
   * Sem `contas` — o jogo local, os testes — o JOIN volta a ser o de
   * sempre, porque `this.contas` e o que decide. Nao ha flag separada
   */
  contas,
  verificadorDeToken: (token) => emissor.verificar(token),
});

// o mesmo servidor HTTP responde o WebSocket. subir dois
// servidores em portas diferentes obriga o cliente a saber duas
// portas e cria um ponto de falha a mais
const wss = new WebSocketServer({
  server: http,
  path: "/ws",

  /**
   * `maxPayload` no `ws`, e nao so o limite manual do `message`.
   *
   * O `LIMITE_MENSAGEM` abaixo checa `bruto.length`, mas o `ws` JA
   * materializou o frame inteiro em memoria para chegar ate aqui. Um
   * cliente mandando 50MB de `INPUT` gastava os 50MB antes de levar
   * `close(1009)`. O limite no `ws` barra na hora da leitura
   */
  maxPayload: 8 * 1024,

  /**
   * COMPRESSÃO DO PAINEL.
   *
   * O `PLAYER_STATE` tem ~154KB, dos quais 112KB são o catálogo de
   * receitas — JSON altamente repetitivo, que é exatamente o caso que o
   * DEFLATE comprime para perto de 10%. O default do `ws@8` é
   * `false`, então antes disso o servidor mandava ~37MB/s só para
   * estado com 50 jogadores
   *
   * `concurrencyLimit` em 10 e o teto de negociacoes por socket: sem
   * ele, um pico de reconexao faz o servidor abrir dezenas de
   * negociacoes ao mesmo tempo para o mesmo socket, e cada uma
   * reserva memória para a janela do compressor
   */
  perMessageDeflate: {
    threshold: 1024,
    concurrencyLimit: 10,
  },
});

/**
 * O tamanho maximo de uma mensagem.
 *
 * Sem isso, um cliente so mandando `INPUT` de 50 MB faria o
 * servidor guardar tudo em memoria antes de notar que o JSON nao
 * presta. 8 KB e folgado para o maior comando valido.
 */
const LIMITE_MENSAGEM = 8 * 1024;

/**
 * QUEM ESTA VIVO.
 *
 * Sem isso um socket MORTO fica registrado para sempre. O caso comum
 * nao e o servidor derrubar o cliente: e o cabo puxado, o NAT com a
 * sessao expirada, ou a aba do navegador suspensa pelo SO. Nenhum dos
 * tres gera `close` — o socket fica "aberto" dos dois lados, o
 * `joined` continua `true`, e o tick segue montando um painel de 154KB
 * a 4Hz para um destinatario que nao le. Com `ws` isso vira buffer no
 * processo do servidor crescendo sem limite
 *
 * O `ping` do `ws` e a forma barata de descobrir: o kernel responde
 * `pong` sozinho, e quem nao responder em 30s esta morto
 *
 * O intervalo e de 30s porque e o piso do NAT UDP para considerar um
 * pacote descartado. Va abaixo disso, uma rede intermediaria com
 * timeout curto derruba jogador que estava de boa
 */
const BATIMENTO_MS = 30_000;

const vivos = new Set();

/**
 * O NASCIMENTO DO SOCKET, E A HORA DE ABRIR O RELOGIO DE VIDA.
 *
 * Sem isso, um `close` so diz "acabou", e nao ha como distinguir um jogador
 * que fechou a aba de um processo que morreu no meio do tique
 */
const nasceuEm = new WeakMap();

/**
 * A CAUSA DO FECHAMENTO, POR SOCKET.
 *
 * ## POR QUE UM `WeakMap` E NAO UM `Map`
 *
 * Porque e a mesma razao do `nasceuEm`: a chave e o socket, e o valor so
 * importa enquanto ele existe. Um `Map` seguraria o socket forte e a entrada
 * depois que o `close` passou por aqui — vazamento que cresce com o numero de
 * conexoes da vida do processo
 *
 * ## O QUE VAI AQUI
 *
 * A descricao em portugues do que o SERVIDOR fez, escrita no instante da
 * decisao. E o unico lugar do codigo onde a causa ainda existe: depois que o
 * `close` chega, o `code` sozinho ja nao conta
 */
const motivosDoSocket = new WeakMap();

wss.on("connection", (socket) => {
  nasceuEm.set(socket, Date.now());

/**
   * POR QUE ESTE SOCKET FECHOU, DO PONTO DE VISTA DO SERVIDOR.
   *
   * ## O QUE ELE RESOLVE
   *
   * O `1005` e um codigo que NUNCA vai pelo fio: e o que a biblioteca inventa
   * quando o socket fecha sem close frame. O `close` chega aqui com `code` e
   * `motivo` vazios, e o log antigo so tinha isso para trabalhar — ele acabava
   * avisando sobre `1006` e `1011` em cima de um evento que nao era nenhum dos
   * dois
   *
   * ## POR QUE A CAUSA SE PERDE SO NESSAS SITUACOES
   *
   * Quando o SERVIDOR fecha, o codigo existe: `socket.close(1009, ...)` manda
   * 1009, `socket.close(1011, ...)` manda 1011. Quando fecha sem codigo nenhum
   * e o `terminate()`, do batimento — ele nao manda frame nenhum, porque a
   * ideia dele e matar na hora
   *
   * Entao: quando o codigo vem, a causa ja esta no codigo. Quando nao vem
   * (1005), a unica forma de saber se foi o servidor e o no TER MARCADO antes
   *
   * ## E POR QUE ISSO E PRECISO, E NAO UM LUXO
   *
   * Porque um `1005` repetido, sem nenhuma pista, e indistinguivel de uma queda
   * real. Quem le o terminal nao sabe se deve investigar ou ignorar. Marcar o
   * motivo no ponto em que a decisao e tomada e o unico lugar onde ele ainda
   * existe
   *
   * ## E POR QUE O NOME NAO E `motivo`
   *
   * Porque o `close` e o `error` ja usam `motivo` como parametro, para o texto
   * que veio no frame. Somar um `motivo()` aqui seria a mesma variavel com dois
   * papeis — e o `mapa` e uma `const` de fora do callback, que sobreviveria,
   * enquanto o parametro nao
   */
  const marcar = (descricao) => {
    motivosDoSocket.set(socket, descricao);
  };

  const client = new Client(socket);

  /**
   * O `isAlive` e o `pong` sao o heartbeat.
   *
   * O `ping` e enviado pelo SERVIDOR, e o cliente so precisa deixar o
   * `ws` responder, que ele faz sozinho — nenhum codigo no cliente
   */
  socket.isAlive = true;

  socket.on("pong", () => {
    socket.isAlive = true;
  });

  vivos.add(socket);

  jogo.conectar(client);

  socket.on("message", (bruto, isBinary) => {
    if (isBinary) return;

    // o `parseCommand` do protocolo ja recusa lixo e `NaN`, mas
    // so DEPOIS de o servidor ter lido a string inteira. o limite
    // e o que impede o estouro de memoria
    if (bruto.length > LIMITE_MENSAGEM) {
      marcar(`a mensagem passou de ${LIMITE_MENSAGEM} bytes`);
      socket.close(1009, "Mensagem grande demais");
      return;
    }

    /**
     * O LIMITER E COBRADO AQUI E NO `GameServer.receber` — o dobro.
     *
     * Cada `permite()` empurra um marco no array, entao as duas
     * chamadas contavam DOIS disparos por mensagem. O teto real
     * acabava sendo metade do configurado (45/s em vez de 90/s), o
     * que dava um Gravity Parkour de teste diferente do que o numero
     * dizia
     *
     * Aqui, e nao no `GameServer`: quem decide o que e Abuse e quem
     * segura o socket. O `GameServer` recebe a mensagem e confia
     */
    if (!client.limiter.permite()) {
      client.enviar("REJECTED", {
        reason: "Voce esta mandando comandos demais.",
      });
      return;
    }

    try {
      jogo.receber(client, bruto.toString());
    } catch (erro) {
      // uma regra com bug nao pode derrubar o mundo para os
      // outros jogadores. o jogador ruim perde a conexao
      console.error("[ws] erro ao tratar mensagem:", erro);
      marcar(`erro ao tratar a mensagem: ${erro?.message ?? erro}`);
      socket.close(1011, "Erro interno");
    }
  });

  /**
   * POR QUE O SOCKET MORREU.
   *
   * ## O QUE O `code` DIZ
   *
   * - 1000 / 1001: o jogador saiu, ou a aba fechou. Normal
   * - 1006: o socket sumiu SEM handshake. E o que acontece quando o processo
   *   MORRE — nao existe servidor para responder o fechamento
   * - 1011: erro interno no servidor, e o `catch` acima mandou este
   * - 1008: o servidor recusou, o que inclui o `REJECTED` de nome ou classe
   *
   * ## POR QUE ISTO E LOGADO E O ANTIGO NAO ERA
   *
   * Porque sem o `code`, uma queda e uma saida sao indistinguiveis no
   * terminal. A pista de que o jogo trava vinha do Vite (`ECONNRESET`), que
   * e o LADO DO CLIENTE do proxy — e nao dizia nada sobre quem derrubou
   */
  /**
 * O FECHAMENTO, COM A CAUSA QUE O SERVIDOR CONSEGUE SABER.
 *
 * ## A REGRA DOS TRES FAIXAS
 *
 * - fechou com codigo (1000, 1001, 1008, 1009, 1011): o `code` JA e a causa.
 *   Sai em `info`, e so vira `warn` nos tres que indicam defeito
 * - 1005 e o servidor tinha marcado um motivo: e o batimento ou o
 *   desligamento. Sai em `warn`, porque aqui a queda foi de verdade
 * - 1005 sem motivo marcado: NAO foi o servidor. O navegador fechou. Sai em
 *   `info`, com o texto dizendo isso
 *
 * ## POR QUE O 1005 SEM MOTIVO DESCE PARA `info`
 *
 * Porque e o caso comum e ele nao indica nada de errado. F5, navegar para
 * outra rota e fechar a aba produzem exatamente isto. Com o `warn` antigo,
 * um simples reload enchia o terminal de aviso que parecia queda de servidor —
 * e o primeiro sintoma de um problema real passou a ser ignorado
 *
 * ## E POR QUE A CAUSA VAI NO LOG, E SO O CODIGO
 *
 * Porque o `1005` nao carrega informacao nenhuma: ele e literalmente "nao
 * houve codigo". Quem sabe o motivo e o servidor, no instante em que escolhe
 * fechar. O log antigo recebia o `code` e gastava a unica pista que ele tinha
 * *(o codigo)*, sem nunca olhar o lado do servidor
 */
socket.on("close", (code, motivoBruto) => {
    const durou = Math.round(
      (Date.now() - (nasceuEm.get(socket) ?? Date.now())) / 1000,
    );

/**
     * O MOTIVO CHEGA COMO BUFFER, E O BUFFER VAZIO E `truthy`.
     *
     * ## O QUE ISSO CAUSAVA
     *
     * O `ws` entrega o segundo argumento do `close` como `Buffer`, e nao como
     * string. Um `Buffer` vazio e um OBJETO, e objeto em JavaScript e sempre
     * `truthy` - mesmo sem um byte dentro
     *
     * Entao a cadeia de causa parava no primeiro `||` que encontrava o motivo
     * vazio, e o resultado era um `Buffer` de zero bytes. Interpolado num
     * template string ele vira `""`: o log saia com `CAUSA:` e nada depois, em
     * qualquer fechamento
     *
     * ## POR QUE A CONVERSAO VEM AQUI, E NAO NO USO
     *
     * Porque e o `Buffer` que engana o `||`, e nao o `console`. Converter uma vez
     * no comeco do handler deixa `texto` com o tipo certo para o log inteiro -
     * inclusive no `motivo="..."`, que tinha o mesmo defeito e imprimia
     * `motivo=""` em vez de dizer que o cliente nao mandou motivo
     */
    const texto = motivoBruto?.toString?.() ?? "";

    /**
     * A CAUSA E LIDA ANTES DE QUALQUER `delete`.
     *
     * O `motivosDoSocket.delete` vem logo abaixo, e ler depois dele devolve
     * sempre `undefined` - o log sairia com "CAUSA: o cliente..." para um
     * fechamento que o servidor tinha marcado como dele
     *
     * E o `||` e nao o `??`: com `texto` ja convertido em string, `""` e o
     * caso comum, e `"" ?? x` devolveria `""`, esvaziando a causa de novo
     */
    const causa = motivosDoSocket.get(socket) || texto || null;

    vivos.delete(socket);
    motivosDoSocket.delete(socket);
    jogo.desconectar(client);

    // saidas limpas: quem mandou foi o cliente e o motivo e o de sempre
    if (code === 1000 || code === 1001) return;

    const onde =
      ` [ws] socket fechado: code ${code}` +
      (texto ? ` motivo="${texto}"` : " (o cliente nao mandou motivo)") +
      ` — durou ${durou}s`;

    if (code === 1005) {
      if (causa) {
        console.warn(`${onde} — CAUSA: ${causa}. O servidor fechou este socket.`);
      } else {
        console.info(
          `${onde} — CAUSA: o cliente fechou sem avisar. ` +
            "Reload, navegacao ou aba fechada. Nao e falha do servidor.",
        );
      }

      return;
    }

    if (code === 1006 || code === 1008 || code === 1011) {
      console.warn(
        `${onde} — CAUSA: ${
          causa ?? "o cliente abortou a conexao sem mandar close frame"
        }.` + (code === 1011 ? " Ha um erro logo acima." : ""),
      );

      return;
    }

    console.info(`${onde} — CAUSA: ${causa ?? "sem registro"}.`);
  });

  socket.on("error", (erro) => {
    const durou = Math.round((Date.now() - (nasceuEm.get(socket) ?? Date.now())) / 1000);

    vivos.delete(socket);
    jogo.desconectar(client);

    console.error(
      `[ws] erro no socket depois de ${durou}s:`,
      erro?.message ?? erro,
      erro,
    );
  });
});

const batimento = setInterval(() => {
  for (const socket of vivos) {
    /**
     * O tique anterior chegou e ele nao respondeu: o caminho died.
     *
     * `terminate()` e nao `close()` porque nao ha handshake a fazer
     * com quem nao esta mais la — e nao ha ninguem para ler os 30s de
     * painel que o `bufferedAmount` pode ter acumulado
     */
    if (socket.isAlive === false) {
      /**
       * `motivosDoSocket.set` DIRETO, E NAO O `marcar`.
       *
       * O `marcar` e um atalho criado DENTRO de `wss.on("connection")`, e este
       * `setInterval` roda FORA dele. Usar `marcar` aqui daria ReferenceError no
       * primeiro tique de heartbeat — o servidor cairia logo depois de subir
       */
      motivosDoSocket.set(
        socket,
        `o cliente nao respondeu ao ping em ${
          Math.round(BATIMENTO_MS / 1000)
        }s — derrubei sem avisar, por isso o codigo 1005`,
      );
      socket.terminate();
      continue;
    }

    socket.isAlive = false;
    socket.ping();
  }
}, BATIMENTO_MS);

batimento.unref();

/* ------------------------------------------------------------------ *
 * A REDE DE SEGURANCA: o erro que NINGUEM TRATA
 * ------------------------------------------------------------------ */

/**
 * POR QUE O DIARIO E EM ARQUIVO E NAO SO NO CONSOLE
 *
 * Porque o `node --watch` levanta o processo no MESMO terminal. O stack da
 * excecao passa, a tela rola, e a mensagem de "subindo de novo" cobre a
 * causa. Quem tenta ver o erro enquanto o jogo esta freezing chega atras
 *
 * O arquivo sobrevive ao restart, e um diario com varias quedas mostra se o
 * erro se repete no mesmo lugar — que e a diferenca entre um bug e um
 * tropeco
 *
 * A implementacao, e o porque de sair depois de registrar, estao em
 * `server/src/registroDeErros.js`
 */
ligarRedeDeSeguranca();

/**
 * O LACO DE 20Hz COMECA AQUI, E SO AQUI.
 *
 * E depois da rede de seguranca de proposito: um erro lancado no primeiro
 * tique ja tem quem o registre, em vez de virar um `uncaughtException` mudo
 * no primeiro segundo de vida do servidor
 */
jogo.start();

/**
 * SOBE O SERVIDOR, E CAI PARA IPv4 SE O IPv6 NAO EXISTIR NA MAQUINA.
 *
 * ## POR QUE ISTO E UM `error` E NAO UM `try/catch`
 *
 * Porque `listen` nao lanca. A falha do socket — `EADDRNOTAVAIL` numa maquina
 * sem IPv6, `EACCES` numa porta reservada — chega como evento `error` depois
 * que a chamada ja retornou. Um `try/catch` em volta de `listen` nao veria
 * nada, e o servidor ficaria em silencio sem porta nenhuma
 *
 * ## POR QUE O `setImmediate` ENTRE AS TENTATIVAS
 *
 * Porque o `http` que falhou ainda esta com o socket meio aberto. Reusar o
 * mesmo servidor no mesmo tique da `EADDRINUSE` ou `EAFNOSUPPORT`; deixar o
 * evento do ciclo seguinte ja resolver solta o socket
 *
 * ## E POR QUE O PADRAO E `::` E O RESGATE E `0.0.0.0`
 *
 * Porque `::` e o socket de duas pilhas: atende `::1` E `127.0.0.1`. E o
 * `0.0.0.0` e o que existia antes, entao e ele que salvou o servidor numa
 * maquina onde o resgate e necessario — so que volta a ser IPv4 so
 */
function subir(preferido) {
  const servidor = http.listen(SERVER_CONFIG.port, preferido, () => {
    const duplo = preferido === "::";

    console.log(
      `Jogo em http://${preferido}:${SERVER_CONFIG.port} ` +
        `(ws em /ws, ${SERVER_CONFIG.tickRate} ticks/s)` +
        (duplo ? " — aceitando IPv6 e IPv4" : " — IPv4 apenas"),
    );
  });

  servidor.once("error", (erro) => {
    const temResgate = preferido !== "0.0.0.0";

    if (!temResgate) {
      console.error(`[servidor] nao subiu na porta ${SERVER_CONFIG.port}:`, erro.message);
      process.exit(1);
    }

    console.warn(
      `[servidor] nao conseguiu abrir "${preferido}" (${erro.code ?? erro.message}). ` +
        "Caindo para 0.0.0.0 — o servidor vai responder em IPv4, " +
        "e o navegador pode recusar em ::1 se ele tentar IPv6 primeiro.",
    );

    setImmediate(() => subir("0.0.0.0"));
  });

  return servidor;
}

subir(SERVER_CONFIG.host);

/**
 * Encerrar o laco de 20 Hz no Ctrl+C.
 *
 * Sem isso o processo fica pendurado esperando o `setInterval`
 * morro, e o `npm run dev` nunca termina o comando.
 */
function encerrar() {
  jogo.stop();

  /**
   * O DESLIGAMENTO MARCA CADA SOCKET, E POR QUE ISSO IMPORTA.
   *
   * O `wss.close()` deixa os sockets abertos morrerem sozinhos, sem close frame.
   * O `close` de cada um chega como 1005, sem motivo, sem nada que diga que
   * aquilo foi um `Ctrl+C` e nao uma queda
   *
   * Que e a pior hora para o log mentir: o operador acabou de mandar o processo
   * embora, e o terminal mostra tres avisos de "1005" sem explicacao logo em
   * seguida — a leitura natural e "o servidor caiu sozinho"
   */
  for (const socket of vivos) {
    motivosDoSocket.set(socket, "o servidor foi encerrado (SIGINT/SIGTERM)");
  }

  wss.close();
  http.close(() => process.exit(0));

  // se algum socket travado impedir o close, sai assim mesmo
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);

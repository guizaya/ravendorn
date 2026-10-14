import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
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

app.use(
  express.static(resolve(PASTA_DO_JOGO), {
    // o `index.html` do jogo nao disputa a raiz com o proxy do front
    index: "jogo.html",
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

wss.on("connection", (socket) => {
  nasceuEm.set(socket, Date.now());
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
  socket.on("close", (code, motivo) => {
    const durou = Math.round((Date.now() - (nasceuEm.get(socket) ?? Date.now())) / 1000);

    vivos.delete(socket);
    jogo.desconectar(client);

    if (code === 1000 || code === 1001) return;

    console.warn(
      `[ws] socket fechado com code ${code}` +
        (motivo ? ` motivo="${motivo}"` : " (sem motivo)") +
        ` — conexao durou ${durou}s. ` +
        "Se 1006, o processo morreu; se 1011, ha um erro em [ws] acima.",
    );
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
  wss.close();
  http.close(() => process.exit(0));

  // se algum socket travado impedir o close, sai assim mesmo
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);

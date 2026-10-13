import { randomBytes, timingSafeEqual } from "node:crypto";
import { verifyMessage, getAddress, isAddress } from "ethers";

/**
 * A ASSINATURA DA CARTEIRA, VERIFICADA DE VERDADE.
 *
 * ## O QUE O FRONT ANTIGO FAZIA
 *
 * `wallet.tsx` chamava `personal_sign` e gravava o resultado em
 * `supabase.auth.updateUser({ data: { wallet_address, wallet_signature,
 * wallet_message } })`. Isso e o cliente escrevendo num campo de texto, e o
 * cliente ser dono do texto. Ninguem verificava a assinatura: qualquer um
 * podia declarar o endereco de outra carteira e o sistema aceitava
 *
 * ## O QUE ESTE MODULO FAZ
 *
 * `ethers.verifyMessage` RECUPERA o endereco que assinou e compara com o
 * endereco declarado. Se a comparacao falhar, a carteira nao pertence a
 * conta — e a conta nao e criada
 *
 * ## A MENSAGEM PRECISA VIR DAQUI, E COM NONCE
 *
 * A mensagem tem duas partes: um texto FIXO, que o servidor conhece, e um
 * nonce, que muda a cada pedido
 *
 * Sem o nonce, a mesma mensagem valeria para sempre. Alguem poderia pedir
 * uma vez, copiar a assinatura do historico e reapresentar quando quisesse.
 * O nonce e consumido no primeiro uso, entao a assinatura antiga morre com
 * ele
 *
 * E o texto fixo impede o ataque de钓鱼 mais obvio: se a mensagem fosse
 * montada no cliente, um site falso pediria "Assine: Vincular esta carteira
 * `0xfalso` a conta X" e o jogador assinaria achando que era o jogo
 */
const PREFIXO = "Eldoria - vincular carteira";
const DOMINIO = "eldoria";

/**
 * Os nonces发放 pendentes, por endereco.
 *
 * A chave e o endereco em minusculo: `0xABC` e `0xabc` sao a MESMA
 * carteira, e chave-las separado daria dois nonces vivos para a mesma
 * pessoa
 */
const nonces = new Map();

function chaveDe(endereco) {
  return String(endereco ?? "").trim().toLowerCase();
}

/**
 * A MENSAGEM, MONTADA NUM LUGAR SO.
 *
 * ## POR QUE ISTO NAO PODE ESTAR DUPLICADO
 *
 * A assinatura e sobre BYTES, e nao sobre o que a tela mostra. Se
 * `pedirAssinatura` e `confirmarVinculo` montassem a mensagem em separado,
 * bastava uma diferenca de uma quebra de linha para a verificacao falhar
 * sempre — e o sintoma seria "a MetaMask assinou e o servidor disse que nao
 * e a mesma carteira", que e o tipo de erro que faz alguem suspectar da
 * carteira em vez do codigo
 *
 * E por isso que as pecas vem de UM objeto, e a montagem e uma funcao: nao
 * ha segundo lugar onde a frase pode mudar
 */
const DURACAO_DO_NONCE_MS = 5 * 60 * 1000;

/**
 * A MENSAGEM FICA GUARDADA, E NAO SO O NONCE.
 *
 * ## POR QUE ISTO NAO PODE ESTAR DUPLICADO
 *
 * A assinatura e sobre BYTES, e nao sobre o que a tela mostra. Se
 * `pedirAssinatura` e `confirmarVinculo` montassem a mensagem em separado,
 * bastaria uma diferenca de uma quebra de linha para a verificacao falhar
 * sempre — e o sintoma seria "a MetaMask assinou e o servidor disse que nao
 * e a mesma carteira", que e o tipo de erro que faz alguem suspectar da
 * carteira em vez do codigo
 *
 * ## E POR QUE A MENSAGEM INTEIRA, E NAO SO AS PECAS
 *
 * Porque a mensagem tem a DATA, que muda a cada chamada. Montar de novo na
 * hora de verificar produziria uma string diferente da que foi assinada, e
 * a verificacao falharia sempre — nao por assinatura falsa, mas por data
 * diferente
 *
 * Guardando o texto exato, a verificacao usa a MESMA string que a carteira
 * viu. So o nonce precisa ser conferido contra o que foi guardado, para
 * saber que este pedido e o pedido
 */
function montarMensagem({ endereco, nonce, emitidoEm }) {
  return [
    PREFIXO,
    `Servidor: ${DOMINIO}`,
    `Carteira: ${endereco}`,
    `Nonce: ${nonce}`,
    `Data: ${new Date(emitidoEm).toISOString()}`,
  ].join("\n");
}

/**
 * Monta a mensagem e guarda o nonce.
 *
 * Devolve `{ endereco, mensagem }`. A carteira assina `mensagem` com
 * `personal_sign`, e o front manda o resultado para
 * `confirmarVinculo({ endereco, assinatura })`
 */
export function pedirAssinatura(endereco) {
  const chave = chaveDe(endereco);

  if (!isAddress(chave)) {
    return { erro: "ENDERECO_INVALIDO" };
  }

  const nonce = randomBytes(16).toString("hex");

  const emitidoEm = Date.now();

  const expiraEm = emitidoEm + DURACAO_DO_NONCE_MS;

  const mensagem = montarMensagem({ endereco: chave, nonce, emitidoEm });

  // o texto guardado e o que sera comparado byte a byte na verificacao
  nonces.set(chave, { nonce, expiraEm, mensagem });

  return { endereco: chave, mensagem };
}

/**
 * Confere a assinatura e consome o nonce.
 *
 * ## POR QUE O NONCE SAI ANTES DE VERIFICAR
 *
 * Um nonce so pode ser usado uma vez. Se a verificacao falhasse e o nonce
 * continuasse na mesa, quem errou a carteira poderia tentar de novo a
 * vontade — e um nonce que nunca sai permitira flood de tentativas. O
 * nonce e removido nos DOIS caminhos: verificado e recusado
 *
 * O efeito colateral e justo: se a MetaMask falhar ao assinar e o jogador
 * tentar de novo, ele precisa pedir um nonce novo. `pedirAssinatura` e
 * idempotente nesse caso
 *
 * ## `getAddress` E O QUE EVITA O `0X` MAIUSCULO
 *
 * `verifyMessage` devolve o endereco em checksum — `0xAbC...`. O que o
 * jogador digitou ou o que a MetaMask devolve pode estar em minusculo, ou em
 * maiusculo, ou com o prefixo `0X`. Comparar as strings cruas daria tres
 * contas diferentes para a mesma carteira. `getAddress` normaliza os dois
 * lados para o mesmo checksum antes da comparacao
 */
export function confirmarVinculo({ endereco, assinatura }) {
  const chave = chaveDe(endereco);

  if (!isAddress(chave)) {
    return { erro: "ENDERECO_INVALIDO" };
  }

  const assinaturaLimpa = String(assinatura ?? "").trim();

  if (!assinaturaLimpa) {
    return { erro: "ASSINATURA_VAZIA" };
  }

  const pendente = nonces.get(chave);

  if (!pendente || typeof pendente !== "object") {
    return { erro: "NONCE_DESCONHECIDO" };
  }

  // consome o nonce, tenha passado ou falhado
  nonces.delete(chave);

  if (pendente.expiraEm <= Date.now()) {
    return { erro: "NONCE_EXPIRADO" };
  }

  // a MESMA string que a carteira assinou, e nao uma remontada: a data da
  // mensagem e a do pedido original, e remontar agora produziria outra
  let recuperado;

  try {
    recuperado = verifyMessage(pendente.mensagem, assinaturaLimpa);
  } catch {
    // assinatura malformada: tamanho errado, prefixo `0x` faltando, lixo
    return { erro: "ASSINATURA_INVALIDA" };
  }

  let esperado;

  let obtido;

  try {
    esperado = getAddress(chave);
    obtido = getAddress(recuperado);
  } catch {
    return { erro: "ASSINATURA_INVALIDA" };
  }

  if (comparacaoConstante(esperado, obtido)) {
    return { endereco: esperado };
  }

  return { erro: "ASSINATURA_DE_OUTRA_CARTEIRA" };
}

/**
 * Comparacao em tempo constante.
 *
 * Sao duas strings do mesmo tamanho depois do `getAddress`, entao o
 * `timingSafeEqual` nao lanca. O objetivo e nao vazar, por tempo de
 * resposta, quantos caracteres iguais havia — que em principio permitiria
 * descobrir o endereco letra a letra
 */
function comparacaoConstante(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);

  if (ba.length !== bb.length) return false;

  return timingSafeEqual(ba, bb);
}

/** Limpa a fila de nonces expirados. Chamado pelo servidor no boot. */
export function limparNonces() {
  nonces.clear();
  noncesDeEntrada.clear();
}

/*
 * ============================================================================
 * A ASSINATURA DE CADA ENTRADA NO MAPA
 * ============================================================================
 *
 * ## O QUE MUDOU
 *
 * Antes, o token de entrada saia so com o token de sessao no header. Quem
 * tivesse lido o `eldoria:sessao` do `localStorage` — ou gotten um site
 * qualquer para usa-lo, porque o CORS era `*` — recebia tokens de entrada
 * para qualquer personagem da conta, sem nunca ter a carteira na frente
 *
 * Agora o token de entrada so e emitido depois que a DONA DA CONTA assina. O
 * token de sessao continua guardando a conta e continua valendo por 30 dias,
 * mas sozinho ele nao abre mais o mapa
 *
 * ## POR QUE A CHAVE E A CONTA, E NAO O ENDERECO
 *
 * Porque quem pede e o token de sessao, e ele nao carrega o endereco: ele
 * carrega o `contaId`. E o que impede um pedido pendente de uma conta ser
 * usado para provar a posse de outra — a assinatura e conferida contra a
 * conta que NAOceu o nonce
 *
 * ## E POR QUE O ENDERECO ESPERADO NUNCA VEM DO CLIENTE
 *
 * A funcao recebe `enderecoEsperado`, e quem chama passa `identidade.id` —
 * que saiu do token, e nao de um campo do corpo do pedido. Um cliente que
 * mandasse `enderecoEsperado` junto provaria a posse de si mesmo, que e o
 * que a assinatura existe para provar
 */

/**
 * Os pedidos pendentes de ENTRADA, por `contaId`.
 *
 * E um store separado do de vincular porque os dois tem requisitos
 * diferentes: o de vincular nao sabe qual personagem, e o de entrada nao pode
 * ser reaproveitado para vincular. Um store so daria ao cliente a escolha de
 * qual dos dois usar
 */
const noncesDeEntrada = new Map();

/**
 * A MENSAGEM DA ENTRADA, e o que o jogador ve na MetaMask.
 *
 * O texto e explicito o bastante para o jogador ler antes de assinar: ele
 * diz em que servidor, para que carteira e com qual personagem. E o que
 * separa a tela de assinatura de phishing de uma tela de assinatura de jogo
 */
function montarMensagemDeEntrada({ endereco, contaId, personagem, nonce, emitidoEm }) {
  return [
    "RavenDorn - entrar no jogo",
    `Servidor: ${DOMINIO}`,
    `Carteira: ${endereco}`,
    `Conta: ${contaId}`,
    `Personagem: ${personagem.nome} (${personagem.classe})`,
    `Nonce: ${nonce}`,
    `Data: ${new Date(emitidoEm).toISOString()}`,
  ].join("\n");
}

/**
 * Prepara a assinatura de entrada e guarda o pedido.
 *
 * Devolve `{ mensagem }` para o front levar a MetaMask. O `endereco` entra na
 * mensagem porque e o que o jogador ve — e o que a MetaMask mostra embaixo do
 * texto, o que faz ele conferir antes de assinar
 */
export function pedirAssinaturaDeEntrada({ contaId, endereco, personagem }) {
  const chave = String(contaId ?? "").trim();

  if (!chave || !isAddress(chaveDe(endereco))) {
    return { erro: "ENDERECO_INVALIDO" };
  }

  if (!personagem?.id) {
    return { erro: "PERSONAGEM_NAO_ENCONTRADO" };
  }

  const nonce = randomBytes(16).toString("hex");
  const emitidoEm = Date.now();
  const expiraEm = emitidoEm + DURACAO_DO_NONCE_MS;

  const mensagem = montarMensagemDeEntrada({
    endereco: chaveDe(endereco),
    contaId: chave,
    personagem,
    nonce,
    emitidoEm,
  });

  /**
   * O PERSONAGEM VAI DENTRO DO PENDENTE.
   *
   * E o que amarra a assinatura ao personagem: a conta pode ter tres, e um
   * nonce valido para "entrar no jogo" sem dizer qual serviria para todos
   * eles
   */
  noncesDeEntrada.set(chave, {
    nonce,
    expiraEm,
    mensagem,
    personagemId: personagem.id,
  });

  return { mensagem };
}

/**
 * Confere a assinatura de entrada e consome o pedido.
 *
 * ## A ORDEM DAS CONFERENCIAS
 *
 * 1. o pedido existe (estava no store)
 * 2. nao expirou
 * 3. a assinatura e de um `personal_sign` valido
 * 4. quem assinou e a carteira dona da conta
 * 5. o personagem pedido e o mesmo do pedido
 *
 * O nonce sai na hora, ANTES da verificacao, pelo mesmo motivo do
 * `confirmarVinculo`: um nonce que sobrevive a uma falha vira um pedido que
 * da para tentar quantas vezes a pessoa quiser
 *
 * @param {string} contaId quem pediu o token de sessao
 * @param {string} enderecoEsperado a carteira dona da conta, lida do token
 * @param {string} personagemId o personagem que o front quer entrar
 * @param {string} assinatura o que a MetaMask devolveu
 */
export function confirmarEntrada({ contaId, enderecoEsperado, personagemId, assinatura }) {
  const chave = String(contaId ?? "").trim();

  const pendente = noncesDeEntrada.get(chave);

  if (!pendente || typeof pendente !== "object") {
    return { erro: "NONCE_DESCONHECIDO" };
  }

  noncesDeEntrada.delete(chave);

  if (pendente.expiraEm <= Date.now()) {
    return { erro: "NONCE_EXPIRADO" };
  }

  /**
   * O PERSONAGEM PRIMEIRO, E POR QUE
   *
   * E a conferenca mais barata e a que impede o uso mais obvio: um nonce
   * valido de um personagem para entrar com outro. Sem esta linha, a
   * verificacao da assinatura passaria e o token sairia para o personagem
   * errado
   */
  if (pendente.personagemId !== personagemId) {
    return { erro: "PERSONAGEM_DIVERGENTE" };
  }

  const assinaturaLimpa = String(assinatura ?? "").trim();

  if (!assinaturaLimpa) {
    return { erro: "ASSINATURA_VAZIA" };
  }

  let recuperado;

  try {
    recuperado = verifyMessage(pendente.mensagem, assinaturaLimpa);
  } catch {
    return { erro: "ASSINATURA_INVALIDA" };
  }

  let esperado;
  let obtido;

  try {
    esperado = getAddress(chaveDe(enderecoEsperado));
    obtido = getAddress(recuperado);
  } catch {
    return { erro: "ASSINATURA_INVALIDA" };
  }

  if (comparacaoConstante(esperado, obtido)) {
    return { personagemId: pendente.personagemId };
  }

  return { erro: "ASSINATURA_DE_OUTRA_CARTEIRA" };
}
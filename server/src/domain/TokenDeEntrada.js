import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * O TOKEN DE ENTRADA: A PONTE ENTRE O FRONT E O JOGO.
 *
 * ## O PROBLEMA QUE ELE RESOLVE
 *
 * O front e o jogo sao dois apps diferentes, em dominios diferentes. O front
 * autentica a conta (Google ou carteira) e mostra a tela de personagem; o
 * jogo abre um WebSocket e manda `JOIN { name, classId }`
 *
 * Se o jogo aceitasse esse JOIN como esta, bastaria abrir o console e
 * digitar `JOIN { name: "Alguem", classId: "warrior" }` para entrar como
 * qualquer personagem. O nome sozinho nunca foi prova de nada
 *
 * ## O QUE O TOKEN PROVA
 *
 * Que o servidor do jogo emitiu este token, e que ele nao foi usado ainda.
 * Quem emite e o servidor, para o personagem que a conta realmente tem
 *
 * ## POR QUE UM TOKEN SEPARADO, E NAO O JWT DA CONTA
 *
 * Porque sao dois publicos:
 *
 *  - o token da CONTA fica no navegador, em `localStorage`, e e reenviado a
 *    cada chamada do front. Ele vale enquanto a sessao valer
 *  - o token de ENTRADA viaja uma unica vez, na URL do redirecionamento, e
 *    e queimado no primeiro JOIN aceito. Ele vale uns segundos
 *
 * Se fosse o mesmo, o token da sessao ficaria na URL — e URL vaza em log de
 * servidor, em `Referer`, no historico do navegador e no historico do
 * Discord quando o jogador compartilha um link
 *
 * ## O FORMATO
 *
 * `base64url(corpo).base64url(assinatura)`, com o corpo sendo JSON. O
 * `base64url` e o mesmo do JWT, e por um motivo so: ele nao tem `+`, `/` nem
 * `=`, que sao caracteres que precisam de escape em URL e em cookie
 */
export function criarEmissorDeToken({
  segredo,
  segundosDeValidade = 60,
  agora = () => Date.now(),
} = {}) {
  if (!segredo) {
    throw new Error(
      "criarEmissorDeToken precisa de um segredo. Sem ele o token e um texto comum que qualquer um forja."
    );
  }

  const assinar = (corpo) =>
    createHmac("sha256", segredo)
      .update(corpo)
      .digest("base64url");

  /**
   * OS TOKENS JA USADOS.
   *
   * A assinatura sozinha nao diz que um token foi USADO, so que ele foi
   * EMITIDO. Sem esta lista, o mesmo token valeria para sempre: o jogador
   * entra, fecha a aba, e a URL com o token ainda na barra de enderecos
   *-letia ele entrar de novo
   *
   * E o `nonce` que faz o trabalho: ele e unico por token, entao guardar o
   * nonce e o mesmo que guardar o token inteiro, com metade da memoria
   *
   * ## POR QUE O MAPA E APAGADO
   *
   * Um token vive 60 segundos. Guardar para sempre seria criar uma tabela
   * que so cresce, com um registro que nunca mais sera lido. A limpeza roda
   * na emissao e descarta o que ja expirou
   */
  const usados = new Map();

  function limparUsados() {
    const t = agora();

    for (const [nonce, exp] of usados) {
      if (exp <= t) usados.delete(nonce);
    }
  }

  /**
   * Monta um token para o personagem `nome` da classe `classe`.
   *
   * O `contaId` vai DENTRO do corpo, e isso e o que amarra os dois lados:
   * o jogo sabe de que conta o personagem veio, sem precisar perguntar a
   * ninguem. E o que permite, mais para a frente, trocar o `donoKey` de
   * nome para conta sem mexer no JOIN
   */
  function emitir({ contaId, tipoConta, nome, classe }) {
    const corpo = {
      contaId,

      /**
       * O TIPO DA CONTA, E NAO SO O ID.
       *
       * Quem confere o token precisa achar o arquivo da conta, e o
       * `Contas.normalizarIdentidade` escolhe o prefixo pelo `tipo`:
       * carteira vira `carteira_0x...`, Google vira o `sub` cru. Sem o tipo
       * aqui, o `GameServer` buscaria `0x...` e nao acharia nada
       */
      tipoConta,

      nome,
      classe,
      // `iat` e a emissao. Um token emitido ha uma hora falha mesmo sem
      // ter sido usado, e e por isso que `emitir` recusa reaproveitar
      iat: agora(),
      // `exp` e o prazo. Curto de proposito: entre o clique em Jogar e o
      // JOIN passa menos de um segundo, e um minuto cobre uma conexao
      // lenta sem deixar janela para replay
      exp: agora() + segundosDeValidade * 1000,
      // nonce e o que torna cada token unico, mesmo para a mesma conta
      // entrando duas vezes no mesmo segundo
      nonce: randomBytes(12).toString("base64url"),
    };

    const texto = base64url(JSON.stringify(corpo));

    limparUsados();

    return `${texto}.${assinar(texto)}`;
  }

  /**
   * Confere a assinatura e devolve o corpo, ou `null`.
   *
   * `null` e a resposta para TODO token invalido: assinatura errada, corpo
   * adulterado, expirado, JSON quebrado. Nao ha mensagem de erro, porque o
   * token nao esta sendo usado por uma pessoa que pode ler o erro — esta
   * sendo tentado por alguem que escolheu o valor errado
   */
  function verificar(token) {
    const bruto = String(token ?? "");

    const partes = bruto.split(".");

    if (partes.length !== 2) return null;

    const [texto, assinatura] = partes;

    if (!texto || !assinatura) return null;

    // `timingSafeEqual` lanca quando os dois buffers tem tamanhos
    // diferentes, entao o tamanho e conferido antes. E a conferida do
    // tamanho nao vaza nada: o comprimento da assinatura nao e segredo
    if (assinatura.length !== 43) return null;

    const esperada = assinar(texto);

    const a = Buffer.from(assinatura);
    const b = Buffer.from(esperada);

    if (a.length !== b.length) return null;

    if (!timingSafeEqual(a, b)) return null;

    let corpo;

    try {
      corpo = JSON.parse(Buffer.from(texto, "base64url").toString("utf8"));
    } catch {
      return null;
    }

    if (!corpo || typeof corpo !== "object") return null;

    // a expiracao e conferida AQUI, e nao no `emitir`: um token pode ser
    // valido na assinatura e ja estar vencido quando chegar
    if (typeof corpo.exp !== "number" || corpo.exp <= agora()) return null;

    if (typeof corpo.nonce !== "string" || !corpo.nonce) return null;

    /**
     * O TOKEN JA FOI USADO.
     *
     * E a conferida que faz o token ser de USO UNICO. Sem ela a assinatura
     * provaria apenas que o servidor emitiu — o que continua valendo
     * enquanto o token nao expira, e a URL com ele ficaria na barra de
     * enderecos para qualquer um reusar
     */
    if (usados.has(corpo.nonce)) return null;

    // o nonce entra no registro ANTES de devolver. Se a entrada for
    // recusada depois (nome ocupado, classe divergente), o token ja morreu:
    // o jogador pede um novo pela tela, e e o que o comentario do
    // `confereTokenDeEntrada` promete
    usados.set(corpo.nonce, corpo.exp);

    return corpo;
  }

  return { emitir, verificar, segundosDeValidade };
}

function base64url(texto) {
  return Buffer.from(texto, "utf8").toString("base64url");
}
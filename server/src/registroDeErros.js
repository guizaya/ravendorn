import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

/**
 * O DIARIO DO SERVIDOR.
 *
 * ## POR QUE UM ARQUIVO E NAO SO O CONSOLE
 *
 * Porque o `node --watch` levanta o processo no mesmo terminal, e o stack da
 * excecao se perde no meio da subida. Quem tenta ver o erro enquanto o jogo
 * esta freezing ve a mensagem de "subindo de novo" e chega atras
 *
 * ## POR QUE O DIARIO FICA FORA DO PROJETO
 *
 * Porque ele ja CAUSOU um loop de reinicio. Na primeira versao ele vivia na
 * raiz do projeto, e cada vez que o servidor escrevia uma linha o `--watch`
 * via a mudanca e reiniciava — que escrevia de novo, que reiniciava de novo.
 * O diario apareceu de 3 em 3 segundos, com um pid novo em cada linha, e o
 * servidor nunca chegou a servir uma conexao
 *
 * ## ONDE ELE VAI
 *
 * Na pasta temporaria do sistema, que nenhum watcher acompanha. E o caminho
 * e impresso no console na subida, para nao ser um arquivo que ninguem sabe
 * onde esta
 *
 * ## E POR QUE `appendFileSync` E NAO `writeFileSync`
 *
 * Porque o objetivo e ter VARIAS quedas no mesmo diario. Um `writeFileSync`
 * apagaria a queda anterior e o diagnostico viraria uma foto solta de cada
 * vez, sem a sequencia — e a sequencia e o que diz se o erro se repete no
 * mesmo lugar
 */

/** O caminho absoluto, para o log dizer ONDE esta o arquivo. */
export const CAMINHO_DO_DIARIO = join(tmpdir(), "rpg-erros-servidor.log");

const carimbo = () =>
  new Date().toLocaleTimeString("pt-BR", { hour12: false });

const escrever = (linhas) => {
  try {
    appendFileSync(CAMINHO_DO_DIARIO, `${linhas.join("\n")}\n`, "utf8");
  } catch (falha) {
    /**
     * O DIARIO NUNCA DERRUBA O SERVIDOR.
     *
     * Porque o caminho pode estar sem permissao, e um disco cheio faria o
     * registro derrubar o processo que ele existe para diagnosticar. A falha
     * vai para o console e o jogo continua
     */
    console.error("[diario] nao consegui escrever:", falha.message);
  }
};

/** Anota que o processo nasceu, e DIZ ONDE ESTA O DIARIO. */
export function anotarInicio() {
  escrever([
    "",
    `=== servidor subiu as ${carimbo()} (pid ${process.pid}) ===`,
  ]);

  /**
   * O CAMINHO SAI NO CONSOLE, TODA VEZ.
   *
   * Porque um arquivo de erro que ninguem sabe onde esta e um arquivo de
   * erro que ninguem le. O console e o unico lugar que o jogador ja esta
   * olhando quando o servidor cai
   */
  console.log(`[diario] erros do servidor em: ${CAMINHO_DO_DIARIO}`);
}

/**
 * Anota uma queda com o stack inteiro.
 *
 * @param {string} titulo o que aconteceu
 * @param {unknown} erro o erro, com o stack ou nao
 */
export function anotarQueda(titulo, erro) {
  const stack = erro?.stack ?? erro?.message ?? String(erro);

  escrever([
    "",
    `!!! ${titulo} em ${carimbo()} (pid ${process.pid})`,
    typeof stack === "string" ? stack : "<sem stack>",
  ]);
}

/**
 * Liga a rede de seguranca no processo inteiro.
 *
 * E CHAMADO UMA VEZ, logo no topo do `index.js`, e antes do `jogo.start()`:
 * um erro no primeiro tique ja tem quem o registre
 */
export function ligarRedeDeSeguranca() {
  /**
   * POR QUE O PROCESSO SAI DEPOIS DE REGISTRAR
   *
   * Porque depois de uma excecao nao se sabe o que o estado interno ficou. Um
   * servidor com meia transacao pela metade e pior que um que cai e volta: o
   * `--watch` levanta em um segundo, e o diario guarda o que aconteceu
   */
  process.on("uncaughtException", (erro) => {
    console.error("[processo] EXCECAO NA TRATADA:", erro?.stack ?? erro);

    anotarQueda("EXCECAO NA TRATADA", erro);

    process.exit(1);
  });

  process.on("unhandledRejection", (motivo) => {
    console.error("[processo] PROMESSA REJEITADA:", motivo?.stack ?? motivo);

    anotarQueda("PROMESSA REJEITADA SEM TRATAMENTO", motivo);

    process.exit(1);
  });

  /**
   * A SAIDA NORMAL TAMBEM ENTRA NO DIARIO.
   *
   * Porque ha uma terceira forma do processo morrer que nao passa por
   * excecao nenhuma: ele simplesmente sai. Sem esta anotacao, um diario que
   * mostra "subiu" e nao mostra queda seguinte parece um diario de um
   * servidor saudavel — que e a leitura errada
   */
  process.on("exit", (codigo) => {
    anotarQueda(`PROCESSO SAIU (codigo ${codigo})`, new Error("saida do processo"));
  });

  anotarInicio();
}
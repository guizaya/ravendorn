import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const rodar = promisify(execFile);

const AQUI = dirname(fileURLToPath(import.meta.url));

/** a raiz do repositorio: `server/test` -> `server` -> raiz */
const RAIZ = resolve(AQUI, "..", "..");

/**
 * O servidor tem que CARREGAR no Node de verdade.
 *
 * O Vitest roda os arquivos por uma transformacao propria, e ela e mais
 * permissiva que o ESM do Node: um `import { X }` de um nome que o
 * modulo nao exporta passa no Vitest e estoura no
 * `node server/src/index.js` com um `SyntaxError` de named export.
 *
 * Foi exatamente assim que o `MarketStore` entrou em producao com
 * `ANUNCIO_MAXIMOS` (sem o S) no import: 55 testes verdes no cliente,
 * 243 no servidor, e o servidor nao subia
 *
 * Este teste e o unico que enxerga essa diferenca, porque ele chama o
 * `node` de verdade. Um import por vez, e so do modulo e do grafo que ele
 * puxa: se qualquer `import` nomeado do servidor estiver errado, ele
 * estoura aqui
 */
/**
 * Carrega um modulo do repositorio no `node` de verdade.
 *
 * O caminho e relativo a RAIZ, e nao a pasta do teste: os arquivos que
 * interessam estao espalhados por `server/src` e `src`, e um `../`
 * a mais ou a menos apontaria para o lugar errado e o teste passaria
 * por import quebrado sem nunca ter carregado nada
 */
async function carrega(caminhoRelativo) {
  const arquivo = pathToFileURL(
    resolve(RAIZ, caminhoRelativo),
  ).href;

  try {
    const { stdout, stderr } = await rodar(process.execPath, [
      "--input-type=module",
      "-e",
      `await import(${JSON.stringify(arquivo)});`,
    ]);

    return { ok: true, erro: stderr || stdout || null };
  } catch (erro) {
    return {
      ok: false,
      erro:
        erro.stderr ||
        erro.stdout ||
        erro.message ||
        "falhou sem mensagem",
    };
  }
}

describe("o que o servidor importa existe de verdade", () => {
  it("o GameServer carrega no ESM do Node", async () => {
    const { ok, erro } = await carrega(
      "server/src/domain/GameServer.js",
    );

    expect(ok, `import nomeado quebrado:\n${erro}`).toBe(true);
  }, 60_000);

  it("o motor do market carrega no ESM do Node", async () => {
    // o modulo mais importado do servidor depois do motor: se ele
    // gainhar um nome errado, e o `GameServer` que quebra primeiro
    const { ok, erro } = await carrega(
      "src/game/market/MarketStore.js",
    );

    expect(ok, `import nomeado quebrado:\n${erro}`).toBe(true);
  }, 60_000);

  it("o protocolo carrega no ESM do Node", async () => {
    const { ok, erro } = await carrega(
      "src/shared/protocol.js",
    );

    expect(ok, `import nomeado quebrado:\n${erro}`).toBe(true);
  }, 60_000);

  it("a persistencia do mercado carrega no ESM do Node", async () => {
    const { ok, erro } = await carrega(
      "server/src/persistence/MarketSave.js",
    );

    expect(ok, `import nomeado quebrado:\n${erro}`).toBe(true);
  }, 60_000);
});
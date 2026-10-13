/**
 * O `--watch-path` SEGURA QUANDO O MOTOR MUDA.
 *
 * ## O PROBLEMA QUE ESTE TESTE PROVA
 *
 * O `GameServer` importa 26 arquivos de `src/` — o motor inteiro. Com
 * `node --watch` sem `--watch-path`, editar QUALQUER arquivo de `src/`
 * derruba o servidor e o levanta de novo. O jogador ve `ECONNREFUSED` no
 * proxy do Vite, e parece falha de rede
 *
 * ## POR QUE UM TESTE E NAO SO A CONFIGURACAO
 *
 * Porque `--watch-path` pode estar escrito certo e nao fazer o que parece:
 * o Node pode continuar observando o grafo inteiro. So um teste que EDITA o
 * arquivo e ve o processo responder diz se a parede funciona
 */

import { spawn, execSync } from "node:child_process";
import { readFileSync, writeFileSync, utimesSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..");

const ALVO = join(RAIZ, "src/game/math.js");
const PROVA = join(RAIZ, "server/src/.prova-watch.tmp");

let ok = 0;
let falhas = 0;

function conferir(condicao, mensagem, detalhe) {
  if (condicao) {
    ok++;
    console.log("  ok    " + mensagem);
    return;
  }
  falhas++;
  console.log("  FALHA " + mensagem);
  if (detalhe !== undefined) console.log("         " + detalhe);
}

/** SOBE O SERVIDOR E CONTA AS LINHAS DE LOG */
function subir(watchPath) {
  const args = ["--watch"];

  if (watchPath) args.push("--watch-path=" + watchPath);

  args.push("server/src/index.js");

  const filho = spawn(process.execPath, args, { cwd: RAIZ, stdio: ["ignore", "pipe", "pipe"] });

  let saida = "";

  filho.stdout.on("data", (d) => { saida += d.toString(); });
  filho.stderr.on("data", (d) => { saida += d.toString(); });

  return { filho, linhas: () => saida.split("\n").length, texto: () => saida };
}

/**
 * A PORTA 8787 TEM DE ESTAR LIVRE.
 *
 * ## POR QUE ISSO E O PRIMEIRO PASSO
 *
 * Porque o servidor nao sobe em uma porta ocupada: ele imprime
 * `EADDRINUSE`, morre, e o `--watch` fica ali esperando arquivo mudar sem
 * nunca ter simulado nada
 *
 * A primeira versao deste teste media esse processo morto. As linhas de log
 * NAO cresciam quando o motor mudava — e o teste dizia "o --watch-path
 * segurou", quando na verdade o servidor nunca tinha subido. Um teste que
 * passa porque a coisa medida nao rodou e o pior tipo de teste
 */
function liberarPorta() {
  try {
    const saida = execSync("netstat -ano -p tcp", { encoding: "utf8" });

    for (const linha of saida.split("\n")) {
      /**
       * `LISTENING`, E NAO `LISTEN`.
       *
       * A primeira versao deste filtro aceitava os dois e nao matava nada:
       * o `netstat` do Windows em portugues escreve `LISTENING`, e o padrao
       * usado era o outro. O servidor continuava morrendo na porta, e o
       * teste media um processo que nunca simulou nada
       */
      if (!/:8787\s/.test(linha)) continue;
      if (!/LISTENING/i.test(linha)) continue;

      const pid = linha.trim().split(/\s+/).pop();

      if (!pid || pid === String(process.pid)) continue;

      try {
        execSync("taskkill /PID " + pid + " /F", { stdio: "ignore" });
        console.log("  liberando a 8787 (pid " + pid + ")");
      } catch {
        // ja morreu entre o netstat e o taskkill
      }
    }
  } catch {
    // netstat indisponivel: o teste abaixo acusa a falha
  }
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("\n  O --watch-path SEGURA QUANDO O MOTOR MUDA\n");

liberarPorta();

await dormir(1200);

/** TOCA UM ARQUIVO E DEVOLVE QUANTAS VEZES O PROCESSO REINICIOU */
function reiniciosAoTocar(alvo, watchPath) {
  return new Promise(async (resolve) => {
    const { filho, linhas, texto } = subir(watchPath);

    await dormir(4500);

    /**
     * O SERVIDOR SUBIU DE VERDADE?
     *
     * Sem esta conferida, o teste mede um processo que morreu na porta e
     * conclui que o `--watch-path` "segurou" porque o log dele nunca cresce
     */
    if (/EADDRINUSE/.test(texto())) {
      filho.kill();
      resolve({ subiu: false });
      return;
    }

    const antes = linhas();

    mkdirSync(dirname(alvo), { recursive: true });
    writeFileSync(alvo, "// prova\n", "utf8");

    await dormir(2500);

    const depoisDeProprio = linhas();

    rmSync(alvo, { force: true });

    await dormir(2000);

    const original = readFileSync(ALVO, "utf8");

    utimesSync(ALVO, new Date(), new Date());

    await dormir(2500);

    const depoisDoMotor = linhas();

    writeFileSync(ALVO, original, "utf8");

    filho.kill();

    resolve({
      subiu: true,
      reiniciouNoProprio: depoisDeProprio > antes,
      reiniciouNoMotor: depoisDoMotor > depoisDeProprio,
    });
  });
}

const comPath = await reiniciosAoTocar(PROVA, "server/src");

conferir(
  comPath.subiu,
  "o servidor subiu de verdade no teste",
  "a porta 8787 estava ocupada: o teste mediu um processo morto",
);

conferir(
  comPath.reiniciouNoProprio,
  "mexer em server/src ainda reinicia o servidor",
  "sem isso o servidor nao pega nem a propria mudanca",
);

conferir(
  comPath.subiu && !comPath.reiniciouNoMotor,
  "mexer no motor NAO derruba mais o servidor",
  "o --watch-path nao segurou: ainda observa src/",
);

console.log(`\n  ${ok} ok, ${falhas} falhas\n`);

if (existsSync(PROVA)) rmSync(PROVA, { force: true });

process.exit(falhas ? 1 : 0);
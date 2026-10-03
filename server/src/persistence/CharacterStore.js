import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { nameKey } from "../../../src/data/characterName.js";

/**
 * Um arquivo por personagem, dentro de uma pasta.
 *
 * O servidor e a autoridade, entao o save mora AQUI e nao no
 * navegador. Se ficasse no cliente, fechar a aba seria perder tudo e
 * um cliente modificado escreveria nivel 9999 no proprio save.
 *
 * A chave do arquivo e `nameKey(nome)`, a MESMA forma que o servidor
 * usa para proibir dois jogadores com o mesmo nome. Entao "Teste",
 * "teste" e "TESTE" caem no mesmo arquivo: ninguem ganha um
 * personagem novo so por digitar com outra caixa.
 *
 * A escrita e ATOMICA: grava num `.tmp` e renomeia. Se o processo
 * morrer no meio da escrita, o arquivo antigo continua inteiro. Sem
 * isso, um `Ctrl+C` na hora de sair deixava um JSON pela metade e o
 * jogador perdia o personagem na proxima entrada.
 */
export const PASTA_PADRAO = "server/data/personagens";

const EXTENSAO = ".json";

/** `nameKey` so devolve letras e numeros, mas o nome vem de fora */
function arquivoDe(nome) {
  const chave = nameKey(nome);

  // defense em profundidade: a chave ja e segura por construcao, mas
  // um caminho de arquivo montado com entrada de usuario nao deve
  // depender so disso
  if (!/^[a-z0-9]{3,32}$/.test(chave)) return null;

  return `${chave}${EXTENSAO}`;
}

export function criarCharacterStore({ pasta = PASTA_PADRAO } = {}) {
  const dir = resolve(pasta);

  const garantirPasta = () => {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  };

  return {
    pasta: dir,

    /**
     * Le o personagem. Devolve `null` quando nao ha save, quando o
     * arquivo esta pela metade, ou quando o JSON nao abre.
     *
     * Um arquivo ilegivel NAO e erro fatal: o jogador entra como
     * personagem novo. Perder o save e ruim, mas derrubar o servidor
     * inteiro por causa de um arquivo truncado e pior.
     */
    carregar(nome) {
      const arquivo = arquivoDe(nome);

      if (!arquivo) return null;

      const caminho = join(dir, arquivo);

      if (!existsSync(caminho)) return null;

      try {
        return JSON.parse(readFileSync(caminho, "utf8"));
      } catch {
        return null;
      }
    },

    /** Guarda o personagem. `false` se nao deu para escrever. */
    salvar(nome, dados) {
      const arquivo = arquivoDe(nome);

      if (!arquivo) return false;

      try {
        garantirPasta();

        const caminho = join(dir, arquivo);
        const temporario = `${caminho}.tmp`;

        writeFileSync(temporario, JSON.stringify(dados), "utf8");

        // o rename e o que torna isto atomico: no Windows ele
        // substitui o destino, e no POSIX precisa do rename por
        // cima que o Node faz
        rmSync(caminho, { force: true });
        renameSync(temporario, caminho);

        return true;
      } catch {
        return false;
      }
    },

    apagar(nome) {
      const arquivo = arquivoDe(nome);

      if (!arquivo) return false;

      try {
        rmSync(join(dir, arquivo), { force: true });
        return true;
      } catch {
        return false;
      }
    },

    /** os nomes salvos, para administracao e diagnostico */
    listar() {
      try {
        if (!existsSync(dir)) return [];

        return readdirSync(dir)
          .filter((arquivo) => arquivo.endsWith(EXTENSAO))
          .map((arquivo) => arquivo.slice(0, -EXTENSAO.length));
      } catch {
        return [];
      }
    },
  };
}

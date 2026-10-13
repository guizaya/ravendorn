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

/**
 * Um arquivo por conta, dentro de uma pasta.
 *
 * ## POR QUE ISSO EXISTE AGORA
 *
 * A conta do jogador era um `localStorage` no navegador (`eldoria:characters:<id>`
 * e `eldoria:diamonds:<id>` no front antigo), e a assinatura MetaMask vivia
 * no `user_metadata` do Supabase. Os dois sumiram junto com o Supabase: um
 * `localStorage.clear()`, um navegador novo ou uma janela anonima apagavam
 * todos os personagens
 *
 * A conta agora mora AQUI, no servidor, que ja era a autoridade do progresso
 * pelo outro lado: o save do personagem vivia em `CharacterStore.js` desde
 * antes. Nao ha dois lugares onde a mesma coisa e verdade
 *
 * ## A CHAVE DO ARQUIVO E O `id` DA CONTA, E NAO O NOME
 *
 * E o que separa esta store da de personagens. La, a chave e `nameKey(nome)`
 * porque o nome ERA a identidade do jogador. Aqui a identidade e a conta, e
 * o nome do personagem e um atributo dela: dois personagens de contas
 * diferentes podem ter o mesmo nome, e o servidor do mundo ja recusa o
 * segundo com `NAME_TAKEN` enquanto o primeiro estiver logado
 *
 * ## A ESCRITA E ATOMICA, COMO A DO `CharacterStore`
 *
 * Grava num `.tmp` e renomeia. Um `Ctrl+C` no meio da escrita deixaria o
 * arquivo pela metade e o jogador entraria sem personagem na proxima vez
 */
export const PASTA_CONTAS_PADRAO = "server/data/contas";

const EXTENSAO = ".json";

/**
 * O id da conta so pode ser o que o provedor de identidade devolveu.
 *
 * Um id vem de fora — do `sub` do Google ou do endereco da carteira — e
 * nao passa por `nameKey`, que espera nome de personagem. Por isso o
 * formato aceito aqui e outro, e o filtro e mais apertado: sem barra,
 * sem dois pontos, sem nada que possa virar um caminho de arquivo
 */
function arquivoDe(id) {
  const chave = String(id ?? "").trim().toLowerCase();

  // o endereco da carteira entra com `0x` e 40 hex; o `sub` do Google
  // entra como algo como `1183...`. Os dois caem nesta regra depois de
  // entram normalizados
  if (!/^[a-z0-9][a-z0-9_.:-]{2,127}$/.test(chave)) return null;

  return `${chave}${EXTENSAO}`;
}

export function criarAccountStore({ pasta = PASTA_CONTAS_PADRAO } = {}) {
  const dir = resolve(pasta);

  const garantirPasta = () => {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  };

  /**
   * Le a conta. `null` quando nao existe, quando o arquivo esta pela
   * metade ou quando o JSON nao abre.
   *
   * Um arquivo ilegivel NAO derruba o processo: o jogador volta a ser
   * uma conta nova. E o mesmo-tradeoff do `CharacterStore`
   */
  function carregar(id) {
    const arquivo = arquivoDe(id);

    if (!arquivo) return null;

    const caminho = join(dir, arquivo);

    if (!existsSync(caminho)) return null;

    try {
      return JSON.parse(readFileSync(caminho, "utf8"));
    } catch {
      return null;
    }
  }

  /** Guarda a conta. `false` se nao deu para escrever. */
  function salvar(id, dados) {
    const arquivo = arquivoDe(id);

    if (!arquivo) return false;

    try {
      garantirPasta();

      const caminho = join(dir, arquivo);
      const temporario = `${caminho}.tmp`;

      writeFileSync(temporario, JSON.stringify(dados, null, 2), "utf8");

      rmSync(caminho, { force: true });
      renameSync(temporario, caminho);

      return true;
    } catch {
      return false;
    }
  }

  function apagar(id) {
    const arquivo = arquivoDe(id);

    if (!arquivo) return false;

    try {
      rmSync(join(dir, arquivo), { force: true });
      return true;
    } catch {
      return false;
    }
  }

  /** os ids salvos, para administracao e diagnostico */
  function listar() {
    try {
      if (!existsSync(dir)) return [];

      return readdirSync(dir)
        .filter((arquivo) => arquivo.endsWith(EXTENSAO))
        .map((arquivo) => arquivo.slice(0, -EXTENSAO.length));
    } catch {
      return [];
    }
  }

  return {
    pasta: dir,
    carregar,
    salvar,
    apagar,
    listar,
  };
}
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

/**
 * O estado das GUILDAS, que nao pertence a nenhum jogador.
 *
 * O mesmo raciocinio do `MarketSave`: todo o resto que o servidor guarda
 * e por personagem, num arquivo por nome dentro do `CharacterStore`. A
 * guilda e o oposto — ela e o estado que um jogador cria para os outros
 * usarem, entao vive num arquivo so, compartilhado
 *
 * Por isso ela NAO fica na pasta dos personagens: `store.listar()` lista
 * os `.json` de la como se fossem personagens, e cada guilda apareceria na
 * administracao como um jogador. Fica um nivel acima, como irma da pasta,
 * ao lado do `mercado.json`
 *
 * ## POR QUE ISTO PRECISA EXISTIR
 *
 * O `GuildStore` guarda tudo em memoria, e sem este arquivo uma guilda
 * evaporava com o processo: o jogador criava, via o clan ativo, e no
 * relog voltava para "criar ou buscar". Os PONTOS do jogador vivem no
 * save do personagem e sobreviveriam — o que piorava o problema, porque
 * o painel mostrava pontos acumulados de uma guilda que nao existia
 * mais
 *
 * ## A ESCRITA E ATOMICA
 *
 * Vai para um `.tmp` e so entao e renomeada, como o mercado. Uma guilda
 * pela metade no disco e um grupo de pessoas que existe para metade: um
 * lider sem membros, um cofre com item sem dono. Se o processo morrer no
 * meio da escrita, o arquivo antigo continua inteiro
 */
export const PASTA_PADRAO = "server/data";

export const ARQUIVO_DAS_GUILDAS = "guildas.json";

const VERSAO = 1;

/**
 * Um arquivo so, gravado de forma ATOMICA.
 *
 * A leitura devolve `null` em vez de estourar: um arquivo ilegivel nao
 * pode derrubar o servidor no boot, e o mundo sem guildas ainda permite
 * criar — o que se perde e o que ja estava la, nao a partida
 */
export function criarGuildSave({
  pasta = PASTA_PADRAO,
} = {}) {
  const dir = resolve(pasta, "..");
  const caminho = resolve(dir, ARQUIVO_DAS_GUILDAS);

  return {
    caminho,
    pasta: dir,

    /** o que esta no disco, ou `null` se nao ha nada legivel */
    carregar() {
      if (!existsSync(caminho)) return null;

      try {
        return JSON.parse(readFileSync(caminho, "utf8"));
      } catch {
        return null;
      }
    },

    /** grava. `false` se nao deu para escrever */
    salvar(dados) {
      try {
        mkdirSync(dir, { recursive: true });

        const temporario = `${caminho}.tmp`;

        writeFileSync(
          temporario,
          JSON.stringify({
            versao: VERSAO,
            ...dados,
          }),
          "utf8",
        );

        // o rename e o que torna isto atomico
        rmSync(caminho, { force: true });
        renameSync(temporario, caminho);

        return true;
      } catch {
        return false;
      }
    },

    apagar() {
      try {
        rmSync(caminho, { force: true });

        return true;
      } catch {
        return false;
      }
    },
  };
}
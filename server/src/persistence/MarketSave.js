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
 * O estado do MERCADO, que nao pertence a nenhum jogador.
 *
 * Todo o resto que o servidor guarda e por personagem: um arquivo por
 * nome, dentro de `CharacterStore`. O mercado e o oposto — os anuncios
 * de um jogador sao o produto que o outro compra, entao vivem num
 * arquivo so, compartilhado por todo mundo
 *
 * Por isso ele NAO fica na pasta dos personagens: `store.listar()`
 * lista os `.json` de la como se fossem personagens, e o mercado
 * apareceria na administracao como um jogador chamado "mercado".
 * Fica um nivel acima, como irmao da pasta
 *
 * O arquivo e UNICO para o servidor inteiro. Se cada jogador tivesse o
 * seu, cada um veria uma vitrine onde o outro nao anuncia nada — que e
 * exatamente o mercado sem mercado
 */
export const PASTA_PADRAO = "server/data";

export const ARQUIVO_DO_MERCADO = "mercado.json";

const VERSAO = 1;

/**
 * Um arquivo so, gravado de forma ATOMICA.
 *
 * A escrita vai para um `.tmp` e so entao e renomeada. O mercado e o
 * estado que mais dói perder: um anuncio pela metade no disco é um item
 * que pertence a alguem e nao esta na mochila de ninguem. Se o processo
 * morrer no meio da escrita, o arquivo antigo continua inteiro
 *
 * A leitura segue o `CharacterStore`: JSON quebrado devolve `null` e o
 * mercado comeca vazio. Um arquivo ilegivel nao pode derrubar o
 * servidor, e um mercado vazio ainda permite Announces novos
 */
export function criarMarketSave({
  pasta = PASTA_PADRAO,
} = {}) {
  // um nivel acima da pasta dos personagens, e nao dentro dela: ver o
  // comentario do modulo
  const dir = resolve(pasta, "..");
  const caminho = resolve(dir, ARQUIVO_DO_MERCADO);

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

/**
 * O que pode entrar no arquivo do mercado.
 *
 * Cada fila passa por um filtro porque o arquivo pode ter sido editado
 * a mao, vir de uma versao futura ou ficar pela metade no meio de uma
 * escrita. Um pagamento sem `ownerKey` nao tem para quem pagar, e um
 * pagamento sem valor nao credita nada: guardar as duas coisas seria
 * carregar lixo para dentro do servidor
 *
 * O item pendente e conferido contra o CATALOGO pelo `MarketStore` e
 * pelo `Inventory` na entrega; aqui so se garante a forma
 */
export function pagamentosLegiveis(bruto) {
  if (!Array.isArray(bruto)) return [];

  return bruto.flatMap((pagamento) => {
    if (!pagamento || typeof pagamento !== "object") {
      return [];
    }

    const ownerKey = chaveDeDono(pagamento.ownerKey);
    const coins = Math.floor(Number(pagamento.coins));

    if (!ownerKey) return [];
    if (!Number.isFinite(coins) || coins <= 0) return [];

    return [{ ownerKey, coins }];
  });
}

export function devolucoesLegiveis(bruto) {
  if (!Array.isArray(bruto)) return [];

  return bruto.flatMap((pendente) => {
    if (!pendente || typeof pendente !== "object") {
      return [];
    }

    const ownerKey = chaveDeDono(pendente.ownerKey);
    const itemId = textoDeItem(pendente.itemId);
    const count = Math.floor(Number(pendente.count));

    if (!ownerKey) return [];
    if (!itemId) return [];
    if (!Number.isFinite(count) || count <= 0) return [];

    return [
      {
        ownerKey,
        itemId,
        rarity: pendente.rarity ?? null,
        count,
      },
    ];
  });
}

/**
 * A chave do dono, igual a que o `GameServer` cria na entrada.
 *
 * `nameKey` so produz letras minusculas e numeros, e um arquivo com
 * qualquer outra coisa foi escrito por fora do jogo. O limite de 32
 * e o mesmo do `nameKey`
 */
function chaveDeDono(valor) {
  const chave = String(valor ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 32);

  return chave.length > 0 ? chave : null;
}

function textoDeItem(valor) {
  const texto = String(valor ?? "").trim();

  return /^[a-z0-9_]{1,64}$/.test(texto) ? texto : null;
}
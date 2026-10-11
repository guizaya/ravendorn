import { getCharacterDefinition } from "../../data/characters/index.js";
import {
  formatarPosicao,
  metricaDe,
  semMedicao,
} from "../../game/ranking/rankView.js";

/**
 * UMA LINHA DA LISTA: o 4º lugar em diante.
 *
 * ## A GRADE É DE TRÊS COLUNAS, E A POSIÇÃO TEM LARGURA FIXA
 *
 * Porque as duas primeiras colunas são de conteúdo variável — nome longo,
 * classe com nome comprido — e a última é a que o jogador compara. Com
 * posição e valor em largura fixa, o número de todas as linhas cai na mesma
 * coluna vertical, e o olho desce a lista comparando números em vez de
 * procurar o valor de cada linha
 *
 * ## POR QUE O VALOR USA `tabular-nums`
 *
 * Porque é a coluna que muda com a rolagem: "1.240" e "987" em fontes de
 * largura diferente fariam o número pular de lado a cada linha, e a coluna
 * viraria um serrilhado
 */
export default function RankingRow({
  jogador,
  criterio,
  euSouEu,
}) {
  const classe = getCharacterDefinition(jogador?.classId);

  const semValor = semMedicao(jogador, criterio);

  return (
    <li
      className={[
        "rnk-row",
        euSouEu ? "is-eu" : "",
        jogador?.online ? "" : "is-offline",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="rnk-row__posicao">
        {formatarPosicao(jogador?.posicao)}
      </span>

      {/*
        O BLOCO DE IDENTIDADE: duas linhas.

        ## POR QUE NÃO HÁ AVATAR AQUI

        Porque a linha carrega o NOME e a CLASSE em texto, e a coluna do avatar
        custava um `<canvas>` com o próprio `requestAnimationFrame` por linha
        (`ClassSprite.jsx:76` e `:91`). Com o top 200, a lista chega a 197
        linhas: 200 canvas e 200 loops vivos ao mesmo tempo por 32px de retrato
        que o jogador quase não olha. O pódio continua com os 3 sprites
        animados, onde o retrato é grande o bastante para valer o custo

        E a 2ª linha é o que sobra do avatar: "Arbalist · Nv 12" diz a classe sem
        precisar de desenho
      */}
      <div className="rnk-row__identidade">
        <span className="rnk-row__nome" data-tip={jogador?.name}>
          {jogador?.name ?? "—"}
        </span>

        <span className="rnk-row__sub">
          {classe?.name ?? "Sem classe"}
          {" · "}
          {`Nv ${jogador?.nivel ?? 1}`}
        </span>
      </div>

      {/*
        O VALOR. "sem medição" no lugar do número quando é um save antigo sem
        o campo de poder: o jogador entende que é falta de dado, e não que
        ele está fraco
      */}
      <span
        className={[
          "rnk-row__valor",
          semValor ? "is-vazio" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {semValor ? "sem medição" : metricaDe(jogador, criterio)}
      </span>
    </li>
  );
}
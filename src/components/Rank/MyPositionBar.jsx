import {
  formatarPosicao,
  metricaDe,
} from "../../game/ranking/rankView.js";

/**
 * A BARRA "SUA POSIÇÃO", fixa no rodapé do painel.
 *
 * ## POR QUE ELA EXISTE COM A LISTA JÁ ROLELÁVEL
 *
 * Porque a pergunta que o jogador tem ao abrir o rank é "onde eu estou?", e
 * essa pergunta não tem resposta na lista: se ele está no 4º, acha; se está
 * no 3.617, nunca acharia rolando. A barra é a única parte do painel que
 * responde sobre JOGADOR LOGADO, e é por isso que ela não some com a rolagem
 *
 * ## POR QUE O TEXTO DIZ "NO TOP 200" OU "FORA DO TOP 200"
 *
 * Porque "#3.617" sem contexto é um número que parece erro: o jogador não
 * sabe se 3.617 é bom ou ruim. "fora do top 200" é o que transforma o número
 * em informação. E quando ele está dentro, o texto muda para "no top 200" e
 * o número deixa de ser a notícia
 *
 * ## POR QUE O `position: sticky` E NÃO `fixed`
 *
 * Porque `fixed` tira o elemento do fluxo e ele passaria por cima do resto
 * da tela inteira. Com `sticky` no fim de um container com rolagem, a barra
 * fica presa ao rodapé *enquanto a lista rola* e some quando o painel fecha
 */
/**
 * O QUE A BARRA DIZ QUANDO NÃO HÁ POSIÇÃO.
 *
 * ## POR QUE NÃO "FORA DO TOP 200" QUANDO NÃO SABEMOS A POSIÇÃO
 *
 * Porque "fora do top 200" é uma afirmação: diz que ele existe na tabela e
 * está abaixo da 200ª linha. Sem posição — servidor reiniciado, save ainda
 * não sincronizado — o que sabemos é o contrário disso: que ainda não há
 * nada. A barra diz "aguardando o ranking" e o número fica "—", e o jogador
 * entende que é tempo, não resultado
 */
function contextoDe(posicao) {
  if (posicao === null || posicao === undefined) {
    return "aguardando o ranking";
  }

  return posicao <= 200 ? "no top 200" : "fora do top 200";
}

export default function MyPositionBar({
  jogador,
  criterio,
  posicao = null,
}) {
  return (
    <footer className="rnk-minha">
      {/*
        A POSIÇÃO, à esquerda. É o número mais grande da tela porque é a
        única informação da barra que o jogador não consegue deduzir de mais
        nada
      */}
      <span className="rnk-minha__posicao">
        {formatarPosicao(posicao)}
      </span>

      <div className="rnk-minha__meio">
        <span className="rnk-minha__rotulo">Sua posição</span>

        <span className="rnk-minha__contexto">{contextoDe(posicao)}</span>
      </div>

      {/*
        A MÉTRICA do jogador logado. Quando ele não está na tabela, o valor
        continua aparecendo: o jogador quer ver o SEU poder mesmo estando em
        posição de fora
      */}
      <span className="rnk-minha__metrica">
        {jogador ? metricaDe(jogador, criterio) : "—"}
      </span>
    </footer>
  );
}
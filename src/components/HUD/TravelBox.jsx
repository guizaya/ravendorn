/**
 * A BOX DO TELEPORTE.
 *
 * Aparece embaixo do minimapa quando o jogador esta no meio de uma
 * caminhada longa e some quando ele chega perto do destino. Tem um botao
 * que pula direto para o fim do deslocamento, gastando um pergaminho.
 *
 * ## ONDE ESTA A MESMA POSICAO DAS OUTRAS DUAS
 *
 * E a conta da `PortalBox` e da `BossBox`, com as MESMAS constantes do
 * minimapa. As tres caixas dividem o mesmo canto da tela: sao todas "a
 * saida, ou o atalho, do lugar em que voce esta". Se esta usasse outra
 * conta, ela nasceria embaixo de um lugar e o minimapa desenaria em
 * outro — e as tres se atropelariam quando duas aparecessem juntas
 *
 * ## A BOX NAO CALCULA NADA
 *
 * Ela nao mede distancia, nao sabe se o auto esta ligado e nao conta
 * pergaminho. Tudo isso vem pronto do motor, no campo `teleporte` do
 * painel, e chega `null` quando a box nao deve existir
 *
 * Um componente que calculasse a distancia leria uma posicao que ele nao
 * tem, e ofereceria um atalho para um lugar onde o jogador ja chegou
 *
 * ## O BOTAO DESLIGADO DIZ POR QUE
 *
 * Sem pergaminho o botao fica desligado E o motivo aparece escrito, e
 * nao so no `title`. Um botao morto sem explicacao e a mesma coisa que
 * nao ter saida nenhuma: o jogador ve que nao pode, sem entender o que
 * ele precisa
 */

export default function TravelBox({
  teleporte = null,
  onTeleportar = null,
}) {
  /**
   * `null` e o estado de "nao ha viagem longa".
   *
   * E o proprio motor quem decide, e nao um `if` no componente sobre a
   * posicao do jogador: o motor e quem tem o plano de viagem, e a tela
   * so recebe a resposta
   */
  if (!teleporte) return null;

  const { distancia, pergaminhos, mapa } = teleporte;

  const temPergaminho = pergaminhos > 0;

  /**
   * A DISTANCIA, OU O NOME DO MAPO DE DESTINO.
   *
   * O motor manda `distancia: null` quando o destino esta em outro mapa,
   * e o motivo e tecnico: as coordenadas do vale nao tem nada a ver com
   * as do hub, entao a distancia entre elas seria um numero inventado.
   * Mostrar `0 px` ali seria pior que nao mostrar nada — o jogador pensaria
   * que ja chegou e a box sumiria
   *
   * Com o mapa no lugar, a box ainda diz para ONDE, que e o que o jogador
   * precisa saber antes de gastar o pergaminho
   */
  /*
   A DISTANCIA COMO UNIDADE DE JOGO, E NAO COMO PIXEL.

   ## POR QUE METROS

   O mapa tem milhares de pixels de lado. "Fim em 3471 px" nao e uma
   distancia que o jogador consiga ler: ele nao tem referencia do que e um
   pixel do mundo. "347,1 m" e uma coisa que existe fora do jogo

   ## A CONVERSA

   Metros ate 999, e quilometros acima disso. Um destino a 1,4km e um destino
   a 1,4m sao coisas que o jogador precisa distinguir de relance, e e o que
   o digito a mais faz

   ## POR QUE SO UM PONTO FLUTUANTE

   Porque a box mostra UM numero, nao uma tabela. Com dois decimais, 347,13m
   tem quatro algarismos uteis e um de ruido: o jogador nao decide o
   teleporte comparando centimetros, ele decide se o destino e longe. Um
   decimal ja separa "quase la" de "la", que e a unica distincao que ele
   faz olhando

   E o ponto flutuante e REQUIRED no quilometro: sem ele, 1.10 seria lido
   como onze, e o numero diria o oposto do que mede
   */
  function formatarDistancia(px) {
    const metros = Math.round(px / 10);

    if (metros < 1000) {
      return `${metros.toFixed(1).replace(".", ",")} m`;
    }

    const km = metros / 1000;

    return `${km.toFixed(2).replace(".", ",")} km`;
  }

  const onde =
    distancia === null ? mapa : formatarDistancia(distancia);

  return (
    <div
      className="prt-box prt-box--teleporte"
      data-teleporte="sim"
    >
      {/*
        O ROTULO CURTO.

        Era "Deslocamento automatico", que com 22px quebrava a linha na
        largura de 220px e fazia a box ganhar uma altura que nao comprava
        informacao nenhuma. O botao, o texto e o icone do HUD ja dizem que
        isso e teleporte
      */}
      <p className="prt-box__label prt-box__label--linha">
        <span>Teleporte</span>

        {/*
          A DISTANCIA AO LADO DO ROTULO, e nao numa linha propria.

          ## POR QUE "FIM EM" SAIU

          Porque "Fim em 1,80 km" e a frase mais longa da box, e ela ocupava
          uma linha inteira para dizer um numero. Tirando as duas palavras,
          sobra o numero — que e o que o jogador le

          ## POR QUE NA LINHA DE CIMA

          Porque o rotulo e o mais curto da box, e ele sobra vazio na
          direita. Label na esquerda, numero na direita: e a mesma leitura
          de qualquer par rotulo/valor da tela, e o olho ja sabe fazer

          ## POR QUE A DISTANCIA SAI QUANDO O MAPA E O DE DESTINO

          Porque nao ha numero para mostrar. O motor manda `distancia: null`
          quando o destino e outro mapa, e a conta entre as coordenadas de
          dois mapas seria inventada
        */}
        <span className="prt-box__label-valor">{onde}</span>
</p>

      {/*
        O MOTIVO DO BOTAO DESLIGADO.

        ## POR QUE OS TEXTOS VIARAM CURTOS

        "Voce nao tem pergaminho de teleporte. O mercador vende." ocupava
        DUAS linhas dentro dos 220px, e eram a maior parte da altura da
        box. E o botao desligado ja escreve "Sem pergaminho" embaixo —
        as duas frases diziam a mesma coisa em dois lugares

        Sobrou so o que o botao nao diz: o preco e onde conseguir
      */}
      <p className="prt-box__lock" role="status">
        {temPergaminho
          ? "Gasta 1 pergaminho."
          : "O mercador vende."}
      </p>

      <button
        type="button"
        className="prt-box__go prt-box__go--teleporte"
        onClick={() => onTeleportar?.()}
        disabled={!temPergaminho}
        data-tip={
          temPergaminho
            ? "Pular para o fim do deslocamento"
            : "Voce nao tem pergaminho de teleporte"
        }
      >
        {temPergaminho ? "Teleportar" : "Sem pergaminho"}
      </button>
    </div>
  );
}

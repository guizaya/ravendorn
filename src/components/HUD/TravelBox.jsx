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
  minimapTop = 84,
  minimapHeight = 146,
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
  const onde = distancia === null ? mapa : `${distancia} px`;

  return (
    <div
      className="prt-box prt-box--teleporte"
      style={{
        top: minimapTop + minimapHeight + 10,
      }}
      data-teleporte="sim"
    >
      <p className="prt-box__label">Deslocamento automatico</p>

      {/*
        ONDE ESTA O DESLOCAMENTO: a distancia em pixel quando e aqui
        mesmo, e o nome do mapa de destino quando o portal esta no meio
      */}
      <p className="prt-box__name">Fim em {onde}</p>

      {/*
        O MOTIVO DO BOTAO DESLIGADO.

        Fica ACIMA do botao e nao dentro dele, pelo mesmo motivo do
        `DeathPanel`: e a informacao que o jogador precisa antes de
        ler o botao, e nao uma explicacao do botao
      */}
      <p className="prt-box__lock" role="status">
        {temPergaminho
          ? "Gasta 1 pergaminho de teleporte."
          : "Voce nao tem pergaminho de teleporte. O mercador vende."}
      </p>

      <button
        type="button"
        className="prt-box__go prt-box__go--teleporte"
        onClick={() => onTeleportar?.()}
        disabled={!temPergaminho}
        title={
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

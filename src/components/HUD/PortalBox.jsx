/**
 * A BOX DO PORTAL.
 *
 * Aparece logo abaixo do minimapa quando o jogador esta EM CIMA de um
 * portal que leva a outro mapa. Ela diz para ONDE e tem o botao de ir.
 *
 * Fica em um arquivo so porque e um bloco pequeno com uma regra simples:
 * ha portal ligado debaixo dos pes ou nao ha. Quem decide e o
 * `portalSobOsPES` do motor, publicado no painel como `portal` — a tela
 * nao descobre sozinha onde esta o jogador, ela le o que o motor disse
 *
 * E o botao nao teleporta por conta propria. Em rede quem troca o mapa
 * e o SERVIDOR: o pedido vai como um comando de painel, o servidor
 * confere que o jogador esta mesmo em cima do portal e so entao troca.
 * Um botao que chamasse `setMap` no cliente serviria para teleportar
 * para qualquer lugar sem andar ate o portal
 *
 * ## O PORTAL TRAVADO
 *
 * A Floresta Sombria so abre com a campanha do mapa 1 acabada, e a box
 * mostra isso. A trava e DITADA pelo motor (`portal.bloqueado` e
 * `portal.motivo`, do mesmo `dadosDaTrava` que o servidor usa para
 * recusar), entao a caixa nunca promete uma viagem que vai ser negada,
 * e nunca esconde uma que vai passar.
 *
 * O botao fica desligado com o motivo escrito na tela, e nao so no
 * `title`: um botao morto sem explicacao e a mesma coisa que nao ter
 * saida nenhuma. O motivo tambem vai no aviso do servidor quando o
 * jogador insiste — mas ele nao consegue insistir, e e esse o ponto
 */

export default function PortalBox({
  portal = null,
  minimapTop = 84,
  minimapHeight = 146,
  onTravel = null,
}) {
  if (!portal) return null;

  /**
   * A TRAVA, com `false` como padrao.
   *
   * Sem o campo, ou com ele explicitamente `false`, o portal esta
   * aberto. Assim um painel antigo — ou o Single player antes desta
   * regra — nao trava portal nenhum por accidento
   */
  const bloqueado = portal.bloqueado === true;

  return (
    <div
      className={[
        "prt-box",
        bloqueado ? "is-locked" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        // o minimapa e desenhado no canvas, entao nao ha elemento DOM
        // para se grudar. A posicao vem das MESMAS constantes que o
        // `drawMinimap` usa, senao a box nasce embaixo de um lugar e
        // o minimapa desenha em outro
        top: minimapTop + minimapHeight + 10,
      }}
      data-portal={portal.id}
      data-destino={portal.destino}
      data-bloqueado={bloqueado ? "sim" : "nao"}
    >
      <p className="prt-box__label">
        {bloqueado ? "Portal selado" : "Portal"}
      </p>

      <p className="prt-box__name">{portal.nome}</p>

      {bloqueado && (
        <p className="prt-box__lock" role="status">
          {portal.motivo ?? "Este portal ainda nao se abriu."}
        </p>
      )}

      <button
        type="button"
        className="prt-box__go"
        onClick={() => onTravel?.(portal.id)}
        disabled={bloqueado}
        title={bloqueado ? (portal.motivo ?? "Bloqueado") : "Atravessar"}
      >
        {bloqueado ? "Selado" : "Atravessar"}
      </button>
    </div>
  );
}
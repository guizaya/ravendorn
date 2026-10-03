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
 */

export default function PortalBox({
  portal = null,
  minimapTop = 84,
  minimapHeight = 146,
  onTravel = null,
}) {
  if (!portal) return null;

  return (
    <div
      className="prt-box"
      style={{
        // o minimapa e desenhado no canvas, entao nao ha elemento DOM
        // para se grudar. A posicao vem das MESMAS constantes que o
        // `drawMinimap` usa, senao a box nasce embaixo de um lugar e
        // o minimapa desenha em outro
        top: minimapTop + minimapHeight + 10,
      }}
      data-portal={portal.id}
      data-destino={portal.destino}
    >
      <p className="prt-box__label">Portal</p>

      <p className="prt-box__name">{portal.nome}</p>

      <button
        type="button"
        className="prt-box__go"
        onClick={() => onTravel?.(portal.id)}
      >
        Atravessar
      </button>
    </div>
  );
}

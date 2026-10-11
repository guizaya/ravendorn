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
  onTravel = null,
  onChefe = null,
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

  /*
  O CHEFE QUE ESTA TRAVANDO ESTE PORTAL.

  `null` em quase toda box: e o estado normal de uma trava comum. O campo
  so vem preenchido quando a missao que tranca o portal e um chefe, e e
  ele que troca o "Selado" morto por um botao com para onde ir

  Sem isto o jogador lia "selado" num portal que so abre com a missao que
  ele so encontra ATRAS deste portal — um circulo que so se desfaz depois
  de dezoito degraus de campanha
  */
  const chefe = bloqueado ? (portal.chefe ?? null) : null;

  return (
    <div
      className={[
        "prt-box",
        bloqueado ? "is-locked" : "",
        chefe ? "is-chefe" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-portal={portal.id}
      data-destino={portal.destino}
      data-bloqueado={bloqueado ? "sim" : "nao"}
    >
      <p className="prt-box__label">
        {chefe ? "Portal do chefe" : bloqueado ? "Portal selado" : "Portal"}
      </p>

      <p className="prt-box__name">{portal.nome}</p>

      {bloqueado && (
        <p className="prt-box__lock" role="status">
          {portal.motivo ?? "Este portal ainda nao se abriu."}
        </p>
      )}

      {/*
        O BOTAO DO CHEFE SUBSTITUI O "SELADO".

        E o mesmo lugar do botao de atravessar, e pelo mesmo motivo: a box
        tem um lugar so para a acao, e a acao deste portal NAO e atravessar.
        Um botao de atravessar cinza ao lado de um botao de enfrentar seria
        dois botoes para a mesma duvida

        E ele nao substitui o portal: o jogador volta da arena e ainda esta
        aqui, com a missao feita e o "Atravessar" no lugar de onde o "Enfrentar"
        estava
      */}
      {chefe ? (
        <button
          type="button"
          className="prt-box__go prt-box__go--chefe"
          onClick={() => onChefe?.()}
          data-tip={`Enfrentar ${chefe.nome ?? "o chefe"}`}
        >
          Enfrentar o chefe
        </button>
      ) : (
        <button
          type="button"
          className="prt-box__go"
          onClick={() => onTravel?.(portal.id)}
          disabled={bloqueado}
          data-tip={bloqueado ? (portal.motivo ?? "Bloqueado") : "Atravessar"}
        >
          {bloqueado ? "Selado" : "Atravessar"}
        </button>
      )}
    </div>
  );
}
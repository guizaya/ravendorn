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

  /**
   * O JOGADOR PODE ENTRAR NA ARENA?
   *
   * `true` e o estado normal deste botao: o jogador esta no degrau do chefe
   * e o clique vai lutar. `false` e o caso que faltava ser tratado — o
   * portal esta selado e o botao seguia levando para a arena assim mesmo,
   * porque o `onClick` nao conferia nada
   *
   * ## POR QUE `false` NAO E `disabled`
   *
   * Porque um botao `disabled` NAO dispara clique: o aviso vermelho nunca
   * apareceria, e o jogador ficaria apertando algo morto sem nunca saber o
   * porque. O botao continua clicavel e e o clique que vira aviso — com o
   * servidor recusando e mandando a frase, que e o mesmo caminho de qualquer
   * outra recusa de viagem
   *
   * `aria-disabled` e o que diz a um leitor de tela que o botao nao leva
   * a lugar nenhum, sem tirar o clique
   */
  const arenaLiberada = portal.entradaArena?.ok === true;

  return (
    <div
      className={[
        "prt-box",
        bloqueado ? "is-locked" : "",

        /*
          A CLASSE DO CHEFE E `prt-box--chefe`, e nao `is-chefe`.

          A primeira versao deste componente escrevia `is-chefe`, e o CSS
          procura `.prt-box--chefe`: a regra nunca casou. O botao do chefe
          ficava sem cor de chefe e caia no cinza do `is-locked`, com
          `cursor: not-allowed` — parecendo morto — e mesmo assim levava
          para a arena. A aparencia e o comportamento sao o mesmo objeto, e
          so um dos dois estava ligado

          E ela so entra quando o botao REALMENTE luta. Com a missao do
          chefe ainda nao chegada, quem entra e a de baixo
        */
        chefe && arenaLiberada ? "prt-box--chefe" : "",
        chefe && !arenaLiberada ? "is-chefe-bloqueado" : "",
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

      <p className="prt-box__name prt-box__name--linha">
        <span>{portal.nome}</span>

        {/*
          O BOTAO, NA MESMA LINHA DO NOME DO MAPA.

          ## POR QUE ELE SAIU PARA DEBAIXO

          Porque ele ocupava uma linha inteira da box, colado na borda
          inferior e longe do rotulo que ele executa. O jogador lia "Portal",
          lia o mapa, e so depois achava o botao: tres blocos para uma acao
          que cabe ao lado do destino

          ## POR QUE SO "IR"

          Porque o botao nao precisa repetir o que ele faz. O rotulo acima ja
          diz "Portal" e o `data-tip` continua explicando. "IR" e o verbo que
          falta, e e o que cabe na largura que sobra ao lado do mapa

          ## E QUANDO ESTA SELADO

          O botao continua desligado e sem "IR": ali o texto e a informacao,
          porque nao ha clique possivel
        */}
        {chefe ? (
          <button
            type="button"
            className="prt-box__go prt-box__go--chefe"
            onClick={() => onChefe?.()}
            aria-disabled={!arenaLiberada}
            data-tip={
              arenaLiberada
                ? `Enfrentar ${chefe.nome ?? "o chefe"}`
                : (portal.entradaArena?.motivo ??
                  "Termine a missao do chefe para entrar na arena.")
            }
          >
            IR
          </button>
        ) : (
          <button
            type="button"
            className="prt-box__go"
            onClick={() => onTravel?.(portal.id)}
            disabled={bloqueado}
            data-tip={bloqueado ? (portal.motivo ?? "Bloqueado") : "Atravessar"}
          >
            {bloqueado ? "Selado" : "IR"}
          </button>
        )}
      </p>

      {bloqueado && (
        <p className="prt-box__lock" role="status">
          {chefe && !arenaLiberada
            ? (portal.entradaArena?.motivo ??
              "Voce precisa estar na missao do chefe para entrar na arena.")
            : (portal.motivo ?? "Este portal ainda nao se abriu.")}
        </p>
      )}
    </div>
  );
}
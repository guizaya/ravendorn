/**
 * A BOX DO CHEFE.
 *
 * Aparece logo abaixo do minimapa quando o jogador esta DENTRO da arena,
 * com um botao de "Sair do chefe". E a mesma posicao e o mesmo desenho da
 * `PortalBox`: as duas sao a saida de um lugar que nao tem portal.
 *
 * ## POR QUE ISTO E O BOTAO DA ARENA DO HUD
 *
 * Ate agora o icone da arena no HUD — ao lado do bestiario — fazia os
 * dois sentidos: entrar e sair, conforme o mapa. Isso e um botao que
 * muda de significado conforme onde o jogador esta, e o jogador precisa
 * lembrar em que mapa esta para saber o que vai acontecer. E o icone
 * fica a meia tela de distancia do minimapa, que e onde o olho ja esta
 * quando se pensa em "sair"
 *
 * Aqui a tarefa e unica: SAIR. E o icone do HUD volta a ser so ENTRAR.
 *
 * ## O BOTAO NAO TELEPORTA
 *
 * Em rede quem troca o mapa e o SERVIDOR: o pedido vai como comando de
 * painel, e o servidor confere que o jogador esta mesmo na arena antes
 * de mover. Um botao que chamasse `setMap` no cliente serviria para
 * teleportar para qualquer lugar sem estar na arena
 *
 * ## A COR E A DO PERIGO
 *
 * O mesmo vermelho que o chefe usa no catalogo, e o que o projeto ja
 * reserva para "voce esta em perigo". A box e uma saida de emergência:
 * ela precisa ser reconhecida antes de ser lida
 */

export default function BossBox({
  naArena = false,
  nomeChefe = "Chefe",
  onSair = null,
}) {
  if (!naArena) return null;

  return (
    <div
      className="prt-box prt-box--chefe"
      data-boss-box="sim"
    >
      <p className="prt-box__label">Arena do chefe</p>

      <p className="prt-box__name">{nomeChefe}</p>

      {/*
        O AVISO E DITO AQUI, e nao so no botao.

        Sair devolve o jogador ao ponto de onde ele veio. Quem entrou
        pela arena e nao tem de onde voltar — e o `showMessage` do
        servidor avisa esses casos. Deixar o aviso so no texto do botao
        esconderia a unica informacao que o jogador precisa antes de
        clicar
      */}
      <p className="prt-box__lock" role="status">
        Sair devolve voce para onde estava.
      </p>

      <button
        type="button"
        className="prt-box__go prt-box__go--chefe"
        onClick={() => onSair?.()}
        data-tip="Sair da arena do chefe"
      >
        Sair do chefe
      </button>
    </div>
  );
}

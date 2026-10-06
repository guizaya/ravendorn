/**
 * O PAINEL DA MORTE.
 *
 * ## POR QUE ELE NAO FECHA
 *
 * O pause fecha na ESC, no clique fora e no "Continuar". Este aqui nao
 * fecha de jeito nenhum, e a diferenca nao e falta de botao: e que ele
 * nao tem um "continuar". Quem morreu nao esta pausando o jogo — esta
 * numa situacao que SAI de duas maneiras, e as duas gastam alguma
 * coisa. Um X no canto seria uma terceira saida que nao existe na regra
 *
 * E o veu e `pointer-events: auto` em `inset: 0`, entao nao ha como
 * clicar por tras: o inventario nao abre, o mapa nao anda, o auto nao
 * ataca. Nenhum atalho de painel tambem, e o `HUD` tem a guarda do
 * modal para isso
 *
 * ## OS PRECOS NAO SAO CALCULADOS AQUI
 *
 * O painel recebe `morte` do painel do servidor — `custoReviver` e
 * `custoVoltar` ja vem prontos. Um painel que chamasse `reviveCost` e
 * `xpPerdidoNaMorte` por conta propria estaria mostrando a conta do
 * cliente, e a conta que o servidor cobra e outra assim que um dos dois
 * numeros mudar
 *
 * E o botao do ouro se desliga quando nao ha ouro. Nao por cortesia:
 * desligado diz o que vai acontecer. Ativo e recusado no clique, o
 * jogador aprende que nao tem dinheiro gastando a animaça do botao
 *
 * ## A ORDEM DOS BOTOES
 *
 * Reviver vem primeiro e dourado. E a escolha mais comum para quem tem
 * ouro, e a unica que nao tira progresso. Voltar para a base vem
 * embaixo, porque custar XP e perder a posicao na zona
 *
 * O assunto do botao e o que o jogador LERIA, nao o que ele faria:
 * "Reviver · 60" e nao "Pagar 60". Quem morreu quer voltar ao jogo, e
 * o preco e a informacao, nao o verbo
 */

export default function DeathPanel({
  morte = null,
  onReviver = null,
  onVoltarBase = null,
}) {
  // sem `morto` nao ha painel: e o estado que decide se isto aparece, e
  // ele vem do servidor. Um `hp === 0` lido aqui seria a segunda fonte
  // da verdade
  if (!morte?.morto) return null;

  const custoReviver = Math.max(0, morte.custoReviver ?? 0);
  const custoVoltar = Math.max(0, morte.custoVoltar ?? 0);

  /**
   * O PRAZO.
   *
   * Vem do motor e nao e contado aqui. O painel mostrar um numero e o
   * motor decidir outro seria o mesmo preco em dois lugares, e o
   * jogador veria 5 segundos com os botoes ainda liberados
   *
   * E o numero e CEIL: e o que o jogador tem, nao o que sobrou no
   * relogio. `restante = 0` significa que o prazo acabou
   */
  const restante = Math.max(0, morte.restante ?? 0);

  const semPrazo = restante <= 0;

  return (
    <div
      className="dth"
      // `alertdialog` e nao `dialog`: e uma situacao que exige uma
      // resposta, e o leitor de tela precisa saber que o foco esta preso
      // aqui dentro
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="dth-title"
      aria-describedby="dth-hint"
    >
      <div className="dth__veil" />

      <div className="dth__panel">
        {/**
         * O MARCA DE MORTE.
         *
         * O circulo e o glifo de caveira em vez de uma imagem: e a
         * unica coisa do painel que nao tem nada a ver com o catalogo
         * de itens, e uma imagem custaria um arquivo inteiro para
         * desenhar um ponto
         */}
        <span className="dth__mark" aria-hidden="true">
          ☠
        </span>

        <h2 className="dth__title" id="dth-title">
          Voce morreu
        </h2>

        <p className="dth__hint" id="dth-hint">
          Escolha como voltar ao jogo. As duas saidas cobram alguma coisa.
        </p>

        {/*
          O VOLTAR AUTOMATICO.
          *
          * Fica ACIMA dos botoes e nao embaixo: e a regra que vale
          * quando ninguem clica, entao e a informacao que o jogador
          * precisa antes de ler os precos. Num numero so, porque e um
          * prazo, e nao uma conta
          */}
        <p
          className="dth__countdown"
          // o leitor de tela ouve o numero a cada painel. `polite` e
          // nao `assertive` porque o jogador nao precisa do numero
          // CADA SEGUNDO: e um aviso de que ha um prazo, nao um
          // alarme a cada tique
          aria-live="polite"
        >
          {semPrazo
            ? "Voltando para a base..."
            : `Voltando para a base em ${restante}s`}
        </p>

        <div className="dth__options">
          <button
            type="button"
            className="dth__btn dth__btn--revive"
            onClick={() => onReviver?.()}
            // sem ouro, o botao desliga. E o que faz o jogador ver o
            // preco e entender por que nao ha o que fazer com ele
            disabled={custoReviver === 0 || semPrazo}
          >
            <span className="dth__btn-label">Reviver</span>

            <span className="dth__btn-cost">
              <i aria-hidden="true">◉</i>
              {custoReviver}
            </span>

            <small className="dth__btn-note">
              Volta aqui mesmo, com vida cheia
            </small>
          </button>

          <button
            type="button"
            className="dth__btn dth__btn--base"
            onClick={() => onVoltarBase?.()}
            // o prazo zerado e a propria saida ja tendo acontecido: o
            // motor esta voltando o jogador neste instante, e o botao
            // clicado aqui seria um pedido atrasado
            disabled={semPrazo}
          >
            <span className="dth__btn-label">Voltar para a base</span>

            <span className="dth__btn-cost dth__btn-cost--xp">
              <i aria-hidden="true">✦</i>
              {custoVoltar}
            </span>

            <small className="dth__btn-note">
              Some com o XP e te traz para o acampamento
            </small>
          </button>
        </div>
      </div>
    </div>
  );
}
import { GUILD_CORES, GUILD_ICONS } from "../../data/guild/index.js";

/**
 * O SELETOR DE ESTILO DE GUILDA.
 *
 * ## POR QUE UM COMPONENTE E NAO DUAS COPIAS
 *
 * Porque ele aparece em dois lugares — a aba de Criar e a de Configuracoes —
 * e o desenho dele nao tem nada de especifico de nenhum dos dois. Sao as
 * mesmas doze celulas de emblema e as mesmas onze amostras de cor. Duas
 * copias divergiriam na primeira vez que o catalogo ganhasse um item, e o
 * jogador veria um emblema novo na criacao e ausente na configuracao
 *
 * ## E POR QUE ELE NAO DECIDE NADA
 *
 * Porque a escolha e do LIDER e a gravacao e do servidor. Este componente
 * so guarda o par escolhido no estado do painel e avisa o pai — ele nao
 * pede nada ao `GameClient`, e nao tem `comCliente`. Quem decide o que
 * happens com a guilda e o `GuildStore`
 */
export function SeletorEstilo({
  icone,
  cor,
  onChange,
  bloqueado = false,
}) {
  return (
    <div className={["gld-estilo", bloqueado ? "is-bloqueado" : ""]
      .filter(Boolean)
      .join(" ")}
    >
      {/*
        O EMBLEMA.

        E um `<button>` e nao um `<span>` porque a celula e clicavel, e o
        `aria-pressed` e o que faz o leitor de tela anunciar "selecionado"
        em vez de so "Escudo"
      */}
      <div
        className="gld-estilo__grupo"
        role="radiogroup"
        aria-label="Emblema da guilda"
      >
        <span className="gld-estilo__rotulo">Emblema</span>

        <div className="gld-estilo__icones">
          {GUILD_ICONS.map((item) => {
            const escolhido = item.id === icone;

            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={escolhido}
                aria-label={item.nome}
                data-tip={item.nome}
                disabled={bloqueado}
                className={[
                  "gld-estilo__icone",
                  escolhido ? "is-ativo" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onChange?.({ icone: item.id, cor })}
              >
                {item.glifo}
              </button>
            );
          })}
        </div>
      </div>

      {/*
        A COR.

        E uma amostra de cor e nao o hex, porque o hex nao e uma opcao que se
        escolhe digitando: onze amostras com nome e sem texto e o jeito que o
        jogador escolhe uma cor. E o `title` que da o nome, para quem quer
        saber o que esta escolhendo antes de clicar
      */}
      <div
        className="gld-estilo__grupo"
        role="radiogroup"
        aria-label="Cor da guilda"
      >
        <span className="gld-estilo__rotulo">Cor</span>

        <div className="gld-estilo__cores">
          {GUILD_CORES.map((item) => {
            const escolhido = item.id === cor;

            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={escolhido}
                aria-label={item.nome}
                data-tip={item.nome}
                disabled={bloqueado}
                className={[
                  "gld-estilo__cor",
                  escolhido ? "is-ativo" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ "--cor": item.cor }}
                onClick={() => onChange?.({ icone, cor: item.id })}
              >
                <span aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * A PREVIA DE COMO A BANDEIRA VAI FICAR.
 *
 * ## POR QUE PREVIA E NAO SO OS DOIS CONTROLES
 *
 * Porque o jogador vai ver essa mesma composicao — emblema, tag colorida,
 * nome — em cima do boneco dele no mundo, e no cabecalho do painel. Escolher
 * uma cor e um emblema em listas separadas deixa o jogador juntar as duas
 * informacoes na cabeca; a previa e o unico jeito de ele ver o resultado
 * antes de gastar os dez milhoes
 *
 * E o TEXTO que muda a cor, e nao um detalhe: e literalmente o que sera
 * pintado no canvas. Se a tag do painel e azul e a do mundo sai amarela,
 * o jogador escolheu uma coisa e recebeu outra
 */
export function PreviaEstilo({ icone, cor, nome, tag }) {
  const amostra = GUILD_CORES.find((c) => c.id === cor) ?? GUILD_CORES[0];

  const emblema = GUILD_ICONS.find((i) => i.id === icone) ?? GUILD_ICONS[0];

  return (
    <div className="gld-previa-estilo">
      {/*
        O TEXTO DA COR E A MESMA FONTE do canvas.
        `Inter` 800 e 10px e o que o `drawNomeDeRemoto` usa, e a tag sai em
        11px ali. Aqui e menor porque a previa esta numa placa de 96px e o
        texto em 11px ocuparia a largura toda
      */}
      <span
        className="gld-previa-estilo__tag"
        style={{ color: amostra.cor }}
      >
        [{tag.trim().toUpperCase() || "??"}]
      </span>

      <span className="gld-previa-estilo__nome">
        {emblema.glifo} {nome.trim() || "Sem nome"}
      </span>
    </div>
  );
}
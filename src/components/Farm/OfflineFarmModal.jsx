/**
 * O RELATORIO DO FARM OFFLINE: a tela que o jogador ve ao voltar.
 *
 * ## POR QUE ESTE COMPONENTE EXISTE E NAO UM AVISO
 *
 * Porque o accrue e uma soma de vinte numeros e o aviso do jogo (`avisoDoDono`,
 * a caixa de texto que so cabe uma frase) mostraria um deles. O jogador
 * voltaria sabendo que ganhou "muita coisa" e nao saberia o que — e a
 * proxima vez que ele apertasse o botao seria com o mesmo-degree de
 * duvida sobre se funcionou
 *
 * ## E POR QUE ELE E UM MODAL E NAO UM PAINEL
 *
 * Porque e um ACONTECIMENTO, nao um lugar. O jogador nao pode navegar
 * para o relatorio: ele so existe depois de um accrue, e some quando o
 * jogador confirma que viu. O modal e o que comunica "isto foi uma vez"
 *
 * O precedente de estrutura e o `DeathPanel`: mesmo z-index maior que o
 * pause, mesmo retorno antecipado quando nao ha estado, mesmo botao que
 * chama o servidor e nao mexe no estado local
 */
import { useEffect, useRef } from "react";
import { formatarMoedas } from "../../data/guild/index.js";
import ItemCard from "../UI/ItemCard.jsx";

/**
 * O TEMPO, escrito para o jogador.
 *
 * "3h20min" e melhor que "11.980.000 ms" e melhor que "0,11 dias".
 * A hora arredonda para baixo e o resto vem em minutos — o minuto e a
 * unidade que o jogador sente de um farm, e mostrar segundos num numero
 * que dura meio dia so faz o numero parecer falso
 */
function duracaoDe(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));

  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);

  if (horas <= 0) return `${minutos}min`;

  if (minutos <= 0) return `${horas}h`;

  return `${horas}h ${String(minutos).padStart(2, "0")}min`;
}

/**
 * O MOTIVO, quando o farm nao rendeu.
 *
 * O modal existe tambem para o caso VAZIO. "Voce voltou e nada
 * aconteceu" sem explicacao e indistinguivel de um bug: o jogador nao
 * sabe se foi o tempo curto, se ele ja tinha visto este relatorio, ou se
 * o mapa estava vazio. Cada caso tem uma frase diferente
 */
function motivoDe(motivo) {
  switch (motivo) {
    case "sem-tempo":
      return "Voce voltou antes de dar tempo de um abate.";

    case "sem-abates":
      return "Nao deu tempo de derrubar nada nesse mapa.";

    case "sem-mob":
      return "Esse mapa nao tem criatura para cacar.";

    case "teto":
      return "Voce bateu no limite de 12 horas de farm.";

    default:
      return null;
  }
}

/** O numero grande do topo: abates, que e a medida do farm. */
function NumeroGrande({ valor, legenda }) {
  return (
    <div className="fof-num">
      <strong>{formatarMoedas(valor)}</strong>
      <small>{legenda}</small>
    </div>
  );
}

export default function OfflineFarmModal({ relatorio = null, onFechar }) {
  /**
   * O FOCO VAI PARA O BOTAO, e nao para o painel.
   *
   * O modal do `MarketModal` faz isso e o motivo e o mesmo: um dialogo
   * que abre sem foco algum deixa o `Tab` andando pelo resto da tela, e
   * o `Escape` do `HUD` — que esta logo abaixo na pilha — nao encontra
   * alvo
   */
  const botaoRef = useRef(null);

  useEffect(() => {
    if (!relatorio) return undefined;

    botaoRef.current?.focus();

    return undefined;
  }, [relatorio]);

  // sem `relatorio` o modal nao existe: quem decide e o estado do
  // servidor, e um `relatorio` local seria a segunda fonte da verdade
  if (!relatorio) return null;

  const motivo = motivoDe(relatorio.motivo);

  const subiuDeNivel =
    Number(relatorio.nivelDepois) > Number(relatorio.nivelAntes);

  /**
   * A LISTA DE ITENS E A GRADE DO INVENTARIO, e nao uma lista de linhas.
   *
   * ## POR QUE O `ItemCard` E NAO UM `<li>` COM ICONE
   *
   * Porque o jogador reconhece um cartao de item de relance. Um retangulo
   * com um glifo dentro e um texto ao lado e a MESMA informacao com menos
   * informacao: a moldura, a cor da raridade e o slot com a arte do item
   * sao a leitura visual que o inventario ensina em dez minutos de jogo
   *
   * E a cor da raridade entra de graca com o `ItemCard`. A versao anterior
   * desta tela desenhava o nome em texto e perdia isso — e o jogador nao
   * conseguia dizer "esse e raro" sem passar o mouse e abrir o tooltip
   *
   * ## E POR QUE SEM TEXTO, COMO A MOCHILA
   *
   * Porque o `mostrarTexto={false}` tira nome e raridade de baixo do
   * icone — que e o que o jogador pediu, e o que faz a lista virar uma
   * parede de arte em vez de uma coluna de paragrafos
   *
   * E a QUANTIDADE continua aparecendo: ela nao mora no bloco de texto, e
   * sim DENTRO do slot, no `inv-slot__count` do `InvSlotView`. Desligar o
   * texto nao apagaria o numero — e o numero e a metade do que esta tela
   * tem a dizer
   */
  const itens = relatorio.itens ?? [];

  const mobs = relatorio.mobs ?? [];

  return (
    <div
      className="fof"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fof-titulo"
    >
      <div className="fof__veil" />

      <div className="fof__painel">
        <h2 className="fof__titulo" id="fof-titulo">
          Farm offline
        </h2>

        <p className="fof__quando">
          {duracaoDe(relatorio.duracaoEfetivaMs)} longe
          {mobs.length > 0 && (
            <>
              {" "}
              em{" "}
              <strong>{mobs.length === 1
                ? mobs[0].nome
                : `${mobs.length} tipos de criatura`}</strong>
            </>
          )}
        </p>

        {subiuDeNivel && (
          <p className="fof__nivel">
            Nivel {relatorio.nivelAntes} &rarr;{" "}
            <strong>{relatorio.nivelDepois}</strong>
          </p>
        )}

        {motivo && <p className="fof__motivo">{motivo}</p>}

        {/*
          A CAIXA DOS ITENS.

          ## POR QUE UMA MOLDURA E NAO A GRADE AVULSA

          Porque a lista de itens e o CORPO da tela — e ela precisa de uma
          borda que diga "isto aqui e uma colecao", separada do titulo
          acima e dos numeros abaixo. Sem a moldura os cartoes flutuam no
          fundo do painel e o jogador nao sabe onde a lista acaba e comeca
          o proximo bloco

          E a borda e o que faz o `max-height` parecer um limite: a rolagem
          acontece DENTRO da caixa, e o que passa da borda esta fora dela
        */}
        {itens.length > 0 && (
          <div className="fof__itens-caixa">
            <h3 className="fof__secao">O que caiu</h3>

            {/*
              A GRADE ROLA DENTRO DA CAIXA, e o `destino` saiu daqui.

              A frase "X na mochila, Y no bau" foi removida a pedido: ela
              ocupava uma linha para dizer uma consequencia — o jogador
              ve o que ganhou, e o espaco restante ja responde sozinho.
              E o numero de perdidos continua existindo no relatorio do
              servidor, para quando houver um caso em que o jogador
              precisar saber
            */}
            <div className="fof__itens inv-grid-modern">
              {itens.map((item) => (
                <ItemCard
                  key={item.itemId}
                  entry={{ itemId: item.itemId, count: item.count }}
                  mostrarTexto={false}
                />
              ))}
            </div>
          </div>
        )}

        {/*
          OS TRES NUMEROS, DEPOIS DOS ITENS.

          ## POR QUE EMBORA ELES SEJAM O TITULO DA TELA

          Porque o jogador abriu esta tela com uma pergunta so: "o que
          eu ganhei". A resposta sao os ITENS — sao eles que ocupam a
          mochila e mudam o que ele pode equipar. Abates, XP e ouro sao o
          resumo desse ganho, e um resumo vem DEPOIS do detalhe, nao antes

          E placing-los no topo puniria o caso comum: quem ganha 2.400
          couros e um item raro veria dois numeros grandes e uma lista
          pequena, e invertiria o peso das duas coisas
        */}
        <div className="fof__numeros">
          <NumeroGrande valor={relatorio.abates} legenda="abates" />
          <NumeroGrande valor={relatorio.xp} legenda="XP" />
          <NumeroGrande valor={relatorio.coins} legenda="ouro" />
        </div>

        {mobs.length > 0 && (
          <>
            <h3 className="fof__secao">O que foi derrotado</h3>

            <ul className="fof__mobs">
              {mobs.map((mob) => (
                <li key={mob.chave ?? mob.typeId} className="fof__mob">
                  {/*
                    O NIVEL AO LADO DO NOME, e ele resolve a duplicata.

                    O jogo tem duas criaturas chamadas "Goblin" — o
                    `ogre_da_predeira` e o `ogre`. Nao renomear nenhuma
                    delas e o certo: o id e o que o bestiario, as missoes
                    de cacada e os `mix` de zona usam para achar a
                    criatura, e trocar o nome mexeria em tela de save

                    O nivel separa as duas linhas E diz o que o jogador
                    quer saber num relatorio de farm: contra o que ele
                    gastou o tempo
                  */}
                  <span className="fof__mob-nome">
                    {mob.nome}
                    {mob.nivel > 0 && (
                      <small className="fof__mob-nivel">
                        {" Nv "}
                        {mob.nivel}
                      </small>
                    )}
                  </span>

                  <span className="fof__mob-qtd">
                    {formatarMoedas(mob.abates)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <button
          ref={botaoRef}
          type="button"
          className="fof__btn"
          onClick={onFechar}
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
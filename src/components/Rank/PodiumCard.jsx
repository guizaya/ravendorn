import ClassSprite from "../UI/ClassSprite.jsx";
import { getCharacterDefinition } from "../../data/characters/index.js";
import {
  RANK_COR_MEDALHA,
  metricaDe,
} from "../../game/ranking/rankView.js";

/**
 * UM CARD DO PÓDIO.
 *
 * ## POR QUE O PRIMEIRO LUGAR É MAIOR E MAIS ALTO
 *
 * Porque o pódio comunica a ordem pela ALTURA antes de qualquer texto: o
 * jogador ve que o primeiro é o do meio, e é essa a leitura que a posição da
 * lista (1, 2, 3) só confirma depois
 *
 * ## POR QUE A MEDALHA FICA SOBRE A BORDA
 *
 * Porque a medalha é o número da posição, e o número precisa estar no topo
 * do card para casar com a ordem visual. Dentro do card, ela desceria para
 * junto do nome e o jogador teria que olhar o texto para saber quem é o 1º
 *
 * E ela sobrepõe a borda em vez de ficar numa linha própria: uma linha a
 * mais empurraria o sprite para baixo e o card do 2º deixaria de alinhar pela
 * base com o do 3º
 */
export default function PodiumCard({ jogador, posicao, criterio, euSouEu }) {
  const primeiro = posicao === 1;

  const classe = getCharacterDefinition(jogador?.classId);

  return (
    <article
      className={[
        "rnk-podio-card",
        primeiro ? "is-primeiro" : "",
        euSouEu ? "is-eu" : "",
      ]
        .filter(Boolean)
        .join(" ")}

      /**
       * O LUGAR, como atributo, e nao como classe.
       *
       * Porque e um DADO da linha — 1, 2 ou 3 — e nao um estado que o CSS
       * liga e desliga. `is-primeiro` ja existia porque o 1o lugar e o unico
       * com tamanho diferente, e era um `if` no componente
       *
       * Com `data-lugar`, o CSS pinta as tres medalhas sem o JSX saber o
       * que e bronze, prata e ouro: uma regra por lugar, e adicionar um
       * comportamento novo nao exige tocar neste arquivo
       */
      data-lugar={posicao}
      style={{ "--medalha": RANK_COR_MEDALHA[posicao] ?? "var(--t-line-3)" }}
    >
      {/*
        A MEDALHA, com o NÚMERO e não com emoji.
        A `RANK_MEDALHA` do rank é emoji (🥇🥈🥉), e emoji de medalha no pódio
        seria uma figura grande que roubaria a atenção do sprite — que é a
        coisa que o jogador está olhando
      */}
      <span
        className="rnk-podio-card__medalha"
        aria-label={`${posicao}º lugar`}
      >
        {posicao}
      </span>

      {/*
        O SPRITE da classe.
        `ClassSprite` devolve um `<canvas>` e ele já anima o `idle`. O
        `className` é quem dá o tamanho — o componente não tem prop de
        tamanho, e mudar o tamanho dele mexeria na tela de seleção também
      */}
      <ClassSprite
        classId={jogador?.classId}
        className="rnk-podio-card__sprite"
      />

      {/*
        O NOME. A guilda e o badge de facção que o desenho pede NÃO entram
        aqui: o rank não recebe nenhum dos dois no payload. Ver o comentário
        do `RankingPanel` sobre o que ficou de fora
      */}
      <h3 className="rnk-podio-card__nome" data-tip={jogador?.name}>
        {jogador?.name ?? "—"}
      </h3>

      <span className="rnk-podio-card__classe">
        {classe?.name ?? "Sem classe"}
      </span>

      {/*
        A MÉTRICA da aba. No primeiro lugar com o dourado, nos outros com o
        tom mais claro: é a mesma regra do desenho, e a diferença é o que faz
        o olho ir no 1º antes de ler qualquer nome
      */}
      <span className="rnk-podio-card__metrica">
        {metricaDe(jogador, criterio)}
      </span>

      {euSouEu && <span className="rnk-podio-card__eu">você</span>}
    </article>
  );
}
import { formatarNumero } from "../../game/bestiary/codexFormat.js";
import { statusDe } from "../../game/bestiary/codexView.js";
import CodexProgressBar from "./CodexProgressBar.jsx";
import CreatureSprite from "./CreatureSprite.jsx";

/**
 * O CARD DE UMA ENTRADA NA COLUNA DA LISTA.
 *
 * ## A MINIATURA E A ARTE DA CRIATURA, NO IDLE PARA BAIXO
 *
 * E o `CreatureSprite`, com o glifo atras como reserva. A direcao e fixa:
 * um retrato de lista nao tem direcao, e um bicho que vira conforme o cursor
 * passa parece vivo de um jeito que ninguem pediu
 *
 * E o retrato e `PARADO` — um quadro do `idle`, sem `requestAnimationFrame`.
 * Sao ate 45 cards na lista, e 45 loops de animacao para 44px de miniatura e
 * o preco certo para um ganho que ninguem perceives. O retrato do detalhe, que
 * e um so, e que anima
 *
 * ## A LINHA 2 DIZ NIVEL, E NAO TIER
 *
 * O `bestiario.txt` pede "{tier} · {feitos}/{total}" e o card precisa de
 * `tier` de criatura, que nao existe no projeto: no `Bestiary` o `tier` e o
 * numero da CACADA (1, 2, 3). O `level` vem do mesmo snapshot e e o dado que
 * o jogador reconhece
 */
export default function CodexEntryCard({
  entrada,
  selecionada = false,
  aoSelecionar,
}) {
  const feitos = entrada.hunts.filter((hunt) => hunt.done).length;
  const total = entrada.hunts.length;
  const completa = entrada.done;
  const status = statusDe(entrada);

  return (
    <li
      className={[
        "cdx-card",
        selecionada ? "is-selected" : "",
        completa ? "is-complete" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="option"
      aria-selected={selecionada}
      tabIndex={selecionada ? 0 : -1}
      onClick={() => aoSelecionar?.(entrada.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          aoSelecionar?.(entrada.id);
        }
      }}
    >
      <span className="cdx-card__mini">
        <CreatureSprite
          creatureId={entrada.creatureId}
          fallback={entrada.icon}
        />
      </span>

      <span className="cdx-card__texto">
        <span className="cdx-card__nome" data-tip={entrada.name}>
          {entrada.name}
        </span>

        <span className="cdx-card__sub">
          {`Nv ${entrada.level} · ${feitos}/${total}`}
        </span>

        <CodexProgressBar
          fracao={entrada.fracao}
          variante={completa ? "sucesso" : "destaque"}
        />
      </span>

      <span
        className={[
          "cdx-card__pct",
          completa ? "is-sucesso" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-tip={status}
      >
        {formatarNumero(Math.round(entrada.fracao * 100))}
        {"%"}
      </span>
    </li>
  );
}
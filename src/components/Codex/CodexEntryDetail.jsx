import {
  faltaPara,
  fracaoDaCacada,
  statusDe,
} from "../../game/bestiary/codexView.js";
import { formatarNumero } from "../../game/bestiary/codexFormat.js";
import CodexProgressBar from "./CodexProgressBar.jsx";
import CreatureSprite from "./CreatureSprite.jsx";

/**
 * A COLUNA CENTRAL: o detalhe da criatura selecionada.
 *
 * Este e o ESQUELETO do bloco de monstros. O `bestiario.txt` pede aqui o
 * cabeçalho, a grade de estatisticas, a caixa de pontos de talento, "onde
 * encontrar", a lista de etapas e o rodape com "IR CAÇAR" — e o que esta
 * escrito abaixo e so a estructura com o que o snapshot tem hoje
 *
 * ## O QUE FICOU DE FORA E POR QUE
 *
 *   - **RODAPÉ "IR CAÇAR"**: o `BestiaryPanel` ja tem o botao que abre a
 *     cacada, e a rota vive nele. Duplicar o botao aqui criaria dois caminhos
 *     para a mesma acao, e o jogador nao saberia qual era o certo
 *   - **PONTOS DE TALENTO**: nao existe no projeto. `Bestiary.bonuses()`
 *     devolve bonus de STAT, e ponto de talento e outra coisa — nao ha
 *     arvore, nao ha gasto, nao ha saldo. Mostrar "3 por etapa" seria
 *     inventar a regra inteira
 *   - **ONDE ENCONTRAR**: existe `zoneName` no snapshot, mas e o nome da
 *     zona, nao uma faixa de nivel. O `bestiario.txt` pede "Faixa 21-25" e
 *     essa faixa nao esta em lugar nenhum do catalogo
 *   - **MINIATURA EM SPRITE**: o mesmo motivo do card da lista
 */
export default function CodexEntryDetail({
  entrada,
  hunting = null,
  onHunt,
}) {
  if (!entrada) {
    return (
      <section className="cdx-col cdx-col--detalhe">
        <p className="cdx-vazio">Nenhuma entrada encontrada</p>
      </section>
    );
  }

  const completos = entrada.hunts.filter((hunt) => hunt.done).length;
  const proximo = entrada.hunts.find((hunt) => !hunt.done) ?? null;
  const status = statusDe(entrada);

  return (
    <section className="cdx-col cdx-col--detalhe">
      <div className="cdx-detalhe__scroll">
        {/* 4.1 CABEÇALHO */}
        <header className="cdx-detalhe__head">
          <span className="cdx-detalhe__portrait">
            <CreatureSprite
              creatureId={entrada.creatureId}
              fallback={entrada.icon}
              animado
            />
          </span>

          <span className="cdx-detalhe__identidade">
            <span className="eyebrow">{`MONSTROS · Nv ${entrada.level}`}</span>

            <h2 className="cdx-detalhe__titulo">{entrada.name}</h2>

            <span className="cdx-detalhe__sub">
              {`${completos} de ${entrada.hunts.length} etapas · ${Math.round(entrada.fracao * 100)}%`}
            </span>
          </span>

          <span
            className={[
              "cdx-badge",
              entrada.done ? "is-sucesso" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {status}
          </span>
        </header>

        {/* 4.2 GRADE DE ESTATÍSTICAS */}
        <div className="cdx-stats">
          <div className="cdx-stat">
            <span className="cdx-stat__label">Abates</span>
            <span className="cdx-stat__valor">
              {formatarNumero(entrada.kills)}
            </span>
          </div>

          <div className="cdx-stat">
            <span className="cdx-stat__label">Etapas</span>
            <span className="cdx-stat__valor">
              {`${completos}/${entrada.hunts.length}`}
            </span>
          </div>

          <div className="cdx-stat">
            <span className="cdx-stat__label">Etapa atual</span>
            <span className="cdx-stat__valor">
              {proximo ? formatarNumero(proximo.count) : "—"}
            </span>
          </div>

          <div className="cdx-stat">
            <span className="cdx-stat__label">Faltam</span>
            <span className="cdx-stat__valor is-aviso">
              {proximo ? formatarNumero(faltaPara(proximo)) : "—"}
            </span>
          </div>
        </div>

        {/*
          ONDE ENCONTRAR — e o botao de ir caçar na MESMA linha, à direita.

          A faixa de nível que o `bestiario.txt` pede aqui ("Faixa 21-25") não
          existe em lugar nenhum do catálogo, e o lado direito da linha estava
          vazio. O botao ocupa o lugar dela.

          ## POR QUE O MESMO `onHunt` DO PAINEL ANTIGO
          Porque `handleHuntCreature` é um INTERRUPTOR: liga a caçada ou
          desliga, conforme o que o servidor já está caçando. Reescrever a
          chamada aqui criaria dois caminhos para a mesma ação, e o jogador
          não saberia qual era o certo — o botão do catálogo pararia a caçada
          enquanto o do Codex initiates outra.

          E o rótulo segue o que a caçada ESTÁ, não o que o botão parece:
          `hunting` é o `creatureId` que o servidor está caçando de verdade.
        */}
        <div className="cdx-bloco">
          <h3 className="cdx-rotulo">ONDE ENCONTRAR</h3>

          {entrada.zoneName ? (
            <div className="cdx-linha">
              <span className="cdx-linha__nome">{entrada.zoneName}</span>

              {onHunt && (
                <button
                  type="button"
                  className={[
                    "bst-entry__go",
                    "cdx-ir",
                    hunting === entrada.creatureId ? "is-on" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => onHunt(entrada.creatureId)}
                  data-tip={
                    hunting === entrada.creatureId
                      ? "Parar a caçada"
                      : "Ir caçar"
                  }
                >
                  {hunting === entrada.creatureId
                    ? "Parar"
                    : "Ir caçar"}
                </button>
              )}
            </div>
          ) : (
            <p className="cdx-vazio cdx-vazio--inline">
              Sem zona registrada
            </p>
          )}
        </div>

        {/* 4.5 ETAPAS — as caçadas viram as etapas */}
        <div className="cdx-bloco">
          <h3 className="cdx-rotulo">ETAPAS</h3>

          <ul className="cdx-etapas">
            {entrada.hunts.map((hunt) => {
              const eProximo = hunt.id === proximo?.id;

              return (
                <li
                  key={hunt.id}
                  className={[
                    "cdx-etapa",
                    hunt.done ? "is-done" : "",
                    eProximo ? "is-next" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span
                    className="cdx-etapa__check"
                    role="img"
                    aria-label={hunt.done ? "Concluído" : "Pendente"}
                  >
                    {hunt.done ? "✓" : ""}
                  </span>

                  {/*
                    A COLUNA DA QUANTIDADE: o total em cima, o quanto ja
                    foi feito embaixo.

                    ## POR QUE O "0/100" DESCE PARA BAIXO DA LINHA
                    Porque os dois numeros sao o MESMO numero em dois tempos:
                    a meta e o quanto falta. Empilhados eles leem como uma
                    unidade, "100, e voce fez 0". Lados a lado, com o bonus
                    entre eles, o olho pega tres numeros soltos e nao sabe
                    qual par pertence a qual etapa

                    E o espaco que o empilhamento abre e o que segura o
                    bonus no fim da linha: a coluna cresce, o `flex: 1`
                    dela empurra o resto para a borda, e o bonus fica sempre
                    na mesma coluna vertical em todas as linhas
                  */}
                  <span className="cdx-etapa__meio">
                    <span className="cdx-etapa__label">
                      {`${formatarNumero(hunt.count)} abates`}
                    </span>

                    <span
                      className={[
                        "cdx-etapa__contador",
                        hunt.done ? "is-sucesso" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {`${formatarNumero(hunt.progress)}/${formatarNumero(hunt.count)}`}
                    </span>
                  </span>

                  {eProximo && (
                    <span className="cdx-etapa__badge">Atual</span>
                  )}

                  {/*
                    O BONUS, NO FIM DA LINHA. E o `rewardLabel` que o proprio
                    `Bestiary.snapshot()` ja formata: o bônus PERMANENTE de
                    stat que esta etapa entrega
                  */}
                  <span className="cdx-etapa__reward">
                    {hunt.rewardLabel}
                  </span>

                  {eProximo && (
                    <CodexProgressBar
                      fracao={fracaoDaCacada(hunt)}
                      variante="destaque"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
import SkillIcon from "../UI/SkillIcon.jsx";
import { useArrastoSlot } from "../UI/useArrastoSlot.js";
import IndicativoTecla, { useTeclaDaAcao } from "../UI/IndicativoTecla.jsx";

export default function SkillSlot({
  skill,
  cooldown = 0,
  disabled = false,
  trancada = false,
  onClick,
  onToggleAuto,
  auto = false,
  draggable = false,
  ultimate = false,
}) {
  /**
   * O GESTO DE LIGAR E DESLIGAR O AUTOMATICO.
   *
   * A regra mora no `useArrastoSlot` e nao aqui, porque o slot da pocao
   * faz o mesmo gesto com os mesmos numeros
   *
   * O `habilitado` repete a conta do `canDrag` de baixo, com as props
   * cruas: o `trancadaAgora` ainda nao foi calculado neste ponto do
   * componente, e um hook nao pode ser chamado depois de uma conta que
   * depende dele
   */
  const {
    drag,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    deixaClicar,
  } = useArrastoSlot({
    onAlternar: onToggleAuto,
    habilitado: draggable && !disabled && !trancada && !ultimate,
  });

  const ratio =
    skill.cooldown > 0
      ? Math.min(1, cooldown / skill.cooldown)
      : 0;

  /**
 * O QUE A TRANCA FAZ, E O QUE ELA NAO FAZ
 *
 * Ela impede o clique e o arraste. Ela nao impede o RENDER: o slot
 * continua desenhado, com o nome e o icone, porque o jogador precisa ver
 * o que ainda nao tem para saber o que comprar com o Mestre
 *
 * `disabled` e o oposto de proposito: ele some o botao da navegacao de
 * verdade, e aqui o slot e um botao com o icome apagado. Sao coisas
 * diferentes: um slot trancado e informacao, um slot desabilitado nao e
 * slot nenhum
 */
  /**
 * A TECLA DESTE SLOT, e ela vem do mapa de binds.
 *
 * ## O QUE ESTAVA AQUI
 *
 * `{ultimate ? "R" : skill.slot}` — a letra e o numero escritos no JSX. Era a
 * unica parte da HUD que ainda anunciava uma tecla fixa depois do painel de
 * teclas existir, e a mais visivel: oito slots embaixo dos slots e um `R` na
 * ultimate
 *
 * ## E POR QUE A ULTIMATE TEM NOME PROPRIO
 *
 * Porque ela nao ocupa um slot: e a acao `ultimate`, e o catalogo da a
 * `R`. Sem o nome proprio, o componente teria de adivinhar pelo `skill.slot` e
 * cairia no `slotundefined` toda vez que a ultimate fosse desenhada
 *
 * ## E POR QUE HAI O RECUO PARA O NUMERO
 *
 * Porque `skill.slot` pode nao vir — a tela de escolha de classe desenha a
 * previa da habilidade sem slot. Sem o recuo, a previa mostraria `undefined`
 * dentro do circulo, e o numero do slot e a unica informacao que ela tem para
 * oferecer
 */
  const trancadaAgora = trancada || disabled;

  /**
   * QUAL ACAO DE TECLA ESTE BOTAO E.
   *
   * E `null` quando o botao nao tem slot nenhum — a previa da escolha de
   * classe. Nesses o `SkillSlot` mostra o numero, como mostrava antes
   */
  const acaoDaTecla = ultimate
    ? "ultimate"
    : skill.slot
      ? `slot${skill.slot}`
      : null;

  /**
   * O HOOK E CHAMADO MESMO SEM ACAO.
   *
   * Porque pular a chamada mudaria a quantidade de hooks entre um render e o
   * outro, e o React quebraria na hora que o jogador troca de tela com a
   * previa aberta. O `slot1` e um descarte: so um
   */
  const teclaDaSkill = useTeclaDaAcao(acaoDaTecla ?? "slot1");

  const ready = cooldown <= 0 && !trancadaAgora;
  const showAuto = auto && !ultimate;
  const canDrag = draggable && !trancadaAgora && !ultimate;

  function handleClick() {
    /**
     * O clique que fechou um arrasto NAO USA A SKILL.
     *
     * E o `deixaClicar` que decide: ele sabe se o `pointerup` veio de um
     * arrasto de verdade ou de um toque curto
     */
    if (!deixaClicar()) return;

    /**
     * O clique numa skill trancada nao faz NADA.
     *
     * Nao e um aviso: o aviso esta no `title`, e um popup a cada clique
     * numa skill de quem esta aprendendo seria barulho. Alem disso o
     * servidor ja recusa com mensagem, entao o aviso aqui seria o mesmo
     * aviso duas vezes
     */
    if (trancadaAgora) return;

    onClick?.();
  }

  return (
    <button
      type="button"
      className={[
        "skill-slot",
        ultimate ? "skill-slot--ultimate" : "",
        trancada ? "is-trancada" : "",
        ready ? "is-ready" : "",
        showAuto ? "is-auto" : "",
        canDrag ? "is-draggable" : "",
        drag ? "is-dragging" : "",
        drag?.direction === 1 ? "is-drag-on" : "",
        drag?.direction === -1 ? "is-drag-off" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        "--skill-color": skill.color ?? "#9ba7b7",
        transform: drag
          ? `translateY(${drag.offset}px) scale(1.06)`
          : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
      disabled={disabled}
      data-tip={
        trancada
          ? `${skill.name} — não aprendida\nCompre o livro com o Mestre de Habilidades`
          : ultimate
            ? `${skill.name} — ${skill.cooldown}s de cooldown\nTecla: ${teclaDaSkill.nome || "sem tecla"}`
            : `${skill.name} — ${skill.cooldown}s de cooldown\nTecla: ${teclaDaSkill.nome || "sem tecla"}\nArraste para baixo: auto\nArraste para cima: manual`
      }
      aria-label={
        trancada
          ? `${skill.name} — não aprendida`
          : `Usar ${skill.name}`
      }
      aria-pressed={showAuto}
    >
      <span className="skill-slot__frame" />

      <span
        className="skill-slot__cooldown"
        style={{
          transform: `scaleY(${ratio})`,
        }}
      />

      {/**
        A TECLA DO BOTAO, e ela e o bind e nao o numero do slot.

        O `kbd` SUBSTITUI o `span` que estava aqui, e nao fica dentro dele: o
        quadrado desenhado pelo CSS e do elemento da tecla, e um `<kbd>` dentro
        de um `<span>` com borda seria um quadradinho dentro de outro

        O `? :` do fim e o caso sem slot — a previa da escolha de classe, que
        nao tem acao de teclado nenhuma e so pode mostrar o numero
      */}
      {acaoDaTecla ? (
        <IndicativoTecla
          acao={acaoDaTecla}
          className="skill-slot__key"
        />
      ) : (
        <span className="skill-slot__key">{skill.slot}</span>
      )}

      <span className="skill-slot__icon">
        {/*
          A ARTE, OU O GLOFO DE RESERVA.

          O `SkillIcon` decide: se a skill tem arquivo ele desenha a imagem,
          e se nao tem desenha o `icon` do catalogo — que e a mesma letra
          que aparecia aqui antes. As outras tres classes continuam no
          glifo sem mudar em nada
        */}
        <SkillIcon
          skillId={skill.id}
          glyph={skill.icon}
        />
      </span>

      {cooldown > 0 && (
        <span className="skill-slot__timer">
          {cooldown.toFixed(1)}
        </span>
      )}

      {canDrag && showAuto && !drag && (
        <span className="skill-slot__auto-badge">
          A
        </span>
      )}

      {/**
        O CADEADO, so na skill trancada.
        *
        E um caractere e nao um icone desenhado: o `§` do livro e o
        `✓` do aprendido ja usam texto nesta tela, e uma arte nova aqui
        seria a primeira coisa do componente que depende de arquivo
      */}
      {trancada && (
        <span className="skill-slot__lock">
          ✕
        </span>
      )}

      {drag && drag.direction !== 0 && (
        <span className="skill-slot__drag-hint">
          {drag.direction > 0 ? "AUTO" : "MAN"}
        </span>
      )}
    </button>
  );
}

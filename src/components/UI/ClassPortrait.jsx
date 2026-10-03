import ClassSprite, {
  hasAnimatedSprite,
} from "./ClassSprite.jsx";

/**
 * O retrato de uma classe, na tela de selecao.
 *
 * Aparece em DOIS lugares com este mesmo componente: o cartao de cada
 * classe na lista e o retrato grande ao lado dos detalhes. Nos dois a
 * regra e a mesma, e ela e sobre o que NAO entra:
 *
 * - sem o `icon` de texto do catalogo. O glifo e uma figura generica
 *   que nao parece com ninguem, e com arte desenhada ele ia por cima
 *   do personagem
 *
 * - sem o halo, que e o circulo da cor da classe. Ele existe para dar
 *   brilho atras do glifo; atras do personagem vira um circulo em
 *   volta dele, e no arquiro — que tem o acento verde — virava um
 *   disco verde atrapalhando a arte
 *
 * - sem o nome. O nome ja esta duas vezes em cada lugar: no `<strong>`
 *   do cartao e no `<h2>` dos detalhes. Ter um terceiro, por cima da
 *   arte, era redundancia
 *
 * Quando a classe NAO tem arte que anima, o glifo e o halo voltam.
 * As quatro classes jogaveis ja tem folha direcional, entao hoje
 * nenhum retrato da tela usa esse ramo: ele fica como reserva para a
 * classe que chegar sem folha gerada, e sem ele o cartao ficaria
 * vazio — o `ClassSprite` devolve `null` para quem nao tem sprite
 */
export default function ClassPortrait({
  definition,
  large = false,
}) {
  const comArte = hasAnimatedSprite(definition.id);

  return (
    <div
      className={[
        "class-portrait",
        large ? "class-portrait--large" : "",
        comArte ? "class-portrait--art" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        "--accent": definition.accent,
      }}
    >
      <div className="class-portrait__grid" />

      {!comArte && (
        <>
          <div className="class-portrait__aura" />

          <span className="class-portrait__icon">
            {definition.icon}
          </span>

          <span className="class-portrait__name">
            {definition.name}
          </span>
        </>
      )}

      {/*
        O glifo some quando a arte carregou. O `:has` le o estado do
        canvas de dentro do CSS, e e o unico lugar onde o "pronto"
        vive: o React so troca a classe no proprio canvas
      */}
      {comArte && (
        <ClassSprite
          className="class-portrait__sprite"
          classId={definition.id}
        />
      )}
    </div>
  );
}

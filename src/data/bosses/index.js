/**
 * OS CHEFES E AS DIFICULDADES.
 *
 * ## POR QUE ISTO É UM ARQUIVO DE DADO E NÃO DENTRO DO `BossPanel`
 *
 * Porque o SERVIDOR precisa da MESMA lista. A tela mostra chefe e dificuldade
 * numa coluna de botões, e o `ExpeditionStore` precisa recusar uma expedição de
 * um chefe que não existe — senão um cliente alterado criaria "expedição do
 * chefe Khaos" e ela apareceria na busca dos outros, apontando para uma tela
 * que não abre
 *
 * Com o catálogo num arquivo só, cliente e servidor leem a mesma fonte. Se o
 * catálogo continuasse dentro do componente, o servidor teria que duplicar a
 * lista, e a duplicação divergiria no primeiro chefe novo
 */

/**
 * A ARTE DE CADA CHEFE.
 *
 * ## POR QUE UM `new URL` POR CHEFE E NÃO UM CAMINHO MONTADO
 *
 * Porque `new URL` é resolvido pelo Vite na build, e ele só enxerga caminho
 * LITERAL escrito no código. Um caminho montado com variável não é analisado, e
 * o GIF simplesmente não entra no `dist` — sem erro, sem aviso, e a arte some
 * da tela com o build dando "sucesso"
 *
 * ## E POR QUE SÓ DOIS CHEFES TÊM ARTE
 *
 * Porque `assets/sprites` tem exatamente dois chefes desenhados. Os outros
 * ficam sem arte e somem da fileira — um retângulo de gradiente sem imagem
 * nenhuma não ajuda ninguém a escolher
 */
const ARTE = {
  karghul: new URL(
    "../../assets/sprites/Karghul/idle/south.gif",
    import.meta.url,
  ).href,
  zerathor: new URL(
    "../../assets/sprites/Zerathor/idle/south.gif",
    import.meta.url,
  ).href,
};

/**
 * O CATÁLOGO.
 *
 * O `id` é a chave que a expedição guarda, e é o que o `ExpeditionStore`
 * valida. Ele é texto curto e estável de propósito: mudar um id aqui quebra
 * as expedições já criadas, que guardam o id do chefe para saber para onde o
 * grupo vai
 */
export const CHEFES = [
  { id: "karghul", nome: "Karghul" },
  { id: "zerathor", nome: "Zerathor" },
  { id: "verme", nome: "Verme Escavado" },
  { id: "corvo", nome: "Corvo Torto" },
  { id: "fornalha", nome: "Sentinela da Fornalha" },
  { id: "martelo", nome: "Martelo Cego" },
  { id: "cubo", nome: "Cubo Rachado" },
  { id: "dente", nome: "Dente do Po" },
  { id: "silvo", nome: "Silvo Sem Voz" },
];

/**
 * AS TRÊS DIFICULDADES.
 *
 * `entradas` é o que a coluna direita mostra como "recompensa esperada": não
 * é o número de tentativas, é o de lugares que o chefe abre. E o `nivel` é a
 * distância entre o personagem e o chefe — é o que o jogador compara, não o
 * número romano
 */
export const DIFICULDADES = [
  { id: "I", nivel: 25, entradas: 14 },
  { id: "II", nivel: 35, entradas: 22 },
  { id: "III", nivel: 45, entradas: 32 },
];

/**
 * OS CHEFES COM ARTE, QUE É O QUE A FILEIRA MOSTRA.
 *
 * Não é uma escolha de design: é o filtro do que existe em `assets/sprites`.
 * Quando entrar o terceiro GIF, esta lista cresce sozinha e nenhuma linha de
 * JSX muda
 */
export const CHEFES_COM_ARTE = CHEFES.filter((c) => ARTE[c.id]);

/** A URL da arte de um chefe, ou `null` */
export function arteDoChefe(chefeId) {
  return ARTE[chefeId] ?? null;
}

/** O chefe pelo id, ou `null` */
export function chefePorId(chefeId) {
  return CHEFES.find((c) => c.id === chefeId) ?? null;
}

/** O nome do chefe, ou o id quando ele não existe */
export function nomeDoChefe(chefeId) {
  return chefePorId(chefeId)?.nome ?? chefeId;
}

/**
 * O NOME DA DIFICULDADE.
 *
 * Vive aqui porque três lugares precisam dele: os três botões da coluna, a
 * etiqueta da linha da busca e o rótulo do `<option>` do formulário. Duas
 * listas com os mesmos três valores divergem no primeiro chefe novo
 */
export const nomeDaDificuldade = (indice) =>
  DIFICULDADES[indice]?.id ?? "?";
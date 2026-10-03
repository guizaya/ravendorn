/**
 * Nome do personagem.
 *
 * Este modulo e usado pelo CLIENTE e pelo SERVIDOR, com a mesma
 * regra. Isso e obrigatorio: se so o cliente limpassse, um cliente
 * adulterado mandaria nome de 4 MB ou com HTML no snapshot dos
 * outros jogadores. O servidor revalida e so aceita o que passa
 * daqui.
 *
 * O que entra na tela de selecao e o que o servidor aceita, sem
 * excessao: o cliente mostra o erro para nao descobrir so no
 * momento da conexao que o nome foi recusado.
 */

export const NAME_MIN = 3;
export const NAME_MAX = 16;

/**
 * Nomes que fariam o jogador se passar por sistema.
 *
 * Escritos na FORMA DA CHAVE (nameKey): sem espaco, sem acento e
 * sem caixa. "Game Master" aqui nunca casaria com o que o jogador
 * digita, porque nameKey junta as palavras antes de comparar.
 *
 * A tela troca acento por letra comum ANTES desta checagem, entao
 * a forma exibida nunca casa com um nome reservado escrito
 * diferente.
 */
const RESERVED = new Set([
  "sistema",
  "system",
  "admin",
  "administrador",
  "moderador",
  "gm",
  "gamemaster",
  "staff",
  "servidor",
  "server",
  "jogador",
  "player",
  "ninguem",
  "npc",
  "mestre",
]);

/**
 * Troca acentos por letra comum e corta o resto.
 *
 * "Zoë_das_Flechas!!" vira "Zoe das Flechas". Manter o accento
 * seria mais bonito, mas e a mesma categoria de problema do
 * maiusculo e do espaco em excesso: duas fontes de verdade para
 * o mesmo nome. Deixar e mais simples de validar dos dois lados.
 */
export function foldName(raw) {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
/** o que a tela mostra enquanto o jogador digita */
export function sanitizeNameInput(raw) {
  return foldName(raw)
    // letras e numeros com espaco ou hifen no meio
    .replace(/[^a-zA-Z0-9 -]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/\s{2,}/g, " ")
    .slice(0, NAME_MAX);
}

/** reduz para comparacao: sem espaco, hifen ou acento */
export function nameKey(raw) {
  return foldName(raw)
    .toLowerCase()
    .replace(/[\s-]+/g, "");
}

/**
 * O nome esta bom para entrar no jogo?
 *
 * Devolve `{ ok, value, reason }`. `reason` ja vem em portugues
 * pronto para mostrar, sem chave de traducao, porque o texto vai
 * para o chat e para o toast do cliente.
 */
export function validateName(raw) {
  const value = sanitizeNameInput(raw).trim();

  if (value.length === 0) {
    return {
      ok: false,
      value: "",
      reason: "Escreva um nome para o personagem.",
    };
  }

  if (value.length < NAME_MIN) {
    return {
      ok: false,
      value,
      reason: `O nome precisa de ${NAME_MIN} caracteres ou mais.`,
    };
  }

  // um nome todo de espaco foi cortado acima, entao chegar aqui
  // com este formato significa que sobrou so pontuacao
  if (!/^[a-zA-Z0-9][a-zA-Z0-9 -]*[a-zA-Z0-9]$/.test(value)) {
    return {
      ok: false,
      value,
      reason:
        "Comece e termine com letra ou numero, sem pontuacao nas pontas.",
    };
  }

  const key = nameKey(value);

  if (RESERVED.has(key)) {
    return {
      ok: false,
      value,
      reason: "Esse nome e reservado. Escolha outro.",
    };
  }

  return { ok: true, value, reason: null };
}

/**
 * Nome provisorio para quem entrou sem digitar nada.
 *
 * O jogo e so online: entrar sem nome nao pode ser um caminho
 * para pular a tela de selecao. A tela bloqueia o JOGAR sem
 * nome valido, e o servidor recusa tambem, entao este so existe
 * para o cliente ter texto enquanto o socket ainda nao respondeu.
 */
export function fallbackName(classId = "hero") {
  return `Heroe ${String(classId).slice(0, 6)}`.slice(
    0,
    NAME_MAX,
  );
}

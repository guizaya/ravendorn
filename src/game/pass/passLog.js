/**
 * OS DIAS RESGATADOS DE CADA PASSE.
 *
 * ## POR QUE ISTO E UM MODULO PURO E NAO UM METODO DO PAINEL
 *
 * Porque o resgate e uma regra de JOGO, e nao um desenho: "este dia ja foi
 * pego" precisa valer igual no servidor que paga, no painel que mostra o
 * botao e no save que sobrevive ao relogin. Se a regra morasse no
 * `PassePanel`, o servidor nao teria como conferir nada — e um cliente
 * modificado clicasse em "Resgatar" quantas vezes quisesse
 *
 * ## POR QUE UM OBJETO COMUM E NAO UMA CLASSE
 *
 * Porque o estado e um mapa de `passId` para os dias ja pegos, e nao ha
 * regra alem de "adicionar um dia" e "perguntar se um dia esta la". Uma
 * classe aqui teria metodos que so embrulham `Array.includes` e `push`. E
 * o formato e o do JSON de gra: o save grava o objeto como e, sem
 * `fromSave` nem `toSave` para escrever
 *
 * ## E O FORMATO
 *
 *     { praga: [1, 2, 3], cripta: [7] }
 *
 * Um dia ausente e um dia nao resgatado. O passe entra na lista de resgates
 * so quando o jogador resgata ALGUM dia dele, entao um passe novo nao
 * aparece com chave vazia — e o save nao cresce com chaves inuteis
 */

/** Um log novo, sem nenhum resgate. */
export function criarPassLog() {
  return {};
}

/**
 * O dia ja foi pego?
 *
 * E `false` para passe desconhecido, e nao `true`: um log sem o passe nao
 * tem dia resgatado nenhum, e e assim que o primeiro resgate de um passe
 * novo passa
 */
export function diaResgatado(log, passeId, dia) {
  const lista = log?.[passeId];

  if (!Array.isArray(lista)) return false;

  return lista.includes(Math.floor(Number(dia)));
}

/**
 * Registra o resgate do dia e devolve o LOG NOVO.
 *
 * ## POR QUE UM LOG NOVO E NAO MUTAR O ANTIGO
 *
 * Porque o estado da sessao e o que o `snapshotSession` grava, e mutar o
 * objeto no lugar faria o save antigo e o novo serem o mesmo objeto. Um
 * log que se altera sozinho de volta para dentro de um `Set` por engano ja
 * custou uma partida perdida
 *
 * ## E POR QUE O DIA JA RESGATADO VAI DE VOLTA
 *
 * Porque o servidor chama isto em CADA pedido, inclusive o segundo clique
 * no mesmo dia. Devolver o `log` sem o dia novo e o que mantem a promessa de
 * "uma vez so" sem depender de o botao ter sumido da tela: o botao some
 * porque o snapshot chegou, e o snapshot chega depois do clique
 */
export function resgatarDia(log, passeId, dia) {
  const numero = Math.floor(Number(dia));

  if (!Number.isFinite(numero)) return log ?? criarPassLog();

  if (diaResgatado(log, passeId, numero)) return log ?? criarPassLog();

  const antes = Array.isArray(log?.[passeId]) ? log[passeId] : [];

  return {
    ...(log ?? {}),
    [passeId]: [...antes, numero].sort((a, b) => a - b),
  };
}

/**
 * Le o log de um save, tolerando a ausencia do campo.
 *
 * ## POR QUE ESTA FUNCAO E NAO SO UM `?? {}`
 *
 * Porque um save escrito antes do passe existir nao tem o campo, e um save
 * adulterado pode ter qualquer coisa nele. O `Array.isArray` descarta o que
 * nao for lista de dias, e o `Set` dentro garante que o dia repetido no
 * arquivo nao vire resgate repetido em memoria
 *
 * E o `Map` e o que faz a deduplicacao: `diaResgatado` usa `includes`, que
 * so precisa da lista limpa uma vez
 */
/**
 * OS PREMIUMS LIGADOS, POR PASSE.
 *
 * ## POR QUE NAO E UM BOOLEANO
 *
 * Porque o premium e uma COMPRA POR PASSE. Com um `premium: true` unico,
 * pagar os dias pagos da Praga abria tambem os da Cripta e os do Arsenal de
 * graca — e o preco de 100 diamantes deixava de valer
 *
 * ## O FORMATO E O MESMO DO `resgatados`
 *
 *     { praga: true, cripta: true }
 *
 * Um passe so entra no objeto quando o jogador o PAGOU. Sem a chave, o
 * passe nao foi comprado — e o save nao cresce com `false` em tres chaves
 * que soServe para dizer "nao"
 *
 * E o mesmo formato de proposito: os dois sao "o que o jogador fez com este
 * passe", e um save antigo que tem `resgatados` e nao tem `premium` se
 * comporta sem migracao — `premiumAtivo` devolve `false` e o jogador so
 * paga o que pagou
 */
export function premiumAtivo(log, passeId) {
  return log?.[passeId] === true;
}

/**
 * LIGA O PREMIUM DE UM PASSE, e devolve um log novo.
 *
 * E a mesma forma de `resgatarDia`: nao mexe no objeto recebido, devolve
 * outro. Quem chama precisa do valor de retorno — mutar o log no lugar
 * deixaria o save e o painel fora de sincronia no primeiro quadro
 */
export function ligarPremium(log, passeId) {
  if (!passeId) return log ?? {};

  if (log?.[passeId] === true) return log ?? {};

  return {
    ...(log ?? {}),
    [passeId]: true,
  };
}

/**
 * DESLIGA O PREMIUM DE UM PASSE, e devolve um log novo.
 *
 * A chave e REMOVIDA em vez de virar `false`, pela mesma razao que ela nao
 * existe antes da compra: um save e um estado-minimo, e `{ praga: false }`
 * nao diz nada que a ausencia da chave nao diga
 */
export function desligarPremium(log, passeId) {
  if (!passeId || log?.[passeId] !== true) return log ?? {};

  const proximo = { ...(log ?? {}) };

  delete proximo[passeId];

  return proximo;
}

/**
 * Le o log de premium de um save, tolerando a ausencia do campo.
 *
 * E a MESMA forma de `passLogDoSave`, pelo mesmo motivo: um save escrito
 * antes do premium existir nao tem o campo, e um save adulterado pode ter
 * qualquer coisa nele. So o `=== true` entra — um `"sim"` ou um `1` nao
 * viram premium ligado, porque quem grava e este arquivo
 */
export function premiumLogDoSave(bruto) {
  const log = {};

  if (!bruto || typeof bruto !== "object") return log;

  for (const [passeId, ligado] of Object.entries(bruto)) {
    if (ligado === true) log[passeId] = true;
  }

  return log;
}

export function passLogDoSave(bruto) {
  const log = criarPassLog();

  if (!bruto || typeof bruto !== "object") return log;

  for (const [passeId, dias] of Object.entries(bruto)) {
    if (!Array.isArray(dias)) continue;

    const limpos = dias
      .map((d) => Math.floor(Number(d)))
      .filter((d) => Number.isFinite(d) && d > 0);

    const unicos = [...new Set(limpos)].sort((a, b) => a - b);

    if (unicos.length > 0) {
      log[passeId] = unicos;
    }
  }

  return log;
}
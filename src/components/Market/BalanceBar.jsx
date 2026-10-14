import { MOEDAS_ESPECIAIS } from "../../data/loja/index.js";
import IconeMoeda from "../UI/IconeMoeda.jsx";

/**
 * A BARRA DE SALDO do mercado.
 *
 * ## POR QUE SO OURO E DIAMANTE, E NAO O STEEL TAMBEM
 *
 * Porque o `MOEDAS_ESPECIAIS` tem tres moedas e o mercado tem DUAS de
 * announcement: o preco de um anuncio vive em ouro ou em diamante. O `steel`
 * e uma moeda de Progressao — a mineracao soma, o aprimorar gasta — e ele
 * continua aparecendo na HUD, onde sempre esteve. Putting-lo aqui seria
 * sugerir que da para anunciar em steel, e nao da
 *
 * ## POR QUE O GLIFO VEM DA FONTE CANONICA
 *
 * Porque `MOEDAS_ESPECIAIS` ja e a fonte unica dos simbolos, e o `◉` do
 * ouro aqui e o mesmo `◉` da HUD e o mesmo do card da loja. Escrever o
 * glifo aqui seria uma quarta fonte, e o dia que o simbolo mudasse em uma
 * delas o mercado ficaria com o icone velho ao lado do novo
 */
const MOEDAS_DO_MERCADO = ["ouro", "diamante"];

export default function BalanceBar({
  inventory,
  maxAnuncios = null,
  anunciosAtivos = null,
  onAnunciar,
}) {
  const saldos = inventory ?? {};

  return (
    <div className="mkt-balanco">
      <div className="mkt-balanco__moedas">
        {MOEDAS_DO_MERCADO.map((id) => {
          const moeda = MOEDAS_ESPECIAIS[id];
          const valor = formatarSaldo(saldos[campoDoSaldo(id)]);

          /**
           * O `role="img"` com `aria-label` e o que resolve o nome da moeda.
           *
           * O `sr-only` seria a forma comum, e o projeto NAO tem essa classe
           * — um `<span class="sr-only">` aqui sairia visivel na tela com o
           * nome da moeda escrito do lado do glifo. E o `aria-label` sozinho,
           * num `<span>` sem papel, e ignorado por varios leitores. Com
           * `role="img"` o rotulo vale: o leitor anuncia "Ouro: 149.493" e
           * nao le "ponto, 149.493"
           */
          return (
            <span
              key={id}
              className="mkt-balanco__moeda"
              style={{ "--moeda": moeda.cor }}
              role="img"
              aria-label={`${moeda.nome}: ${valor}`}
              data-tip={moeda.nome}
            >
              <span className="mkt-balanco__glifo" aria-hidden="true">
                <IconeMoeda moeda={campoDaMoeda(id)} lado={16} />
              </span>

              <span className="mkt-balanco__valor">{valor}</span>
            </span>
          );
        })}
      </div>

      {/*
        O LIMITE DE ANUNCIOS, que o servidor ja manda em `data.limites`.
        Ele fica aqui porque e a unica barra do modal que mostra um numero que
        o jogador precisa conferir ANTES de clicar em "+ Anunciar": e o que
        impede o Bazaar de encher a vitrine de anuncio que nunca vai aparecer
      */}
      {maxAnuncios !== null && (
        <span className="mkt-balanco__limite">
          {`${anunciosAtivos ?? 0}/${maxAnuncios} anúncios`}
        </span>
      )}

      <button
        type="button"
        className="mkt-anunciar"
        onClick={onAnunciar}
        disabled={!onAnunciar}
      >
        <span className="mkt-anunciar__mais" aria-hidden="true">
          +
        </span>
        Anunciar
      </button>
    </div>
  );
}

/**
 * O CAMPO DO INVENTARIO QUE CARREGA CADA MOEDA.
 *
 * ## POR QUE ISTO E UM MAPA E NAO UM ACESSO DIRETO
 *
 * Porque o campo e `coins`, e a moeda e `ouro`. Os dois nomes vem de linguas
 * diferentes — o `Inventory` e o save seguem o schema antigo em ingles, e o
 * catalogo de moedas e o portugues que o jogador le. Um `saldos[id]` direto
 * cairia em `undefined` para as duas moedas, e a barra mostraria "NaN"
 */
function campoDoSaldo(moedaId) {
  return { ouro: "coins", diamante: "diamonds" }[moedaId] ?? null;
}

/**
 * O ID QUE O `IconeMoeda` ESPERA, e e o mesmo do `campoDoSaldo`.
 *
 * Sao a MESMA conta com dois nomes, e nao por escolha: `campoDoSaldo` diz a
 * chave do `Inventory` e o `IconeMoeda` quer o id da arte. Os dois happens de
 * ser iguais hoje; se um dia divergirem, este e o lugar que denuncia
 */
function campoDaMoeda(moedaId) {
  return campoDoSaldo(moedaId);
}

/** O saldo como texto, com milhar pt-BR. */
function formatarSaldo(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) return "0";

  return numero.toLocaleString("pt-BR");
}
import { useEffect, useMemo, useRef, useState } from "react";

import CategorySidebar from "./CategorySidebar.jsx";
import ClassFilterChips from "./ClassFilterChips.jsx";
import ListingCard from "./ListingCard.jsx";

import { useArrastarScroll } from "../../game/ui/arrastarScroll.js";
import { nameKey } from "../../data/characterName.js";
import { slotsNecessarios } from "../../game/inventory/Inventory.js";
import { CHARACTER_CLASSES } from "../../data/characters/index.js";
import { classesOfItem } from "../../data/craft/craftPorClasse.js";
import { getItem, isStackable } from "../../data/items/index.js";
import { tipoDoAnuncio } from "../../data/market/index.js";

/**
 * OS IDS DE CLASSE, lidos do catálogo uma vez.
 *
 * Porque o badge de contagem precisa percorrer todas as classes para saber
 * quantos anúncios cada uma mostra, e `CHARACTER_CLASSES` é a única fonte
 * disso. Uma lista escrita aqui seria uma quarta cópia da mesma verdade
 */
const IDS_DE_CLASSES = CHARACTER_CLASSES.map((classe) => classe.id);

/**
 * A VITRINE: a aba principal do mercado.
 *
 * ## POR QUE O FILTRO CONTINUA NO CLIENTE
 *
 * Porque o `MarketPanel` antigo explica isso e a razão continua valendo: a
 * vitrine é pequena e o filtro muda a cada tecla, e um pedido por tecla seria
 * uma enxurrada de trafego. O que o servidor garante — os anúncios que chegam
 * ja vim filtrados de todos os outros jogadores — não mudou
 *
 * ## POR QUE A GRADE NÃO É VIRTUALIZADA
 *
 * Porque `ANUNCIOS_MAXIMOS` é 8 POR JOGADOR, e o `MarketStore` corta a lista
 * por jogador. Com um mundo de poucos jogadores a vitrine cabe na tela sem
 * rolagem longa. O briefing pede virtualização "se for muito grande", e hoje
 * não é: quando passar a ser, o ponto de entrada é este componente
 *
 * ## POR QUE A BUSCA TEM UM BOTÃO ALÉM DO `onChange`
 *
 * Porque o `onChange` já filtra a cada tecla — o botão serve ao `Enter` e ao
 * clique, que é o gesto de quem termina de digitar e não quer esperar o
 * filtro. Filtrar no `onChange` E no botão seria filtrar duas vezes; aqui o
 * botão só confirma
 */
export default function VitrineAba({
  data,
  inventory,
  onBuy,
  onBid,
}) {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [classe, setClasse] = useState(null);

  const rolagem = useArrastarScroll({ eixo: "y" });
  const gradeRef = useRef(null);

  /**
   * TROCAR QUALQUER FILTRO VOLTA A GRADE AO TOPO.
   *
   * E o `gradeRef` por conta propria, e nao o `ref` do `useArrastarScroll`:
   * o hook so sabe rolar, nao sabe reiniciar. Sem isso, quem filtrava com a
   * vitrine rolada no fim veria "Nenhum anuncio" e creditaria ao filtro, e nao
   * a rolagem que ficou para tras
   */
  useEffect(() => {
    if (gradeRef.current) gradeRef.current.scrollTop = 0;
  }, [busca, tipo, classe]);

  /**
   * O FILTRO, TODAS AS CONDIÇÕES EM "E".
   *
   * A ordem não importa para o resultado, e sim para a leitura do código: é a
   * mesma ordem em que o jogador marca os filtros, e cada condição sai de um
   * campo que o próprio `snapshotMarket` já manda
   */
  const filtrados = useMemo(() => {
    const termo = busca.trim() ? nameKey(busca) : null;

    return (data.listings ?? []).filter((listing) => {
      if (tipo && tipoDoAnuncio(listing) !== tipo) return false;

      if (termo && !nomeCombina(listing.itemId, termo)) return false;

      if (classe) {
        /**
         * O FILTRO DE CLASSE USA `classesOfItem`, E NAO `item.classes`.
         *
         * Porque `classesOfItem` é a MESMA regra que o `canClassUseItem` usa
         * para decidir se o item pode ser equipado, e ela resolve as ARMAS
         * pelo `kind` — arco é Arbalist, lança é Lancer, cajado é Sorcerer,
         * espada é Warrior. Lendo `item.classes` direto, toda arma apareceria
         * como "sem restrição", e o filtro de classe mentiria justamente nos
         * itens mais restritos do jogo
         *
         * `null` é "vale para todo mundo" (material, poção, e o item sem
         * dono declarado): um colete genérico não pode desaparecer quando o
         * jogador filtra por Lancer
         */
        const liberam = classesOfItem(listing.itemId);

        if (liberam !== null && !liberam.includes(classe)) return false;
      }

      return true;
    });
  }, [data.listings, busca, tipo, classe]);

  /**
   * A QUANTIDADE DE ANÚNCIOS POR CLASSE, para o badge do chip.
   *
   * E contada sobre os anuncios que ja passaram pela BUSCA e pela CATEGORIA,
   * e nao sobre a vitrine inteira: um badge que mostra o total do mundo
   * enquanto o filtro de texto esconde quase todos faz o jogador clicar num
   * chip achando que tem anuncios ali
   */
  const contagens = useMemo(() => {
    const mapa = {};

    for (const listing of filtrados) {
      const liberam = classesOfItem(listing.itemId);

      if (liberam === null) {
        // item sem restricao entra em todas as classes
        for (const id of IDS_DE_CLASSES) {
          mapa[id] = (mapa[id] ?? 0) + 1;
        }

        continue;
      }

      for (const id of liberam) {
        mapa[id] = (mapa[id] ?? 0) + 1;
      }
    }

    return mapa;
  }, [filtrados]);

  const pilhas = inventory?.items ?? [];
  const livres = (inventory?.capacity ?? 0) - (inventory?.used ?? 0);

  /**
   * ALGUM FILTRO ESTA MARCADO?
   *
   * E o que decide se o "Limpar filtros" aparece na linha dos chips. Sem
   * nenhum filtro ele ficaria ali como um botão que não faz nada, e o
   * jogador passaria o mouse por cima sem entender o que ele limpa
   */
  const temFiltro = Boolean(busca || tipo || classe);

  /**
   * VOLTAR TUDO AO PADRAO.
   *
   * Uma funcao so, e nao tres `onClick` separados: os tres campos mudam
   * juntos, e um botao que limpasse so a classe deixaria a busca no lugar e o
   * jogador teria que apertar de novo
   */
  function limparFiltros() {
    setBusca("");
    setTipo("");
    setClasse(null);
  }

  return (
    <div className="mkt-vitrine-aba">
      <CategorySidebar
        ativa={tipo}
        onTrocar={setTipo}
        total={filtrados.length}
      />

      <div className="mkt-vitrine-principal">
        <div className="mkt-busca-linha">
          <div className="mkt-busca-campo">
            <span
              className="mkt-busca-campo__lupa"
              aria-hidden="true"
            >
              ⌕
            </span>

            <input
              type="text"
              className="mkt-busca-campo__input"
              placeholder="Buscar pelo nome"
              value={busca}
              aria-label="Buscar anúncio pelo nome"
              onChange={(event) => setBusca(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />

            <button
              type="button"
              className="mkt-busca-campo__enviar"
              onClick={() => gradeRef.current?.focus()}
            >
              Buscar
            </button>
          </div>
        </div>

        <ClassFilterChips
          ativa={classe}
          onTrocar={setClasse}
          contagens={contagens}
          limpar={temFiltro ? limparFiltros : null}
        />

        <p className="mkt-contador">
          {contagemDeAnuncios(filtrados.length)}
        </p>

        {filtrados.length === 0 ? (
          <div className="mkt-vazia-box">
            <p className="mkt-vazia">
              Nenhum anúncio encontrado
            </p>

            {/*
              O "Limpar filtros" MIGRou para a linha dos chips.

              Ele aparecia aqui dentro, e isso significava que um jogador com
              filtro marcado que ainda tinha resultado nao tinha como limpar:
              o botao so existia quando a busca ja tinha falhado
            */}
          </div>
        ) : (
          <div
            className="mkt-grade"
            ref={gradeRef}
            role="list"
            tabIndex={-1}
            {...rolagem.evento}
          >
            {filtrados.map((listing) => {
              const precisa = slotsNecessarios(
                pilhas,
                listing.itemId,
                listing.count,
                listing.rarity,
              );

              const cabe = livres >= precisa;
              const item = getItem(listing.itemId);

              /**
               * UM ANÚNCIO SEM NOME NAO SE COMPRA.
               *
               * O `MarketStore` tem anúncios pela metade enquanto o vendedor
               * preenche o formulario (`itemId: null` até o `fill()`). Um
               * anuncio incompleto não pode virar card com o nome em branco, e
               * o motivo vai no `title` do botão, que é onde o jogador olha
               * quando o botão não reage
               */
              

              return (
                <div key={listing.id} role="listitem">
                  <ListingCard
                    listing={listing}
                    onBuy={onBuy}
                    onBid={onBid}
                    podeComprar={
                      cabe &&
                      Boolean(listing.itemId) &&
                      (isStackable(item) || listing.count === 1)
                    }
                    motivoBloqueio={
                      !listing.itemId
                        ? "Anúncio sendo preparado pelo vendedor"
                        : !cabe
                          ? `Não cabe: precisa de ${precisa} slot(s) e você tem ${livres}`
                          : "Indisponível"
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** "1 anúncio" e "12 anúncios" — o plural certo, sem o "de". */
function contagemDeAnuncios(total) {
  return `${total} ${total === 1 ? "anúncio" : "anúncios"}`;
}

/**
 * O NOME DO ITEM BATE COM A BUSCA, sem caixa e sem acento.
 *
 * E o mesmo `nameKey` que o rank usa para deduplicar jogador, e o mesmo que
 * o servidor usa para achar o save pelo nome. Uma normalização local aqui
 * seria a terceira versão da mesma regra, e as três divergiriam em um nome
 * com acento
 */
function nomeCombina(itemId, termo) {
  const nome = getItem(itemId)?.name;

  if (!nome) return false;

  return nameKey(nome).includes(termo);
}
import { useEffect, useRef, useState } from "react";

/**
 * A BOX DA PARTY, abaixo da box de missoes.
 *
 * ## OS TRES ESTADOS QUE O PEDIDO DESCREVE
 *
 * 1. FORA de party: a box existe e traz o botao de criar
 * 2. SOZINHA na party: o botao de convidar fica ABAIXO do unico
 *    personagem, e e ele que abre o campo do nick
 * 3. COM GENTE: a lista de membros, e o botao de sair
 *
 * ## O CONVITE RECEBIDO
 *
 * A caixa de 5 segundos e um bloco separado, acima dos tres. Ela tem a
 * propria contagem porque e a unica coisa da tela com prazo, e um botao
 * de sair no meio dela se confundiria com sair da party
 *
 * ## O NICK
 *
 * O campo aparece embaixo do botao de convidar e nao no lugar dele: o
 * botao continua sendo o alvo, e o campo e a resposta a ele. Abrir o
 * campo troca o texto do botao para "Cancelar", e o que se digita vai
 * para `onConvidar(nome)`
 */
export default function PartyBox({
  party,
  /**
   * O ID DO JOGADOR QUE ESTA OLHANDO.
   *
   * Sem ele a caixa nao sabe quem e o lider, e o botao de expulsar
   * apareceria para todo mundo — ou para ninguem
   */
  meuId = null,
  /**
   * O CONVITE QUE CHEGOU PELO EVENTO.
   *
   * Vem separado do `party.convite` do painel porque a caixa de cinco
   * segundos nao pode esperar o proximo pacote: o servidor manda o
   * convite na hora, e o painel chega alguns segundos depois
   *
   * O `party.convite` continua sendo lido como reserva — e o que mantem
   * a caixa de pe se o evento se perder e o painel trouxer o convite
   */
  convite = null,
  onCreate,
  onInvite,
  onAcceptInvite,
  onKick,
  onFollow,
  onFocus,
  onTransfer,
  onLeave,
}) {
  const [digitando, setDigitando] = useState(false);
  const [nome, setNome] = useState("");

  const inputRef = useRef(null);

  useEffect(() => {
    if (digitando) inputRef.current?.focus();
  }, [digitando]);

/**
 * O CONVITE QUE A CAIXA MOSTRA.
 *
 * O EVENTO tem prioridade, e o painel e a reserva. A ordem importa: o
 * evento chega na hora e o painel so no proximo pacote, e um convite
 * esperando o painel perderia a maior parte dos seus cinco segundos
 *
 * O `?.` no painel e o que mantem a caixa de pe antes do primeiro
 * pacote: sem `party` no snapshot a tela ainda nao sabe de nada, e uma
 * caixa que estoura no primeiro quadro derruba a tela inteira
 */
const conviteAtivo = convite ?? party?.convite ?? null;

  // o campo fecha sozinho quando o convite sai da tela: deixar o input
  // aberto com um convite expirado e a pessoa digitando para ninguem e
  // o pior dos dois mundos
  useEffect(() => {
    if (!conviteAtivo) {
      setDigitando(false);
      setNome("");
    }
  }, [conviteAtivo]);

  // sem party no snapshot ainda: a tela esta esperando o primeiro pacote
  if (!party) return null;

  const membros = party.membros ?? [];

  const emParty = membros.length > 0;

  const souSo = emParty && membros.length === 1;

  /**
   * SO O LIDER EXPULSA, e SO OS OUTROS.
   *
   * O `party.lider` vem do servidor e nao de um campo de tela: e quem
   * montou o grupo, e mudar isso no cliente deixaria qualquer jogador com
   * o botao de expulsar
   *
   * O proprio lider nao aparece com o botao — para expulsar alguem ele usa
   * [Sair]
   */
  const souLider = party.lider === meuId;

  /**
   * QUEM ESTA SENDO SEGUIDO.
   *
   * O painel traz o id, e nao um booleano: com dois botoes de seguir
   * na tela, o jogador precisa ver QUAL deles esta ligado. O `•` e o que
   * faz isso, e sem o id seria preciso adivinhar
   */
  const seguindo = party.seguindoId ?? null;

  /**
   * O FOCO DO ALVO DO LIDER, e o estado do interruptor.
   *
   * Vem do snapshot, e nao de um estado local: o botao precisa mostrar
   * o que o SERVIDOR acha, e nao o que a tela tocou na hora
   */
  const focandoLider = Boolean(party.focarLider);

  const cheia = emParty && membros.length >= (party.max ?? 3);

  const abrirCampo = () => {
    setDigitando((v) => !v);
    setNome("");
  };

  const enviar = (evento) => {
    evento.preventDefault();

    const alvo = nome.trim();

    if (!alvo) return;

    onInvite?.(alvo);

    setDigitando(false);
    setNome("");
  };

  return (
    <section
      className={[
        "pty-box",
        /**
         * A BORDA ESQUERDA acende com convite na tela.
         *
         * A `ConviteBox` dentro da caixa ja avisa que ha convite, com a
         * moldura dourada. Mas a borda da CAIXA e o que o jogador ve
         * quando o olho esta no jogo e nao na coluna: e ela que diz,
         * de longe, que alguem esta chamando
         *
         * A fonte e a `ConviteBox`, e nao o `party` do painel, porque o
         * evento chega antes do pacote — um convite esperando o painel
         * perderia quase a metade dos cinco segundos
         */
        conviteAtivo ? "is-invite" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {conviteAtivo && (
        <ConviteBox
          key={conviteAtivo.de?.id ?? "convite"}
          convite={conviteAtivo}
          onAceitar={onAcceptInvite}
        />
      )}

      <header className="pty-box__head">
        <span className="pty-box__title">Party</span>

        <span className="pty-box__count">
          {membros.length}/{party.max ?? 3}
        </span>
      </header>

      {!emParty && (
        <button
          type="button"
          className="pty-btn pty-btn--create"
          onClick={onCreate}
          title="Criar uma party"
        >
          Criar party
        </button>
      )}

      {emParty && (
        <>
          <ul className="pty-list">
            {membros.map((membro) => {
              const ehLider = membro.id === party.lider;

              /**
               * A VIDA COMO BARRA, e nao como numero solto.
               *
               * `150/200` exige uma conta mental para virar "morreu" ou
               * "esta em quarto". A barra e lida num olhar, e e o que
               * importa numa party: quem precisa de atencao agora e quem
               * esta morrendo
               *
               * O texto continua ao lado da barra: o numero e o que o
               * jogador le quando quer o valor exato
               */
              const vida = Math.max(
                0,
                Math.min(100, (membro.hp / (membro.maxHp || 1)) * 100),
              );

              return (
<li
                  key={membro.id}
                  className={[
                    "pty-member",
                    membro.eu ? "is-me" : "",
                    ehLider ? "is-lider" : "",
                    vida <= 25 ? "is-low" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="pty-member__id">
                    <span
                      className="pty-member__name"
                      title={membro.nome}
                    >
                      {membro.nome}
                    </span>

                    {/*
                      O "lider" fica COLADO no nome, e nao numa etiqueta
                      solta no fim da linha. Quem le a party procura o
                      dono do grupo, e o nome e o que ele le primeiro: a
                      etiqueta a dois campos de distancia obriga o olhar a
                      voltar
                    */}
{ehLider && (
                      <span className="pty-member__tag">lider</span>
                    )}

                    {/*
                      O FOCO LIGADO DE CADA UM.

                      Colado no nome, como a etiqueta de lider: e o que
                      o jogador procura quando quer ver "quem esta
                      comigo na mesma briga". Sem isto, o interruptor
                      existia mas o estado nao aparecia em lugar nenhum
                      da tela
                    */}
                    {!membro.eu && membro.focandoLider && (
                      <span
                        className="pty-member__tag pty-member__tag--foco"
                        title="Seguindo o alvo do lider"
                      >
                        foco
                      </span>
                    )}

                    {/*
                      OS DOIS BOTOES, E O MESMO LUGAR.

                      O `×` e so do lider; o seguir e de todo mundo. Como
                      um dos dois sempre aparece em cada linha, eles
                      dividem a MESMA posicao — e o botao de seguir fica
                      do lado do `×` quando o jogador e o lider, e no
                      lugar dele quando nao e

                      A regra e o que mantem a caixa IGUAL para lider e
                      nao-lider: quem nao pode expulsar nao ve um espaco
                      vazio, ve o outro botao
                    */}
                    <span className="pty-member__acoes">
                      {/*
                        A LIDERANCA SAI DO LIDER.

                        E o botao do meio: o `×` tira a pessoa, o `L`
                        entrega o comando. Fica antes do `»` porque a
                        ordem na tela e: tirar, passar, seguir
                      */}
                      {souLider && !membro.eu && (
                        <button
                          type="button"
                          className="pty-member__transfer"
                          onClick={() => onTransfer?.(membro.id)}
                          title={`Passar a lideranca para ${membro.nome}`}
                        >
                          L
                        </button>
                      )}

                      {souLider && !membro.eu && (
                        <button
                          type="button"
                          className="pty-member__kick"
                          onClick={() => onKick?.(membro.id)}
                          title={`Tirar ${membro.nome} da party`}
                        >
                          ×
                        </button>
                      )}

                      {!membro.eu && (
                        <button
                          type="button"
                          className={[
                            "pty-member__follow",
                            seguindo === membro.id ? "is-on" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => onFollow?.(membro.id)}
                          title={`Seguir ${membro.nome}`}
                        >
                          {seguindo === membro.id ? "•" : "»"}
                        </button>
                      )}
                    </span>
                  </div>

                  <div className="pty-member__life">
                    <div
                      className="pty-member__track"
                      title={`${membro.hp} de ${membro.maxHp} de vida`}
                    >
                      <i style={{ width: `${vida}%` }} />
                    </div>

                    <span className="pty-member__hp">
                      {membro.hp}
                      <small>/{membro.maxHp}</small>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          {/*
            O CONVIDAR fica ABAIXO do unico personagem, que e onde o
            pedido coloca. Com mais de um membro ele some: o grupo esta
            formado, e o botao viraria uma segunda forma de criar
            grupo quando o que o jogador quer e so adicionar alguem pelo
            clique
          */}
          {souSo && !cheia && (
            <>
              {digitando ? (
                <form
                  className="pty-invite"
                  onSubmit={enviar}
                >
                  <input
                    ref={inputRef}
                    className="pty-invite__input"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nick do jogador"
                    maxLength={24}
                    aria-label="Nick de quem convidar"
                  />

                  <button
                    type="submit"
                    className="pty-btn pty-btn--send"
                    disabled={!nome.trim()}
                  >
                    Enviar
                  </button>

                  <button
                    type="button"
                    className="pty-btn pty-btn--cancel"
                    onClick={abrirCampo}
                  >
                    Cancelar
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="pty-btn pty-btn--invite"
                  onClick={abrirCampo}
                  title="Convidar por nick"
                >
                  Convidar
                </button>
              )}
            </>
          )}
        </>
      )}

      {/*
        O FOCO DO ALVO DO LIDER.

        So para quem NAO e o lider. Para o lider a opcao nao faz sentido:
        ele e a fonte do foco, entao nao ha o que focar nele mesmo, e um
        botao ali seria um controle sem efeito

        O que o lider ve e o EFEITO, nao o controle: a etiqueta `foco` na
        linha de cada membro que esta com o foco ligado
      */}
      {emParty && !souLider && (
        <button
          type="button"
          className={[
            "pty-btn pty-btn--focus",
            focandoLider ? "is-on" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-pressed={focandoLider}
          onClick={() => onFocus?.(!focandoLider)}
          title={
            focandoLider
              ? "Parar de seguir o alvo do lider"
              : "Bater no mesmo inimigo que o lider, e so quando ele bater"
          }
        >
          {focandoLider ? "Foco ligado" : "Focar lider"}
        </button>
      )}

      {emParty && (
        <button
          type="button"
          className="pty-btn pty-btn--leave"
          onClick={onLeave}
          title="Sair da party"
        >
          Sair
        </button>
      )}
    </section>
  );
}

/**
 * A CAIXA DE 5 SEGUNDOS.
 *
 * ## POR QUE A CONTAGEM E LOCAL
 *
 * O prazo vem do servidor (`expiraEm`), e o cliente conta a partir dele.
 * O servidor confere de novo quando o aceite chega: um relogio adiantado
 * aqui nao cria uma party com 20 segundos de vida
 *
 * ## UM CONVITE POR VEZ
 *
 * Com dois convites chegando, o jogador tem os 5 segundos do que esta na
 * TELA. O proximo entra quando este sai. O servidor e quem decide a
 * ordem, entao aqui so aparece um
 */
function ConviteBox({ convite, onAceitar }) {
  const [restante, setRestante] = useState(() => {
    const sobra =
      (convite.expiraEm - Date.now()) / 1000;

    return Math.max(0, Math.ceil(sobra));
  });

  const [recusado, setRecusado] = useState(false);

  useEffect(() => {
    setRecusado(false);

    const conta = () => {
      const sobra = Math.max(
        0,
        Math.ceil((convite.expiraEm - Date.now()) / 1000),
      );

      setRestante(sobra);

      if (sobra <= 0) setRecusado(true);
    };

    conta();

    // de 100ms e nao de 1s: o numero nao pisca, e o zero chega no
    // primeiro quadro em que ele e verdade
    const timer = setInterval(conta, 100);

    return () => clearInterval(timer);
  }, [convite.de, convite.expiraEm]);

  return (
    <div className="pty-invite-box">
      <div className="pty-invite-box__head">
        <strong>{convite.de.nome}</strong>
        <span>convidou você para a party</span>
      </div>

      {!recusado ? (
        <>
          <div className="pty-invite-box__timer">
            <i
              style={{
                width: `${Math.min(
                  100,
                  (restante / (convite.ttl ?? 5)) * 100,
                )}%`,
              }}
            />
            <span>{restante}s</span>
          </div>

          <div className="pty-invite-box__actions">
            <button
              type="button"
              className="pty-btn pty-btn--accept"
              onClick={() => onAceitar?.(convite.de.id)}
            >
              Aceitar
            </button>

            <button
              type="button"
              className="pty-btn pty-btn--decline"
              onClick={() => setRecusado(true)}
            >
              Recusar
            </button>
          </div>
        </>
      ) : (
        <span className="pty-invite-box__expired">
          Convite expirado
        </span>
      )}
    </div>
  );
}

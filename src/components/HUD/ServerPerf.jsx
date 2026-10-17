import { useEffect, useState } from "react";

/**
 * O PAINEL DE DESEMPENHO DO SERVIDOR.
 *
 * ## O QUE ELE FAZ
 *
 * Le o `/health/laco` e mostra os numeros na tela, para dar para VERIFICAR
 * uma otimizacao em vez de acreditar nela. E um instrumento de medicao,
 * nao um painel de producao: ele nao esta dentro do `HUD` e nao depende
 * de estado de jogo nenhum
 *
 * ## POR QUE BUSCA HTTP E NAO PEDE PELO WEBSOCKET
 *
 * Porque o `/health/laco` ja existe e ja devolve o que interessa. Pedir
 * pelo socket seria um caminho NOVO para o mesmo numero, e o caminho novo
 * e o que ia precisar de teste proprio
 *
 * O preco e uma requisicao por segundo. O endpoint e o mesmo que um
 * monitor usaria, e uma leitura a cada 1000ms nao pesa nem no servidor
 * nem no navegador — ele devolve um objeto de duas dezenas de campos
 *
 * ## POR QUE ELE SOME QUANDO NAO DA
 *
 * O `fetch` falha quando o servidor esta fora do ar ou quando a pagina
 * foi aberta pelo `vite preview` sem o proxy. Nesse caso o componente
 * simplesmente nao desenha nada: um "erro" fixo na tela seria pior que a
 * ausencia dele, porque o jogador acharia que o servidor caiu
 */
export default function ServerPerf() {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    let vivo = true;

    async function ler() {
      try {
        const resposta = await fetch("/health/laco");

        if (!resposta.ok) {
          if (vivo) setDados(null);
          return;
        }

        const corpo = await resposta.json();

        if (vivo) setDados(corpo);
      } catch {
        // servidor fora do ar, ou sem proxy. nao e erro de tela:
        // o componente simplesmente some
        if (vivo) setDados(null);
      }
    }

    ler();

    const intervalo = setInterval(ler, 1000);

    // o fetch pode estar no ar quando o componente sai da tela. sem
    // este flag, o `setDados` chamaria `setState` em um componente morto
    // e o React avisaria no console
    return () => {
      vivo = false;
      clearInterval(intervalo);
    };
  }, []);

  if (!dados) return null;

  const orcamento = dados.orcamentoMs ?? 50;

  /**
   * A COR DA BARRA.
   *
   * Tres faixas, e a do meio e a que importa: a barra e o TRABALHO do
   * tique contra o ORCAMENTO dele. Acima de 80% o tique esta comendo o
   * tempo do proximo, e e ai que o atraso comeca
   *
   * A faixa vermelha e o pior tique, e nao a media: um tique de 900ms
   * com media de 8ms e o engasgo que o jogador sentiu
   */
  const corDoPior = (dados.duracaoPiorMs ?? 0) > orcamento
    ? "#e06b6b"
    : (dados.duracaoPiorMs ?? 0) > orcamento * 0.8
      ? "#e8c96a"
      : "#d3bd90";

  return (
    <div className="server-perf">
      <span className="server-perf__titulo">servidor</span>

      <span
        className="server-perf__num"
        data-tip={`ultimos 10s, orcamento ${orcamento}ms por tique`}
      >
        {dados.duracaoRecenteMs ?? "—"}
        <i>ms</i>
      </span>

      <span
        className="server-perf__pior"
        style={{ color: corDoPior }}
        data-tip="pior tique da janela"
      >
        pior {dados.duracaoPiorMs ?? "—"}
      </span>

      <span className="server-perf__barra" aria-hidden="true">
        <i
          style={{
            width: `${Math.min(
              100,
              ((dados.duracaoRecenteMs ?? 0) / orcamento) * 100,
            )}%`,
            background: corDoPior,
          }}
        />
      </span>

      <span
        className="server-perf__extra"
        data-tip="jogadores conectados | tiques rodados | erros seguidos"
      >
        {dados.jogadores ?? 0} jog · {dados.tiquesRodados ?? 0} tq
        {dados.errosSeguidos > 0
          ? ` · ${dados.errosSeguidos} erro`
          : ""}
      </span>
    </div>
  );
}
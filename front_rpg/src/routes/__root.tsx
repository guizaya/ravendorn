import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import favIcon from "../assets/project/fav_icon.png?url";
import appleTouchIcon from "../assets/project/fav_icon.png?url";
import { NOME_DO_PROJETO } from "../components/marca-projeto";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  /**
   * O ERRO VAI PARA O CONSOLE E NADA MAIS.
   *
   * A fronteira de erro nao tem para onde reportar: antes ela chamava um
   * modulo que mandava a excecao para um coletor de erros de terceiro, e o
   * erro do jogador saia da maquina dele. Sem servidor de erro configurado,
   * o console e o destino honesto — e e o que o jogador consegue abrir com
   * F12 para descrever o problema
   */
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { property: "og:site_name", content: NOME_DO_PROJETO },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" },
      {
        rel: "stylesheet",
        href: appCss,
      },
      /*
        O FAVICON.

        A entrada antiga apontava para `/favicon.ico`, que o build gerava a
        partir do `public/favicon.ico` — um icone quadrado de outro projeto.

        Sao TRES entradas e nao uma porque cada uma e pedida por um
        consumidor diferente: `icon` para o navegador, `apple-touch-icon`
        para o iOS quando alguem adiciona a pagina na tela de inicio (ele nao
        le PNG no `icon`, e sem essa entrada ele tira um screenshot
        qualquer da pagina), e `shortcut icon` para Windows e Linux, que
        procuram `.ico` pelo nome curto

        O `?url` e o que faz o Vite gerar o arquivo com hash no build: sem
        ele o caminho seria literal e o navegador serviria a versao antiga do
        cache depois de trocar a arte
      */
      { rel: "icon", href: favIcon, type: "image/png" },
      { rel: "shortcut icon", href: favIcon, type: "image/png" },
      { rel: "apple-touch-icon", href: appleTouchIcon },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  /**
   * A SESSAO AGORA VIVE EM `localStorage`, E NAO EM UM OBSERVADOR.
   *
   * Antes havia um `supabase.auth.onAuthStateChange` que invalidava o
   * roteador a cada `SIGNED_IN`. O substituto e o evento `storage`, que e o
   * que o navegador dispara quando OUTRA aba deste mesmo site muda o
   * `eldoria:sessao`
   *
   * ## POR QUE O `storage` E NAO UM CALLBACK PROPRIO
   *
   * O `entrarComCarteira` ja navega para `/characters` depois de gravar a
   * sessao, entao a aba que acabou de entrar ja sabe. A unica coisa que o
   * evento resolve e a OUTRA aba: o jogador entrou numa aba, abriu outra, e
   * as duas precisam concordar. E isso que o `storage` cobre
   *
   * E o evento so dispara em outra aba, nunca na que escreveu — que e o que
   * evita o laco de invalidar a rota duas vezes na mesma navegacao
   */
  useEffect(() => {
    /**
     * A MESMA REFERENCIA NO ADD E NO REMOVE.
     *
     * O `removeEventListener` compara a funcao por identidade, entao um
     * wrapper novo na hora de remover nao tiraria nada e o listener
     * sobreviveria ao unmount — o sintoma seria uma tela que continua
     * invalida o cache depois de desmontada
     */
    function aoMudar(evento: StorageEvent) {
      if (evento.key !== "eldoria:sessao") return;
      queryClient.invalidateQueries();
    }

    window.addEventListener("storage", aoMudar);

    return () => window.removeEventListener("storage", aoMudar);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks routing */}
      <Outlet />
    </QueryClientProvider>
  );
}

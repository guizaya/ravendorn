/**
 * O REGISTRO DE CAMADAS DE TILE, e ele nao sabe de NENHUM mapa.
 *
 * ## POR QUE ISTO EXISTE SEPARADO DO ARQUIVO QUE LE O `.tmj`
 *
 * ## O SERVIDOR IMPORTA O MOTOR
 *
 * O `GameServer` faz `import { GameEngine } from
 * "../../../src/game/engine/GameEngine.js"`. Se o motor importasse o
 * arquivo que le o `.tmj`, o servidor cairia na carga — e o sintoma seria o
 * jogo inteiro fora do ar, sem nenhuma pista de que a causa e uma linha de
 * import num arquivo de arte
 *
 * O Node nao entende `.tmj`: o que faz o arquivo virar modulo e o plugin
 * `tiledTmj` do `vite.config.js`, que so existe no build do navegador
 *
 * ## E POR QUE NAO UM IMPORT DINAMICO
 *
 * Porque e assincrono, e o desenho nao e. `await import()` deixaria o
 * primeiro quadro sem chao, e o segundo trocaria o chao embaixo dos pes
 *
 * ## E COMO FICA, ENTao
 *
 * O motor pergunta aqui, e quem responde no navegador e o `main.jsx`, que
 * importa o arquivo do mapa e se registra. No servidor o registro fica
 * vazio, `temCamadaDeTile` devolve `false` e o mapa usa o terreno de sempre
 * — que e o que um servidor que nunca desenha precisa
 */

/**
 * O `lerMapaTiled` entra aqui, e ele e puro: nenhum `.tmj`, nenhuma imagem,
 * nenhum `document`. O arquivo que carrega a arte do mapa e o unico proibido
 * de entrar aqui
 */
import { lerMapaTiled } from "./tiled.js";
import { solidsDeObjetosTiled, camadasIgnoradasPelaColisao } from "./colisaoTiled.js";
import { zonasDeCamadasTiled } from "./zonasTiled.js";
import { esquecerMinimapa } from "./minimapaTiled.js";
import { definirResolvedorDeZonas } from "../../data/maps/index.js";

/**
 * O RESOLVEDOR DE ZONAS, instalado uma vez no carregamento do modulo.
 *
 * ## POR QUE INSTALA AQUI E NAO A CADA MAPA
 *
 * Porque `data/maps` e um modulo de dado, sem `mapId` de parametro em lugar
 * nenhum. Quem pede a zona por id (`getZoneById`) nao diz de que mapa ela e:
 * ele diz "pantano", e a resposta e a mesma nos dois mapas
 *
 * ## E COMO ELE SABE QUE A ZONA E DO MAPA 1
 *
 * Pelo `mapId` que a propria zona carrega. A zona do mapa 2 tem `mapId:
 * "map_2"`, e nao ha `m2_...` no arquivo — entao ela passa direto e continua
 * com o retangulo do codigo
 */
definirResolvedorDeZonas((id, zona) => {
  /**
   * SO O MAPA 1 TEM ARTE.
   *
   * A zona do mapa 2 tem `mapId: "map_2"` e nao existe em nenhum `.tmj`, entao
   * ela nem chega a ser procurada. Sem esta linha o mapa 2 pagaria uma
   * leitura de arquivo a cada `getZoneById` e receberia lista vazia — o
   * resultado estaria certo pelo motivo errado
   */
  if (zona.mapId !== "map_1") return null;

  const [achada] = zonasDoMapa(zona.mapId, [id], { base: zona });

  return achada ?? null;
});

/**
 * AS ZONAS QUE O MAPO DECLARA, e so as que o jogo conhece.
 *
 * ## POR QUE O REGISTRO, E NAO UM `import` DO `.tmj`
 *
 * O mesmo motivo da colisao: o servidor precisa destas zonas tanto quanto o
 * navegador, porque quem sorteia as criaturas e o motor, e o motor roda no
 * servidor. O `GameServer` le o arquivo do disco e registra no MESMO
 * registro, entao o motor tem um caminho so para os dois
 *
 * ## POR QUE OS IDS VEM DE PARAMETRO
 *
 * Porque este arquivo nao conhece o roster: ele vive em `data/enemies`, que
 * importa `data/maps`, e o motor e quem sabe os dois. Passar a lista aqui e
 * o que mantem o registro sem dependencia de dado
 *
 * @param {string} mapId
 * @param {Iterable<string>} idsConhecidos ids de zona que o jogo aceita
 */
export function zonasDoMapa(mapId, idsConhecidos, { base = null } = {}) {
  if (!mapId) return [];

  const entrada = registro.get(mapId);

  if (!entrada) return [];

  const { zonas, ignoradas } = zonasDeCamadasTiled(entrada.tmj, idsConhecidos);

  /**
   * AVISA SO QUANDO O QUE FOI PEDIDO NAO EXISTE.
   *
   * Este e chamado por `getZoneById`, que roda a cada 0.25s por jogador no
   * piloto da viagem automatica. Avisar de toda camada ignorada enche o
   * console em segundos
   *
   * O aviso e por id, e nao por camada: "pedi pantano e nao tem" e a
   * informacao que serve. Uma camada `PAREDES` ignorada e o resultado
   * esperado, nao um erro — ela esta na lista porque nao foi pedida, e nao
   * porque tenha falhado
   */
  const devolvidas = new Set(zonas.map((z) => z.id));

  for (const pedido of idsConhecidos) {
    if (devolvidas.has(pedido)) continue;

    const emCodigo = ignoradas.includes(pedido);

    console.warn(
      `[tiled] ${mapId}: a zona "${pedido}" foi pedida e nao veio do .tmj` +
        (emCodigo ? "" : " — o jogo nao conhece nenhuma zona com esse nome"),
    );
  }

  /**
   * A ZONA QUE SAI DAQUI E COMPLETA, E SO O RETANGULO VEM DO TILED.
   *
   * `zonasDeCamadasTiled` devolve so `id`, `x`, `y`, `width` e `height` —
   * o que a caixa tem. O resto da zona (`name`, `terrain`, `kind`, `mapId`,
   * `mapColor`) esta no codigo, e e ele que o minimapa pinta e o que a
   * viagem automatica le para mostrar o nome
   *
   * Devolver o objeto pelado quebraria os dois: um `undefined` no `terrain`
   * pinta o chao sem textura, e um `undefined` no `mapId` manda o piloto
   * procurar no mapa errado
   *
   * O `base` e a zona do codigo quando o chamador ja a tem na mao — o
   * `getZoneById`, que e quem chama no jogo. Sem ele, quem so tem os ids
   * receberia a zona nua, e teria de ir ao `getZoneById` para encher o resto
   *
   * E porque o spread do retangulo vem DEPOIS: e o Tiled que sobrescreve o
   * codigo, que e o ponto da coisa toda
   */
  if (!base) return zonas;

  return zonas.map((z) => ({ ...base, ...z }));
}

/**
 * A COLISAO DE TILE DESTE MAPA, e a mesma nos dois lados.
 *
 * ## POR QUE O REGISTRO, E NAO UM `import` DO `.tmj`
 *
 * Porque o servidor precisa dela tanto quanto o navegador: o movimento online
 * e autoritativo, e um servidor sem parede deixa o jogador andar por qualquer
 * uma. O `GameServer` le o arquivo do disco e registra no MESMO registro,
 * entao o motor tem um caminho so para os dois
 *
 * ## E POR QUE NAO ESPERA A FOLHA DE TILES CARREGAR
 *
 * Porque a colisao sai de um retangulo de objeto, que esta em texto no
 * arquivo. Esperar a imagem faria o jogador atravessar parede durante o
 * download, e o `clampToBounds` o seguraria so na ultima linha de pixel
 */
export function colisaoDoMapa(mapId) {
  if (!mapId) return [];

  if (colisoes.has(mapId)) return colisoes.get(mapId);

  const entrada = registro.get(mapId);

  const saida = entrada ? solidsDeObjetosTiled(entrada.tmj) : [];

  /**
   * O QUE A COLISAO DEIXOU DE LER.
   *
   * Sao as camadas de ZONA do mapa, e a mensagem e de leitura, nao de erro.
   * Sem ela o autor renomearia a camada de parede, veria as paredes pararem
   * de barrar e nao saberia se foi o jogo ou o nome
   *
   * Sai uma vez por mapa porque a colisao tem cache: o aviso repetiria a cada
   * quadro e burying the console
   */
  if (entrada) {
    const ignoradas = camadasIgnoradasPelaColisao(entrada.tmj);

    if (ignoradas.length) {
      console.info(
        `[tiled] ${mapId}: ${ignoradas.length} camadas de objeto nao sao parede e foram ignoradas na colisao: ${ignoradas.join(", ")}`,
      );
    }
  }

  colisoes.set(mapId, saida);

  return saida;
}

/**
 * AS CAMADAS DECLARADAS, por `id` de mapa.
 *
 * E um `Map` e nao um objeto porque a chave e o id do mapa, e um id pode ter
 * qualquer caractere — inclusive `__proto__`, que num objeto comum seria uma
 * chave adormecida e nao uma chave
 */
const registro = new Map();

/**
 * O QUE JA FOI LIDO, e o que impede reler a cada quadro.
 *
 * E separado do `registro` de proposito: registrar de novo um mapa tem que
 * invalidar o que foi lido, senao o `main.jsx` reavaliado deixaria o mapa
 * com a folha antiga para sempre
 */
const lidos = new Map();

/**
 * A COLISAO JA DERIVADA, e ela tem cache proprio.
 *
 * Separado do `lidos` porque as duas coisas mudam por motivos diferentes: o
 * `lidos` guarda a camada que a FOLHA carregada desenha, e este guarda a
 * colisao que o `.tmj` ja traz em texto. O `tiledDoMapa` pode falhar — sem
 * folha carregada — e a colisao continuar respondendo
 */
const colisoes = new Map();

/**
 * DECLARA AS CAMADAS DE UM MAPA, e o `main.jsx` chama isto.
 *
 * ## POR QUE A ENTRADA TRAZ O `.tmj` E NAO A CAMADA JA LIDA
 *
 * Porque o `lerMapaTiled` fatia os `gid` e cria dois `Int32Array`. Fazer isso
 * no import do registro gastaria memoria do servidor com algo que so o
 * navegador desenha. Guardando o `.tmj` cru, a leitura acontece na primeira
 * vez que o motor pergunta — no cliente, e so no mapa certo
 *
 * ## E POR QUE ISSO PODE SER CHAMADO MAIS DE UMA VEZ
 *
 * Porque `registrar` substitui e limpa a leitura: o `main.jsx` reavaliado
 * nao pode deixar duas copias do mesmo mapa na tela
 */
export function registrarCamadas(mapId, entrada) {
  if (!mapId || !entrada?.tmj) return;

  registro.set(mapId, entrada);
  lidos.delete(mapId);
  colisoes.delete(mapId);

  /**
   * O CANVAS DO MINIMAPA TAMBEM E INVALIDADO.
   *
   * Ele foi desenhado do arquivo antigo e nao sabe que voce mexeu no Tiled.
   * Sem esta linha o minimapa mostraria a parede no lugar de antes mesmo
   * com a colisao ja atualizada — e o pior tipo de defeito: o jogador ve a
   * parede nova na tela, atravessa a antiga no minimapa, e nao sabe qual
   * das duas e a verdade
   */
  esquecerMinimapa(mapId);
}

/**
 * A CAMADA DE TILE DESTE MAPA, ou `null` se ele nao tem.
 *
 * ## E POR QUE UM `try` QUE DEVOLVE `null` E NAO LANCA
 *
 * Porque um mapa sem camada e um estado normal: quatro dos cinco mapas nao
 * tem. A falha ao LER o arquivo e problema de desenvolvimento, e ela vai
 * para o console com o nome do mapa — onde o `lerMapaTiled` ja diz qual
 * tileset ficou sem imagem
 */
export function tiledDoMapa(mapId) {
  if (!mapId) return null;

  if (lidos.has(mapId)) return lidos.get(mapId);

  const entrada = registro.get(mapId);

  if (!entrada) {
    lidos.set(mapId, null);

    return null;
  }

  try {
    const lido = lerMapaTiled(entrada.tmj, {
      imagens: entrada.imagens,
      tilesets: entrada.tilesets,
    });

    lidos.set(mapId, lido);

    return lido;
  } catch (erro) {
    console.error(
      `[tiled] nao deu para ler a camada de tile de "${mapId}":`,
      erro,
    );

    lidos.set(mapId, null);

    return null;
  }
}

/**
 * O MAPA DECLAROU CAMADA DE TILE?
 *
 * E o que o motor usa para escolher entre o terreno e a cor de fundo. E a
 * pergunta "o mapa tem chao no Tiled", e nao "a imagem ja baixou": uma folha
 * que ainda nao chegou tem que mostrar o fundo do mapa, e nao a grama de um
 * mapa que o Tiled substituiu
 */
export function temCamadaDeTile(mapId) {
  return registro.has(mapId);
}

/**
 * TODAS AS FOLHAS DE TILE REGISTRADAS, EM TODOS OS MAPAS.
 *
 * ## PARA QUE ISTO EXISTE
 *
 * O motor ja precarrega a arte do mapa de DESTINO antes do `setMap`, e isso
 * resolve o chao sumindo na travessia. Mas as folhas dos MOBS sao outra coisa:
 * elas nao tem `precarregar`, e sao pedidas por `new Image()` na hora em que o
 * mob entra em cena. O sintoma era o jogador atravessando do mapa da base para
 * o mapa 1 e ver os bichos aparecendo aos poucos, um por um, enquanto a luta ja
 * tinha comecado
 *
 * ## PORQUE LER DO REGISTRO, E NAO TER UMA LISTA AQUI
 *
 * Porque a lista de mapa novo e problema de quem escreve o mapa. Este registro
 * ja e a fonte da verdade: cada `camada*.js` se registra com as imagens dele
 * quando o modulo e importado. Um mapa novo entra no preload sozinho, sem ninguem
 * lembrar de acrescentar o nome aqui
 *
 * ## E POR QUE DEVOLVER UM CONJUNTO, E NAO UM ARRAY
 *
 * Porque `boss_1/dungeon.png` e `map_1/dungeon.png` tem o mesmo nome de arquivo
 * e as URLs no bundle sao diferentes (o hash do conteudo entra nelas). Sao
 * entradas distintas do registro, e o `Set` so remove o que e de fato o mesmo
 * arquivo duas vezes
 */
export function folhasDeTodosOsMapas() {
  const folhas = new Set();

  for (const entrada of registro.values()) {
    for (const url of Object.values(entrada?.imagens ?? {})) {
      if (typeof url === "string" && url) folhas.add(url);
    }
  }

  return folhas;
}
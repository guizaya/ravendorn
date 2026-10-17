# contexto.md — RavenDorn / Ashen

Mapa completo do projeto: o que cada parte faz, e **como cada parte se liga às outras**.
Escrito a partir da leitura do código, não de memória.

> Este documento é **leitura**, não roteiro de mudança. Nenhum arquivo de código foi alterado para produzi-lo.

---

## Índice

1. [O que é o projeto](#1-o-que-é-o-projeto)
2. [Topologia: três processos, três portas](#2-topologia-três-processos-três-portas)
3. [Mapa de dependências](#3-mapa-de-dependências)
4. [Tópico 1 — Stack, build e scripts](#tópico-1--stack-build-e-scripts)
5. [Tópico 2 — O motor (`GameEngine`)](#tópico-2--o-motor-gameengine)
6. [Tópico 3 — Sessão do jogador](#tópico-3--sessão-do-jogador)
7. [Tópico 4 — O tick: ordem de execução](#tópico-4--o-tick-ordem-de-execução)
8. [Tópico 5 — Mapas e o registro Tiled](#tópico-5--mapas-e-o-registro-tiled)
9. [Tópico 6 — Portais e travessia](#tópico-6--portais-e-travessia)
10. [Tópico 7 — Colisão e navegação](#tópico-7--colisão-e-navegação)
11. [Tópico 8 — Auto-play e plano de viagem](#tópico-8--auto-play-e-plano-de-viagem)
12. [Tópico 9 — Mineração](#tópico-9--mineração)
13. [Tópico 10 — Missões](#tópico-10--missões)
14. [Tópico 11 — Itens, materiais e raridades](#tópico-11--itens-materiais-e-raridades)
15. [Tópico 12 — Craft](#tópico-12--craft)
16. [Tópico 13 — Inventário e equipamento](#tópico-13--inventário-e-equipamento)
17. [Tópico 14 — Stats: a fórmula única](#tópico-14--stats-a-fórmula-única)
18. [Tópico 15 — Habilidades e árvore](#tópico-15--habilidades-e-árvore)
19. [Tópico 16 — Inimigos, IA e telegrafia](#tópico-16--inimigos-ia-e-telegrafia)
20. [Tópico 17 — Props, loot e chefe](#tópico-17--props-loot-e-chefe)
21. [Tópico 18 — Arena e chefe por jogador](#tópico-18--arena-e-chefe-por-jogador)
22. [Tópico 19 — Servidor e autoridade](#tópico-19--servidor-e-autoridade)
23. [Tópico 20 — Protocolo e rede](#tópico-20--protocolo-e-rede)
24. [Tópico 21 — Painel: o contrato com a UI](#tópico-21--painel-o-contrato-com-a-ui)
25. [Tópico 22 — A UI em React](#tópico-22--a-ui-em-react)
26. [Tópico 23 — `front_rpg` (SSR) e a carteira](#tópico-23--front_rpg-ssr-e-a-carteira)
27. [Tópico 24 — Economia: mercado, guilda, party, coleção, passe](#tópico-24--economia)
28. [Tópico 25 — Persistência](#tópico-25--persistência)
29. [Tópico 26 — Testes](#tópico-26--testes)
30. [Tópico 27 — Assets](#tópico-27--assets)
31. [Tópico 28 — Convenções do código](#tópico-28--convenções-do-código)
32. [Tópico 29 — Problemas conhecidos e pendências](#tópico-29--problemas-conhecidos-e-pendências)
33. [Apêndice — Glossário de símbolos](#apêndice--glossário-de-símbolos)

---

## 1. O que é o projeto

RPG 2D top-down, multiplayer, com três camadas:

| Camada | Onde | Stack | Papel |
|---|---|---|---|
| **Front (landing)** | `front_rpg/` | React 19 + TanStack Start (SSR/Nitro) + Tailwind 4 | Login de carteira, criação de personagem, e o **iframe** que embute o jogo |
| **Jogo (cliente)** | `src/` | React 18 + Vite 6 + **Canvas 2D** | Motor de simulação/render + toda a UI do jogo |
| **Servidor** | `server/` | Node 20 + Express + `ws` | Autoridade sobre movimento, combate, mineração, economia e save |

**A decisão que define o resto da arquitetura:** o servidor **importa o mesmo `GameEngine` que o navegador**. Não existe uma segunda simulação. `GameEngine` roda em dois modos:

- **headless** (`this.headless = !canvas`) — servidor e testes: simula tudo, `render()` retorna imediatamente.
- **networked** (`this.networked = true`) — navegador: o `update()` **não simula nada**; só Presentation + aplicação de pacotes do servidor.

Consequência prática: qualquer regra de jogo escrita no motor vale igualmente nos dois lados, e não pode divergir.

---

## 2. Topologia: três processos, três portas

```
                    ┌──────────────────────────────────┐
   navegador ──────▶│  front_rpg  (Nitro/SSR)  :3000   │
                    │  / , /auth , /characters , /jogo   │
                    └───────────────┬──────────────────┘
                                    │ o /jogo é um <iframe>
                                    ▼
                    ┌──────────────────────────────────┐
                    │  jogo (Vite build → dist/)       │
                    │  index.html e jogo.html           │
                    │  Canvas 2D + React (HUD)          │
                    └───────────────┬──────────────────┘
                                    │ WebSocket /ws
                                    │ + REST /api
                                    ▼
                    ┌──────────────────────────────────┐
                    │  Node (Express + ws)  :8787       │
                    │  GameServer + GameEngine headless │
                    └──────────────────────────────────┘
```

### Dev — três processos, um só aberto no navegador

| processo | porta | comando |
|---|---|---|
| API + WebSocket | 8787 | `npm run start` (raiz) |
| jogo com HMR | 5173 | `npm run dev:web` (raiz) |
| **front (o navegador)** | **3000** | `npm run dev` (`front_rpg/`) |

O proxy de `/ws` e `/api` **já existe** no `vite.config.js` (linhas 71–89) e aponta para `localhost:8787`. Sem ele, o `new WebSocket("ws://localhost:5173/ws")` dá "conexão recusada" enquanto a API responde normal na mesma porta — e o erro parece firewall.

> **Pegadinha conhecida:** em dev o iframe do mapa vem do **Vite do jogo na 5173**, não do `dist/`. Sem `npm run dev:web` da raiz, o iframe aponta para 5173, não acha `jogo.html`, e **o mapa fica preto sem erro visível**. `urlDoJogo()` (em `front_rpg/src/lib/api.ts:423`) escolhe entre `http://localhost:5173` e `window.location.origin` por `import.meta.env.DEV`.

### Produção — um processo só

`npm run build` na raiz → `dist/`; `npm run build` no `front_rpg` → `.output/`. O Node em 8787 serve `dist/` estaticamente e faz **proxy de catch-all** para o Nitro (`server/src/index.js:626–713`, porta via `FRONT_PORT`, default 3000).

**A ordem das rotas no Express importa:** `/health*`, `/api/*` e o `express.static` vêm **antes** do `app.get(/.*/, repassarParaOFront)`. Invertido, `/api/conta` iria para o front e a tela de personagem receberia HTML onde espera JSON.

---

## 3. Mapa de dependências

```
                    ┌──────────────────────────────────┐
                    │  src/shared/protocol.js          │  contrato único
                    │  CMD_*, SERVER_EVENTS, PARTY_MAX  │
                    └────────┬────────────────┬────────┘
                             │                │
              ┌──────────────┘                └──────────────┐
              ▼                                              ▼
   ┌────────────────────┐                        ┌────────────────────┐
   │  server/src/       │                        │  src/game/net/     │
   │  GameServer.js     │                        │  GameClient.js     │
   │  (importa o motor) │                        │  NetworkWorld.js   │
   └─────────┬──────────┘                        │  Previsao.js       │
             │                                   └─────────┬──────────┘
             │        ┌────────────────────────┐          │
             └───────▶│  src/game/engine/      │◀─────────┘
                      │  GameEngine.js         │
                      │  (o NUCLEO, 17k linhas)│
                      └───┬────┬────┬────┬────┘
                          │    │    │    │
        ┌─────────────────┘    │    │    └──────────────────┐
        ▼                      ▼    ▼                       ▼
 ┌─────────────┐   ┌──────────────────┐   ┌──────────────┐  ┌──────────┐
 │ nav/        │   │ enemies/ combat/ │   │ inventory/   │  │ quests/  │
 │ collision/  │   │ effects/ loot/   │   │ equipment/   │  │ skills/  │
 │ (o chão)    │   │ (o combate)      │   │ craft/       │  │ bestiary/│
 └─────────────┘   └──────────────────┘   └──────────────┘  └──────────┘
        ▲                    ▲                    ▲              ▲
        └────────────────────┴────────────────────┴──────────────┘
                             │
                    ┌────────┴─────────┐
                    │  src/data/**     │  configuração pura
                    │  (nunca importa  │  importada por todo
                    │   src/game/**)   │  o resto
                    └──────────────────┘

                    ┌──────────────────┐
                    │  src/components/ │  React — só LÊ o painel
                    │  HUD + painéis   │  nunca simula
                    └──────────────────┘
```

**Três regras de camada que o projeto respeita:**

1. `src/data/**` é **configuração pura** — importa `src/game/**` em exatamente um lugar (`quests/index.js` → `balance.js`), nunca o contrário.
2. `src/game/**` importa `src/data/**`, nunca o inverso.
3. `src/components/**` **nunca importa `src/game/net/*`**. Os painéis falam com o mundo por um único objeto (`intencao`) e com o motor por `engineRef`.

---

## Tópico 1 — Stack, build e scripts

### Dependências

| pacote | versão | uso |
|---|---|---|
| `express` | ^4.21 | rotas de API, estáticos, proxy para o front |
| `ws` | ^8.22 | WebSocket (`/ws`) |
| `ethers` | ^6.17 | **só no servidor** — assinar/verificar mensagens EIP-191 da carteira |
| `react` / `react-dom` | ^18.3 | a UI do jogo |
| `vite` | ^6.0 | dev server + build |
| `vitest` | ^2.1 | 180 arquivos de teste |
| `jsdom` | ^25 | ambiente dos testes de componente |
| `concurrently` | ^9.1 | `npm run dev` sobe web + API juntos |

### `vite.config.js` — o plugin `tiledTmj`

O plugin (linha 18) existe porque **o `.tmj` é JSON com comentários-free mas o Node não sabe ler como módulo**. Sem ele o build morre no primeiro `{`. É ele que permite `import tmj from ".../vale.tmj"` dentro dos arquivos de `src/game/maps/`.

Configuração relevante:

- **`test.environment: "node"`** com `environmentMatchGlobs` só para `*.test.jsx` — o resto dos testes roda sem DOM, que é mais rápido.
- **`server.proxy`** para `/api`, `/health`, `/ws` (o `/ws` precisa de `ws: true`).
- **`rollupOptions.input`** com `index.html` e `jogo.html` — dois entrypoints, mesmo bundle.
- **`build.minify`**: `esbuild` em produção, `false` em dev.
- `esbuild.keepNames` — nomes de classe/função sobrevivem à minificação (o motor反射a nomes em alguns pontos).

### Scripts

| script | o que faz |
|---|---|
| `npm run dev` | web (5173) + API (8787) juntos, via concurrently |
| `npm run dev:web` | só o Vite do jogo |
| `npm run dev:server` / `start` | `node --env-file-if-exists=.env server/src/index.js` |
| `npm run build` | `vite build --mode production` → `dist/` |
| `npm test` | `vitest run` |
| `sprites:*` | geram folhas de sprite a partir de GIFs |
| `props:arvore` | gera a prop de árvore |

---

## Tópico 2 — O motor (`GameEngine`)

`src/game/engine/GameEngine.js` — **17.465 linhas**. É o arquivo mais importante do projeto e o ponto de maior risco.

### Módulo (linhas 1–937), antes da classe

- **34 `import`s**, depois as constantes de módulo.
- `mergeBonuses(...sources)` (L130) — soma bônus **por chave de stat**. Um `Object.assign` simples deixaria o equipamento sobrescrever o bestiário.
- `marcarChefeVencido(sessaoId, mapaId)` (L371) — escreve no `Map` privado de módulo `ARENA_VENCIDA` (L359). Exportado e consumido pelo `GameServer`.
- `createBosses(map, sessaoId)` (L404) — ver [Tópico 18](#tópico-18--arena-e-chefe-por-jogador).

### Constantes de módulo (cada uma com um comentário explicando o número)

| linha | símbolo | valor | por quê |
|---|---|---|---|
| 123 | `ALCANCE_DE_CHEGADA` | 48 | caixa de chegada em volta do NPC, não dos pés da arte |
| 167 | `EMPTY_MARKET` | — | forma do painel quando `marketStore === null` |
| 217 | `BAU_VAZIO` | — | baú sem itens |
| 224 | `EMPTY_GUILD_SNAPSHOT` | — | **construído a partir de `GUILD_TALENTS`**, nunca escrito à mão |
| 460 | `AUTO_RETARGET_INTERVAL` | 0.25s | de quanto em quanto o auto troca de alvo |
| 461 | `AUTO_LEASH_RANGE` | 1500 | distância máxima de caça sem zona |
| 476 | `TRAVEL_CHEGADA` | 24 | raio de "cheguei" da viagem |
| 491 | `TRAVEL_CHEGADA_CELULA` | 20 | meia célula de tolerância |
| 512 | `SEGUIR_REPLANEJA` | 0.4s | replanejar ao seguir o líder |
| 532 | `TRAVEL_TRAVADO_LIMITE` | 3s | travado → refaz a grade inteira |
| 556 | `TRAVEL_PARADO_PULA_PONTO` | 0.8s | travado → pula **um** waypoint |
| 566 | `PEDIDA_DO_TUTORIAL` | `"cristal_comum"` | tipo de pedra da missão 1.6 |
| 583 | `PEDIDA_MINERAR_DIST` | 200px | distância do pedido de minerar |
| 593 | `TRAVEL_TRAVADO_EPSILON` | 4px | o que conta como "avançou" |
| 621 | `RAIO_DO_JOGADOR` | 16 | duplicado do servidor, de propósito |
| 650/651 | `FOLGA_PARA_PEGAR` / `_SOLTAR` | 24 / 48 | histerese da mira magnética |
| 679/681 | `EMPURRAO_POR_DANO` / `_MAXIMO` | 1.6 / 190 | knockback escalado pelo dano |
| 855 | `ALCANCE_CREDITO_ABATE` | 320 | 3× o alcance corpo a corpo |
| 856 | `EMPTY_LIST` | — | array vazio compartilhado, para não alocar por quadro |

### `this.world` — a divisão compartilhado/privado

**Compartilhado** (por contexto de mapa, visível a todos do mapa): `time`, `players`, `enemies`, `npcs`, `projectiles`, `drops`, `telegraphs`, `map`, `collision`, `statuses`, `damage`, `effects`.

**Privado** (acessores que fazem proxy para `world.session`, L1914–1956): `player`, `inventory`, `equipment`, `quests`, `bestiary`, `craft`, `collection`, `passe`.

### Os acessores de sessão (L1295–1485)

Oito camposetro saíram do motor e foram para a sessão: `autoPlay`, `engagedTargetId`, `selectedTargetId`, `bestiaryTargetType`, `autoWaypoint`, **`autoMoveDirection`**, `autoFacing`, `autoDecisionTimer`, `travelPlan`, **`travelParado`**, `cacadaCaminho`, `cacadaRelogio`, `autoLeashRange`.

O comentário em L1262–1294 diz o motivo: **com um motor só para o servidor inteiro, o `autoPlay` de um jogador aparecia no tique de outro.**

`get sessaoDeJogador()` (L1470) usa `this.world?.session ?? null` — o `?.` o torna usável **antes** de `world` existir, porque o construtor atribui opções.

### Roteamento de jogador e mapa

| linhas | método | papel |
|---|---|---|
| 1156 | `addPlayer(session, {focus, mapId})` | idempotente por id. Semeia `session.mapId` do **argumento**, nunca de `world.map` — senão quem entrasse nasceria no mapa do último focado |
| 1186 | `removePlayer(id)` | deleta e **re-foca** outro jogador (senão `world.inventory` seria `null`) |
| 1202 | `focusPlayer(id)` | seta `world.session` e aplica o contexto do mapa dele. **É isso que faz a travessia de portal afetar só quem atravessou** |
| 1238 | `withPlayer(id, fn)` | foca → `try { fn(session) } finally { world.session = anterior }`. O laço multiplayer inteiro vive dentro |
| 2488 | `contextoDoMapa(map)` | memoizado num `WeakMap` **chaveado pelo objeto do mapa**, não pelo id |
| 2506 | `montarContexto(mapa)` | monta colisão, inimigos, NPCs, props. Faz `zonasDoMapa()` e, se houver, cria um **mapo objeto novo** `{...mapa, zones}` — nunca muta `MAP_1` |
| 2922 | `setMap(map, {chegada})` | escreve `sessao.mapId`, aplica contexto, posiciona, **zera `autoWaypoint`** |
| 2759 | `sincronizarPedidasFora(mapId, ids)` | `clear()` + refill no **`Set` existente** (nunca cópia). É o lado escrito tanto pelo servidor quanto pelo cliente a 20Hz |

**Ponto delicado:** `collision.pedidasFora` recebe o **mesmo objeto `Set`**, não uma cópia. É por isso que a pedra demolida pelo servidor some da colisão do cliente sem sincronização extra.

---

## Tópico 3 — Sessão do jogador

`src/game/engine/PlayerSession.js` (784 linhas) — **a raiz de composição de todo estado por jogador**.

`createPlayerSession(classDefinition, options)` monta, em um objeto só:

- **Identidade**: `id`, `name`, `classId`, `donoKey` (estável entre reconexões), `contaId`
- **Entidades**: `player`
- **Sistemas de estado**: `inventory`, `equipment`, `quests`, `bestiary`, `craft`, `collection`, `bau` (o **segundo** `Inventory`, de 60 slots), `farmOffline`, `guilda`, `passe`
- **Rede**: `intent` (o que o servidor gravou), `input` (o que o cliente mandou)
- **Auto**: `autoPlay`, `engagedTargetId`, `bestiaryTargetType`, `autoWaypoint`, `autoMoveDirection`, `autoFacing`, `travelPlan`, `travelParado`, `skillAuto`
- **Mineração**: `mineracao` + `mineracaoCaminho/Recalcula/Melhor/Travado/Random/SteelNoTique/SteelEm`
- **Habilidades**: `habilidadesAprendidas`, `nosArvore`, `pontosHabilidade`, `lojaComprados`
- **Mundo**: `mapId`, `arenaOrigem`, `mapaTesteOrigem`, `focarLider`, `lootFilter`, `morte`, `messageTick`

> **Regra da背包:** o inventário do jogador e o baú são **dois `Inventory` separados** (20 e 60 slots). Mover entre eles é uma operação de painel, não um atalho.

---

## Tópico 4 — O tick: ordem de execução

A ordem **é o contrato**. Trocar duas linhas muda o jogo.

### `update(deltaTime)` (L10742)

**A. `networked`? → sai cedo (L10762).** No navegador, *nada* é simulado:
`spriteTime += dt` → `updatePresentation` → `hookDePrevisao` (predição) → `updatePassagem` → telegrafias → efeitos → ambiência → painel a 10Hz.

**B. ramo de simulação:**

| ordem | passo | por que nessa posição |
|---|---|---|
| 1 | `world.time += dt` | o relógio do mundo |
| 2 | TTL das mensagens da sessão | |
| 3 | **laço por jogador** — `for (const id of [...players.keys()])` → `withPlayer(id, …)` | |
| 3.1 | `updateCooldowns` | |
| 3.2 | **`updateAutoPlay`** | **zera `autoMoveDirection`/`autoFacing` primeiro** |
| 3.3 | **`runMineracao`** | **depois** do piloto (a direção dele sobrevive), **antes** do `updatePlayer` (vira deslocamento) |
| 3.4 | `atualizaMineracaoVisual` | depois da mineração, antes do movimento, por causa do frame da picareta |
| 3.5 | `updatePlayer` | |
| 3.6 | **`updatePassagem`** | **depois** do movimento: a posição que decide é a do fim do quadro |
| 3.7 | `skillSystem.update` | |
| 3.8 | `coletarDropDoChao` | |
| 3.9 | `statuses.update` | |
| 3.10 | `tryBeberAutoPocao` → painel | |
| 4 | `spriteTime += dt` | |
| 5 | **laço por mapa** — `updateEnemies`, projéteis, flechas, `updateDrops` | **por mapa, não por jogador** — senão um slime perderia N× seu HP |
| 6 | efeitos, ambiência, telegrafias, dash | |
| 7 | painel a 10Hz **só se `!painelExterno`** | no servidor quem pede é o `GameServer` |

**`jogadoresPorMapa()` (L11095)** devolve **um id de sessão por `mapId` distinto**. É o que impede a multiplicação de dano.

### `updatePlayer(deltaTime)` (L11128)

1. hp ≤ 0 → morte, `return`
2. consome `pushVelocity` com amortecimento `exp(-8·dt)`
3. direção = teclado **ou** `sessao.intent.moveX/moveY` (quando `intent.seq > 0`) — **é aqui que o servidor passa a poder mover qualquer um**
4. **qualquer movimento zera a mineração** e os campos de auto
5. `soltarAutoAoAndar()`
6. **arbitragem**: o auto ganha, **exceto** se `autoPlay` está ligado **e** o teclado está produzindo direção
7. `collision.moveEntity`, animação, empurrão de inimigos, resolução de sobreposição
8. facing: `autoFacing ?? pointerFacing`, mais re-encarar em direção ao alvo
9. regen de recurso, DoT, decaimento de animações

---

## Tópico 5 — Mapas e o registro Tiled

### O registro (`src/game/maps/registroDeTiles.js`)

**Este é o ponto mais não-óbvio do projeto.** O `.tmj` só pode ser importado pelo plugin `tiledTmj` do Vite, que **não existe no Node**. Se o motor importasse o `.tmj` direto, o servidor morreria no boot.

Solução: um registro.

- O **navegador** importa os `camada*.js`, que fazem `registrarCamadas("<mapId>", { tmj, imagens, tilesets })`.
- O **servidor** lê os **mesmos arquivos do disco** (`server/src/maps/tilesDoDisco.js`) e registra igual.
- O motor **nunca** vê um `.tmj`; ele pergunta ao registro.

```
navegador: main.jsx → import camadaDoMapa1/camadaDaBase/camadaDoBoss1/
                     camadaDoVale1/camadaDoMapa2 → registrarCamadas()
servidor:  GameServer → registrarTilesDoDisco() → ler o MESMO .tmj do disco
motor:     colisaoDoMapa(id) / tiledDoMapa(id) / zonasDoMapa(id)  ← só consulta
```

`zonasTiled.js` ainda oferece um **hook** (`definirResolvedorDeZonas`) para corrigir os retângulos de zona a partir do Tiled — e o comentário lá explica que o id tem que ser passado por parâmetro para não criar ciclo com `data/enemies`.

### Os cinco mapas

| id | nome | tamanho | papel |
|---|---|---|---|
| `base` | Base | 1664×1152 | hub. `combat: false`. `cameraZoom: 103/64` (escolhido para 64 tiles × zoom = 103px, o que **elimina a emenda** entre tiles) |
| `map_1` | — | 6016×4224 | campanha principal, 12 zonas |
| `map_2` | — | 6016×4224 | continuação, mesmas 12 zonas com prefixo `m2_` |
| `boss_1` | Arena do Chefe | 1664×1152 | arena. `combat: true` |
| `mapa_teste` | **Vale 1** | 6016×4224 | o vale de mineração. `resumeWhereLeftOff: false` |

> **Pegadinha de nomenclatura:** o vale tem **nome "Vale 1"** mas **id `mapa_teste`**, porque o save do jogador pode ter esse id gravado. O `portais/index.js` **duplica** a string `"mapa_teste"` em vez de importar `MAP_TESTE_ID` — o import criaria ciclo.

### Zonas

`MAP_1_ZONES` tem 12 entradas (`pantano`, `pedreira`, `dunas`, `cinzas`, `toca`, `brejo`, `cripta`, `ruinas`, `campina`, `acampamento`, `floresta`, `treino`). Cada uma ganha `mapId` e cores derivadas do terreno.

`MAP_2_ZONES` = cópia com `id: "m2_" + id` e `baseId: id`. O prefixo `m2_` é **obrigatório** em toda referência de zona do mapa 2.

**O `TREINO` é a única zona com `kind: "training"`** e posições explícitas — é onde nascem os dummies.

### Props: o RNG semeado

`createRandom(seed)` é um **mulberry32**. A mesma função serve para:
- as props do mapa 1 (`MAP_1_SEED = 20260929`)
- o roster de inimigos
- os cristais do vale (`MAP_TESTE_SEED = 771402`)
- o sorteio de steel na mineração

**Um único RNG semeado serve a tudo**, e é por isso que o servidor e o cliente concordam no steel de uma batida sem trocar número nenhum.

---

## Tópico 6 — Portais e travessia

`src/data/portais/index.js` (895 linhas) — **folha** da camada de dados: não importa nada. É isso que permite `data/maps` importar `data/portais` sem ciclo.

### A geometria: `raioY` guarda a **altura inteira**

A zona de travessia é uma **elipse**, não um círculo:

```js
raioX = size / 2
raioY = (raioY ?? size) / 2   // o código divide
```

- Passagem de **parede vertical**: `size: 48`, `raioY: 128` → 24px em X, 64px em Y. Precisão em X, tolerância em Y.
- Passagem de **parede horizontal** (topo do mapa): `size: 256`, `raioY: 128` → 128px em X, 64px em Y.
- Sem `raioY`, degrada para um círculo de diâmetro `size`.

O **mesmo método** roda no cliente e no servidor, então a geometria não pode divergir.

### `abreNoDegrau` / `fechaNoDegrau` — portais empilhados

Em vez de um portal com destino dinâmico (que obrigaria todo `findMap(portal.destino)` a resolver um valor que depende do jogador), há **dois portais no mesmo pixel**, mutuamente exclusivos por janela de missão. Tudo num método só, `passagemAberta(portal)` (L3596):

```js
if (abre === undefined && fecha === undefined) return true;  // sem janela = corredor
const degrau = this.world.quests?.mainIndex ?? 0;
if (abre  !== undefined && degrau <  abre)  return false;
if (fecha !== undefined && degrau >= fecha) return false;
return true;
```

| `mainIndex` | topo do mapa 1 (704,150) | vão da arena (864,1100) |
|---|---|---|
| 0–17 | nenhum dos dois | — |
| 18 (missão 1.19, Hulk) | `portal_chefe` → `boss_1` | `portal_chefe_saida_volta` → `map_1` |
| 19+ | `portal_floresta` → `map_2` | `portal_chefe_saida` → `map_2` |

**Esse método é a correção de um bug real:** antes havia três detectores quase idênticos, e o cenário "a tela mostra a arena, a travessia vai pro mapa 2" era o resultado de um deles não saber da janela.

### A travessia

| linhas | método | papel |
|---|---|---|
| 3512 | `updatePassagem()` | Sai da zona → limpa o lacre. Grava a posição. **Suprime o pedido se o jogador não andou ≥1px** — a guarda contra o ping a 60Hz. Online, só notifica; offline, chama `travessarPortal()` |
| 14581 | `chegadaDe(portal, destino)` | acha a chegada pelo `portal.chegada` e empurra **3 tiles (192px) para dentro a partir da borda mais próxima** — borda mais próxima, não centro, porque empate num portal de canto jogaria para fora do mapa |
| 14660 | `travessarPortal()` | recheca `portalLiberado` localmente, **pré-carrega** as folhas do destino (`tiles.precarregar`), `setMap`, e só então `resetarAggroDoMapa()` — limpar antes limparia o mapa que está sendo **deixado**, não o que está chegando |
| 14779 | `dadosDaPassagemPerto()` | raio de 3 tiles (192px), **a mais próxima vence**. Alimenta o aviso do HUD |

**Ligação com as missões:** `portalLiberado(exigeMissaoDe, mainIndex)` vem de `data/quests`. A regra mora em `quests/` e **não** em `portais/` por causa do ciclo `portais → quests → maps → portais`.

---

## Tópico 7 — Colisão e navegação

### `CollisionSystem` (`src/game/collision/`, 568 linhas)

- Hash espacial em células; consulta só o bucket da posição.
- `isPositionFree(position, radius)` — a **única** fonte de verdade de "cabe aqui".
- `moveEntity(entity, dx, dy, entities)` — resolve eixo a eixo e faz **deslizar pela parede** em vez de travar.
- `pedidasFora` — o `Set` das pedras demolidas, injetado.
- `resolveOverlap` — separa o jogador dos inimigos.

**A colisão é montada assim** (`GameEngine.montarContexto`): `new CollisionSystem(map, [...colisaoDoMapa(map.id), ...caixasDosNPCsBloqueantes])`.
- `colisaoDoMapa(id)` são os retângulos do objeto `PAREDES` do Tiled.
- NPCs `blocking` entram como retângulo também.

### `NavGrid` (`src/game/nav/`, 1032 linhas) — o A\*

**Não importa nada.** Fala só com o `CollisionSystem` injetado.

| constante | valor | por quê |
|---|---|---|
| `CELULA` | **40px** | grosso de propósito: uma coluna de 40px contra um raio de 22px dá folga de obstáculo, e o desvio de meio raio é invisível em sprite animado |
| `RAIO` | **22** | o `player.radius` de verdade |
| `FOLGA` | **8** | o "encostado" vs "passando pelo meio" |
| `this.raio` | **30** | `RAIO + FOLGA` |
| `AVANCO_MINIMO` | 8px | passo do amostrador de linha de visada |
| `VAO_SIMPLIFICAR` | **48** | quantos pontos o *string pulling* olha à frente |

**Quatro decisões que valem knowing:**

1. **`andavel` é um `Uint8Array`**, não array — 15.750 células no vale. Precomputado **uma vez** no construtor com `isPositionFree(centro, raio)`.
2. **O centro da célula, não o canto** — canto bloqueia células por onde o corpo passa.
3. **Sem corte de canto** — uma diagonal exige as duas cardinais andáveis.
4. **A\* é determinístico** — mesma origem e destino, mesmo caminho, sempre.

**`#simplificar` (string pulling)**: varre **de trás para frente** a partir de `min(len-1, inicio+48)`, mantendo o ponto mais longe ainda visível. Começa da posição **real** do jogador, não do centro da célula inicial (~28px de diferença).

**`#fecharNoDestino`**: o último centro de célula pode ficar a 28px do destino real — exatamente onde uma sebe é atravessada. Três saídas em ordem: destino alcançável → substitui; alcançável **com folga** → substitui; senão `#ponte`, um ponto médio visível dos dois lados, com **as duas pernas testadas com o raio com folga**.

**Grade justa** (`#gradeSemFolga`, L677): uma **segunda** grade sem folga, montada preguiçosamente, só quando a primeira falha. "Um caminho que raspa é melhor do que nenhum caminho."

**Memoização** (`caminho()`, L700) — **adicionada durante esta sessão**:

```js
chave = "round(x1),round(y1),round(x2),round(y2)"
cache: Map, máx 256 entradas, clear() no estouro
retorna [...guardado]   // CÓPIA, porque todo chamador faz shift()
```

Medido: rota de ~3.500px custa **56–90ms** por chamada; rota curta, **0–5ms**. Com o cache, o caso do piloto **parado** (mesma origem, mesmo destino, A\* determinístico) cai de 90ms para **0ms** a partir do segundo tique.

**Sem cache**, cada tique parado era um congelamento de 60–90ms — mais de três quadros a 60Hz, no meio do tique.

### `rotaDeViagem.js` — o BFS entre mapas

Só importa `data/maps`. Devolve a cadeia de portais que leva de um mapa a outro, ou `null` se não há rota.

---

## Tópico 8 — Auto-play e plano de viagem

É o subsistema mais complicado e o que mais mudou nesta sessão.

### A pirâmide de decisão

```
updateAutoPlay(dt)
 ├─ !isAutoActive()        → limpa tudo
 ├─ player.hp <= 0         → para
 ├─ engagedTargetId != null → runEngagedTarget (ALVO MANUAL VENCE)
 ├─ runTravelPlan(dt)       → true = plano manda (VIAGEM VENCE A CACADA)
 ├─ seguindo && parado      → para
 └─ getAutoObjective() || autoPlay || focoDoLider → runAutoHunt
```

`isAutoActive()` (L4464) = `autoPlay || engagedTargetId || bestiaryTargetType || getQuestObjective()`.
> O comentário em L4350 registra que uma versão anterior testava `autoWaypoint` e `travelPlan` — **errado**, porque os dois mudam todo quadro e não dizem se há auto ligado.

### `destinoDoObjetivo()` — para onde o piloto vai

Ordem **fixa**, e cada passo existe porque um passo anterior quebrava:

| ordem | origem | quando |
|---|---|---|
| 1 | `destinoDoSeguido()` | seguindo alguém — a posição **viva** dofollowed, com o `mapId` **dele** (ler o mapa de quem é seguido fazia a Ana andar para o vazio) |
| 2 | `destinoDoChefe(objective)` | missão de chefe — procura o portal em `findMap("map_1")`, retorna o **centro** do portal |
| 3 | `destinoDoNpc(objective)` | missão de NPC — embrulha num `zone` 96×96 para `reachedQuestZone` ter retângulo (ler `zone.x` de `undefined` derrubava o motor **na chegada**, sem mensagem) |
| 4 | **`destinoDeMinerar(objective)`** | **novo** — só quando `objective.type === QUEST_TYPE.MINE` |
| 5 | `getQuestZone(objective)` | caçada — o centro do retângulo da zona |

`cristalParaMinerar()` (L8663) olha `findMap(MAP_TESTE_ID).props` — **não** `world.props`, porque no instante em que o auto liga o jogador ainda está no mapa 1 e o vale não tem cristal nenhum no `world` dele. Filtra `cristal_comum`, tira as gastas, e pega a mais próxima.

### O plano

`travelPlanParaObjetivo()` (L8953):
- `mapaAtual` é `let` e **avança por portal**
- rota = `rotaDeMapas(mapaAtual, destino.mapId)`; `null` → limpa e `return false`
- **só refaz quando o destino muda** (cache por `destinoX/Y/MapId`)
- uma etapa por portal + a etapa final
- **só a etapa final carrega `prop`** — as de portal não, porque terminam numa passagem e o pedido de minerar dispararia aonde o jogador está a caminho da pedra, não nela

### `runTravelPlan(dt, player)` (L9099) — ~730 linhas

| passo | o que faz |
|---|---|
| 1 | `pickAutoTarget()` só vence se `alvo.id.replace(/_\d+$,"") === objetivo.target` — a rigidez existe porque a missão de chefe tem `location: "arena"`, `getQuestZone()` dá `null`, e sem isso **qualquer** criatura próxima cancelava a caminhada |
| 2 | plano vazio → `travelPlanParaObjetivo()` |
| 3 | replanejar ao seguir o líder (0.4s **e** 96px) |
| 4 | **ramo do plano velho (L9349)**: `etapa.mapId !== world.map.id` **e** `etapa.destinoMapa === world.map.id` → a etapa foi **cumprida**, só consome. Senão o plano morreu, descarta e refaz. **Sem essa divisão**, chegar pela passagem descartava etapas válidas e depois não conseguia recriá-las — o auto desligava sozinho no meio do mapa |
| 5 | **mineração cede aqui (L9400)** — limpa lache, plano e waypoint |
| 6 | `#contarTravelParado` |
| 7 | travado: `> 0.8s` com `caminho.length > 1` → `shift()` de um waypoint; sozinho → `= TRAVEL_TRAVADO_LIMITE`; `> 3s` → `caminho = null` (refaz a grade) |
| 8 | chegada: portal por `portalSobOsPets().portal.id === etapa.portalId`; normal por `hypot < TRAVEL_CHEGADA + TRAVEL_CHEGADA_CELULA` |
| 9 | A* do `NavGrid`; **etapa de portal acrescenta o centro como último ponto** — a grade para no centro da última célula livre, que para uma passagem de 8px fica a ~57px |
| 10 | `overridePortal` a <160px → vai direto ao centro, `raioChegada = 2` |
| 11 | consumo de pontos com `while` e **dois** testes: "cheguei" **e** "já passei" |
| 12 | `autoWaypoint = proximo`; `raio = portal ? 2 : 24`; `pedirMinerarNaPedida`; `walkToward` |

### `#contarTravelParado` (L9883) — o detector de travamento

**É o que foi reescrito nesta sessão.** A versão anterior comparava o jogador com a posição do quadro anterior e chamava isso de "travado":

```js
const andou = Math.hypot(player.x - travelUltimaX, ...) > 4;
this.travelParado = andou ? 0 : this.travelParado + deltaTime;
```

Isso só detecta quem está **parado**. O sintoma real era **vaivém**: o jogador muda de posição todo quadro, então `andou` dava `true` toda vez, o contador **zerava a cada tique** e o limiar nunca era alcançado. O detector era **cego para o defeito que ele existia para achar** — e por isso todo limite novo era inalcançável.

A versão atual mede **progresso ao alvo**:

```js
const dist = Math.hypot(alvoX - player.x, alvoY - player.y);
const avancou = melhorDist === null || dist < melhorDist - 4;
```

Só "ficar mais perto" zera. Oscilar de **qualquer tamanho** não engana. E usa o alvo **do quadro anterior** — a pergunta é "no tempo que eu mandei aquele ponto, ele se aproximou?".

Guarda: sem alvo, ou `!statuses.canMove`, o contador volta a zero. Atordoado não é estar preso.

### O consumo de waypoints

Dois testes no `while`:

```js
const chegou = distAtual < raioChegada;
const passou = seguinte !== undefined &&
  Math.hypot(seguinte.x - player.x, seguinte.y - player.y) < distAtual;
if (!chegou && !passou) break;
```

O segundo é o que mata a "travadinha": exigir o centro exato da célula (40px) dentro de 24px é margem apertada demais. Se o próximo ponto já está mais perto, o jogador **já passou** e o caminho já virou.

---

## Tópico 9 — Mineração

### O modelo: **a jazida é do mapa, o relógio é da sessão**

| onde | o quê |
|---|---|
| `GameServer.minasPorMapa: Map<mapId, Map<propId, {batidasRestantes, voltaEm, mineradaPor}>>` | estado da jazida, **por mapa**, nunca por sessão |
| `sessao.mineracao` | o pedido: qual pedra, o relógio, o lacre `alcancado` |

**Três detalhes que sustentam o sistema:**

1. **`abrirPedida`** cria a entrada na primeira vez que alguém encosta. Antes disso a pedra tem "batidas totais" implícitas.
2. **`pedidaNoMapa(mapId, propId)`** é a **porta antifalsificação**: um id de outro mapa devolve `null`. O cliente não consegue minerar a pedra de um mapa em que não está.
3. **`minerar(sessao, propId, agora)`** é **um método, duas direções**: se já existe mineração, ele **para aquela** e devolve sucesso. Por isso o motor precisa de um **lache** (`pedidoDeMinerar`) para pedir uma vez só.

### O relógio só liga quando o jogador encosta

`sessao.mineracao.proximoGolpeEm` começa `null`. No **primeiro tique** em que o motor escreve `alcancado = true`, o servidor arma `proximoGolpeEm = agora + SEGUNDOS_POR_BATIDA*1000`.

> Sem isso, uma caminhada de 25s dava duas batidas de steel com o boneco atravessando o vale — o jogador recebia por minerar algo em que não estava encostado, e o painel apareceria mostrando tempo demais pela metade.

`alcancado` é um **lacre, não um estado**: liga e nunca desliga. Quem zera é o `minerar` do servidor, no pedido novo.

### O lado do motor

| linhas | método |
|---|---|
| 10246 | `runMineracao(dt)` — revalida a pedra, laca na chegada, watchdog de avanço, caminho em `sessao.mineracaoCaminho` recalculado só quando acaba e passou `RECALCULA_CAMINHO_S` (0.5s) |
| 10467 | `vigiarAvancoDaMineracao` — sem progresso por `MINERACAO_TRAVA_S` (4s), solta o pedido pelo mesmo canal do cancelamento por teclado |
| 10520 | `pedidaEm(point)` — a pedra sob o clique (o inimigo tem prioridade sobre a pedra) |
| 10566 | `pedidaMineravel(mapId, propId)` |
| 10589 | `encostadoNaPedida(player, prop)` |

**A última perna não usa `walkToward`**: escreve `autoFacing`/`autoMoveDirection` direto, porque a condição de parada real é `encostadoNaPedida` (40px), não a proximidade do alvo.

### A missão 1.6 no auto (novo)

`QUEST_TYPE.MINE` entrou em `AUTO_TYPES` (e por consequência em `TIPOS_COM_DESTINO`). Sem isso, `temDestinoDeAuto` devolvia `false`, o `objective()` devolvia `null`, e o auto ligava **sem destino nenhum**.

O fluxo completo:
1. `destinoDeMinerar()` devolve o cristal + `mapId: MAP_TESTE_ID`
2. o planejador atravessa o portal do vale normalmente
3. `pedirMinerarNaPedida()` dispara `onMineClick` a 200px da arte, **uma vez** (lache)
4. `runMineracao` fecha o resto e laca `alcancado`
5. o servidor conta a batida → `quests.onAcao("mine")` → **a missão fecha sozinha**
6. mineração termina → plano limpo → a 1.7 vira o objetivo → o auto segue

---

## Tópico 10 — Missões

`src/data/quests/index.js` (2361 linhas).

### A escada

`ESCADA_MAPA_1` tem **12 degraus** + o degrau do chefe (nível 20, `hulk`, `zona: "arena"`). `ESCADA_MAPA_2` tem 11. Concatenadas: 23.

**Sete tutoriais** são encaixados no meio da escada, cada um depois de um degrau nomeado (`depoisDo`):

| # | tipo | depois de |
|---|---|---|
| 1.2 | craft | O Pantano |
| 1.4 | enchant | A Pedreira |
| **1.6** | **mine** | **As Dunas** |
| 1.8 | enhance | O Vale das Cinzas |
| 1.10 | deliver | A Toca dos Ratos |
| 1.12 | buy | O Brejo |
| 1.14 | learnSkill | A Cripta |

Resultado: **`MAIN_QUESTS` tem 30** e **`SIDE_QUESTS` tem 23** — uma por degrau, metade da quantidade, metade do ouro, **mesmo XP e mesmo material**.

### Três conjuntos de tipos, e eles não são a mesma coisa

| conjunto | conteúdo | quem usa |
|---|---|---|
| `AUTO_TYPES` | hunt, kill, **mine** | `isAutoCompletable` — "o auto pode fazer isto sozinho?" |
| `TIPOS_COM_DESTINO` | `[...AUTO_TYPES, learnSkill]` | `temDestinoDeAuto` — "o piloto tem para onde andar?" |
| `TIPOS_DE_TUTORIAL` | craft, enchant, enhance, mine, deliver, learnSkill, buy | `QuestLog.onAcao` — "isto conta como progresso?" |

A separação é deliberada: uma caçada tem `location`; a mineração tem uma **prop**; um tutorial de craft não tem destino nenhum, e sim um painel.

**`PAINEL_DO_TUTORIAL`** mapeia tipo → painel (`craft`→craft, `enchant`→enchant, `enhance`→enchant, `deliver`→collection, `buy`→loja). **`mine` está de fora de propósito** — não é painel, é um clique numa pedra.

### O balanceamento

`CURVA_POR_MAPA = { map_1: {inicio:10, fim:24}, map_2: {inicio:24, fim:48} }` com interpolação **geométrica** e `Math.round` (não `floor`: `1.091^6` dari 16 num degrau que deve custar 17).

`PREPARA_PARA` garante os materiais dos tutorials: Pantano `+5 osso_quebrado`, Pedreira `+1 aljava_arbalist`, Toca `+20 osso_quebrado`, **Cripta `+1 livro_quick_shot`** (que não dropa de ninguém).

### Numeração e trava de portal

`numeroDaMissao("map_1_main_19_limo_arena")` → `"1.19"`. Re-indexa por mapa, então o mapa 2 mostra `2.x` e nunca `2.19`.

`portalLiberado(exigeMissaoDe, mainIndex)`, `dadosDaTrava`, `entradaNaArena(mainIndex)` — a arena só abre **enquanto a missão atual é o degrau do chefe**.

---

## Tópico 11 — Itens, materiais e raridades

### O quebra-ciclo

```
items/raridade.js  ──RARITY──▶  materiais/index.js  ──▶  items/index.js
      (folha)                                        (re-exporta RARITY*)
```

`items/raridade.js` existe **só** para quebrar o ciclo. `items/index.js` importa `materiais` e re-exporta `RARITY*`, para os ~100 call sites de `import { RARITY } from "data/items/index.js"` continuarem funcionando.

### As 5 raridades

`common`, `uncommon`, `rare`, `epic`, `legendary` com pesos de drop `62 / 24 / 10 / 3.4 / 0.6`, escala de stat `0.7 / 0.85 / 1 / 1.2 / 1.45` e escala de custo `0.5 / 0.75 / 1 / 1.7 / 2.8`.

### Os 12 materiais × 5 graus = 60 itens

Quatro famílias, três materiais cada:

| família (mob) | materiais |
|---|---|
| Esqueleto (`slime`) | `osso_quebrado`, `tendao_ressecado`, `essencia_necrotica` |
| Goblin (`ogre`) | `couro_goblin`, `minerio_bruto`, `pedra_verde_bruta` |
| Kaelen (`skeleton`) | `fragmento_de_ferro`, `couro_reforcado`, `fragmento_de_aco` |
| Nylara (`zumbi_arbalist`) | `madeira_de_lanca`, `tecido_militar`, `aco_temperado` |

Cada base abre sua **própria** cadeia com 4 graus (`reforcado`, `resistente`, `refinado`, `lendario`). `couro_goblin` e `couro_reforcado` são **cadeias diferentes**, não graus da mesma.

O valor multiplica por 5 a cada grau: ×1, ×5, ×25, ×125, ×625.

### Os acessórios (novo nesta sessão)

`anel` e `amuleto_arqueiro` foram **removidos** e substituídos por **seis** peças — três anéis e três amuletos, um por atributo. O `id` **é** o nome do arquivo:

| id | stats | arte |
|---|---|---|
| `anel_de_forca` | ATK +3 | `assets/Items/acessorios/anel_de_forca.png` |
| `anel_de_mana` | MP +8, MP Regen +1 | `anel_de_mana.png` |
| `anel_de_vigor` | HP +14, HP Regen +1 | `anel_de_vigor.png` |
| `amuleto_de_forca` | ATK +5, DEF +2 | `amuleto_de_forca.png` |
| `amuleto_de_mana` | MP +14, MP Regen +2, MATK +3 | `amuleto_de_mana.png` |
| `amuleto_de_vigor` | HP +24, HP Regen +2, DEF +3 | `amuleto_de_vigor.png` |

> **O amuleto sempre bate mais que o anel** porque são **dois slots** (`trinket1` e `trinket2`). Com o mesmo número nos dois, a segunda aba seria sempre a escolha errada.

Slots (`Equipment.js:118,124`) continuam se chamando **"Anel"** e **"Amuleto"** — são os **slots**, não os itens. As seis peças não têm `slot`, então o jogador escolhe em qual dos dois equipar.

Tirar dois itens e pôr seis não foi só no catálogo: as **6 receitas**, as **3 tabelas de drop** (`enemies`) e a **tabela de drop genérica** (`rules/regrasDoItem`) apontavam para os ids antigos.

### A regra do Vite para arte

> **Todo asset precisa de `new URL("<caminho literal>", import.meta.url).href`, escrito por extenso.**

Um caminho montado com template string **não é seguido** pelo bundler: o pacote sai sem a arte, **sem erro nenhum**, e o jogador vê o glifo de reserva. Dois motivos: o Node resolve `new URL` para string sem abrir o arquivo (enquanto `import url from "x.png"` mata o processo com `ERR_UNKNOWN_FILE_EXTENSION`), e o Vite reescreve o literal para a URL com hash.

---

## Tópico 12 — Craft

`src/data/craft/index.js` (865 linhas) — **o nó de dependência mais pesado da camada de dados**: importa `enemies`, `maps`, `items` e `materiais`.

### A escala de raridade

`GRAU_DA_RARIDADE = { common: null, uncommon: "reforcado", rare: "resistente", epic: "refinado", legendary: "lendario" }`.

O helper `m(baseId, grau, quantidade)` devolve um **par**, não objeto: `m("osso_quebrado", "reforcado", 3)` = 3 ossos reforçados.

### As receitas

- **`RECEITAS_DE_REFINO`**: 48, geradas. Material → material do grau anterior, ×5, **custo zero** (é reprocessar, não trabalhar).
- **`EQUIPAMENTOS`**: 27 escritas à mão, cada uma com **cinco linhas** (uma por raridade).
- Total `RECIPES` = 75 → `CRAFT_VARIANTS` = **375** (75 × 5).

`receitaDeEquipamento` calcula o ouro: `round(60 × [1, 1.5, 2.5, 4, 6.5][rarityIndex])`.

### As abas do painel

`CRAFT_CATEGORIES` deriva de `ITEM_TYPE` na ordem `WEAPON, ARMOR, TRINKET, MATERIAL`, com `label` vindo de `ITEM_TYPE_LABEL` — **exceto `TRINKET`, que tem rótulo próprio, "Acessório"**.

> **Por que só no craft:** o mesmo `ITEM_TYPE_LABEL` aparece no mercado, no tooltip e no painel de encantamento. Trocar lá mudaria quatro telas sem ninguém pedir. A aba do craft é a única que o jogador escolhe **pelo nome**.

`Acessório` tem as 6 receitas com as 5 raridades cada.

---

## Tópico 13 — Inventário e equipamento

`Inventory` (1054 linhas) — pilhas com `uid`, `capacity`, empilhamento por tipo, filtro de loot.

**`pilhasVestidas()`** foi corrigido nesta sessão: devolvia um `Set` de uidsconsiderados "vestidos", e com isso equipar **uma** de duas peças iguais escondia **as duas**. Agora devolve conjunto vazio — a peça equipada continua visível, que é o comportamento simétrico com o filtro de loot.

`Equipment` (708 linhas) — os slots, `slotForItem` (entrega o primeiro slot que aceita o tipo), `bonuses()` e `enchantBonuses(stats)`.

**A regra dos dois slots de relíquia:** `trinket1` e `trinket2` ambos aceitam `ITEM_TYPE.TRINKET`. Com `slot: null` no item, o jogador escolhe; com `slot` fixo, o segundo ficaria sempre vazio.

O **bau** é um `Inventory` **separado** (60 slots), com operações próprias de mover — não um filtro do inventário.

---

## Tópico 14 — Stats: a fórmula única

`StatSheet.js` (862 linhas) é a **única** fonte de verdade de como um stat é calculado. O painel de status e o cálculo de dano leem a mesma função — é o que impede os dois de discordarem.

`applyEquipment()` (L6225) funde **seis** fontes, nesta ordem exata:

```js
mergeBonuses(
  world.equipment.bonuses(),
  world.equipment.enchantBonuses(stats),   // só esta recebe stats
  world.bestiary.bonuses(),
  world.collection.bonuses(),
  this.guildBonuses(),
  bonusDaArvore(session.classId, session.nosArvore),
)
```

`mergeBonuses` soma **por chave**. Um `Object.assign` deixaria o equipamento sobrescrever o bestiário.

**Só o afixo de encantamento recebe `stats`** — porque ele é uma *fração* de um stat base, e passar o jogador inteiro comporia o efeito.

Depois: `maxHp = stats.hp + growth.maxHp + bonus.maxHp`, o HP é preenchido pelo delta e limitado a `[0, maxHp]`, e `player.stats = buildStatSheet(...)` é montado — de onde `accuracy` e `evasion` são lidos de volta. **Uma fórmula só.**

`guildBonuses()` é o quinto termo e o único que lê estado compartilhado (`guildStore`), guardado por `if (!this.guildStore) return {}`.

---

## Tópico 15 — Habilidades e árvore

- `data/skills/index.js` — `SKILL_PACKS` por classe: as 4 primeiras + uma slot de ultimate. `ULTIMATE_NIVEL = 6`.
- `data/skills/tree.js` — geometria da árvore (`PALCO`, `PONTOS_POR_NIVEL`, `TAMANHO_DO_NO`) e as regras `noDaArvore`, `nosDisponiveis`, `bonusDaArvore`, `nosConfiaveis`.
- `data/skills/books.js` — catálogo de livros da loja; `validarLivros` confere contra `items/index.js`.

`learnTreeNode(noId)` (L5326) valida em ordem: o nó existe → não é_owned → `level >= no.nivel` → todo `no.exige` é possuído → pontos >= `no.custo`.

**O detalhe que importa:** o nó da árvore despeja a habilidade no **mesmo `Set` `habilidadesAprendidas`** que um livro usaria. **Um campo de save, não dois.**

E termina em `applyEquipment()` — os números mudam **agora**, não quando outro painel abrir.

---

## Tópico 16 — Inimigos, IA e telegrafia

### Comportamentos

`PASSIVE` (só reage se for atacado), `SEMI_PASSIVE` (`aggroRange: 0` mas tem `alertarAliados`), `ACTIVE`.

| criatura | papel | nível |
|---|---|---|
| `slime` | PASSIVE + `retalia` | 1 |
| `rat` | PASSIVE | 2 |
| `goblin` | SEMI_PASSIVE | 5 |
| `ogre_da_predeira` | SEMI_PASSIVE | 7 |
| `ogre` | SEMI_PASSIVE | 8 |
| `ghoul` | SEMI_PASSIVE | 8 |
| `skeleton` (Kaelen) | ACTIVE | 11 |
| `zumbi_arbalist` (Nylara) | ACTIVE | 12 |
| `hulk` | ACTIVE, chefe | 20 |

`CREATURE_GROWTH`: hp +0.22, dano +0.16, defesa +0.12 por nível.

### Regra de posse (importa para o auto)

`mobDeOutroJogador(enemy)` (L8296): **um mob pertence a quem já o danificou** (`lastHitBy`). Mesmo dono → meu. **Mesma party** → meu (cacada em grupo). Qualquer outra coisa → não meu.

### Telegrafia

`telegraphSkills.js` define as habilidades; `TelegraphSystem` as executa; `TelegraphRenderer` desenha. `telegraphGeometry.js` resolve as formas (cone, anel, linha).

`estadoInimigos` no servidor manda **só a execução mais recente**, com `servidorEm` (o `world.time` do servidor) para o cliente alinhar o relógio, e **só as medidas que aquele tipo usa** (`raio`, `alcance`, `largura`, `anguloGraus`).

**`DAMAGE` deliberadamente exclui** `danoAplicado` e `tipoHabilidade`: o cliente não deve saber o número antes de o ver chegar.

### O mapa 2 é o mapa 1 com os nomes trocados

`MAP_2_ROSTER` é derivado: mesmas zonas, mesmas contagens, mesmas posições; os tipos renomeados (`ogre`→`skeleton`, `ogre_da_predeira`→`skeleton`, `slime`→`zumbi_arbalist`), pesos somados, nível trocado pela escala. **`behaviors` são descartados** nos tipos renomeados, para a Nylara continuar `ACTIVE`.

O `createCreatureRoster` também garante que **nada nasça perto de um portal** (`PORTAL_ZONA_SEGURA = 620 + size/2`).

---

## Tópico 17 — Props, loot e chefe

### As quatro pedras

| tipo | raio | colisor | sólido | **batidas** |
|---|---|---|---|---|
| `cristal_comum` | 31 | 20 | 58×71 | **5** (50s) |
| `cristal_raro` | 33 | 21 | 59×74 | **9** (90s) |
| `cristal_epico` | 34 | 22 | 62×78 | **14** (140s) |
| `cristal_lendario` | 37 | 24 | 68×85 | **20** (200s) |

O vale tem **40 cristais** gerados por RNG semeado: 2 lendários, 5 épicos, 10 raros, **23 comuns** — e nenhum nasce no retângulo livre do centro.

`solidoNaArte: true` — o colisor segue a arte, não um `prop.x`. Sem isso, uma arte de 139×180 (o lendário) teria um colisor do tamanho de um tile, e um inimigo encostado nela viraria mineração em um clique.

### Drop

**A regra:** **qualquer monstro dropa a peça de qualquer classe.** O drop não tem relação com a classe do jogador; o que trava a classe é o **craft**.

As tabelas são por "andar de campanha": `quebrado` (nível ≤3), `comum` (4–7), `refinado` (≥8). `trocarEquipamentoPeloAndarDaCriatura()` reescreve a `loot.items` de cada criatura uma vez, no load.

### Chefe

`createBosses(map, sessaoId)` (L404) usa o **mesmo `createCreature`** de um mob normal — mesmos `maxHp`, `loot`, `xp`, `spriteScale`. O `index` começa em **9000** para nunca colidir com o id de um mob do roster.

O gancho de morte é por **mapa**, não por criatura:

```js
if (this.world.map?.bosses?.some(b => b.creature === enemy.typeId))
  this.onChefeDerrotado?.({ enemy, dono, map: this.world.map });
```

Um mapa novo com um chefe não exige mudar o motor.

---

## Tópico 18 — Arena e chefe por jogador

### As saídas sobrepostas

Dois portais no mesmo pixel do vão da arena, por janela de missão — ver [Tópico 6](#tópico-6--portais-e-travessia). A arena não expulsa mais ninguém na vitória; quem matou escolhe a saída.

### Chefe por sessão

`bossPorJogador: true` em `boss1.js` faz `createBosses` carimbar `inimigo.sessaoDe = sessaoId` e sufixar o id. O snapshot do servidor **filtra** chefes de outra sessão, e o `EnemyAI.nearestPlayer()` filtra pelo dono.

### Vitória

`marcarChefeVencido(sessaoId, mapaId)` escreve no `ARENA_VENCIDA`. `createBosses` lê antes de criar: se o chefe já foi vencido, **não cria**. É em memória — reiniciar o servidor traz o Hulk de volta.

### O lock

`arenaOcupadaPor(sessao)` (L3715) é `true` se **qualquer outro cliente** conectado tem `session.mapId === ARENA_ID`. Itera `clients.keys()` — **não** `world.players`, que é o mapa focado.

O lock foi adicionado ao **fluxo de portal** (`travessarPortal`). `irParaArena`, o caminho legado do botão, tem o lock **na entrada** mas via `entradaNaArena(mainIndex)` — é a função de missão que barra, não o lock de ocupação.

### Voltas

- Morte na arena → `voltarParaPortalDoChefe()`: vai ao mapa 1, 3 tiles da passagem do chefe.
- `voltarDaArenaParaOrigem()`: lê `sessao.arenaOrigem`, limpa, e `setMap(mapa, {chegada: {x, y}})`. **O detalhe é a chave**: passar `{x, y}` errado usaria silenciosamente o spawn do mapa.

`arenaOrigem` fica **na sessão, nunca no save**.

---

## Tópico 19 — Servidor e autoridade

`server/src/domain/GameServer.js` — **7600 linhas**.

### Boot (`server/src/index.js`)

| ordem | o quê |
|---|---|
| 1 | `express()` + `node:http.createServer(app)` — **um servidor, HTTP e WS juntos** |
| 2 | CORS `*` — temporário, o próprio código diz que a correção é allowlist de origem exata |
| 3 | `SEGREDO_DO_TOKEN`: sem segredo, `contas = null` e `emissor = null`, com aviso — o servidor **sobe assim mesmo** |
| 4 | `ligarRedeDeSeguranca()` **antes** de `jogo.start()` |
| 5 | `GameServer` + `WebSocketServer({server: http, path: "/ws", maxPayload: 8*1024})` |

`perMessageDeflate` com `threshold: 1024` porque um painel tem 154KB, dos quais 112KB são o catálogo de receitas.

### O laço (`avancarTempo` → `tick`)

1. `dropsDoTick` zerado
2. **`engine.update(delta)`** — a simulação inteira
3. `expirarAnuncios()` — o mercado expira mesmo sem ninguém agindo
4. `parties.tick(world)`
5. **`tickMineracao(agora)`** — antes do laço por sessão, para uma pedra que respawnou neste tique estar visível neste tique
6. laço por sessão de mineração — **depois** do `engine.update`, porque "ainda adjacente" depende da posição deste tique
7. `SNAPSHOT` por cliente, cada um dentro de `withPlayer`
8. painel a cada 5 ticks (**4Hz**)

**Saúde do laço:** `try/catch` por tique; no erro, zera o acumulador e incrementa `errosDeTick`, que zera no primeiro tique bom. **Para o laço após 3 falhas seguidas.** `/health/laco` responde **200 ou 503** conforme `saudeDoLaco().rodando` — existe porque `/health` ficava verde enquanto `errosDeTick` já tinha congelado o mundo.

### O que é do servidor, e por quê

| sistema | por que o cliente não pode forjar |
|---|---|
| **movimento** | o pacote é um **vetor de direção**, nunca posição; `parseInput` normaliza para comprimento ≤1; as paredes vêm do mesmo `.tmj` |
| **mineração** | a jazida é por mapa; o RNG é semeado pela hora de chegada; `batidasRestantes` decrementa no servidor |
| **combate** | `DAMAGE` é push-only para atacante e vítima; HP e `restamMorte` vêm do servidor |
| **economia** | todo movimento de moeda/item acontece no `GameServer`, porque precisa de duas sessões ao mesmo tempo |
| **progresso de missão** | `onAcao("mine")` dispara no servidor, na batida |

**E o que é do cliente:** renderização, input, **previsão de movimento**, e o **caminho do piloto** (A* local). O servidor nunca vê o plano de viagem — ele só obedece ao vetor de direção.

### A troca de contexto

`withPlayer(id, fn)` é o que torna um motor único possível para N jogadores. Todo o laço multiplayer vive dentro dele.

---

## Tópico 20 — Protocolo e rede

`src/shared/protocol.js` (1546 linhas) — importado **literalmente** pelos dois lados. `server/src/contracts/protocol.js` é só um re-export para o caminho antigo.

### Versão

`PROTOCOL_VERSION = 1`, checada **duas vezes**: no fio (`parseCommand` rejeita com `BAD_VERSION`) e na descoberta (`GET /api/version`, `/health`, ecoada no `WELCOME`).

`SERVER_CONFIG.protocolVersion` é documentação — **nada lê**.

### Envelope

`createCommand` / `createEvent` → `{protocolVersion, type, payload, timestamp}`. JSON puro.

### Cliente → servidor: 5 comandos

`JOIN`, `INPUT`, `ACTION`, `PANEL`, `PING`.

**`parsePanel` (L937–1451) é uma reconstrução por whitelist**: valida `op ∈ PANEL_OPS` e **reconstrói o payload campo a campo**. Tudo que não está na lista é descartado em silêncio. `parseInput` normaliza o vetor; `parseAction` limita `slot` a 1–9.

### Servidor → cliente

`WELCOME`, `SNAPSHOT`, `PLAYER_STATE`, `REJECTED`, `PLAYER_JOINED`, `PLAYER_LEFT`, `PONG`, `PARTY_INVITE_RECEIVED`, `PARTY_INVITE_CLOSED`, `DAMAGE`.
(`LOOT` e `PARTY_STATE` são **declarados e nunca emitidos** — o loot viaja em `session.message` dentro do `PLAYER_STATE`, e a party é escrita em `sessao.party`.)

### `PLAYER_STATE` tem **um só produtor**

`engine.sendSnapshot()`. O mesmo formato que o HUD offline consome. **Online e offline não podem divergir** porque é literalmente a mesma função.

### O painel é caro: 154KB

Por isso o par `painelExterno` / `painelSolicitado`:
- `painelExterno` = "o dono do painel é quem chama, não o timer de 10Hz do motor" (ligado pelo servidor)
- `painelSolicitado` = "esta construção específica tem cliente"
- `painelExterno && !painelSolicitado` = "uma ação de combate disparou uma reconstrução que ninguém vai ler"

E o `Client.enviar` **descarta `PLAYER_STATE` quando `bufferedAmount > 1MB`** — um estado cheio é substituído pelo próximo, então é o caminho de recuperação para socket lento.

### Previsão e reconciliação

`WorldState` guarda `atual`/`anterior`/`primeiro` e **descarta pacote com `seq <= this.seq`**. Interpola entre os dois. `t = 0` devolve o pacote **anterior** de propósito.

`Previsao` (client): `LIMIAR_ESTALO_PX = 48` — erro acima disso é **snap duro** (o servidor está certo: parede, teleporte, knockback). Abaixo disso o erro é *substituído* numa fila, nunca acumulado.

**Sem replay de input** — decisão documentada: `updatePlayer` também resolve knockback, dash, mineração e sobreposição de props, então rollback clássico não caberia.

`eu` **não** é interpolado: a previsão precisa da amostra autoritativa mais recente, não de uma mistura.

### Sem reconexão

`GameClient.onclose` **não reabre**. A fila é limpa de propósito, para uma reconexão não repetir `INPUT` velhos. Reentrar é remontar a cena, o que exige um token novo do front.

---

## Tópico 21 — Painel: o contrato com a UI

`sendSnapshot()` (L12954, ~510 linhas) monta **um objeto só** com ~35 chaves. Três guardas, em ordem:

1. `if (!this.onSnapshot) return`
2. `if (!this.world.session) return` — sem isto, uma exceção **dentro de um `setInterval` do servidor mata o timer**
3. **`if (this.painelExterno && !painelSolicitado) return`**

As chaves, e o que cada painel lê:

| chave | painel |
|---|---|
| `inventory` | Inventário, Bau, Craft, Market, Guild, Enchant, Config, Loja |
| `equipment` | Equipamento (boneco), Craft, Enchant |
| `quests` | QuestPanel, HUD tracker |
| `craft` | CraftPanel |
| `market` | MarketModal, CreateListingModal |
| `guilda` | GuildPanel |
| `collection` | CollectionPanel |
| `bestiary` | CodexPanel |
| `bau` | BauPanel |
| `mineracao` | MineracaoPanel |
| `passe` | PassePanel |
| `loja` | LojaPanel |
| `rank` | RankingPanel |
| `party` | PartyBox |
| `autoPocao` | slot de poção, ConfigPanel |
| `player` | **quase tudo** (stats, level, classe, HP, resource) |
| `passagemPerto` | o aviso de passagem do HUD |
| `portal` | PortalBox |
| `teleporte` | TravelBox |
| `morte` | DeathPanel |
| `selectedTarget` | o painel de alvo |
| `message` | `.game-message` |
| `farmOffline` | OfflineFarmModal |

> **O HUD recebe `estado.painel`, que é o painel privado** — não o `SNAPSHOT` do mundo. `mapa` e `conviteParty` vêm **fora de banda**, por motivos documentados.

---

## Tópico 22 — A UI em React

### A árvore

```
index.html / jogo.html
 └─ main.jsx  →  importa os 5 camada*.js (registro Tiled)  +  os 3 CSS
     └─ <React.StrictMode>
         ├─ <App />          decodifica o token, guarda a entrada
         └─ <TooltipGlobal />
 └─ se estiver em iframe: postMessage de prontidão e recepção do token

App → TestMapScene → GameCanvas (dona do engine) + HUD (lê o painel)
```

### `GameCanvas.jsx` — a ponte

- Cria o `GameEngine` no mount e `destroy()` no cleanup.
- **`engine.hookDePrevisao`** é a costura: recebe `dt`, lê o `intencaoAtual` **de dentro do callback** (para que aponte sempre para o cliente atual) e chama `NetworkWorld.prever(dt)`.
- `engine.onMineClick = (prop) => onIntentRef.current?.minerar(prop.id)` — **é este gancho que o auto da missão 1.6 usa**.
- `engine.onPassagemEntrou` → `intencao.atravessarPortal(portalId)`.
- Todo callback é guardado em **ref**, porque props mudam de identidade a cada render e qualquer efeito que dependa delas remontaria o engine.
- O `classList.toggle` do cursor é feito direto no DOM, não por state — vira várias vezes por segundo.

### `useGameClient.js` — ~90 wrappers

Um `useCallback` por método do `GameClient`, todos passando por `comCliente(acao)`, que devolve `false` se não há cliente.

**A decisão mais importante do arquivo:** o objeto `intencao` retornado é **memoizado à mão por um ref**, e só troca de identidade quando `status`, `erro`, `recusa` ou `conviteParty` mudam. Sem isso, o `keydown` da HUD era re-registrado **20× por segundo** — o parent re-renderiza a cada snapshot.

`onDano` é **guardado em ref de propósito**, fora do `useState`, para não re-renderizar a cada golpe.

### `HUD.jsx` — 5763 linhas

- **17 painéis** num `const PAINEL`. O invariante é **um painel de cada vez**, garantido por **atribuição** (`setPainelAberto(atual => atual === id ? null : id)`) em vez de uma lista de "fecha os outros dois".
- **11 atalhos**: I, Q, B, C, H, L, K, P, X, G, M. **A história está nos comentários** — `H` era `T`, que colidia com o auto-play; `L` era `R`, que colidia com a ultimate; `X` era `T`; `P` era `S`, uma das teclas de movimento.
- **Prateleira esquerda** (7 botões): status, craft, guilda, encantar, bestiário, coleção, **árvore de habilidade** (o último é novo nesta sessão). Inventário **não** está na prateleira — é o botão `.hud-pouch` dentro do `.hud-vitals`.
- **Prateleira direita** (5): mercado, loja, rank, passe, engrenagem (**abre a pausa**, não o painel de config).
- **Barra de ação**: rodapé, quick-shot, slot de poção, slots de skill, dash, auto, ultimate, trilho de XP.

---

## Tópico 23 — `front_rpg` (SSR) e a carteira

Front separado: **React 19 + TanStack Start (Nitro) + Tailwind 4**, em `front_rpg/`. **React 19 no front, React 18 no jogo** — são dois apps.

### Rotas

| rota | arquivo | papel |
|---|---|---|
| `/` | `index.tsx` | landing |
| `/auth` | `auth.tsx` | conectar MetaMask |
| `/characters` | `characters.tsx` | criar/escolher personagem |
| `/jogo` | `jogo.tsx` | o **iframe** que embute o jogo |
| `/wallet` | `wallet.tsx` | lápide — redireciona para `/auth` |

Roteamento por arquivo: `src/routes/`. **Não existe** `pages/`, `layouts/` nem `server/routes/`.

### O handshake do token

```
front /characters  →  pedirTokenDeEntrada(personagemId, assinarComCarteira)
                    →  guardarTokenPendente(token)   [sessionStorage, read-and-delete]
                    →  navigate('/jogo')
front /jogo        →  <iframe src="{urlDoJogo()}/jogo.html">
                    →  postMessage({tipo:'entrada', token, origem}) com targetOrigin = origem do jogo
jogo  main.jsx     →  compara dados.origem com document.referrer
                    →  window.__TOKEN_DE_ENTRADA__ = dados.token
                    →  dispatchEvent(new Event("eldoria:entrada"))
App.jsx            →  lê o global E assina o evento (a mensagem pode chegar antes do React montar)
```

> **O token nunca entra na URL.** Vai por `postMessage` com `targetOrigin` checado, e o front apaga o `?token=` da barra de endereços com `history.replaceState`.

### A carteira

**O front não usa `ethers`.** Fala com `window.ethereum` na mão: `eth_accounts` (nunca `eth_requestAccounts` no `contaConectada`) e `personal_sign` com `[mensagem, conta]` — o endereço é o **segundo** parâmetro, senão o MetaMask interprets como `from`.

**O `ethers` é do servidor**, em `server/src/domain/Carteira.js`: monta a mensagem EIP-191, verifica com `verifyMessage`, compara com `getAddress`. Nonces separados para **login** e para **entrada**.

`SEGREDO_DO_TOKEN` ausente = servidor sem contas, com aviso.

### `nitro: { preset: "node-server" }`

O preset padrão do Lovable é `cloudflare-module`, que dava 502 em produção porque o Node faz proxy de `.output` esperando HTTP simples. **Esse comentário está no `vite.config.ts` e vale respeitar.**

---

## Tópico 24 — Economia

| sistema | store | onde mora a verdade |
|---|---|---|
| **Mercado P2P** | `MarketStore` (1069) + o dinheiro no `GameServer` | listar/leilão/lance; 8 anúncios por jogador; 7 dias; o **vendedor é pago primeiro** |
| **Guilda** | `GuildStore` (1407) | 40 membros, 1 líder + 1 adjunto, cofre de 40 slots, talentos de 5 níveis, pontos por hora |
| **Party** | `PartyStore` (627) | máx 3, convite dura 5s, decide quem ganha o loot |
| **Coleção** | `Collection` (1058) | entrega permanente → stat permanente, 5 coleções |
| **Bestiário** | `Bestiary` (177) | caçar → stat permanente |
| **Passe** | `passLog` | 14 dias, trilha free + premium |
| **Farm offline** | `OfflineFarm` (1108) | resolve no login, antes do `WELCOME` |

**Padrão comum:** dinheiro e item **nunca** se movem sem passar pelo `GameServer`, porque toda operação de economia precisa de duas sessões ao mesmo tempo. As filas `pagamentosPendentes` e `pendentesDeDevolucao` são indexadas por **`ownerKey`**, não por id de sessão — assim sobrevivem à desconexão e são drenadas no login.

**Diamantes** passam por `guardarDiamantesNaConta` na hora de debitar, para dois personagens da mesma conta não gastarem o mesmo saldo duas vezes.

**Save das filas:** `guardar(sessao)` roda **antes** de `removePlayer` no `desconectar` (L7139).

---

## Tópico 25 — Persistência

| o quê | formato | onde |
|---|---|---|
| personagem | `CharacterSave.js` (1230) | um arquivo por personagem, nomeado por `ownerKey` |
| contas | `Contas.js` (535) | pasta de contas |
| mercado | `criarMarketSave` | com ** cerca de versão** |
| guilda | `criarGuildSave` | com cerca de versão |

**A cerca de versão:** um arquivo com `versao > MERCADO_VERSAO` **não é carregado** e fica intacto. E a flag "sujo" só é limpa **se a escrita de fato deu certo**.

`criarCharacterStore` é opcional: `saves` é `null` quando o servidor não recebe persistência — é assim que os testes optam por não tocar o disco.

**O que NÃO é salvo:** `arenaOrigem`, `mapaTesteOrigem` (são posição de sessão), e `sessao.mineracao` (o pedido em andamento morre com a conexão).

`CharacterSave` tem `resumeWhereLeftOff` por mapa: o hub e a arena **não** guardam posição; o vale também não; os mapas de campanha guardam.

**O diário de erros** (`registroDeErros.js`) mora em **`os.tmpdir()`** — de propósito: um diário dentro do projeto causava loop de restart do `node --watch`.

---

## Tópico 26 — Testes

**~180 arquivos de teste.** `npm test` = `vitest run`.

| ambiente | quem |
|---|---|
| `node` (padrão) | tudo |
| `jsdom` | só `src/components/**/*.test.jsx` e `src/scenes/**/*.test.jsx` |

O comentário no `vite.config.js` explica: o painel de craft e a tela de seleção têm estado próprio, e o botão de raridade só revela defeito **depois de um clique de verdade**.

### Os que cobrem o que trabalhamos

| arquivo | o que garante |
|---|---|
| `src/game/engine/autoPeloVale.test.js` | os três autos atravessam o vale |
| `src/game/engine/viagemAuto.test.js` (31kb) | o plano de viagem |
| `src/game/engine/playerStuck.test.js` | jogador travado |
| `src/game/nav/NavGrid.test.js` (19kb) | a grade e o A* |
| `src/game/collision/stuck.test.js` | a colisão |
| `src/game/portais/portal.test.js` (21kb) | os portais |
| `server/test/portalSelado.test.js` | o portal lacrado |
| `server/test/portalSoDeUm.test.js` | a janela de portal |
| `server/test/jornada.test.js` | a jornada completa |
| `src/data/items/icons.test.js` | **todo item tem arte e ela existe em disco** |
| `src/data/hudIcons.test.js` | **as três listas de ícone batem, e o PNG é PNG de verdade** |

> `hudIcons.test.js` exige que `HUD_ICON_IDS`, `HUD_ICON_URL` e `HUD_ICON_FILE` tenham **exatamente as mesmas chaves**. Essa coerência foi restaurada nesta sessão ao mover as 12 artes para `assets/icons/hud/`.

### Testes que provavelmente estão falhando (não rodei)

| arquivo | por quê |
|---|---|
| `src/game/equipment/Equipment.test.js:645,803` | usa o id `"anel"`, que foi removido |
| `src/game/inventory/Inventory.test.js` | `pilhasVestidas()` agora devolve conjunto vazio por decisão |
| `src/components/HUD/HUD.test.jsx:306-316` | ainda afirma que `hud-btn--sm` renderiza; a marcação mudou |
| qualquer coisa de `zoneOf` | `ZONE_ROSTER` não tem a chave `creatures`, então todo `zoneName` no `DROP_INDEX` é `null` |

> Não executei nenhum teste nesta sessão, conforme a regra do projeto. Estes são levantamentos **estáticos**, por leitura.

---

## Tópico 27 — Assets

```
src/assets/
├─ tilesets/           um .tmj por mapa (dungeon.tmj, base.tmj, boss.tmj, vale.tmj, map_2.tmj)
├─ sprites/            por personagem e por inimigo, em folhas + animações
├─ Items/              por família; drops/otimizado/ tem as versões reduzidas (256px)
│  └─ acessorios/      os 6 acessórios (NOVO)
├─ props/              props.png, arvore.png, cristal_*_prop.png
├─ icons/              HUD, moedas, cursor
│  └─ hud/             as 12 artes da barra (NOVO)
├─ skills/             por classe
├─ terrain/            tiles de chão (128px)
├─ npc/, portais/, cursor/, project/
```

**Duas regras de asset:**

1. **PNG em `new URL` literal** — [Tópico 11](#tópico-11--itens-materiais-e-raridades).
2. **`drops/otimizado/` é separado, não substitui o original.** Os originais têm até 9600×9600 e pesam 22MB cada; os otimizados são 256px. O original é a fonte: reescalar duas vezes perde qualidade, e o jogo só empacota o otimizado.

**As 12 artes da HUD** foram movidas para `assets/icons/hud/` e as três listas de `hudIcons.js` foram realinhadas. Quatro nomes de arquivo **não** seguem o id:

| id | arquivo |
|---|---|
| `collection` | `colecao.png` |
| `settings` | `configuracao.png` |
| `guild` | `guilda.png` |
| `market` | `market_palyers.png` (com o `palyers` trocado) |
| `arvore` | `arvore_de_habilidades.png` |

---

## Tópico 28 — Convenções do código

### Comentários

O projeto usa um estilo incomum e **consistente**: comentário explicando **por que o número é aquele**, não o que a linha faz. O cabeçalho de quase toda constante tem um bloco com o valor e a razão.

Exemplo real:

```
 * ## POR QUE `0.8` E NAO 3
 * Porque sao respostas diferentes para sintomas diferentes. O `3` refaz o
 * caminho INTEIRO, e o A* e determinista: refaz do mesmo lugar devolve o
 * mesmo caminho, entao o piloto batia na mesma parede a cada 3 segundos para
 * sempre, sem nunca tentar o ponto seguinte
```

**Ao escrever neste código, o padrão é:** não explique o que, explique **por que esse valor, por que essa ordem, e qual foi o defeito que ela conserta**.

### Camadas e ciclos

Nenhum `data/**` importa `game/**` (com uma exceção documentada). Nenhum `components/**` importa `net/**`. Quando um import criaria ciclo, o projeto **duplica a string** e comenta o porquê (é o caso de `"mapa_teste"` e dos `SUFIXOS_DE_GRAU`).

### Nomes

Sem acento em identificadores, com acentuação apenas em **strings voltadas ao jogador** (nomes de item, dicas de missão, mensagens). O comentário de abertura da `QuestLog` e de `GameServer` explica isso.

### Verificação

O usuário **não executa testes, o jogo nem o servidor** — a verificação dele é a playteste dele. O sinal de compilação é `npx vite build` e `node --check`. Ver `AGENTS.md` para as regras completas.

---

## Tópico 29 — Problemas conhecidos e pendências

### Bug em aberto: a "travadinha" do auto

**Sintoma:** o auto anda, chega a um ponto, dá uma travadinha, e continua. O mesmo ponto, todas as vezes.

**O que já foi resolvido nesta sessão:**
- o detector de travamento era **cego** (media posição quadro a quadro; vaivém zera o contador toda vez)
- o A\* de rota longa custa **56–90ms** e rodava **toda tique** com o piloto parado → agora memoizado, 0ms

**O que sobrou:** ainda não foi aislado. A simulação com `CollisionSystem` real na rota `(3023,3461) → portal` deu **0 travamentos** num caminho de 18 pontos, e todos os trechos de caminhada retas passam livres com raio 30.

> **Suspeita em aberto (não confirmada):** o `A\*` roda de novo quando o caminho acaba ou é invalidado, e **o jogador está de fato se movendo** nesses 56–90ms. A correção seria A\* assíncrono — refatoração grande, não feita sem pedido.

### Código morto

| arquivo | situação |
|---|---|
| `server/src/domain/GameState.js` | sem importadores |
| `server/src/domain/validation/CommandValidator.js` | sem importadores, e valida nomes de comando que **não existem mais** no protocolo |
| `server/src/gateway/GameGateway.js` | stub que lança em tudo |
| `src/components/Bestiary/BestiaryPanel.jsx` | só o teste importa; o painel vivo é o `CodexPanel` |
| `src/components/Market/MarketPanel.jsx` (default export) | retorna fragmento vazio; os subcomponentes ainda são usados |
| `server/src/contracts/protocol.js` | shim de caminho antigo |

### Bugs levantados por leitura

| lugar | o quê |
|---|---|
| `data/craft/index.js` `zoneOf()` | testa `zone.creatures`, mas `ZONE_ROSTER` tem `mix`/`niveis`/`niveisPorTipo` — **sempre devolve `null`**, e todo `zoneName` no `DROP_INDEX` é `null` |
| `data/quests/index.js` `PRIMEIRO_INDICE_DO_MAPA[2] = 19` | o primeiro degrau do mapa 2 tem índice global 20 → `20-19+1 = 2` → mostra **`2.2`**, mas o comentário duas linhas acima diz que o jogador espera `2.1` |
| `data/maps/index.js` | `groundTile` **duplicado** em `MAP_1`, `MAP_2` e `MAP_TESTE` (artefato de merge; o último vence) |
| `data/portais/index.js:118` | comentário referencia `checarDestinos`, **que não existe no arquivo** |
| `data/items/index.js` | comentários dizem "55 itens" e "onze cadeias"; o real é **60 materiais / 12 cadeias** |
| `data/items/icons.js` | comentário diz "14 arquivos"; `ARQUIVO_DA_FAMILIA` tem **12** |
| `data/quests/index.js` L1347, L2299 | corrupção: `出现了` e `力` em comentários (**preexistente**) |
| `game/collision/CollisionSystem.js` | comentário com `速度` (**preexistente**) |
| `data/enemies/index.js` | `alertarAliados: 2` para `ogre` e `ogre_da_predeira` **não implementado** |
| `HUD.jsx` | `page` das skills é posto em 0 e **nunca mudado**; não há botão de página, mas o CSS e um teste ainda esperam os marcadores |
| `data/items/index.js` | **nenhuma arma existe para `lancer`**, apesar de `CLASS_WEAPON_KINDS.lancer = ["lance"]` |

### Não commitado

30 arquivos modificados + 15 não rastreados. Inclui **4 `.tmj` editados à mão pelo usuário** (`boss.tmj`, `dungeon.tmj`, `map_2.tmj`, `vale.tmj`), as 12 artes da HUD, os 6 acessórios e ~11 PNGs de skill novos. **Os `.tmj` são trabalho manual do usuário e não devem ser sobrescritos.**

---

## Apêndice — Glossário de símbolos

| símbolo | onde | o quê |
|---|---|---|
| `GameEngine` | `src/game/engine/` | o motor, 17k linhas, roda headless ou networked |
| `PlayerSession` | `src/game/engine/` | raiz de composição do estado por jogador |
| `withPlayer` | `GameServer` + `GameEngine` | foca uma sessão, roda, restaura — a chave do multiplayer |
| `painelExterno` / `painelSolicitado` | `GameEngine` | quem é dono do painel de 154KB |
| `sendSnapshot` | `GameEngine` | monta o `PLAYER_STATE`; **um só produtor** |
| `raioY` | `data/portais` | guarda a altura **inteira** da elipse; o código divide por 2 |
| `abreNoDegrau` / `fechaNoDegrau` | `data/portais` | janela de missão que decide o destino de um portal |
| `passagemAberta` | `GameEngine` | **um** método, consultado pelos três detectores de portal |
| `chegadaDe` | `GameEngine` | ponto de chegada, 3 tiles para dentro da borda mais próxima |
| `CELULA` / `RAIO` / `FOLGA` | `NavGrid` | 40px / 22 / 8 |
| `cacheCaminho` | `NavGrid` | memoização do A\* por par (origem, destino) |
| `VAO_SIMPLIFICAR` | `NavGrid` | string pulling olha 48 pontos à frente |
| `travelPlan` | sessão | a lista de etapas da viagem |
| `travelParado` | sessão | há quanto tempo **não há progresso ao alvo** |
| `pedidoDeMinerar` | motor | lache: o `minerar` é um interruptor, pedir duas vezes desliga |
| `alcancado` | sessão | **lacre** de minerar: liga, nunca desliga |
| `ownerKey` | sessão | identidade estável entre reconexões; chave de mercado/guilda/pagamento |
| `donoKey` | sessão | mesmo que `ownerKey`, grafia alternativa em `GameServer` |
| `ARENA_VENCIDA` | módulo do motor | `Map` privado: chefe já vencido por sessão |
| `sessaoDe` | inimigo | dono de um chefe por jogador |
| `PET` / `PETS` | — | **não existe**; a nomenclatura real é "pedida" |
| `pedida` | `data/props` | a prop minerável (cristal) |
| `batidas` | `data/props` | quantas vezes a pedra pode ser minerada |
| `folga` | `data/materiais` | o grau acima da base do material |
| `AUTO_TYPES` | `data/quests` | tipos que o auto completa sozinho |
| `TIPOS_COM_DESTINO` | `data/quests` | tipos para onde o piloto sabe andar |
| `TIPOS_DE_TUTORIAL` | `data/quests` | tipos contados por `onAcao` |
| `MAPS` | `data/maps` | o registro de mapas |
| `getMap` / `findMap` | `data/maps` | **leniente** (cai no hub) / **estrito** (`null`) |
| `findMap` | — | a versão estrita é a que os portais usam, para que um `destino` apagado não mande o jogador para o hub em silêncio |
| `colisaoDoMapa` | `registroDeTiles` | retângulos de parede do Tiled, **para cliente e servidor** |
| `definirResolvedorDeZonas` | `zonasTiled` | hook para corrigir retângulos de zona vindo do Tiled |
| `mergeBonuses` | `GameEngine` | soma bônus **por chave**, não sobrescreve |
| `applyEquipment` | `GameEngine` | funde as 6 fontes de bônus e recalcula o StatSheet |

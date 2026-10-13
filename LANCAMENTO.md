# Checklist de lançamento

Gerado pela auditoria de segurança de 2026-XX-XX, depois da migração do
Supabase para o servidor do jogo e da unificação de porta (front + jogo +
API + WebSocket na 8787).

**Estado:** o jogo funciona e foi testado localmente. Os itens marcados
como **CORRIGIDO** ja foram feitos. O resto e a lista do que falta para ir
ao ar.

---

## 🔴 BLOQUEADORES — o jogo não sobe para o público

### 1. O build do front não roda em Node

- **Onde:** `front_rpg/.output/nitro.json` → `"preset": "cloudflare-module"`
- **O que acontece:** o build do front sai para Cloudflare Workers. O
  `server/src/index.js` tenta servir o site fazendo proxy para um `vite dev`
  na porta 3000, mas em produção esse processo não existe. O AGENTS.md
  promete "tudo servido pelo Node único na 8787" — isso não acontece.
- **Sintoma:** deploy → `npm run start` → navegar para `/` → 502 com "O
  site nao subiu / Rode npm run dev dentro de front_rpg"
- **Correção:** `nitro.preset = 'node-server'` no `defineConfig` do
  `front_rpg/vite.config.ts`, e subir com `node .output/server/index.mjs`

### 2. `VITE_API_URL` com localhost fixo no bundle

- **Onde:** `front_rpg/.env` → `VITE_API_URL=http://localhost:8787`
- **Confirmado no bundle:** `function e(){return "http://localhost:8787"...}`
- **O que acontece:** qualquer jogador real chama a API do localhost *dele*.
  CORS error, MetaMask assina, tela mostra "Não foi possível conectar"
- **Correção:** remover do `.env`. `urlDaApi()` já cai em
  `window.location.origin`, que funciona porque front e API são servidos
  pelo mesmo Node. Se precisar de override, criar `.env.production` no
  servidor de deploy — nunca no repo.

### 3. Sem `SEGREDO_DO_TOKEN` o servidor sobe SEM autenticação

- **Onde:** `server/src/index.js` — `contas = null` + `console.warn`
- **O que acontece:** com contas desligadas, `GameServer.entrar` cai no
  caminho antigo e aceita `JOIN {name, classId}` cru. Qualquer página web
  abre `ws://servidor:8787/ws`, manda o JOIN e **entra como qualquer
  personagem**, digitando o nome no console
- **Pior:** o save é chaveado por nome, então o atacante assume o
  personagem de outra pessoa
- **Correção:** se `NODE_ENV === 'production'` e faltar o segredo, **derrubar
  o processo** no boot. O modo degradado serve para dev, não para produção

---

## 🔴 BUGS INTRODUZIDOS PELA CÂMERA CLAMPADA

### 4. `screenToWorld` usa o jogador cru — **CORRIGIDO**

- **Onde:** `src/game/engine/GameEngine.js:3070-3083`
- **O que acontece:** a câmera centraliza no ponto clampado, mas o inverso
  (clique → mundo) ainda soma `world.player`. O erro é `player - centro`,
  até meia viewport
- **Quebra:** hover de NPC, seleção de inimigo, clicar na pedra para minerar
- **Correção:** usar `this.centroDaCameraLimitado()` no lugar de
  `this.world.player`

### 5. A mira tem o mesmo bug, uma camada acima — **CORRIGIDO**

- **Onde:** `src/components/Game/GameCanvas.jsx:320-327` +
  `src/game/net/GameClient.js:212`
- **O que acontece:** o ponteiro é enviado como offset do centro da TELA e
  `aimFromPointer` compara com `{x:0, y:0}`. Com a câmera clampada o jogador
  não está mais no centro da tela, então todo `INPUT`/`ACTION` manda direção
  errada — e é isso que o servidor usa para mirar
- **Correção:** passar a posição do jogador na tela, em unidades de mundo

### 6. `drawCrosshair` sem `* z` e com jogador cru — **CORRIGIDO**

- **Onde:** `src/game/engine/GameEngine.js` (`drawCrosshair`)
- **Correção:** `(pointer.x - centro.x) * z + width / 2`

### 7. Minimapa: retângulo de visão com jogador cru — **CORRIGIDO**

- **Onde:** `src/game/ui/minimap.js` + o `centroDaCamera` que o motor passa
- **O que acontece:** o tamanho está certo (`visibleWorldSize`), a posição
  não. O `Math.max(0, …)` só prendia esquerda/topo, então vazava à direita
- **Correção:** `centroDaCamera` nos dois eixos, com limite dos dois lados

### 8. Clamp "cabe na tela" decide só pelo eixo X — **CORRIGIDO**

- **Onde:** `src/game/engine/GameEngine.js` (`centroDaCameraLimitado`)
- **O que acontece:** se o mapa couber na largura mas não na altura, o clamp
  de Y era pulado e a câmera parava de seguir o jogador verticalmente
- **Correção:** os dois eixos decididos separadamente

---

## 🔴 TEXTO CORROMPIDO EM 35 ARQUIVOS (achado depois da auditoria)

**Este nao estava na lista original — apareceu durante a correcao da camera.**

Os arquivos foram gravados com codificacao dupla: o texto UTF-8 foi lido
como latin1 e gravado de novo como UTF-8. O byte `C3 A3` ("a com til") virou
`C3 83 C2 A3` ("A-tilde + a-cedilha").

**O que o jogador ve hoje:**

```js
name: "Ataque BÃ¡sico"                    // era "Ataque Básico"
tagline: "controle e resistÃªncia"         // era "controle e resistência"
"usa forÃ§a fÃ­sica para controlar grupos."
this.showMessage("Auto de missÃ£o desligado.");
```

**Onde (os piores):**

| Ocorrencias | Arquivo |
|---|---|
| 496 | `src/game/engine/GameEngine.js` |
| 207 | `server/src/domain/GameServer.js` |
| 71 | `src/data/characters/index.js` |
| 20 | `src/data/terrain/index.js` |
| 20 | `src/game/enemies/EnemyAI.js` |
| 15 | `src/components/Rank/RankingPanel.jsx` |

**Total: 35 arquivos, 897 ocorrencias.** Nos 3 maiores, 83 linhas sao
codigo/string (aparecem na tela) e 586 sao comentario.

### Por que nao da para arrumar com um re-encode simples

Os arquivos estao **MISTOS**: parte do texto esta correta e parte esta
corrompida. Re-encodear o arquivo inteiro destruiria a parte que esta boa.

O caminho e re-decodificar **so as runs corrompidas** (o algoritmo do
`ftfy`: achar sequencias de caracteres U+0080..U+00FF, converter para
bytes e ler de novo como UTF-8), com um script, e revisar o diff.

### Como medir antes de mexer

```
U+00C3 (A-tilde MAIUSCULO) nao existe em portugues.
```

Entao: decodificar o arquivo como UTF-8 e contar `Ã` e `â€` — cada
ocorrencia e corrupcao real.

**Cuidado com a medicao:** ler os bytes como latin1 e procurar `Ã` da
FALSO POSITIVO em todo arquivo UTF-8 correto, porque o `ã` legitimate
(C3 A3) vira `Ã£` nessa leitura. Foi assim que a primeira varredura
reportou 224 arquivos quando sao 35.

---

## 🟠 SEGURANÇA — antes de qualquer usuário real

### 9. CORS liberado para `*`

- **Onde:** `server/src/index.js:61`
- **Impacto:** não permite ler conta alheia passivamente (o token é
  `Authorization`, não cookie). Mas converte "token vazado" em perda total
  de conta: o atacante abre o DevTools em `evil.com` e consome a API
- **Correção:** lista de origens exatas em env, com `Vary: Origin`. Nunca
  voltar a `*`

### 10. ATO por phishing (encadeia com o #9)

- **Onde:** `server/src/domain/Carteira.js:91-99`
- **O que acontece:** a mensagem assinada tem `Servidor: eldoria` (string
  literal, não o host real) e não tem `chainId`. Um site falso pede o nonce
  ao servidor real, mostra na MetaMask uma mensagem **idêntica à legítima**
  (ela É do servidor real), e a vítima assina achando que é o jogo
- **Correção:** amarrar domínio qualificado + `chainId` na mensagem, e
  exigir `Origin` conhecido na rota `pedir-assinatura`

### 11. Sem rate limit em rota nenhuma

- **Onde:** `server/src/index.js` — nenhuma rota HTTP tem limite
- **Pior caso:** `POST /api/conta/carteira/pedir-assinatura` enche o Map de
  nonces **sem precisar de assinatura válida** — só um endereço no formato
  certo. Derruba o processo por memória
- **Correção:** limitador por IP na API de contas

### 12. `postMessage` contornável

- **Onde:** `src/main.jsx:131-141`
- **O que acontece:** compara `dados.origem` com `document.referrer`. Um site
  atacante que embute `jogo.html` tem `referrer` = o próprio URL, então
  manda `origem: <a própria origem>` e passa. Não checa `event.source` nem
  `event.origin`. O servidor não manda `frame-ancestors`
- **Impacto hoje é limitado** (o token é HMAC e de uso único), mas é login
  CSRF
- **Correção:** `event.source !== window.parent` + allowlist de origem em env
  + `Content-Security-Policy: frame-ancestors`

### 13. Sem logout no servidor

- **Onde:** `server/src/index.js` — não existe rota de revogação
- **O que acontece:** `limparSessao()` só apaga do `localStorage`. O token
  continua válido no servidor por 30 dias. Além disso, `sessaoDeConta` é um
  `Map` em memória: qualquer restart desloga todo mundo
- **Correção:** `POST /api/conta/logout` que apaga o token do Map + varredura
  periódica de expirados

### 14. Sem CSP nem headers de segurança

- **Onde:** `server/src/index.js` — não há `helmet` nem CSP
- **Por que importa:** o token de sessão vive no `localStorage`. Qualquer
  injeção de script na origem lê. Hoje não há XSS, mas isso torna a app um
  alvo de uma linha só
- **Correção:** CSP + `X-Content-Type-Options` + `Referrer-Policy` +
  `frame-ancestors`

### 15. Contas de jogador commitáveis

- **Onde:** `.gitignore` da raiz protege `server/data/personagens` mas
  **não** `server/data/contas`
- **Estado:** dois arquivos reais já existem (carteiras + diamantes +
  personagens) e estão untracked
- **Correção:** adicionar `server/data/contas` ao `.gitignore`

---

## 🟠 Bugs introduzidos hoje

### 16. `mining` nunca é normalizado na folha

- **Onde:** `tools/gif-to-sheet.mjs:2012` — `miningNorm` roda DEPOIS de
  `repairTruncatedFrames` já ter promovido `lane.frames`
- **Efeito:** a folha tem 11 colunas em vez de 9; 2 colunas mortas
- **Correção:** mover a normalização para antes da promoção

### 17. `enhance` sem teto no save

- **Onde:** `src/game/save/CharacterSave.js:619, 734, 763` e
  `src/game/equipment/Equipment.js:476`
- **O que acontece:** `Equipment.bonuses()` multiplica todo stat por
  `1 + enhance * 0.12`. Um save com `enhance: 999999` multiplica ataque por
  ~120.000
- **Correção:** `Math.min(ENHANCE_MAX, ...)` nos quatro pontos

### 18. `hulk.tmj` fora do centro da colisão

- **Onde:** `hulk.tmj` é 27×19 = 1728×1216 (centro 864,608) vs
  `BOSS_1_CENTER` = (840,588)
- **Efeito:** a arte está 24/20px deslocada do círculo. Invisible hoje (tile
  único), aparece assim que alguém pintar borda alinhada
- **Correção:** alinhar o `.tmj` ao círculo, ou recalcular
  `BOSS_1_WIDTH/HEIGHT` para 27/19 tiles

### 19. `dados.nome` do token entra cru

- **Onde:** `src/App.jsx:74`
- **Correção:** passar por `validateName()` antes de usar

### 20. HUD calcula dano no cliente ao clicar em skill

- **Onde:** `src/components/HUD/HUD.jsx:4647-4649, 4842-4844`
- **O que acontece:** `useSkillSlot`/`useUltimate` são chamados direto no
  motor, sem a guarda `if (intencao)` que os outros handlers usam. Executa
  `SkillSystem` local e credita loot/XP na sessão local
- **Pré-existente**, não introduzido hoje
- **Correção:** replicar o padrão dos outros handlers

---

## 🟡 HIGIENE

- `tools/warriorSheet.test.js` está obsoleto (afirma 68/17/9/34/55) e
  **reescreve o PNG de produção** ao rodar
- `front_rpg` tem dois lockfiles (`bun.lock` e `package-lock.json`), nenhum
  versionado → sem diff de dependência para revisar
- Dependências mortas no front: `@supabase/supabase-js`,
  `@lovable.dev/cloud-auth-js`, `drizzle-kit`, `drizzle-orm` (esta última é a
  origem das 4 vulnerabilidades moderadas — todas de dev)
- `VITE_API_URL` no `.env` do front: qualquer coisa com prefixo `VITE_` vira
  texto no bundle. `SEGREDO_DO_TOKEN` nunca pode ter esse prefixo
- `og:image` ausente — as rotas declaram `twitter:card` sem imagem
- 404 e error boundary em inglês num site `lang="pt-BR"`
- `saveLootFilter` nunca é chamado — o filtro de loot nunca persiste
- `MAX_MOVE_SPEED` e `MAX_SNAPSHOT_BYTES` exportados e nunca usados
- `/api/personagem/:nome` sem auth permite enumerar jogadores e quem está online

---

## ✅ O QUE ESTÁ CORRETO (não mexer)

- **Token de entrada:** HMAC-SHA256, `timingSafeEqual`, expiração de 60s,
  uso único (nonce queimado antes de qualquer checagem), revalidado contra a
  conta no JOIN. `name`/`classId` do payload são **ignorados**
- **MetaMask:** `verifyMessage` real, nonce de uso único, mensagem guardada
  byte-a-byte
- **Autoridade do servidor:** 70 comandos revalidados; nenhum buraco de
  item, inventário, teletransporte ou mercado entre contas
- **XSS:** nenhum sink alcançável no front nem no jogo
- **Path traversal:** barrado nos dois stores
- **Dependências:** 0 críticas, 0 altas (4 moderadas, todas de dev)
- **Persistência:** `isReadableSave` sanitiza level/coins/steel/diamonds
  (negativo → 0, NaN → 0), itens contra catálogo, afixos e skills filtrados

---

## Testes pré-existentes que falham (não são de hoje)

Confirmado com `git stash` — falham com e sem as mudanças:

- `server/test/GameServer.unit.test.js` → "o drop no chao leva o dono"
- `server/test/persistencia.test.js` → "carrega nivel, xp, ouro, itens..."
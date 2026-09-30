# Project Ashen — RPG 2D Top-Down

Protótipo da primeira etapa de um RPG 2D top-down com React,
Vite, Canvas 2D e Node.js.

## Requisitos

- Node.js 20 ou superior
- npm 10 ou superior

## Executar

```bash
npm install
npm run dev
```

O comando acima sobe duas coisas ao mesmo tempo:

- Web (Vite) em http://localhost:5173
- API (Node.js + Express) em http://localhost:8787

## Scripts

| Script            | Descrição                                  |
| ----------------- | ------------------------------------------ |
| `npm run dev`     | Sobe web e API juntos                      |
| `npm run dev:web` | Sobe apenas o front-end                    |
| `npm run dev:server` | Sobe apenas a API com watch              |
| `npm run build`   | Gera o bundle de produção em `dist/`        |
| `npm run preview` | Serve o bundle de produção                  |
| `npm test`        | Roda os testes com Vitest                   |

## Controles

- `W`, `A`, `S`, `D` ou setas: movimentar
- Clique esquerdo: habilidades 1 a 4
- `Q`, `E`: habilidades 5 e 6
- `R`: habilidade ultimate
- `Space`: ataque básico
- `Esc`: voltar para a seleção de classe

## Estrutura

- `src/data/characters` - definição das classes, atributos e habilidades
- `src/data/skills` - criação e normalização das ações
- `src/data/maps` - mapa de testes, paredes, obstáculos e zonas
- `src/data/enemies` - blueprints dos bonecos de treino
- `src/game` - núcleo do motor (matemática, entidades, input, combate)
- `src/scenes` - cenas de seleção de classe e mapa de teste
- `server/src` - API mínima usada pelo protótipo

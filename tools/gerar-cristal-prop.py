"""
GERA AS PROPS DE CRISTAL DO VALE 1, A PARTIR DAS QUATRO ARTES DE
`src/assets/rocks`.

    python tools/gerar-cristal-prop.py

## POR QUE ESTE E O UNICO GERADOR QUE NAO E .mjs

Porque a MATERIA PRIMA E JPEG, e o Node nao abre JPEG.

O resto do `tools/` decodifica PNG com o proprio
`inflatePng`/`encodePng` e roda em Node puro, sem dependencia nenhuma.
Nao ha `sharp`, `jimp` ou `jpeg-js` no `node_modules` deste projeto, e
nao ha `Image`, `createImageBitmap` nem `OffscreenCanvas` no Node 22 —
sao APIs de navegador. Escrever um decodificador JPEG em Node para usar
quatro vezes seriaMais codigo e mais risco do que a conversao.

A alternativa seria normalizar as quatro artes para PNG e guardar as duas
versoes no repositorio, duplicando 4 MB de binario. Python com PIL le o
JPEG direto, entao a materia prima continua sendo a que o usuario
entregou

## O QUE ESTE SCRIPT FAZ, E POR QUE CADA PASSO EXISTE

As quatro artes sao sprites de pixel art de 1600x1600 sobre FUNDO BRANCO
OPACO. Um JPEG nao tem canal alfa, entao nao da para recortar a caixa
opaca como o `gerar-arvore-prop.mjs` faz: para ele, "transparente" e
literalmente "alpha zero", e um JPEG nao tem alpha

O caminho e, nesta ordem:

1. **REMOVEDOR DE FUNDO POR ENCHIMENTO A PARTIR DA BORDA.** Nao e
   "apagar tudo que e branco". A diferenca aparece dentro do cristal: o
   brilho da faceta e quase branco, e uma chave global furaria buracos na
   rocha. O enchimento so alcanca o branco que DA PARA CHEGAR DA BORDA
   sem passar pelo cristal, entao o brilho do meio fica

2. **CORTE DA CAIXA.** As quatro artes tem margens enormes — de 280 a
   351px de lado e ate 294px em cima. Sem o corte, a prop entraria no
   jogo com 71% de area vazia, e o `drawImage` esticaria esse vazio junto

3. **CORRECAO DE BORDA ANTES DE REDUZIR.** Reduzir 1200px para 90px faz a
   media do filtro puxar o branco da borda para dentro do cristal, e o
   resultado e um halo claro em volta de cada rocha. Como o fundo e
   branco, a correcao e exata e nao precisa ser aproximada: o pixel
   observado e a mistura `a*rocha + (1-a)*branco`, entao a cor da rocha
   se recupera invertendo a conta

4. **DIMINUICAO EM CADEIA.** `reducing_gap` faz o PIL reduzir em etapas
   com area media antes do filtro final. Sem ele, um salto de 1200px para
   90px de uma vez faz o LANCZOS amostrar poucos pixels e a arte vira
   ruido
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

AQUI = Path(__file__).resolve().parent
ORIGEM = AQUI.parent / "src" / "assets" / "rocks"
DESTINO = AQUI.parent / "src" / "assets" / "props"

# O limiar do branco. Medido nas quatro artes: os quatro cantos sao
# 255,255,255 e as 916 amostras de borda sao todas claras. O `235` e
# folga para o ringing do JPEG, que suja o branco puro nas bordas
LIMIAR = 235
DESPREZIVEL = 14

# A ALTURA NA TELA DE CADA RARIDADE, em pixel de tela.
#
# Sao as quatro alturas que o usuario escolheu, e a ordem delas importa:
# e o que faz a raridade ser legivel no cenario sem escrever nada
# embaixo do cristal. A largura sai da proporcao de cada arte, que nao e
# igual entre elas (de 0.759 a 0.773), e por isso cada uma tem a sua
#
# O NOME DO ARQUIVO DE SAIDA E EM PORTUGUES, e o do arquivo de origem nao.
# As artes chegaram com `comum`, `rare`, `epic` e `legendary`, misturando
# as duas linguas; o catalogo de props do jogo e em portugues (`arvore`,
# `arbusto`), entao `cristal_raro_prop.png` e o que fica. A chave aqui e o
# nome da origem, e o valor traz o nome que entra no jogo
ALVOS = {
    "comum": ("cristal_comum_prop.png", 90),
    "rare": ("cristal_raro_prop.png", 120),
    "epic": ("cristal_epico_prop.png", 150),
    "legendary": ("cristal_lendario_prop.png", 180),
}


def remover_fundo(imagem):
    """
    Devolve a mascara do cristal: `True` onde a rocha esta.

    O enchimento comeca nos quatro cantos e so entra num pixel se ele for
    claro E vizinho de um pixel ja aceito. E por isso que ele nao vaza
    para dentro da rocha: o caminho so existe pelo branco de fora
    """
    rgb = np.asarray(imagem.convert("RGB")).astype(np.int16)
    altura, largura, _ = rgb.shape

    claro = (rgb.min(axis=2) >= LIMIAR) & (
        rgb.max(axis=2) - rgb.min(axis=2) <= DESPREZIVEL
    )

    visitados = np.zeros((altura, largura), dtype=bool)
    fila = deque()

    for sy, sx in ((0, 0), (0, largura - 1), (altura - 1, 0), (altura - 1, largura - 1)):
        fila.append((sx, sy))
        visitados[sy, sx] = True

    while fila:
        x, y = fila.popleft()

        # o pixel da frente NAO e claro: e rocha, e a borda do enchimento
        if not claro[y, x]:
            continue

        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < largura and 0 <= ny < altura and not visitados[ny, nx]:
                visitados[ny, nx] = True
                fila.append((nx, ny))

    # A rocha e o que o enchimento NAO pegou. O `& ~claro` descarta o
    # branco solto no meio da arte, que nao pertence ao fundo
    return ~visitados


def preparar(caminho, altura_alvo):
    imagem = Image.open(caminho).convert("RGB")
    mascara = remover_fundo(imagem)

    ys, xs = np.where(mascara)
    y0, y1 = ys.min(), ys.max()
    x0, x1 = xs.min(), xs.max()

    rgb = np.asarray(imagem).astype(np.float64)[y0 : y1 + 1, x0 : x1 + 1]
    alfa = mascara[y0 : y1 + 1, x0 : x1 + 1]

    altura, largura = alfa.shape
    largura_alvo = max(1, round(largura * altura_alvo / altura))

    # O RGB vai premultiplicado pelo alpha ANTES de reduzir. E o que
    # impede o branco da borda de vazar para dentro: um filtro linear
    # qualquer mistura os canais na proporcao errada, e so o alpha zero
    # impede a mistura
    premult = rgb * alfa[:, :, None]

    # Alpha: reduzido sozinho, porque e a cobertura, nao uma cor
    a = Image.fromarray((alfa * 255).astype(np.uint8), mode="L").resize(
        (largura_alvo, altura_alvo), Image.LANCZOS, reducing_gap=2.0
    )

    # Alpha: reduzido sozinho, porque e a cobertura, nao uma cor
    a = Image.fromarray((alfa * 255).astype(np.uint8), mode="L").resize(
        (largura_alvo, altura_alvo), Image.LANCZOS, reducing_gap=2.0
    )
    alfa_pequeno = np.asarray(a, dtype=np.float64) / 255.0

    # Cada canal premultiplicado, reduzido
    canais = []
    for indice in range(3):
        c = Image.fromarray(
            np.clip(premult[:, :, indice], 0, 255).astype(np.uint8), mode="L"
        ).resize((largura_alvo, altura_alvo), Image.LANCZOS, reducing_gap=2.0)
        canais.append(np.asarray(c, dtype=np.float64) / 255.0)

    # Despremultiplica contra o branco: o que o filtro viu foi
    # `a*rocha + (1-a)*branco`, entao a rocha e o que sobra da conta
    saida = np.empty((altura_alvo, largura_alvo, 4), dtype=np.uint8)
    for indice in range(3):
        cor = (canais[indice] - (1.0 - alfa_pequeno)) / np.maximum(
            alfa_pequeno, 1e-6
        )
        saida[:, :, indice] = np.clip(cor * 255.0, 0, 255).astype(np.uint8)

    saida[:, :, 3] = np.clip(alfa_pequeno * 255.0, 0, 255).astype(np.uint8)

    # O pixel totalmente transparente fica com o RGB que o filtro inventou.
    # Nao aparece na tela, mas arquivo com RGB solto e o que faz o PNG
    # ficar maior sem ganhar nada
    saida[saida[:, :, 3] == 0] = 0

    return Image.fromarray(saida, mode="RGBA"), (x1 - x0 + 1, y1 - y0 + 1)


def main():
    DESTINO.mkdir(parents=True, exist_ok=True)

    print(f"origem : {ORIGEM}")
    print(f"destino: {DESTINO}")
    print("")

    for raridade, (nome_saida, altura) in ALVOS.items():
        origem = ORIGEM / f"{raridade}.jpg"
        saida = DESTINO / nome_saida

        imagem, (largura_origem, altura_origem) = preparar(origem, altura)
        imagem.save(saida, optimize=True)

        alfa = np.asarray(imagem)[:, :, 3]
        opacos = int((alfa >= 250).sum())

        print(f"{raridade}")
        print(
            f"   corte   {largura_origem}x{altura_origem}"
            f"  ->  tela {imagem.width}x{imagem.height}"
        )
        print(
            f"   alfa    {opacos} px opacos, "
            f"{int(((alfa > 0) & (alfa < 250)).sum())} px de borda"
        )
        print(f"   arquivo {saida.name}  {saida.stat().st_size / 1024:.1f} KB")
        print("")


if __name__ == "__main__":
    main()

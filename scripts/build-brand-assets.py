"""
Gera os ativos web das marcas Creche Carioca a partir dos arquivos oficiais de
`/img/logo`.

DESIGN.md, Brand Assets, proibe recolorir, distorcer ou redesenhar o logotipo.
Este script NAO altera a marca: os arquivos originais sao mockups em JPEG, com
um fundo de apresentacao (textura de papel, tracos decorativos e, no arquivo de
cabecalho, um xadrez de falsa transparencia). O que o script faz e recortar
exatamente a silhueta da marca e tornar transparente o que esta FORA dela.
Nenhum pixel da marca e alterado: mesmas cores, mesmas proporcoes, mesma
composicao. Ver docs/DECISIONS.md (ADR-0031).

Requer Pillow. Execucao manual, fora do build:
    python3 scripts/build-brand-assets.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "img" / "logo"
TARGET = ROOT / "apps" / "web" / "public" / "img" / "logo"

# Altura de exibicao x 3, para telas de alta densidade.
HEADER_HEIGHT = 120
FOOTER_HEIGHT = 288


def is_brand_blue(pixel: tuple[int, int, int]) -> bool:
    """Azul saturado da placa/disco. Distingue a marca do fundo do mockup."""
    r, g, b = pixel
    return b > 110 and b - r > 60 and b - g > 30


def build_header() -> None:
    """Placa horizontal: mantem o retangulo arredondado, descarta o xadrez."""
    im = Image.open(SOURCE / "crechecariocaheader.jpeg").convert("RGB")
    width, height = im.size
    px = im.load()

    # Janela da placa. Fora dela ha tracos decorativos que tambem sao azuis.
    box_x0, box_x1, box_y0, box_y1 = 210, 2545, 305, 1230

    # Para cada linha, o primeiro e o ultimo pixel azul sao as bordas da placa.
    # Preencher entre eles reproduz o canto arredondado real, sem inventar raio.
    rows: dict[int, tuple[int, int]] = {}
    for y in range(box_y0, box_y1 + 1):
        xs = [x for x in range(box_x0, box_x1 + 1) if is_brand_blue(px[x, y])]
        if len(xs) > 400:
            rows[y] = (min(xs), max(xs))

    alpha = Image.new("L", (width, height), 0)
    alpha_px = alpha.load()
    for y, (first, last) in rows.items():
        for x in range(first, last + 1):
            alpha_px[x, y] = 255

    ys = sorted(rows)
    x0 = min(v[0] for v in rows.values())
    x1 = max(v[1] for v in rows.values())

    out = im.copy()
    out.putalpha(alpha)
    out = out.crop((x0, ys[0], x1 + 1, ys[-1] + 1))
    _save(out, HEADER_HEIGHT, TARGET / "crechecarioca-header.png")


def build_footer() -> None:
    """Selo circular: mantem o disco, descarta o papel e os tracos ao redor."""
    im = Image.open(SOURCE / "crechecariocafooter.jpeg").convert("RGB")
    width, height = im.size
    px = im.load()

    # A maior sequencia continua de azul em cada linha e o proprio disco; os
    # tracos decorativos das laterais sao curtos e ficam de fora.
    rows: dict[int, tuple[int, int]] = {}
    for y in range(height):
        start = None
        best = None
        for x in range(width + 1):
            blue = is_brand_blue(px[x, y]) if x < width else False
            if blue and start is None:
                start = x
            elif not blue and start is not None:
                if best is None or x - start > best[1] - best[0]:
                    best = (start, x - 1)
                start = None
        if best is not None and best[1] - best[0] > 300:
            rows[y] = best

    ys = sorted(rows)
    x0 = min(v[0] for v in rows.values())
    x1 = max(v[1] for v in rows.values())
    cx, cy = (x0 + x1) / 2, (ys[0] + ys[-1]) / 2
    radius = max(x1 - x0, ys[-1] - ys[0]) / 2

    alpha = Image.new("L", (width, height), 0)
    ImageDraw.Draw(alpha).ellipse(
        (cx - radius, cy - radius, cx + radius, cy + radius), fill=255
    )

    out = im.copy()
    out.putalpha(alpha)
    out = out.crop(
        (int(cx - radius), int(cy - radius), int(cx + radius) + 1, int(cy + radius) + 1)
    )
    _save(out, FOOTER_HEIGHT, TARGET / "crechecarioca-footer.png")


def _save(image: Image.Image, target_height: int, path: Path) -> None:
    """Reduz preservando a proporcao original (DESIGN.md: nunca distorcer)."""
    ratio = target_height / image.height
    resized = image.resize(
        (round(image.width * ratio), target_height), Image.LANCZOS
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    resized.save(path, optimize=True)
    print(f"{path.relative_to(ROOT)} {resized.width}x{resized.height}")


if __name__ == "__main__":
    build_header()
    build_footer()

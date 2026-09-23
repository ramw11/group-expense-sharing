from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "android" / "app" / "src" / "main" / "res"
INK = "#182a20"
LIME = "#c7f36a"
CORAL = "#ff7657"
PAPER = "#f6f2e8"


def mark(size: int, transparent: bool = False, safe: float = 0.70) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0) if transparent else INK)
    draw = ImageDraw.Draw(image)
    radius = int(size * safe * 0.235)
    left = (int(size * 0.40), int(size * 0.43))
    right = (int(size * 0.60), int(size * 0.61))
    for center, color in ((left, LIME), (right, CORAL)):
        draw.ellipse((center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius), fill=color)
    line_width = max(2, int(size * safe * 0.063))
    draw.line((size // 2, int(size * 0.27), size // 2, int(size * 0.73)), fill=PAPER, width=line_width)
    return image


def legacy(size: int, round_icon: bool = False) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    if round_icon:
        mask_draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    else:
        mask_draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * .25), fill=255)
    background = mark(size, safe=.82)
    image.paste(background, (0, 0), mask)
    return image


def splash(width: int, height: int) -> Image.Image:
    image = Image.new("RGBA", (width, height), INK)
    logo_size = int(min(width, height) * .27)
    logo = mark(logo_size, transparent=True, safe=.95)
    image.alpha_composite(logo, ((width - logo_size) // 2, (height - logo_size) // 2))
    return image


densities = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for density, factor in densities.items():
    directory = RES / f"mipmap-{density}"
    directory.mkdir(parents=True, exist_ok=True)
    legacy(int(48 * factor)).save(directory / "ic_launcher.png")
    legacy(int(48 * factor), True).save(directory / "ic_launcher_round.png")
    mark(int(108 * factor), transparent=True).save(directory / "ic_launcher_foreground.png")

splash_sizes = {
    "drawable": (480, 320),
    "drawable-land-mdpi": (480, 320), "drawable-land-hdpi": (720, 480), "drawable-land-xhdpi": (960, 640), "drawable-land-xxhdpi": (1440, 960), "drawable-land-xxxhdpi": (1920, 1280),
    "drawable-port-mdpi": (320, 480), "drawable-port-hdpi": (480, 720), "drawable-port-xhdpi": (640, 960), "drawable-port-xxhdpi": (960, 1440), "drawable-port-xxxhdpi": (1280, 1920),
}
for folder, dimensions in splash_sizes.items():
    directory = RES / folder
    directory.mkdir(parents=True, exist_ok=True)
    splash(*dimensions).save(directory / "splash.png", optimize=True)

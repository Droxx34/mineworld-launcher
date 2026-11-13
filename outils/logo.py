"""(13/11/2026) Logo du launcher MineWorld : carré arrondi turquoise et bloc à facettes (dessiné pour MineWorld).
Écrit l'icône de l'installateur, l'icône des fenêtres et les deux images de l'écran de chargement.
Usage : python3 outils/logo.py (depuis la racine du dépôt)."""
import math
from PIL import Image, ImageDraw

K = 4


def logo(t, fond=True):
    T = t * K
    im = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if fond:
        d.rounded_rectangle((0, 0, T - 1, T - 1), radius=int(T * .22), fill=(22, 120, 126, 255))
    m = T * (.0 if not fond else .0)

    def p(x, y):
        return (m + x * T, m + y * T)
    d.polygon([p(.5, .16), p(.84, .34), p(.5, .52), p(.16, .34)], fill=(120, 236, 236, 255))
    d.polygon([p(.16, .34), p(.5, .52), p(.5, .86), p(.16, .68)], fill=(40, 170, 176, 255))
    d.polygon([p(.84, .34), p(.5, .52), p(.5, .86), p(.84, .68)], fill=(26, 140, 146, 255))
    return im.resize((t, t), Image.LANCZOS)


def anneau(t):
    """Anneau de petits blocs qui tourne autour du logo pendant le chargement."""
    T = t * K
    im = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c, r, n = T / 2, T * .44, 24
    for k in range(n):
        a = k * 2 * math.pi / n
        x, y = c + r * math.cos(a), c + r * math.sin(a)
        e = T * .022 * (0.45 + 0.55 * (k / n))
        alpha = int(60 + 195 * (k / n))
        d.rectangle((x - e, y - e, x + e, y + e), fill=(63, 208, 212, alpha))
    return im.resize((t, t), Image.LANCZOS)


logo(1024).save('build/icon.png')
logo(1024).save('app/assets/images/SealCircle.png')
logo(256).save('app/assets/images/SealCircle.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
seal = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
seal.alpha_composite(logo(560), (232, 232))
seal.save('app/assets/images/LoadingSeal.png')
anneau(1024).save('app/assets/images/LoadingText.png')
print('ok')

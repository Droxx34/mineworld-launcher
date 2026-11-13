"""(13/11/2026) Icônes du launcher à partir du logo MineWorld (outils/logo_mineworld.png : « MW » en blocs au coucher du
soleil, fourni par MineWorld le 13/11/2026, découpé à son carré arrondi, fond transparent).
Écrit l'icône de l'installateur, l'icône des fenêtres et les deux images de l'écran de chargement.
Usage : python3 outils/logo.py (depuis la racine du dépôt)."""
import math
from PIL import Image, ImageDraw

K = 4
logo = Image.open('outils/logo_mineworld.png').convert('RGBA')


def taille(t):
    return logo.resize((t, t), Image.LANCZOS)


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
        # du bleu au doré, comme la lueur du logo
        f = k / n
        col = (int(60 + 195 * f), int(170 + 20 * f), int(255 - 215 * f), alpha)
        d.rectangle((x - e, y - e, x + e, y + e), fill=col)
    return im.resize((t, t), Image.LANCZOS)


taille(1024).save('build/icon.png')
taille(1024).save('app/assets/images/SealCircle.png')
taille(256).save('app/assets/images/SealCircle.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
seal = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
seal.alpha_composite(taille(600), (212, 212))
seal.save('app/assets/images/LoadingSeal.png')
anneau(1024).save('app/assets/images/LoadingText.png')
print('ok')

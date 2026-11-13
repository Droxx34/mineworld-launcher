"""(13/11/2026) Paysages en blocs inventés (fonds du launcher en attendant de vraies images de MineWorld).
gen(i, largeur, hauteur) -> image RGB."""
import random
from PIL import Image, ImageDraw

CIELS = {
    'jour': ((96, 156, 246), (186, 216, 255)),
    'soir': ((92, 82, 160), (255, 160, 102)),
    'nuit': ((8, 12, 34), (34, 44, 86)),
    'matin': ((150, 190, 250), (255, 222, 190)),
}
SCENES = [('ville', 'jour'), ('plage', 'soir'), ('ville', 'nuit'), ('foret', 'jour'), ('roue', 'soir'), ('plage', 'jour'),
          ('foret', 'matin'), ('ville', 'soir'), ('roue', 'nuit'), ('ville', 'matin'), ('foret', 'soir'), ('plage', 'matin')]


def _mel(a, b, k):
    return tuple(int(a[j] + (b[j] - a[j]) * k) for j in range(3))


def _var(c, r, n=10):
    return tuple(max(0, min(255, v + r.randint(-n, n))) for v in c)


def gen(i, w, h):
    sc_, moment = SCENES[i % len(SCENES)]
    r = random.Random(1000 + i * 37)
    gw, gh = 96, 54   # grille de « pixels » du jeu
    if w > 2.2 * h:   # bannière : plus large, mêmes « pixels »
        gw = int(54 * w / h)
    im = Image.new('RGB', (gw, gh))
    d = ImageDraw.Draw(im)
    c1, c2 = CIELS[moment]
    for y in range(gh):
        d.line((0, y, gw, y), fill=_mel(c1, c2, y / (gh * .75)) if y < gh * .75 else c2)
    nuit = moment == 'nuit'
    # soleil / lune, nuages, étoiles
    if nuit:
        for _ in range(40):
            d.point((r.randrange(gw), r.randrange(int(gh * .5))), fill=(220, 226, 255))
        sxx = r.randint(10, gw - 16)
        d.rectangle((sxx, 6, sxx + 5, 11), fill=(236, 238, 250))
    else:
        sxx = r.randint(8, gw - 14)
        sy_ = r.randint(4, 14) if moment == 'jour' else r.randint(16, 24)
        d.rectangle((sxx, sy_, sxx + 6, sy_ + 6), fill=(255, 244, 190) if moment != 'soir' else (255, 214, 120))
        for _ in range(r.randint(2, 4)):
            cx, cy = r.randint(-5, gw), r.randint(3, 16)
            for k in range(r.randint(2, 4)):
                d.rectangle((cx + k * 4, cy - (k % 2), cx + k * 4 + r.randint(6, 10), cy + 2), fill=_mel((255, 255, 255), c2, .15))
    sol = int(gh * .66)
    if sc_ == 'plage':
        mer = int(gh * .58)
        eau = (40, 110, 200) if moment != 'soir' else (70, 90, 170)
        d.rectangle((0, mer, gw, gh), fill=eau)
        for _ in range(26):
            x, y = r.randrange(gw), r.randrange(mer + 1, int(gh * .8))
            d.line((x, y, x + r.randint(2, 6), y), fill=_mel(eau, (255, 255, 255), .35))
        sable = int(gh * .8)
        for x in range(gw):
            yy = sable + int(2 * (x / gw))
            d.line((x, yy, x, gh), fill=_var((226, 208, 150), r, 6))
        for _ in range(3):
            x = r.randint(4, gw - 8)
            d.rectangle((x, sable - 12, x + 1, sable), fill=(120, 84, 50))
            d.rectangle((x - 4, sable - 15, x + 5, sable - 11), fill=(60, 140, 60))
    else:
        haut = [0] * gw
        hh = sol
        for x in range(gw):
            if x % 4 == 0:
                hh = max(int(gh * .55), min(int(gh * .75), hh + r.randint(-2, 2)))
            haut[x] = hh
        if sc_ == 'ville' or sc_ == 'roue':
            x = 0
            while x < gw:
                bw, bh = r.randint(8, 16), r.randint(10, 30)
                coul = r.choice([(214, 206, 190), (188, 152, 120), (170, 170, 178), (226, 222, 214), (150, 110, 90)])
                if nuit:
                    coul = _mel(coul, (20, 24, 40), .65)
                top = sol - bh
                d.rectangle((x, top, x + bw - 1, sol), fill=coul)
                d.rectangle((x, top, x + bw - 1, top), fill=_mel(coul, (0, 0, 0), .25))
                for wy in range(top + 2, sol - 2, 4):
                    for wx in range(x + 2, x + bw - 2, 3):
                        allume = nuit and r.random() < .55
                        d.rectangle((wx, wy, wx + 1, wy + 1), fill=(255, 214, 120) if allume else _mel(coul, (60, 90, 120), .6))
                x += bw + r.randint(0, 3)
            if sc_ == 'roue':
                cx, cy, rr = int(gw * .62), int(gh * .36), 17
                import math
                col = (240, 200, 60) if not nuit else (255, 220, 110)
                for k in range(48):
                    a = k * math.pi * 2 / 48
                    d.point((cx + int(rr * math.cos(a)), cy + int(rr * math.sin(a))), fill=col)
                for k in range(8):
                    a = k * math.pi / 4
                    d.line((cx, cy, cx + int(rr * math.cos(a)), cy + int(rr * math.sin(a))), fill=col)
                    gx, gy = cx + int(rr * math.cos(a)), cy + int(rr * math.sin(a))
                    d.rectangle((gx - 1, gy, gx + 1, gy + 2), fill=r.choice([(220, 60, 80), (60, 160, 220), (90, 200, 120)]))
                d.line((cx, cy, cx - 8, sol), fill=col)
                d.line((cx, cy, cx + 8, sol), fill=col)
            for x in range(gw):
                d.line((x, sol, x, gh), fill=_var((128, 128, 132) if not nuit else (54, 56, 66), r, 5))
            for x in range(0, gw, 6):
                d.line((x, sol + 3, x + 3, sol + 3), fill=(230, 230, 230) if not nuit else (120, 120, 130))
        else:   # forêt
            for x in range(gw):
                herbe = (96, 170, 70) if moment != 'soir' else (110, 150, 70)
                d.point((x, haut[x]), fill=_var(herbe, r, 8))
                d.line((x, haut[x] + 1, x, haut[x] + 3), fill=_var((134, 96, 64), r, 8))
                d.line((x, haut[x] + 4, x, haut[x] + 6), fill=_var((120, 120, 124), r, 8))
                d.line((x, haut[x] + 7, x, gh), fill=_var((84, 150, 62) if moment != 'soir' else (90, 128, 60), r, 9))
            for _ in range(9):
                x = r.randint(2, gw - 6)
                t = r.randint(6, 12)
                y0 = haut[x]
                d.rectangle((x, y0 - t, x + 1, y0), fill=(110, 80, 50))
                f = (52, 120, 46) if moment != 'soir' else (64, 110, 46)
                d.rectangle((x - 3, y0 - t - 5, x + 4, y0 - t + 1), fill=_var(f, r, 10))
                d.rectangle((x - 2, y0 - t - 7, x + 3, y0 - t - 5), fill=_var(f, r, 10))
    big = im.resize((gw * 8, gh * 8), Image.NEAREST)
    # recadrage au format demandé, puis taille
    k = max(w / big.width, h / big.height)
    big = big.resize((max(1, int(big.width * k + 1)), max(1, int(big.height * k + 1))), Image.LANCZOS)
    ox, oy = (big.width - w) // 2, (big.height - h) // 2
    return big.crop((ox, oy, ox + w, oy + h))

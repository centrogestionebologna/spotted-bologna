"""Genera le icone dell'app con il logo Spotted Bologna.

Icona = logo (cuore rosso, SPOTTED / BOLOGNA e OFFICIAL) su fondo bianco,
lo stesso marchio della schermata di caricamento e dell'intestazione.
Produce favicon.ico, logo192.png e logo512.png.

Uso: python3 tools/genera-icona.py
"""

import math
import os

from PIL import Image, ImageDraw, ImageFont

BASE = 2048

BIANCO = "#ffffff"
NERO = "#111111"
CUORE = "#e0313f"

CARTA = "#111111"
OFFICIAL = "#1c1c1c"

CARTELLE_FONT = (
    "/opt/freestyle/python/lib/python3.12/site-packages/"
    "matplotlib/mpl-data/fonts/ttf",
    "/usr/share/fonts",
    "/usr/local/share/fonts",
    os.path.expanduser("~/.fonts"),
)


def trova_font(nome):
    """Cerca un .ttf tra i font disponibili; None se non c'e'."""
    for cartella in CARTELLE_FONT:
        candidato = os.path.join(cartella, nome)

        if os.path.exists(candidato):
            return candidato

        if not os.path.isdir(cartella):
            continue

        for radice, _, files in os.walk(cartella):
            if nome in files:
                return os.path.join(radice, nome)

    return None


FONT_GRASSETTO = trova_font("DejaVuSans-Bold.ttf") or trova_font(
    "LiberationSans-Bold.ttf"
)
FONT_NORMALE = trova_font("DejaVuSans.ttf") or trova_font(
    "LiberationSans-Regular.ttf"
)


def larghezza_tracciata(font, testo, traccia):
    """Larghezza del testo con lo spazio extra tra una lettera e l'altra."""
    if not testo:
        return 0.0

    return sum(font.getlength(c) for c in testo) + traccia * (
        len(testo) - 1
    )


def scrivi_tracciato(draw, centro_x, centro_y, testo, font, traccia, colore):
    """Scrive il testo centrato, lettera per lettera, con la spaziatura."""
    x = centro_x - larghezza_tracciata(font, testo, traccia) / 2

    for carattere in testo:
        draw.text(
            (x, centro_y),
            carattere,
            font=font,
            fill=colore,
            anchor="lm",
        )
        x += font.getlength(carattere) + traccia


def disegna_cuore(draw, centro_x, centro_y, larghezza, colore):
    """Cuore pieno dalla curva classica, grande quanto richiesto."""
    scala = larghezza / 32.0

    punti = []

    for passo in range(0, 360, 2):
        t = math.radians(passo)

        x = 16 * math.sin(t) ** 3
        y = (
            13 * math.cos(t)
            - 5 * math.cos(2 * t)
            - 2 * math.cos(3 * t)
            - math.cos(4 * t)
        )

        # Sullo schermo la y cresce verso il basso: si ribalta.
        punti.append((x * scala, -y * scala))

    alto = max(p[1] for p in punti)
    basso = min(p[1] for p in punti)
    spostamento = centro_y - (alto + basso) / 2

    draw.polygon(
        [(centro_x + px, spostamento + py) for px, py in punti],
        fill=colore,
    )

    return alto - basso


def disegna_logo(lato):
    """Logo su fondo bianco, dentro la zona sicura delle icone."""
    immagine = Image.new("RGB", (lato, lato), BIANCO)
    disegno = ImageDraw.Draw(immagine)

    prova = ImageFont.truetype(FONT_GRASSETTO, 100)
    larghezza_prova = larghezza_tracciata(prova, "BOLOGNA", -1.8)

    dimensione = int(round(100 * (0.66 * lato) / larghezza_prova))
    grassetto = ImageFont.truetype(FONT_GRASSETTO, dimensione)
    traccia = -0.02 * dimensione

    official_font = ImageFont.truetype(
        FONT_NORMALE, max(int(round(dimensione * 0.3)), 8)
    )
    traccia_official = 0.4 * official_font.size

    larghezza_cuore = 0.17 * lato
    altezza_cuore = larghezza_cuore * 0.9

    altezza_riga = dimensione * 1.03
    spazio_cuore = 0.06 * lato
    spazio_official = 0.045 * lato
    altezza_official = official_font.size * 1.2

    totale = (
        altezza_cuore
        + spazio_cuore
        + altezza_riga * 2
        + spazio_official
        + altezza_official
    )

    y = (lato - totale) / 2

    disegna_cuore(
        disegno,
        lato / 2,
        y + altezza_cuore / 2,
        larghezza_cuore,
        CUORE,
    )

    y += altezza_cuore + spazio_cuore

    scrivi_tracciato(
        disegno,
        lato / 2,
        y + altezza_riga / 2,
        "SPOTTED",
        grassetto,
        traccia,
        NERO,
    )

    y += altezza_riga

    scrivi_tracciato(
        disegno,
        lato / 2,
        y + altezza_riga / 2,
        "BOLOGNA",
        grassetto,
        traccia,
        NERO,
    )

    y += altezza_riga + spazio_official

    scrivi_tracciato(
        disegno,
        lato / 2,
        y + altezza_official / 2,
        "OFFICIAL",
        official_font,
        traccia_official,
        OFFICIAL,
    )

    return immagine


def disegna_solo_cuore(lato):
    """Versione per la scheda del browser: solo il cuore, leggibile a 16 px."""
    immagine = Image.new("RGB", (lato, lato), BIANCO)
    disegno = ImageDraw.Draw(immagine)

    disegna_cuore(
        disegno,
        lato / 2,
        lato / 2,
        0.52 * lato,
        CUORE,
    )

    return immagine


def riduci(immagine, lato):
    return immagine.resize((lato, lato), Image.LANCZOS)


def main():
    if not FONT_GRASSETTO:
        raise SystemExit(
            "Nessun font in grassetto trovato: installare un .ttf."
        )

    base = disegna_logo(BASE)

    for lato in (512, 192):
        riduci(base, lato).save(
            f"public/logo{lato}.png", optimize=True
        )
        print(f"public/logo{lato}.png scritto")

    cuore = disegna_solo_cuore(BASE)
    favicon = riduci(cuore, 256)
    favicon.save(
        "public/favicon.ico",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    print("public/favicon.ico scritto")

    # Anteprima ingrandita delle icone piccole, per controllarle.
    os.makedirs("artifacts", exist_ok=True)
    strisce = [
        riduci(base, lato).resize((lato * 8, lato * 8), Image.NEAREST)
        for lato in (32, 48)
    ]
    strisce.insert(
        0,
        riduci(cuore, 32).resize((32 * 8, 32 * 8), Image.NEAREST),
    )
    larghezza = sum(s.width for s in strisce) + 16 * len(strisce)
    altezza = max(s.height for s in strisce)
    prova = Image.new("RGB", (larghezza, altezza), "#5c1028")

    x = 0

    for striscia in strisce:
        prova.paste(striscia, (x, (altezza - striscia.height) // 2))
        x += striscia.width + 16

    prova.save("artifacts/favicon-anteprima.png")
    print("artifacts/favicon-anteprima.png scritto")


if __name__ == "__main__":
    main()

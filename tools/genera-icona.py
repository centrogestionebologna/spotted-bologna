"""Genera le icone dell'app (favicon.ico, logo192.png, logo512.png).

Il disegno e' lo stesso di public/logo-atom.svg: quadrato grigio con
angoli arrotondati e atomo azzurro. Serve perche' nel container non c'e'
nessun convertitore SVG -> PNG; richiede solo numpy.

Uso: python3 tools/genera-icona.py
"""

import struct
import zlib

import numpy as np

BASE = 1536

GRIGIO = np.array([0xDB, 0xDB, 0xDB], dtype=np.float64) / 255
AZZURRO = np.array([0x45, 0xAE, 0xDE], dtype=np.float64) / 255

RAGGIO_ANGOLI = 116 / 512
ORBITA_RX = 168 / 512
ORBITA_RY = 74 / 512
ORBITA_SPESSORE = 15 / 512
PUNTO_R = 34 / 512
ANGOLI = (0.0, 60.0, 120.0)


def copertura(valore):
    return np.clip(valore, 0.0, 1.0)


def disegna(lato):
    """Restituisce l'icona come array (lato, lato, 4) RGBA."""
    asse = (np.arange(lato, dtype=np.float64) + 0.5) / lato
    x, y = np.meshgrid(asse, asse)

    # Quadrato con angoli arrotondati.
    dx = np.abs(x - 0.5) - (0.5 - RAGGIO_ANGOLI)
    dy = np.abs(y - 0.5) - (0.5 - RAGGIO_ANGOLI)
    fuori = np.hypot(np.maximum(dx, 0), np.maximum(dy, 0))
    dentro = np.minimum(np.maximum(dx, dy), 0)
    distanza = fuori + dentro - RAGGIO_ANGOLI
    alpha_sfondo = copertura(0.5 - distanza * lato)

    rgb = np.broadcast_to(GRIGIO, (lato, lato, 3)).copy()
    alpha = alpha_sfondo.copy()

    # Orbite dell'atomo: tre ellissi ruotate.
    cx = x - 0.5
    cy = y - 0.5
    alpha_orbite = np.zeros((lato, lato), dtype=np.float64)

    for angolo in ANGOLI:
        rad = np.deg2rad(angolo)
        coseno, seno = np.cos(rad), np.sin(rad)
        px = cx * coseno + cy * seno
        py = -cx * seno + cy * coseno

        u = px / ORBITA_RX
        v = py / ORBITA_RY
        f = u * u + v * v

        gradiente = 2 * np.hypot(u / ORBITA_RX, v / ORBITA_RY)
        gradiente = np.where(gradiente < 1e-9, 1e-9, gradiente)

        dist = np.abs(f - 1) / gradiente
        alpha_orbite = np.maximum(
            alpha_orbite,
            copertura((ORBITA_SPESSORE / 2 - dist) * lato + 0.5),
        )

    # Punto centrale.
    distanza_punto = np.hypot(cx, cy) - PUNTO_R
    alpha_punto = copertura(0.5 - distanza_punto * lato)

    alpha_forma = np.maximum(alpha_orbite, alpha_punto)
    rgb = rgb * (1 - alpha_forma[..., None]) + AZZURRO * alpha_forma[..., None]

    rgba = np.empty((lato, lato, 4), dtype=np.float64)
    rgba[..., :3] = rgb
    rgba[..., 3] = alpha
    return rgba


def riduci(immagine, fattore):
    """Riduce l'immagine mediando i blocchi: bordi gia' morbidi."""
    lato = immagine.shape[0] // fattore
    return immagine.reshape(lato, fattore, lato, fattore, 4).mean(axis=(1, 3))


def png(immagine):
    """Codifica un array RGBA in PNG (senza dipendenze esterne)."""
    byte = np.clip(immagine * 255 + 0.5, 0, 255).astype(np.uint8)
    altezza, larghezza = byte.shape[:2]

    righe = b"".join(
        b"\x00" + byte[riga].tobytes() for riga in range(altezza)
    )

    def blocco(tipo, dati):
        corpo = tipo + dati
        return (
            struct.pack(">I", len(dati))
            + corpo
            + struct.pack(">I", zlib.crc32(corpo) & 0xFFFFFFFF)
        )

    return (
        b"\x89PNG\r\n\x1a\n"
        + blocco(b"IHDR", struct.pack(">IIBBBBB", larghezza, altezza, 8, 6, 0, 0, 0))
        + blocco(b"IDAT", zlib.compress(righe, 9))
        + blocco(b"IEND", b"")
    )


def ico(immagini):
    """Costruisce un .ico con piu' PNG dentro."""
    intestazione = struct.pack("<HHH", 0, 1, len(immagini))
    offset = 6 + 16 * len(immagini)
    voci = b""
    dati = b""

    for immagine in immagini:
        png_bytes = png(immagine)
        lato = immagine.shape[0]
        voci += struct.pack(
            "<BBBBHHII",
            lato if lato < 256 else 0,
            lato if lato < 256 else 0,
            0,
            0,
            1,
            32,
            len(png_bytes),
            offset,
        )
        offset += len(png_bytes)
        dati += png_bytes

    return intestazione + voci + dati


def main():
    base = disegna(BASE)

    for lato, fattore in ((512, 3), (192, 8)):
        with open(f"public/logo{lato}.png", "wb") as file:
            file.write(png(riduci(base, fattore)))
        print(f"public/logo{lato}.png scritto")

    immagini = [riduci(base, fattore) for fattore in (96, 48, 32)]
    with open("public/favicon.ico", "wb") as file:
        file.write(ico(immagini))
    print("public/favicon.ico scritto")


if __name__ == "__main__":
    main()

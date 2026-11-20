/*
 * Modelli grafici dello spotted verticale (1080x1920).
 *
 * Sono le cinque varianti della card ufficiale: cambia lo sfondo, mentre
 * testo, data e invito restano quelli dello spotted scaricato. Ogni
 * chiamata a scegliModelloVerticale() passa al modello successivo, cosi'
 * scaricando piu' spotted non escono tutti con lo stesso colore.
 */
export const MODELLI_VERTICALE = [
  {
    chiave: "magenta",
    etichetta: "Magenta",
    sfondo: {
      stop: [
        [0, "#ff0a76"],
        [0.28, "#f0007c"],
        [0.55, "#b312bd"],
        [0.78, "#6d14a8"],
        [1, "#3d0f85"]
      ]
    },
    bagliori: [
      {
        x: 0.5,
        y: 0.08,
        raggio: 0.5,
        colore: "rgba(255,255,255,0.10)"
      },
      {
        x: 0.5,
        y: 0.42,
        raggio: 0.35,
        colore: "rgba(255,0,120,0.18)"
      }
    ]
  },
  {
    chiave: "arancio",
    etichetta: "Arancio",
    sfondo: {
      stop: [
        [0, "#f9a01b"],
        [0.35, "#f78a1e"],
        [0.68, "#f4652c"],
        [1, "#e83c3f"]
      ]
    },
    bagliori: [
      {
        x: 0.62,
        y: 0.08,
        raggio: 0.55,
        colore: "rgba(255,220,150,0.18)"
      },
      {
        x: 0.3,
        y: 0.85,
        raggio: 0.45,
        colore: "rgba(255,80,70,0.15)"
      }
    ]
  },
  {
    chiave: "azzurro",
    etichetta: "Azzurro",
    sfondo: {
      stop: [
        [0, "#8ed2f7"],
        [0.3, "#69b6ef"],
        [0.58, "#4a86e2"],
        [0.82, "#3d45bb"],
        [1, "#2a2a86"]
      ]
    },
    bagliori: [
      {
        x: 0.45,
        y: 0.08,
        raggio: 0.5,
        colore: "rgba(255,255,255,0.22)"
      },
      {
        x: 0.15,
        y: 0.92,
        raggio: 0.5,
        colore: "rgba(50,30,140,0.35)"
      }
    ]
  },
  {
    chiave: "verde",
    etichetta: "Verde acqua",
    sfondo: {
            stop: [
        [0, "#0a3b4d"],
        [0.22, "#0d5b68"],
        [0.48, "#128e8c"],
        [0.7, "#16a89c"],
        [1, "#0a3a4a"]
      ]
    },
    bagliori: [
      {
        x: 0.5,
        y: 0.78,
        raggio: 0.6,
        colore: "rgba(80,255,230,0.55)"
      },
      {
        x: 0.5,
        y: 0.55,
        raggio: 0.35,
        colore: "rgba(40,230,210,0.28)"
      },
      {
        x: 0.5,
        y: 0.02,
        raggio: 0.45,
        colore: "rgba(255,255,255,0.07)"
      }
    ]
  },
  {
    chiave: "arcobaleno",
    etichetta: "Arcobaleno",
    diagonale: true,
    sfondo: {
      stop: [
        [0, "#ff9a1f"],
        [0.18, "#ffc21f"],
        [0.38, "#86cc2f"],
        [0.55, "#38c4e8"],
        [0.75, "#2f6fe0"],
        [1, "#6a2bd0"]
      ]
    },
    bagliori: [
      {
        x: 0.08,
        y: 0.04,
        raggio: 0.55,
        colore: "rgba(255,140,20,0.65)"
      },
      {
        x: 0.82,
        y: 0.06,
        raggio: 0.45,
        colore: "rgba(255,235,40,0.6)"
      },
      {
        x: 0.08,
        y: 0.5,
        raggio: 0.5,
        colore: "rgba(60,220,80,0.6)"
      },
      {
        x: 0.12,
        y: 0.92,
        raggio: 0.5,
        colore: "rgba(130,40,220,0.65)"
      },
      {
        x: 0.92,
        y: 0.9,
        raggio: 0.55,
        colore: "rgba(30,110,255,0.65)"
      },
      {
        x: 0.55,
        y: 0.5,
        raggio: 0.35,
        colore: "rgba(40,200,240,0.35)"
      }
    ]
  }
];

let prossimoModello = 0;

export function scegliModelloVerticale() {
  const modello =
    MODELLI_VERTICALE[
      prossimoModello % MODELLI_VERTICALE.length
    ];

  prossimoModello =
    (prossimoModello + 1) % MODELLI_VERTICALE.length;

  return modello;
}

export function azzeraModelliVerticale() {
  prossimoModello = 0;
}

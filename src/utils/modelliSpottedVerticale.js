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
        [0, "#2ec3b0"],
        [0.32, "#16a49b"],
        [0.6, "#0f7a86"],
        [0.82, "#0a4f60"],
        [1, "#072c3a"]
      ]
    },
    bagliori: [
      {
        x: 0.5,
        y: 0.82,
        raggio: 0.4,
        colore: "rgba(50,255,220,0.22)"
      },
      {
        x: 0.5,
        y: 0.05,
        raggio: 0.4,
        colore: "rgba(255,255,255,0.08)"
      }
    ]
  },
  {
    chiave: "arcobaleno",
    etichetta: "Arcobaleno",
    diagonale: true,
    sfondo: {
      stop: [
        [0, "#f7941d"],
        [0.25, "#f2c31c"],
        [0.45, "#8cc63f"],
        [0.65, "#2bb3e0"],
        [0.85, "#2f6fe0"],
        [1, "#5b2bd0"]
      ]
    },
    bagliori: [
      {
        x: 0.08,
        y: 0.04,
        raggio: 0.55,
        colore: "rgba(250,140,20,0.55)"
      },
      {
        x: 0.9,
        y: 0.06,
        raggio: 0.45,
        colore: "rgba(220,235,40,0.45)"
      },
      {
        x: 0.06,
        y: 0.45,
        raggio: 0.45,
        colore: "rgba(40,190,70,0.40)"
      },
      {
        x: 0.12,
        y: 0.92,
        raggio: 0.5,
        colore: "rgba(110,40,210,0.55)"
      },
      {
        x: 0.92,
        y: 0.9,
        raggio: 0.55,
        colore: "rgba(20,100,245,0.55)"
      },
      {
        x: 0.55,
        y: 0.5,
        raggio: 0.35,
        colore: "rgba(40,180,230,0.30)"
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

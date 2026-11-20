import { scegliModelloVerticale } from "./modelliSpottedVerticale";

const FONT_TESTO =
  '"Poppins", "Segoe UI", Arial, sans-serif';

let promessaFontSpotted = null;

const basePubblico = () => {
  if (typeof process === "undefined" || !process.env) {
    return "";
  }

  return String(
    process.env.PUBLIC_URL || ""
  ).replace(/\/$/, "");
};

const caricaFontSpotted = () => {
  if (promessaFontSpotted) {
    return promessaFontSpotted;
  }

  if (
    typeof document === "undefined" ||
    !document.fonts ||
    typeof FontFace === "undefined"
  ) {
    promessaFontSpotted = Promise.resolve();
    return promessaFontSpotted;
  }

  const base = basePubblico();
  const definizioni = [
    ["400", "Poppins-Regular.ttf"],
    ["600", "Poppins-SemiBold.ttf"],
    ["700", "Poppins-Bold.ttf"]
  ];

  promessaFontSpotted = Promise.all(
    definizioni.map(async ([peso, file]) => {
      try {
        const font = new FontFace(
          "Poppins",
          `url(${base}/fonts/${file})`,
          { weight: peso }
        );

        await font.load();
        document.fonts.add(font);
      } catch (errore) {
        // Se il font non si carica si continua con Arial.
      }
    })
  );

  return promessaFontSpotted;
};

const spezzaTestoInRighe = (
  context,
  testo,
  maxWidth
) => {
  const righe = [];

  String(testo || "")
    .split("\n")
    .forEach((paragrafo) => {
      let riga = "";

      paragrafo.split(/\s+/).forEach((parola) => {
        const candidata = riga
          ? `${riga} ${parola}`
          : parola;

        if (
          riga &&
          context.measureText(candidata).width >
            maxWidth
        ) {
          righe.push(riga);
          riga = parola;
        } else {
          riga = candidata;
        }
      });

      righe.push(riga);
    });

  return righe;
};

const troncaRiga = (
  context,
  riga,
  maxWidth
) => {
  let risultato = String(riga || "").trim();

  while (
    risultato.length > 0 &&
    context.measureText(`${risultato}…`).width >
      maxWidth
  ) {
    risultato = risultato
      .slice(0, -1)
      .trimEnd();
  }

  return `${risultato}…`;
};

export async function creaImmagineSpotted(
  post,
  likesCount = 0,
  formato = "verticale"
) {
  if (formato === "instagram") {
    return creaImmagineSpottedInstagram(
      post,
      likesCount
    );
  }

  return creaImmagineSpottedVerticale(post);
}

const disegnaCuore = (
  context,
  centroX,
  centroY,
  larghezza,
  colore
) => {
  const scala = larghezza / 34;

  context.save();
  context.beginPath();

  for (let passo = 0; passo <= 360; passo += 3) {
    const t = (passo * Math.PI) / 180;
    const x = 16 * Math.sin(t) ** 3;
    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);
    const puntoX = centroX + x * scala;
    const puntoY = centroY - y * scala;

    if (passo === 0) {
      context.moveTo(puntoX, puntoY);
    } else {
      context.lineTo(puntoX, puntoY);
    }
  }

  context.closePath();
  context.fillStyle = colore;
  context.fill();
  context.restore();
};

const scriviTracciato = (
  context,
  testo,
  x,
  y,
  font,
  traccia,
  scalaX = 1
) => {
  const fontPrecedente = context.font;
  const caratteri = Array.from(testo);
  let larghezza = 0;

  context.font = font;
  caratteri.forEach((carattere, indice) => {
    larghezza += context.measureText(carattere).width;

    if (indice < caratteri.length - 1) {
      larghezza += traccia;
    }
  });

  context.save();
  context.translate(x, y);
  context.scale(scalaX, 1);
  context.font = font;

  let cursore = 0;

  caratteri.forEach((carattere) => {
    context.fillText(carattere, cursore, 0);
    cursore +=
      context.measureText(carattere).width + traccia;
  });

  context.restore();
  context.font = fontPrecedente;

  return larghezza * scalaX;
};

const disegnaTestoSuArco = (
  context,
  testo,
  centroX,
  centroY,
  raggio,
  angoloCentro,
  verso,
  font,
  colore,
  traccia
) => {
  context.save();
  context.font = font;
  context.fillStyle = colore;
  context.textAlign = "center";
  context.textBaseline = "middle";

  const caratteri = Array.from(testo);
  const larghezze = caratteri.map(
    (carattere) =>
      context.measureText(carattere).width + traccia
  );
  const totale = larghezze.reduce(
    (somma, larghezza) => somma + larghezza,
    0
  );
  const ampiezza = totale / raggio;
  let angolo =
    angoloCentro - (ampiezza / 2) * verso;

  caratteri.forEach((carattere, indice) => {
    const larghezza = larghezze[indice];
    const angoloCarattere =
      angolo + (larghezza / raggio / 2) * verso;
    const x =
      centroX + Math.cos(angoloCarattere) * raggio;
    const y =
      centroY + Math.sin(angoloCarattere) * raggio;

    context.save();
    context.translate(x, y);
    context.rotate(
      angoloCarattere + (Math.PI / 2) * verso
    );
    context.fillText(carattere, 0, 0);
    context.restore();

    angolo += (larghezza / raggio) * verso;
  });

  context.restore();
};

const disegnaTorri = (
  context,
  centroX,
  centroY,
  raggio
) => {
  const terra = centroY + 56;

  context.save();
  context.beginPath();
  context.arc(
    centroX,
    centroY,
    raggio,
    0,
    Math.PI * 2
  );
  context.clip();
  context.strokeStyle = "rgba(255,255,255,0.94)";
  context.fillStyle = "rgba(255,255,255,0.94)";
  context.lineWidth = 1.8;
  context.lineCap = "round";
  context.lineJoin = "round";

  const linea = (x1, y1, x2, y2) => {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  };

  const finestre = (
    x,
    y,
    colonne,
    righe,
    passoX,
    passoY,
    larghezza = 3,
    altezza = 5
  ) => {
    for (let riga = 0; riga < righe; riga += 1) {
      for (let colonna = 0; colonna < colonne; colonna += 1) {
        context.strokeRect(
          x + colonna * passoX,
          y + riga * passoY,
          larghezza,
          altezza
        );
      }
    }
  };

  linea(centroX - 98, terra, centroX + 98, terra);

  // Torre degli Asinelli, alta e con la guglia.
  const asinelliX = centroX + 2;
  const asinelliTop = centroY - 86;
  const asinelliLarghezza = 30;

  context.strokeRect(
    asinelliX,
    asinelliTop,
    asinelliLarghezza,
    terra - asinelliTop
  );

  context.beginPath();
  context.moveTo(centroX + 18, asinelliTop - 20);
  context.lineTo(asinelliX - 4, asinelliTop);
  context.lineTo(
    asinelliX + asinelliLarghezza + 4,
    asinelliTop
  );
  context.closePath();
  context.stroke();

  context.beginPath();
  context.arc(
    centroX + 18,
    asinelliTop - 22,
    1.6,
    0,
    Math.PI * 2
  );
  context.fill();

  finestre(
    asinelliX + 5,
    asinelliTop + 18,
    4,
    8,
    6.5,
    11
  );

  context.beginPath();
  context.moveTo(asinelliX + 11, terra);
  context.lineTo(asinelliX + 11, terra - 12);
  context.arc(asinelliX + 15, terra - 12, 4, Math.PI, 0);
  context.lineTo(asinelliX + 19, terra);
  context.stroke();

  // Torre della Garisenda, pendente.
  context.save();
  context.translate(centroX - 40, terra);
  context.rotate(-0.14);

  const garisendaLarghezza = 22;
  const garisendaAltezza = 128;

  context.strokeRect(
    -garisendaLarghezza / 2,
    -garisendaAltezza,
    garisendaLarghezza,
    garisendaAltezza
  );

  for (let indice = 0; indice < 3; indice += 1) {
    context.strokeRect(
      -garisendaLarghezza / 2 - 2 + indice * 8,
      -garisendaAltezza - 5,
      5,
      5
    );
  }

  finestre(
    -garisendaLarghezza / 2 + 4,
    -garisendaAltezza + 16,
    2,
    7,
    8,
    12
  );

  context.restore();

  // Palazzo con cupola a sinistra.
  const sinistraX = centroX - 94;
  const sinistraY = terra - 46;
  const sinistraLarghezza = 42;

  context.strokeRect(
    sinistraX,
    sinistraY,
    sinistraLarghezza,
    46
  );
  linea(
    sinistraX - 3,
    sinistraY,
    sinistraX + sinistraLarghezza + 3,
    sinistraY
  );

  context.beginPath();
  context.arc(
    sinistraX + 21,
    sinistraY,
    12,
    Math.PI,
    0
  );
  context.stroke();
  linea(
    sinistraX + 21,
    sinistraY - 12,
    sinistraX + 21,
    sinistraY - 21
  );
  linea(
    sinistraX + 18,
    sinistraY - 18,
    sinistraX + 24,
    sinistraY - 18
  );

  finestre(
    sinistraX + 6,
    sinistraY + 12,
    3,
    2,
    12,
    13,
    4,
    6
  );

  context.beginPath();
  context.moveTo(sinistraX + 17, terra);
  context.lineTo(sinistraX + 17, terra - 10);
  context.arc(sinistraX + 21, terra - 10, 4, Math.PI, 0);
  context.lineTo(sinistraX + 25, terra);
  context.stroke();

  // Palazzo con portico a destra.
  const destraX = centroX + 38;
  const destraY = terra - 38;
  const destraLarghezza = 50;

  context.strokeRect(
    destraX,
    destraY,
    destraLarghezza,
    38
  );
  context.beginPath();
  context.moveTo(destraX - 3, destraY);
  context.lineTo(destraX + 25, destraY - 14);
  context.lineTo(destraX + 53, destraY);
  context.stroke();

  for (let indice = 0; indice < 3; indice += 1) {
    const centroArco = destraX + 10 + indice * 15;

    context.beginPath();
    context.moveTo(centroArco - 5, terra);
    context.lineTo(centroArco - 5, terra - 13);
    context.arc(
      centroArco,
      terra - 13,
      5,
      Math.PI,
      0
    );
    context.lineTo(centroArco + 5, terra);
    context.stroke();
  }

  // Piccole figure sotto i portici.
  const figura = (x, altezza) => {
    context.beginPath();
    context.arc(
      x,
      terra - altezza,
      1.9,
      0,
      Math.PI * 2
    );
    context.stroke();
    linea(x, terra - altezza + 2, x, terra - 4);
    linea(x, terra - 4, x - 2, terra);
    linea(x, terra - 4, x + 2, terra);
  };

  figura(centroX - 12, 10);
  figura(centroX + 46, 9);
  figura(centroX - 68, 8);

  context.restore();
};

const disegnaSigillo = (
  context,
  centroX,
  centroY,
  raggio
) => {
  context.save();

  // Alone morbido attorno al sigillo.
  context.save();
  context.shadowColor = "rgba(255,255,255,0.35)";
  context.shadowBlur = 12;
  context.strokeStyle = "rgba(255,255,255,0.96)";
  context.lineWidth = 2.2;
  context.beginPath();
  context.arc(
    centroX,
    centroY,
    raggio,
    0,
    Math.PI * 2
  );
  context.stroke();
  context.restore();

  context.strokeStyle = "rgba(255,255,255,0.95)";
  context.lineWidth = 1.2;
  context.beginPath();
  context.arc(
    centroX,
    centroY,
    raggio - 6,
    0,
    Math.PI * 2
  );
  context.stroke();

  context.lineWidth = 1.6;
  context.beginPath();
  context.arc(
    centroX,
    centroY,
    raggio - 38,
    0,
    Math.PI * 2
  );
  context.stroke();

  disegnaTestoSuArco(
    context,
    "SPOTTED BOLOGNA OFFICIAL",
    centroX,
    centroY,
    raggio - 19,
    -Math.PI / 2,
    1,
    `600 16px ${FONT_TESTO}`,
    "rgba(255,255,255,0.97)",
    2.4
  );

  disegnaTestoSuArco(
    context,
    "UNIVERSITÀ DI BOLOGNA",
    centroX,
    centroY,
    raggio - 19,
    Math.PI / 2,
    -1,
    `600 12px ${FONT_TESTO}`,
    "rgba(255,255,255,0.95)",
    3
  );

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(255,255,255,0.96)";
  context.font = `600 17px ${FONT_TESTO}`;
  context.letterSpacing = "1.5px";
  context.fillText(
    "A.D. 2026",
    centroX,
    centroY + 86
  );
  context.letterSpacing = "0px";

  const interno = context.createRadialGradient(
    centroX,
    centroY,
    0,
    centroX,
    centroY,
    raggio - 38
  );

  interno.addColorStop(0, "rgba(255,255,255,0.10)");
  interno.addColorStop(1, "rgba(255,255,255,0)");

  context.fillStyle = interno;
  context.beginPath();
  context.arc(
    centroX,
    centroY,
    raggio - 38,
    0,
    Math.PI * 2
  );
  context.fill();

  disegnaTorri(
    context,
    centroX,
    centroY,
    raggio - 38
  );
  context.restore();
};

const disegnaIntestazione = (context) => {
  context.save();
  disegnaSigillo(context, 350, 242, 146);

  disegnaCuore(context, 694, 105, 50, "#f01c3c");

  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = "#ffffff";
  context.shadowColor = "rgba(0,0,0,0.30)";
  context.shadowBlur = 12;
  scriviTracciato(
    context,
    "SPOTTED",
    546,
    252,
    "800 86px Arial, sans-serif",
    -3,
    0.67
  );
  scriviTracciato(
    context,
    "BOLOGNA",
    546,
    332,
    "800 86px Arial, sans-serif",
    -3,
    0.67
  );
  context.shadowBlur = 0;
  context.fillStyle = "rgba(255,255,255,0.92)";
  scriviTracciato(
    context,
    "OFFICIAL",
    574,
    376,
    `400 27px ${FONT_TESTO}`,
    18
  );
  context.restore();
};

let granaVerticale = null;

const creaGrana = () => {
  if (granaVerticale) {
    return granaVerticale;
  }

  const tela = document.createElement("canvas");
  tela.width = 180;
  tela.height = 320;

  const context = tela.getContext("2d");

  if (context) {
    const dati = context.createImageData(
      tela.width,
      tela.height
    );

    for (
      let indice = 0;
      indice < dati.data.length;
      indice += 4
    ) {
      const valore =
        120 + Math.floor(Math.random() * 136);

      dati.data[indice] = valore;
      dati.data[indice + 1] = valore;
      dati.data[indice + 2] = valore;
      dati.data[indice + 3] = 22;
    }

    context.putImageData(dati, 0, 0);
  }

  granaVerticale = tela;

  return tela;
};

const disegnaSfondoModello = (
  context,
  width,
  height,
  modello
) => {
  const gradiente = modello.sfondo.diagonale
    ? context.createLinearGradient(0, 0, width, height)
    : context.createLinearGradient(0, 0, 0, height);

  modello.sfondo.stop.forEach(([posizione, colore]) => {
    gradiente.addColorStop(posizione, colore);
  });

  context.fillStyle = gradiente;
  context.fillRect(0, 0, width, height);

  context.save();

  if (modello.mescola) {
    context.globalCompositeOperation = modello.mescola;
  }

  (modello.bagliori || []).forEach((bagliore) => {
    const raggio = bagliore.raggio * height;
    const centroX = bagliore.x * width;
    const centroY = bagliore.y * height;
    const alone = context.createRadialGradient(
      centroX,
      centroY,
      0,
      centroX,
      centroY,
      raggio
    );

    alone.addColorStop(0, bagliore.colore);
    alone.addColorStop(1, "rgba(0,0,0,0)");

    context.fillStyle = alone;
    context.fillRect(0, 0, width, height);
  });

  context.restore();

  const vignetta = context.createRadialGradient(
    width / 2,
    height * 0.45,
    height * 0.2,
    width / 2,
    height * 0.45,
    height * 0.85
  );

  vignetta.addColorStop(0, "rgba(0,0,0,0)");
  vignetta.addColorStop(1, "rgba(0,0,0,0.10)");

  context.fillStyle = vignetta;
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = 0.35;
  context.globalCompositeOperation = "overlay";
  context.drawImage(
    creaGrana(),
    0,
    0,
    width,
    height
  );
  context.restore();
};

const disegnaParolaAdattata = (
  context,
  testo,
  larghezzaTarget,
  x,
  y,
  allineamento,
  scalaX
) => {
  context.font = "900 200px Arial, sans-serif";
  const larghezza =
    context.measureText(testo).width || 1;
  const dimensione = Math.round(
    (200 * (larghezzaTarget / scalaX)) / larghezza
  );

  context.save();
  context.translate(x, y);
  context.scale(scalaX, 1);
  context.font = `900 ${dimensione}px Arial, sans-serif`;
  context.textAlign = allineamento;
  context.fillText(testo, 0, 0);
  context.restore();
};

const disegnaParoleGiganti = (
  context,
  width,
  height
) => {
  context.save();
  context.fillStyle = "rgba(0,0,0,0.18)";
  context.textBaseline = "alphabetic";

  disegnaParolaAdattata(
    context,
    "SPOTTED",
    1080,
    width / 2,
    590,
    "center",
    0.88
  );

  disegnaParolaAdattata(
    context,
    "BOLOGNA",
    1180,
    -120,
    745,
    "left",
    0.88
  );

  context.textAlign = "left";
  scriviTracciato(
    context,
    "OFFICIAL",
    350,
    1038,
    "700 72px Arial, sans-serif",
    14,
    0.9
  );

  context.restore();
};

const disegnaCard = (
  context,
  x,
  y,
  larghezza,
  altezza
) => {
  const gradiente = context.createLinearGradient(
    x,
    y,
    x + larghezza,
    y + altezza
  );

  gradiente.addColorStop(0, "rgba(8,6,12,0.70)");
  gradiente.addColorStop(
    0.55,
    "rgba(12,8,16,0.62)"
  );
  gradiente.addColorStop(1, "rgba(18,10,24,0.58)");

  context.save();
  context.beginPath();
  context.roundRect(x, y, larghezza, altezza, 52);
  context.fillStyle = gradiente;
  context.fill();

  context.strokeStyle = "rgba(255,255,255,0.55)";
  context.lineWidth = 2;
  context.stroke();
  context.restore();
};

async function creaImmagineSpottedVerticale(post) {
  await caricaFontSpotted();

  const canvas = document.createElement("canvas");
  const width = 1080;
  const height = 1920;

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas non disponibile");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const modello = scegliModelloVerticale();
  const testo = String(post.text || "").trim();

  disegnaSfondoModello(
    context,
    width,
    height,
    modello
  );
  disegnaIntestazione(context);

  const cardX = 114;
  const cardWidth = 856;
  const cardY = 690;
  const padding = 52;
  const textX = cardX + padding;
  const maxTextWidth = cardWidth - padding * 2;
  const textStartY = cardY + 120;

  let fontSize = 48;
  let lineHeight = 72;
  let righe = [];
  const cardBottomMassimo = 1780;
  const spazioRighe =
    cardBottomMassimo - 170 - 92 - 84 - textStartY;

  for (
    let dimensione = 48;
    dimensione >= 32;
    dimensione -= 2
  ) {
    const interlinea = Math.round(dimensione * 1.5);

    context.font = `700 ${dimensione}px ${FONT_TESTO}`;
    const spezzate = spezzaTestoInRighe(
      context,
      testo,
      maxTextWidth
    );
    const righeDisponibili = Math.max(
      1,
      Math.floor(spazioRighe / interlinea) + 1
    );

    fontSize = dimensione;
    lineHeight = interlinea;
    righe = spezzate;

    if (spezzate.length <= righeDisponibili) {
      break;
    }
  }

  const massimoRighe = Math.max(
    1,
    Math.floor(spazioRighe / lineHeight) + 1
  );

  if (righe.length > massimoRighe) {
    righe = righe.slice(0, massimoRighe);
    righe[righe.length - 1] = troncaRiga(
      context,
      righe[righe.length - 1],
      maxTextWidth
    );
  }

  const ultimaRigaY =
    textStartY +
    Math.max(0, righe.length - 1) * lineHeight;
  const dateY = Math.max(
    cardY + 412,
    ultimaRigaY + 84
  );
  const ctaY = dateY + 92;
  const cardHeight = Math.max(
    972,
    Math.min(cardBottomMassimo, ctaY + 170) - cardY
  );

  disegnaParoleGiganti(context, width, height);
  disegnaCard(
    context,
    cardX,
    cardY,
    cardWidth,
    cardHeight
  );

  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.font = `700 ${fontSize}px ${FONT_TESTO}`;
  context.fillStyle = "#ffffff";
  context.shadowColor = "rgba(0,0,0,0.35)";
  context.shadowBlur = 8;

  righe.forEach((riga, indice) => {
    context.fillText(
      riga,
      textX,
      textStartY + indice * lineHeight
    );
  });

  context.shadowBlur = 0;

  const dataPost = post.createdAt
    ? new Date(post.createdAt)
    : null;
  const data =
    dataPost && !Number.isNaN(dataPost.getTime())
      ? dataPost.toLocaleDateString("it-IT")
      : "";

  context.fillStyle = "rgba(255,255,255,0.55)";
  context.font = `400 33px ${FONT_TESTO}`;
  context.fillText(data, textX, dateY);

  context.fillStyle = "#f5d02b";
  context.font = `600 34px ${FONT_TESTO}`;
  context.fillText(
    "Commenti e like nel link in Bio",
    textX,
    ctaY
  );

  context.textAlign = "right";
  context.fillStyle = "rgba(255,255,255,0.88)";
  context.font = `400 25px ${FONT_TESTO}`;
  context.shadowColor = "rgba(0,0,0,0.35)";
  context.shadowBlur = 6;
  context.fillText(
    "@spotted.bologna.official",
    1022,
    1880
  );
  context.shadowBlur = 0;

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((immagine) => {
      if (immagine) {
        resolve(immagine);
      } else {
        reject(
          new Error(
            "Creazione immagine non riuscita"
          )
        );
      }
    }, "image/png");
  });

  return {
    blob,
    canvas,
    tema: {
      chiave: modello.chiave,
      etichetta: modello.etichetta
    }
  };
}

const disegnaParoleGigantiQuadrate = (
  context,
  width
) => {
  context.save();
  context.fillStyle = "rgba(0,0,0,0.18)";
  context.textBaseline = "alphabetic";

  disegnaParolaAdattata(
    context,
    "SPOTTED",
    880,
    width / 2,
    410,
    "center",
    0.88
  );

  disegnaParolaAdattata(
    context,
    "BOLOGNA",
    1080,
    -90,
    505,
    "left",
    0.88
  );

  context.textAlign = "left";
  scriviTracciato(
    context,
    "OFFICIAL",
    300,
    620,
    "700 54px Arial, sans-serif",
    12,
    0.9
  );

  context.restore();
};

const disegnaIntestazioneQuadrata = (context) => {
  context.save();

  const scala = 105 / 146;
  context.save();
  context.translate(
    235 - 350 * scala,
    158 - 242 * scala
  );
  context.scale(scala, scala);
  disegnaSigillo(context, 350, 242, 146);
  context.restore();

  disegnaCuore(context, 486, 75, 38, "#f01c3c");

  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = "#ffffff";
  context.shadowColor = "rgba(0,0,0,0.30)";
  context.shadowBlur = 10;
  scriviTracciato(
    context,
    "SPOTTED",
    380,
    155,
    "800 62px Arial, sans-serif",
    -2.2,
    0.67
  );
  scriviTracciato(
    context,
    "BOLOGNA",
    380,
    215,
    "800 62px Arial, sans-serif",
    -2.2,
    0.67
  );
  context.shadowBlur = 0;
  context.fillStyle = "rgba(255,255,255,0.92)";
  scriviTracciato(
    context,
    "OFFICIAL",
    402,
    252,
    `400 19px ${FONT_TESTO}`,
    10
  );
  context.restore();
};

async function creaImmagineSpottedInstagram(post) {
  await caricaFontSpotted();

  const canvas = document.createElement("canvas");
  const width = 1080;
  const height = 1080;

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas non disponibile");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const modello = scegliModelloVerticale();
  const testo = String(post.text || "").trim();

  disegnaSfondoModello(
    context,
    width,
    height,
    modello
  );
  disegnaParoleGigantiQuadrate(context, width);
  disegnaIntestazioneQuadrata(context);

  const cardX = 85;
  const cardWidth = 910;
  const cardY = 420;
  const padding = 48;
  const textX = cardX + padding;
  const maxTextWidth = cardWidth - padding * 2;
  const textStartY = cardY + 80;
  const cardBottomMassimo = 960;
  const spazioRighe =
    cardBottomMassimo - 120 - 62 - 70 - textStartY;

  let fontSize = 44;
  let lineHeight = 60;
  let righe = [];

  for (
    let dimensione = 44;
    dimensione >= 28;
    dimensione -= 2
  ) {
    const interlinea = Math.round(dimensione * 1.36);

    context.font = `700 ${dimensione}px ${FONT_TESTO}`;
    const spezzate = spezzaTestoInRighe(
      context,
      testo,
      maxTextWidth
    );
    const righeDisponibili = Math.max(
      1,
      Math.floor(spazioRighe / interlinea) + 1
    );

    fontSize = dimensione;
    lineHeight = interlinea;
    righe = spezzate;

    if (spezzate.length <= righeDisponibili) {
      break;
    }
  }

  const massimoRighe = Math.max(
    1,
    Math.floor(spazioRighe / lineHeight) + 1
  );

  if (righe.length > massimoRighe) {
    righe = righe.slice(0, massimoRighe);
    righe[righe.length - 1] = troncaRiga(
      context,
      righe[righe.length - 1],
      maxTextWidth
    );
  }

  const ultimaRigaY =
    textStartY +
    Math.max(0, righe.length - 1) * lineHeight;
  const dateY = Math.max(
    cardY + 380,
    ultimaRigaY + 70
  );
  const ctaY = dateY + 62;
  const cardHeight = Math.max(
    520,
    Math.min(cardBottomMassimo, ctaY + 120) - cardY
  );

  disegnaCard(
    context,
    cardX,
    cardY,
    cardWidth,
    cardHeight
  );

  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.font = `700 ${fontSize}px ${FONT_TESTO}`;
  context.fillStyle = "#ffffff";
  context.shadowColor = "rgba(0,0,0,0.35)";
  context.shadowBlur = 8;

  righe.forEach((riga, indice) => {
    context.fillText(
      riga,
      textX,
      textStartY + indice * lineHeight
    );
  });

  context.shadowBlur = 0;

  const dataPost = post.createdAt
    ? new Date(post.createdAt)
    : null;
  const data =
    dataPost && !Number.isNaN(dataPost.getTime())
      ? dataPost.toLocaleDateString("it-IT")
      : "";

  context.fillStyle = "rgba(255,255,255,0.55)";
  context.font = `400 30px ${FONT_TESTO}`;
  context.fillText(data, textX, dateY);

  context.fillStyle = "#f5d02b";
  context.font = `600 31px ${FONT_TESTO}`;
  context.fillText(
    "Commenti e like nel link in Bio",
    textX,
    ctaY
  );

  context.textAlign = "right";
  context.fillStyle = "rgba(255,255,255,0.88)";
  context.font = `400 23px ${FONT_TESTO}`;
  context.shadowColor = "rgba(0,0,0,0.35)";
  context.shadowBlur = 6;
  context.fillText(
    "@spotted.bologna.official",
    1010,
    1035
  );
  context.shadowBlur = 0;

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((immagine) => {
      if (immagine) {
        resolve(immagine);
      } else {
        reject(
          new Error(
            "Creazione immagine non riuscita"
          )
        );
      }
    }, "image/png");
  });

  return {
    blob,
    canvas,
    tema: {
      chiave: modello.chiave,
      etichetta: modello.etichetta
    }
  };
}

export async function scaricaImmagineSpotted(
  post,
  likesCount = 0,
  formato = "verticale"
) {
  const { blob, tema } = await creaImmagineSpotted(
    post,
    likesCount,
    formato
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const prefisso =
    formato === "instagram" ? "instagram-" : "";

  link.href = url;
  link.download = `spotted-bologna-${prefisso}${tema.chiave}-${
    post.id || "post"
  }.png`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

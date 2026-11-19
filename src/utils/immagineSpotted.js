import { scegliTemaSpotted } from "./temaSpotted";
import { scegliModelloVerticale } from "./modelliSpottedVerticale";

const INVITO_ACCESSO =
  "Accedi per visualizzare commenti e like! Link in descrizione al profilo Instagram";

const cacheSfondi = new Map();

const disegnaTestoACapo = (
  context,
  testo,
  x,
  y,
  maxWidth,
  lineHeight
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
          context.measureText(candidata).width > maxWidth
        ) {
          righe.push(riga);
          riga = parola;
        } else {
          riga = candidata;
        }
      });

      righe.push(riga);
    });

  righe.forEach((riga, indice) => {
    context.fillText(
      riga,
      x,
      y + indice * lineHeight
    );
  });

  return righe.length;
};

const contaRigheTesto = (
  context,
  testo,
  maxWidth
) =>
  Math.max(
    1,
    String(testo || "")
      .split("\n")
      .reduce((totale, paragrafo) => {
        let riga = "";
        let numeroRighe = 0;

        paragrafo.split(/\s+/).forEach((parola) => {
          const candidata = riga
            ? `${riga} ${parola}`
            : parola;

          if (
            riga &&
            context.measureText(candidata).width >
              maxWidth
          ) {
            numeroRighe += 1;
            riga = parola;
          } else {
            riga = candidata;
          }
        });

        return totale + numeroRighe + 1;
      }, 0)
  );

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

function hashTesto(testo) {
  let hash = 0;

  for (
    let indice = 0;
    indice < String(testo || "").length;
    indice += 1
  ) {
    hash =
      (hash * 31 +
        String(testo).charCodeAt(indice)) >>>
      0;
  }

  return hash;
}

function caricaSfondo(src) {
  if (cacheSfondi.has(src)) {
    return cacheSfondi.get(src);
  }

  const promessa = new Promise((resolve) => {
    if (
      typeof window === "undefined" ||
      typeof Image === "undefined"
    ) {
      resolve(null);
      return;
    }

    const immagine = new Image();
    let concluso = false;

    const timer = window.setTimeout(() => {
      if (concluso) return;
      concluso = true;
      resolve(null);
    }, 8000);

    const completa = (valore) => {
      if (concluso) return;
      concluso = true;
      window.clearTimeout(timer);
      resolve(valore);
    };

    immagine.onload = () => completa(immagine);
    immagine.onerror = () => completa(null);
    immagine.decoding = "async";
    immagine.src = src;
  });

  cacheSfondi.set(src, promessa);

  return promessa;
}

function percorsoSfondo(tema) {
  const base = String(
    process.env.PUBLIC_URL || ""
  ).replace(/\/$/, "");

  return `${base}/share-backgrounds/${tema.file}`;
}

async function disegnaSfondo(
  context,
  width,
  height,
  tema,
  variazione
) {
  const immagine = await caricaSfondo(
    percorsoSfondo(tema)
  );

  if (immagine) {
    const larghezzaOriginale =
      immagine.naturalWidth || immagine.width;
    const altezzaOriginale =
      immagine.naturalHeight || immagine.height;

    const zoom =
      1.045 + (variazione % 6) * 0.008;

    const scala =
      Math.max(
        width / larghezzaOriginale,
        height / altezzaOriginale
      ) * zoom;

    const larghezza = larghezzaOriginale * scala;
    const altezza = altezzaOriginale * scala;
    const offsetX =
      (width - larghezza) / 2 +
      ((variazione % 7) - 3) * 7;
    const offsetY =
      (height - altezza) / 2 +
      ((variazione % 5) - 2) * 5;

    context.save();
    context.filter =
      "blur(1.2px) brightness(0.62) saturate(1.08)";
    context.drawImage(
      immagine,
      offsetX,
      offsetY,
      larghezza,
      altezza
    );
    context.restore();
  } else {
    const sfondo = context.createLinearGradient(
      0,
      0,
      width,
      height
    );

    sfondo.addColorStop(0, tema.colori[0]);
    sfondo.addColorStop(0.55, tema.colori[1]);
    sfondo.addColorStop(1, tema.colori[2]);

    context.fillStyle = sfondo;
    context.fillRect(0, 0, width, height);

    const alone = context.createRadialGradient(
      width * 0.78,
      height * 0.18,
      0,
      width * 0.78,
      height * 0.18,
      height * 0.55
    );

    alone.addColorStop(
      0,
      "rgba(255,255,255,0.16)"
    );
    alone.addColorStop(
      1,
      "rgba(255,255,255,0)"
    );

    context.fillStyle = alone;
    context.fillRect(0, 0, width, height);
  }

  const velo = context.createLinearGradient(
    0,
    0,
    0,
    height
  );

  velo.addColorStop(0, "rgba(3, 7, 18, 0.58)");
  velo.addColorStop(0.28, "rgba(3, 7, 18, 0.26)");
  velo.addColorStop(0.72, "rgba(3, 7, 18, 0.44)");
  velo.addColorStop(1, "rgba(3, 7, 18, 0.82)");

  context.fillStyle = velo;
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = 0.18;

  const tinta = context.createLinearGradient(
    0,
    0,
    width,
    height
  );

  tinta.addColorStop(0, tema.colori[0]);
  tinta.addColorStop(0.5, tema.colori[1]);
  tinta.addColorStop(1, tema.colori[2]);

  context.fillStyle = tinta;
  context.fillRect(0, 0, width, height);
  context.restore();

  const aloneAlto = context.createRadialGradient(
    width / 2,
    110,
    0,
    width / 2,
    110,
    420
  );

  aloneAlto.addColorStop(
    0,
    "rgba(255,255,255,0.12)"
  );
  aloneAlto.addColorStop(
    1,
    "rgba(255,255,255,0)"
  );

  context.fillStyle = aloneAlto;
  context.fillRect(0, 0, width, height);
}

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
  traccia
) => {
  const fontPrecedente = context.font;
  let cursore = x;

  context.font = font;

  Array.from(testo).forEach((carattere) => {
    context.fillText(carattere, cursore, y);
    cursore +=
      context.measureText(carattere).width + traccia;
  });

  context.font = fontPrecedente;
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
  context.strokeStyle = "rgba(255,255,255,0.92)";
  context.lineWidth = 1.7;
  context.lineCap = "round";
  context.lineJoin = "round";

  context.beginPath();
  context.moveTo(centroX - 94, terra);
  context.lineTo(centroX + 94, terra);
  context.stroke();

  const torreX = centroX + 8;
  const torreY = terra - 116;
  const torreLarghezza = 30;
  const torreAltezza = 116;

  context.strokeRect(
    torreX,
    torreY,
    torreLarghezza,
    torreAltezza
  );

  context.beginPath();

  for (let indice = 0; indice < 4; indice += 1) {
    context.rect(
      torreX - 2 + indice * 9,
      torreY - 7,
      5,
      7
    );
  }

  context.stroke();

  for (let riga = 0; riga < 6; riga += 1) {
    for (let colonna = 0; colonna < 3; colonna += 1) {
      context.strokeRect(
        torreX + 5 + colonna * 8,
        torreY + 12 + riga * 16,
        4,
        7
      );
    }
  }

  context.beginPath();
  context.moveTo(torreX + 11, terra);
  context.lineTo(torreX + 11, terra - 10);
  context.arc(
    torreX + 15,
    terra - 10,
    4,
    Math.PI,
    0
  );
  context.lineTo(torreX + 19, terra);
  context.stroke();

  context.save();
  context.translate(centroX - 42, terra);
  context.rotate(-0.13);

  const larghezzaGarisenda = 24;
  const altezzaGarisenda = 86;

  context.strokeRect(
    -larghezzaGarisenda / 2,
    -altezzaGarisenda,
    larghezzaGarisenda,
    altezzaGarisenda
  );

  context.beginPath();

  for (let indice = 0; indice < 3; indice += 1) {
    context.rect(
      -larghezzaGarisenda / 2 -
        2 +
        indice * 9,
      -altezzaGarisenda - 6,
      5,
      6
    );
  }

  context.stroke();

  for (let riga = 0; riga < 4; riga += 1) {
    for (let colonna = 0; colonna < 2; colonna += 1) {
      context.strokeRect(
        -larghezzaGarisenda / 2 +
          5 +
          colonna * 9,
        -altezzaGarisenda + 12 + riga * 16,
        4,
        7
      );
    }
  }

  context.restore();

  context.strokeRect(
    centroX - 92,
    terra - 34,
    38,
    34
  );

  for (let indice = 0; indice < 3; indice += 1) {
    const centroArco = centroX - 83 + indice * 10;

    context.beginPath();
    context.moveTo(centroArco - 4, terra);
    context.lineTo(centroArco - 4, terra - 12);
    context.arc(
      centroArco,
      terra - 12,
      4,
      Math.PI,
      0
    );
    context.lineTo(centroArco + 4, terra);
    context.stroke();
  }

  context.restore();
};

const disegnaSigillo = (
  context,
  centroX,
  centroY,
  raggio
) => {
  context.save();
  context.strokeStyle = "rgba(255,255,255,0.95)";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(
    centroX,
    centroY,
    raggio,
    0,
    Math.PI * 2
  );
  context.stroke();

  context.lineWidth = 1.2;
  context.beginPath();
  context.arc(
    centroX,
    centroY,
    raggio - 7,
    0,
    Math.PI * 2
  );
  context.stroke();

  context.beginPath();
  context.arc(
    centroX,
    centroY,
    raggio - 40,
    0,
    Math.PI * 2
  );
  context.stroke();

  disegnaTestoSuArco(
    context,
    "SPOTTED BOLOGNA OFFICIAL",
    centroX,
    centroY,
    raggio - 20,
    -Math.PI / 2,
    1,
    "700 15px Arial, sans-serif",
    "rgba(255,255,255,0.96)",
    2.2
  );

  disegnaTestoSuArco(
    context,
    "UNIVERSITÀ DI BOLOGNA",
    centroX,
    centroY,
    raggio - 20,
    Math.PI / 2,
    -1,
    "700 10.5px Arial, sans-serif",
    "rgba(255,255,255,0.92)",
    2
  );

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(255,255,255,0.95)";
  context.font = "700 15px Arial, sans-serif";
  context.letterSpacing = "2px";
  context.fillText(
    "A.D. 2026",
    centroX,
    centroY + 84
  );
  context.letterSpacing = "0px";

  disegnaTorri(
    context,
    centroX,
    centroY,
    raggio - 40
  );
  context.restore();
};

const disegnaIntestazione = (context) => {
  context.save();
  disegnaSigillo(context, 350, 242, 146);

  disegnaCuore(context, 703, 112, 48, "#f01c3c");

  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = "#ffffff";
  context.shadowColor = "rgba(0,0,0,0.22)";
  context.shadowBlur = 8;
  scriviTracciato(
    context,
    "SPOTTED",
    546,
    208,
    "900 62px Arial, sans-serif",
    -1.6
  );
  scriviTracciato(
    context,
    "BOLOGNA",
    546,
    270,
    "900 62px Arial, sans-serif",
    -1.6
  );
  context.shadowBlur = 0;
  context.fillStyle = "rgba(255,255,255,0.92)";
  scriviTracciato(
    context,
    "OFFICIAL",
    550,
    310,
    "400 20px Arial, sans-serif",
    7
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

  const vignetta = context.createRadialGradient(
    width / 2,
    height * 0.45,
    height * 0.2,
    width / 2,
    height * 0.45,
    height * 0.85
  );

  vignetta.addColorStop(0, "rgba(0,0,0,0)");
  vignetta.addColorStop(1, "rgba(0,0,0,0.18)");

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
  allineamento
) => {
  context.font = "900 200px Arial, sans-serif";
  const larghezza =
    context.measureText(testo).width || 1;
  const dimensione = Math.round(
    (200 * larghezzaTarget) / larghezza
  );

  context.font = `900 ${dimensione}px Arial, sans-serif`;
  context.textAlign = allineamento;
  context.fillText(testo, x, y);
};

const disegnaParoleGiganti = (
  context,
  width,
  height
) => {
  context.save();
  context.fillStyle = "rgba(0,0,0,0.11)";
  context.textBaseline = "alphabetic";

  disegnaParolaAdattata(
    context,
    "SPOTTED",
    1040,
    width / 2,
    650,
    "center"
  );

  disegnaParolaAdattata(
    context,
    "BOLOGNA",
    1120,
    -150,
    812,
    "left"
  );

  context.font = "700 86px Arial, sans-serif";
  context.textAlign = "center";
  context.letterSpacing = "16px";
  context.fillText("OFFICIAL", width / 2 + 8, 1060);
  context.letterSpacing = "0px";
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

  gradiente.addColorStop(0, "rgba(8,6,12,0.64)");
  gradiente.addColorStop(
    0.55,
    "rgba(12,8,16,0.56)"
  );
  gradiente.addColorStop(1, "rgba(18,10,24,0.52)");

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
  disegnaParoleGiganti(context, width, height);
  disegnaIntestazione(context);

  const cardX = 114;
  const cardWidth = 852;
  const cardY = 690;
  const padding = 52;
  const textX = cardX + padding;
  const maxTextWidth = cardWidth - padding * 2;
  const textStartY = cardY + 132;

  let fontSize = 52;
  let lineHeight = 70;
  let righe = [];
  const cardBottomMassimo = 1780;
  const spazioRighe =
    cardBottomMassimo - 170 - 92 - 84 - textStartY;

  for (
    let dimensione = 52;
    dimensione >= 34;
    dimensione -= 2
  ) {
    const interlinea = Math.round(dimensione * 1.34);

    context.font = `700 ${dimensione}px Arial, sans-serif`;
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
    cardY + 421,
    ultimaRigaY + 84
  );
  const ctaY = dateY + 92;
  const cardHeight = Math.max(
    980,
    Math.min(cardBottomMassimo, ctaY + 170) - cardY
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
  context.font = `700 ${fontSize}px Arial, sans-serif`;
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
  context.font = "400 34px Arial, sans-serif";
  context.fillText(data, textX, dateY);

  context.fillStyle = "#f5d02b";
  context.font = "700 35px Arial, sans-serif";
  context.fillText(
    "Commenti e like nel link in Bio",
    textX,
    ctaY
  );

  context.textAlign = "right";
  context.fillStyle = "rgba(255,255,255,0.88)";
  context.font = "400 26px Arial, sans-serif";
  context.shadowColor = "rgba(0,0,0,0.35)";
  context.shadowBlur = 6;
  context.fillText(
    "@spotted.bologna.official",
    1038,
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

async function creaImmagineSpottedInstagram(
  post,
  likesCount = 0
) {
  const canvas = document.createElement("canvas");
  const width = 1080;
  const height = 1080;
  const cardX = 72;
  const cardWidth = 936;
  const padding = 48;
  const textX = cardX + padding;
  const maxTextWidth = cardWidth - padding * 2;
  const testo = String(post.text || "").trim();

  let context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas non disponibile");
  }

  const tema = scegliTemaSpotted(
    testo,
    post.id || ""
  );
  const isGroupProposal =
    post.type === "groupProposal";
  const requiredLikes = Math.max(
    1,
    Number(post.requiredLikes) || 10
  );
  const obiettivoRaggiunto =
    Boolean(post.unlockedAt) ||
    likesCount >= requiredLikes;
  const statoGruppo = obiettivoRaggiunto
    ? "Obiettivo raggiunto: il link è disponibile."
    : "Il link si sblocca al raggiungimento dell'obiettivo.";

  const badgeHeight = 40;
  const gapBadgeTesto = 26;
  const gapTestoData = 18;
  const dateHeight = 30;
  const ctaFontSize = 27;
  const ctaLineHeight = 34;
  const gapTag = 72;
  const contentTop = 260;
  const maxCardHeight = 725;
  const minCardHeight = 430;

  context.font = `700 ${ctaFontSize}px Arial, sans-serif`;
  const invitoRighe = contaRigheTesto(
    context,
    INVITO_ACCESSO,
    maxTextWidth
  );

  context.font = "400 24px Arial, sans-serif";
  const statoGruppoRighe = isGroupProposal
    ? contaRigheTesto(
        context,
        statoGruppo,
        maxTextWidth
      )
    : 0;

  const baseSenzaTitolo =
    padding * 2 +
    badgeHeight +
    gapBadgeTesto +
    gapTestoData +
    dateHeight +
    (isGroupProposal
      ? 38 +
        Math.max(0, statoGruppoRighe - 1) * 30 +
        34
      : 58) +
    Math.max(0, invitoRighe - 1) *
      ctaLineHeight +
    gapTag;

  let titleSize = 58;
  let titleLineHeight = Math.round(
    titleSize * 1.16
  );
  let righeTitolo = [];
  let cardHeight = 0;

  for (
    let dimensione = 58;
    dimensione >= 24;
    dimensione -= 2
  ) {
    titleSize = dimensione;
    titleLineHeight = Math.round(
      titleSize * 1.16
    );
    context.font = `700 ${titleSize}px Arial, sans-serif`;
    righeTitolo = spezzaTestoInRighe(
      context,
      testo,
      maxTextWidth
    );
    cardHeight =
      baseSenzaTitolo +
      titleSize +
      Math.max(0, righeTitolo.length - 1) *
        titleLineHeight;

    if (cardHeight <= maxCardHeight) {
      break;
    }
  }

  if (cardHeight > maxCardHeight) {
    titleSize = 24;
    titleLineHeight = Math.round(
      titleSize * 1.16
    );
    context.font = `700 ${titleSize}px Arial, sans-serif`;
    righeTitolo = spezzaTestoInRighe(
      context,
      testo,
      maxTextWidth
    );

    const righeMassime = Math.max(
      1,
      Math.floor(
        (maxCardHeight -
          baseSenzaTitolo -
          titleSize) /
          titleLineHeight
      ) + 1
    );

    if (righeTitolo.length > righeMassime) {
      righeTitolo = righeTitolo.slice(
        0,
        righeMassime
      );
      righeTitolo[
        righeTitolo.length - 1
      ] = troncaRiga(
        context,
        righeTitolo[
          righeTitolo.length - 1
        ],
        maxTextWidth
      );
    }

    cardHeight =
      baseSenzaTitolo +
      titleSize +
      Math.max(0, righeTitolo.length - 1) *
        titleLineHeight;
  }

  cardHeight = Math.max(
    minCardHeight,
    Math.min(maxCardHeight, cardHeight)
  );

  const cardY =
    contentTop +
    Math.max(
      0,
      (maxCardHeight - cardHeight) / 2
    );
  const titleFirstY =
    cardY +
    padding +
    badgeHeight +
    gapBadgeTesto +
    titleSize;
  const titleLastY =
    titleFirstY +
    Math.max(0, righeTitolo.length - 1) *
      titleLineHeight;
  const dateY =
    titleLastY + gapTestoData + dateHeight;
  const statusY = dateY + 38;
  const ctaY = isGroupProposal
    ? statusY +
      Math.max(0, statoGruppoRighe - 1) * 30 +
      34
    : dateY + 58;
  const tagsY =
    ctaY +
    Math.max(0, invitoRighe - 1) *
      ctaLineHeight +
    gapTag;

  canvas.width = width;
  canvas.height = height;

  context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas non disponibile");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  await disegnaSfondo(
    context,
    width,
    height,
    tema,
    hashTesto(`${post.id || ""}${testo}`)
  );

  context.textAlign = "center";
  context.shadowColor = "rgba(0,0,0,0.45)";
  context.shadowBlur = 10;
  context.fillStyle = "#ef3340";
  context.font = "700 60px Arial, sans-serif";
  context.fillText("♥", width / 2, 76);
  context.fillStyle = "#f8fafc";
  context.font = "900 54px Arial, sans-serif";
  context.fillText("SPOTTED", width / 2, 136);
  context.fillText("BOLOGNA", width / 2, 190);
  context.fillStyle = "rgba(241,245,249,0.72)";
  context.font = "300 20px Arial, sans-serif";
  context.letterSpacing = "5px";
  context.fillText("OFFICIAL", width / 2, 224);
  context.letterSpacing = "0px";
  context.shadowBlur = 0;

  const cardBottom = cardY + cardHeight;
  const cardGradient = context.createLinearGradient(
    cardX,
    cardY,
    cardX + cardWidth,
    cardBottom
  );

  cardGradient.addColorStop(
    0,
    "rgba(7, 11, 20, 0.90)"
  );
  cardGradient.addColorStop(
    0.55,
    "rgba(10, 16, 28, 0.88)"
  );
  cardGradient.addColorStop(
    1,
    "rgba(20, 12, 30, 0.91)"
  );

  context.fillStyle = cardGradient;
  context.beginPath();
  context.roundRect(
    cardX,
    cardY,
    cardWidth,
    cardHeight,
    40
  );
  context.fill();

  const bordo = context.createLinearGradient(
    cardX,
    cardY,
    cardX + cardWidth,
    cardBottom
  );

  bordo.addColorStop(0, "#22d3ee");
  bordo.addColorStop(
    0.48,
    "rgba(255,255,255,0.75)"
  );
  bordo.addColorStop(1, "#a855f7");

  context.strokeStyle = bordo;
  context.lineWidth = 3;
  context.shadowColor = "rgba(34,211,238,0.35)";
  context.shadowBlur = 24;
  context.stroke();
  context.shadowBlur = 0;

  context.strokeStyle = "rgba(255,255,255,0.10)";
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(
    cardX + 5,
    cardY + 5,
    cardWidth - 10,
    cardHeight - 10,
    36
  );
  context.stroke();

  const testoBadge = isGroupProposal
    ? "📚  PROPOSTA GRUPPO"
    : "🤝  NUOVO SPOTTED";

  context.font = "700 22px Arial, sans-serif";
  const larghezzaBadge =
    context.measureText(testoBadge).width + 34;

  context.fillStyle = "rgba(34,211,238,0.10)";
  context.strokeStyle = "rgba(45,212,191,0.65)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.roundRect(
    textX,
    cardY + padding,
    larghezzaBadge,
    badgeHeight,
    20
  );
  context.fill();
  context.stroke();

  context.fillStyle = "#67e8f9";
  context.textAlign = "left";
  context.fillText(
    testoBadge,
    textX + 17,
    cardY + padding + 27
  );

  context.fillStyle = "#f8fafc";
  context.font = `700 ${titleSize}px Arial, sans-serif`;
  righeTitolo.forEach((riga, indice) => {
    context.fillText(
      riga,
      textX,
      titleFirstY + indice * titleLineHeight
    );
  });

  const dataPost = post.createdAt
    ? new Date(post.createdAt)
    : null;
  const data =
    dataPost &&
    !Number.isNaN(dataPost.getTime())
      ? dataPost.toLocaleDateString("it-IT")
      : "";

  context.fillStyle = "rgba(226,232,240,0.72)";
  context.font = "400 30px Arial, sans-serif";
  context.fillText(data, textX, dateY);

  if (isGroupProposal) {
    context.fillStyle = "#dbeafe";
    context.font = "400 24px Arial, sans-serif";
    const righeStato = spezzaTestoInRighe(
      context,
      statoGruppo,
      maxTextWidth
    );

    righeStato.forEach((riga, indice) => {
      context.fillText(
        riga,
        textX,
        statusY + indice * 30
      );
    });
  }

  context.fillStyle = "#facc15";
  context.font = `700 ${ctaFontSize}px Arial, sans-serif`;
  disegnaTestoACapo(
    context,
    INVITO_ACCESSO,
    textX,
    ctaY,
    maxTextWidth,
    ctaLineHeight
  );

  context.strokeStyle = "rgba(255,255,255,0.10)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(textX, tagsY - 28);
  context.lineTo(
    cardX + cardWidth - padding,
    tagsY - 28
  );
  context.stroke();

  const testoTag = `${tema.icona}  ${tema.tags.join(
    " • "
  )}`;

  context.fillStyle = "#67e8f9";
  let dimensioneTag = 25;
  context.font = `700 ${dimensioneTag}px Arial, sans-serif`;

  while (
    context.measureText(testoTag).width >
      maxTextWidth &&
    dimensioneTag > 15
  ) {
    dimensioneTag -= 1;
    context.font = `700 ${dimensioneTag}px Arial, sans-serif`;
  }

  context.fillText(testoTag, textX, tagsY);

  context.textAlign = "right";
  context.fillStyle = "rgba(255,255,255,0.72)";
  context.font = "400 22px Arial, sans-serif";
  context.fillText(
    "@spotted.bologna.official",
    width - 42,
    height - 36
  );

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

  return { blob, canvas, tema };
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

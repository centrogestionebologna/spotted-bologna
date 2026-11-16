import { scegliTemaSpotted } from "./temaSpotted";

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

  const canvas = document.createElement("canvas");
  const width = 900;
  const cardX = 80;
  const cardY = 350;
  const cardWidth = 740;
  const padding = 44;
  const textX = cardX + padding;
  const maxTextWidth = cardWidth - padding * 2;
  const fontSize = 54;
  const lineHeight = 66;
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

  context.font = `700 ${fontSize}px Arial, sans-serif`;
  const lineCount = contaRigheTesto(
    context,
    testo,
    maxTextWidth
  );

  context.font = "700 27px Arial, sans-serif";
  const invitoRighe = contaRigheTesto(
    context,
    INVITO_ACCESSO,
    maxTextWidth
  );

  context.font = "400 25px Arial, sans-serif";
  const statoGruppoRighe = isGroupProposal
    ? contaRigheTesto(
        context,
        statoGruppo,
        maxTextWidth
      )
    : 0;

  const textTop =
    cardY + padding + 58 + fontSize;
  const metaY =
    textTop +
    Math.max(0, lineCount - 1) * lineHeight +
    54;
  const ctaY =
    metaY +
    (isGroupProposal
      ? 42 +
        Math.max(0, statoGruppoRighe - 1) * 34 +
        34
      : 62);
  const tagsY =
    ctaY +
    Math.max(0, invitoRighe - 1) * 38 +
    76;
  const cardHeight = Math.max(
    420,
    tagsY - cardY + 48
  );
  const height = Math.max(
    1600,
    cardY + cardHeight + 220
  );

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
  context.font = "700 56px Arial, sans-serif";
  context.fillText("♥", width / 2, 88);
  context.fillStyle = "#f8fafc";
  context.font = "900 48px Arial, sans-serif";
  context.fillText("SPOTTED", width / 2, 140);
  context.fillText("BOLOGNA", width / 2, 188);
  context.fillStyle = "rgba(241,245,249,0.72)";
  context.font = "300 18px Arial, sans-serif";
  context.letterSpacing = "5px";
  context.fillText("OFFICIAL", width / 2, 222);
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
    38
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
    34
  );
  context.stroke();

  const testoBadge = isGroupProposal
    ? "📚  PROPOSTA GRUPPO"
    : "🤝  NUOVO SPOTTED";

  context.font = "700 21px Arial, sans-serif";
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
    38,
    19
  );
  context.fill();
  context.stroke();

  context.fillStyle = "#67e8f9";
  context.textAlign = "left";
  context.fillText(
    testoBadge,
    textX + 17,
    cardY + padding + 26
  );

  context.fillStyle = "#f8fafc";
  context.font = `700 ${fontSize}px Arial, sans-serif`;
  disegnaTestoACapo(
    context,
    testo,
    textX,
    textTop,
    maxTextWidth,
    lineHeight
  );

  const dataPost = post.createdAt
    ? new Date(post.createdAt)
    : null;
  const data =
    dataPost &&
    !Number.isNaN(dataPost.getTime())
      ? dataPost.toLocaleDateString("it-IT")
      : "";

  context.fillStyle = "rgba(226,232,240,0.72)";
  context.font = "400 33px Arial, sans-serif";
  context.fillText(data, textX, metaY);

  if (isGroupProposal) {
    context.fillStyle = "#dbeafe";
    context.font = "400 25px Arial, sans-serif";
    disegnaTestoACapo(
      context,
      statoGruppo,
      textX,
      metaY + 42,
      maxTextWidth,
      34
    );
  }

  context.fillStyle = "#facc15";
  context.font = "700 27px Arial, sans-serif";
  disegnaTestoACapo(
    context,
    INVITO_ACCESSO,
    textX,
    ctaY,
    maxTextWidth,
    38
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
  let dimensioneTag = 24;
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
    height - 42
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

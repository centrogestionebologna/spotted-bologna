/*
 * Instagram accetta solo JPEG: la card dell'app viene disegnata su
 * canvas, quindi la riesportiamo in JPEG riducendo la qualita' finche'
 * resta sotto il limite del documento Firestore che la contiene.
 */
export const esportaJpeg = (canvas) => {
  const qualitaDisponibili = [
    0.86, 0.8, 0.74, 0.68, 0.6
  ];

  for (const qualita of qualitaDisponibili) {
    const dataUrl = canvas.toDataURL(
      "image/jpeg",
      qualita
    );

    if (dataUrl.length <= 850000) {
      return dataUrl;
    }
  }

  throw new Error(
    "L'immagine resta troppo pesante per la pubblicazione."
  );
};

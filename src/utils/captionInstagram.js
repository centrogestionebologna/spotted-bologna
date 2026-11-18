/*
 * Caption per Instagram: testo dello spotted piu' un blocco di hashtag
 * fissi e quelli gia' scritti dall'utente, senza duplicati.
 */

const HASHTAG_FISSI = [
  "#spottedbologna",
  "#spotted",
  "#bologna",
  "#bolognaitaly",
  "#emiliaromagna"
];

const HASHTAG_MASSIMI = 30;
const CARATTERI_CAPTION = 2200;

export const creaCaptionInstagram = (
  testo,
  massimoCaratteri = CARATTERI_CAPTION
) => {
  const pulito = String(testo || "").trim();
  const trovati = pulito.match(/#[\p{L}\p{N}_]+/gu) || [];

  const hashtag = [];
  const visti = new Set();

  [...HASHTAG_FISSI, ...trovati].forEach((voce) => {
    const tag = String(voce).trim().replace(/[.,;:!?]+$/, "");
    const chiave = tag.toLowerCase();

    if (
      !tag ||
      visti.has(chiave) ||
      hashtag.length >= HASHTAG_MASSIMI
    ) {
      return;
    }

    visti.add(chiave);
    hashtag.push(tag);
  });

  const blocco = hashtag.join(" ");
  const spazioTesto = Math.max(
    0,
    massimoCaratteri - blocco.length - 2
  );

  let corpo = pulito;

  if (corpo.length > spazioTesto) {
    corpo =
      `${corpo
        .slice(0, Math.max(0, spazioTesto - 1))
        .trimEnd()}…`;
  }

  return `${corpo}\n\n${blocco}`.trim();
};

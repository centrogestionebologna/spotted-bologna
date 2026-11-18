import { auth } from "../firebase";

const WORKER_URL =
  "https://spotted-bologna-push.centrogestionebologna.workers.dev";

const leggiTokenUtente = async () => {
  const utente = auth.currentUser;

  if (!utente) {
    throw new Error("Devi effettuare l'accesso.");
  }

  return utente.getIdToken(true);
};

/*
 * Dice se sul Worker c'e' un token Instagram utilizzabile, cosi' il
 * pannello admin puo' mostrare un messaggio chiaro invece di un errore
 * oscuro al primo tentativo.
 */
export const leggiConfigurazioneInstagram = async () => {
  const idToken = await leggiTokenUtente();

  const risposta = await fetch(
    `${WORKER_URL}/instagram/config`,
    {
      headers: {
        Authorization: `Bearer ${idToken}`
      }
    }
  );

  const risultato = await risposta
    .json()
    .catch(() => ({}));

  if (!risposta.ok || !risultato.success) {
    throw new Error(
      risultato.error ||
        `Errore Worker (${risposta.status}).`
    );
  }

  return risultato;
};

/*
 * Pubblica lo spotted su Instagram: la card arriva gia' disegnata dal
 * pannello admin, il Worker la salva, la serve a un URL pubblico e
 * chiama l'API di Instagram.
 */
export const pubblicaSpottedSuInstagram = async ({
  postId,
  caption,
  immagineBase64
}) => {
  if (!postId || !immagineBase64) {
    throw new Error(
      "Dati mancanti per la pubblicazione su Instagram."
    );
  }

  const idToken = await leggiTokenUtente();

  const risposta = await fetch(
    `${WORKER_URL}/instagram/publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        postId: String(postId).trim(),
        caption: String(caption || "").slice(0, 2200),
        imageBase64: String(immagineBase64).replace(
          /^data:[^;]+;base64,/,
          ""
        )
      })
    }
  );

  const risultato = await risposta
    .json()
    .catch(() => ({}));

  if (!risposta.ok || !risultato.success) {
    throw new Error(
      risultato.error ||
        `Errore Worker (${risposta.status}).`
    );
  }

  return risultato;
};

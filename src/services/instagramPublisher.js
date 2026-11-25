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
 * Profilo Instagram collegato: username, tipo di account, numero di
 * post e scadenza del token. Il pannello della dashboard lo usa per
 * far vedere a colpo d'occhio se il collegamento funziona.
 */
export const leggiAccountInstagram = async () => {
  const idToken = await leggiTokenUtente();

  const risposta = await fetch(
    `${WORKER_URL}/instagram/account`,
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
 * Forza il rinnovo del token Instagram senza aspettare il cron.
 */
export const rinnovaTokenInstagram = async () => {
  const idToken = await leggiTokenUtente();

  const risposta = await fetch(
    `${WORKER_URL}/instagram/refresh`,
    {
      method: "POST",
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
 * Stato dell'IA, catalogo delle skill e bozze in attesa di
 * approvazione.
 */
export const leggiAiInstagram = async () => {
  const idToken = await leggiTokenUtente();

  const risposta = await fetch(
    `${WORKER_URL}/instagram/ai`,
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
 * Attiva o spegne le skill di scrittura usate dall'IA.
 */
export const salvaSkillInstagram = async (skills) => {
  const idToken = await leggiTokenUtente();

  const risposta = await fetch(
    `${WORKER_URL}/instagram/ai/skills`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        skills: Array.isArray(skills) ? skills : []
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

/*
 * Chiede al Worker di generare nuove bozze con l'IA.
 */
export const generaBozzeInstagram = async (
  quantita = 3
) => {
  const idToken = await leggiTokenUtente();

  const risposta = await fetch(
    `${WORKER_URL}/instagram/ai/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({ quantita })
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
 * Pubblica una bozza approvata: la card arriva gia' disegnata dal
 * pannello della dashboard.
 */
export const pubblicaBozzaInstagram = async ({
  draftId,
  caption,
  immagineBase64
}) => {
  if (!draftId || !immagineBase64) {
    throw new Error(
      "Dati mancanti per la pubblicazione della bozza."
    );
  }

  const idToken = await leggiTokenUtente();

  const risposta = await fetch(
    `${WORKER_URL}/instagram/drafts/publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        draftId: String(draftId).trim(),
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

/*
 * Scarta una bozza senza pubblicare nulla.
 */
export const scartaBozzaInstagram = async (
  draftId
) => {
  const idToken = await leggiTokenUtente();

  const risposta = await fetch(
    `${WORKER_URL}/instagram/drafts/discard`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({ draftId })
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

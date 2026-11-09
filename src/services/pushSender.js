import { auth } from "../firebase";

const WORKER_URL =
  "https://spotted-bologna-push.centrogestionebologna.workers.dev";

const leggiRispostaWorker = async (risposta) => {
  let risultato;

  try {
    risultato = await risposta.json();
  } catch (errore) {
    console.error(
      "Risposta non valida dal Worker:",
      errore
    );

    throw new Error(
      `Risposta non valida dal Worker (${risposta.status}).`
    );
  }

  if (
    !risposta.ok ||
    !risultato.success
  ) {
    throw new Error(
      risultato.error ||
        `Errore Worker (${risposta.status}).`
    );
  }

  return risultato;
};

const eseguiRichiestaWorker = async (
  endpoint,
  payload
) => {
  const utente = auth.currentUser;

  if (!utente) {
    throw new Error(
      "Devi effettuare l'accesso."
    );
  }

  const idToken =
    await utente.getIdToken(true);

  const risposta = await fetch(
    `${WORKER_URL}${endpoint}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify(payload)
    }
  );

  return leggiRispostaWorker(risposta);
};

/*
 * Variante senza token, per gli spotted inviati da chi non ha un
 * account: il Worker rilegge il documento e verifica che sia anonimo.
 */
const eseguiRichiestaWorkerPubblica = async (
  endpoint,
  payload
) => {
  const risposta = await fetch(
    `${WORKER_URL}${endpoint}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  return leggiRispostaWorker(risposta);
};

export const aggiornaConteggioIscrittiServer = async (
  forza = false
) => {
  return eseguiRichiestaWorker(
    "/community-count",
    { force: forza }
  );
};

export const notificaNuovoPending = async (
  pendingPostId
) => {
  if (
    !pendingPostId ||
    typeof pendingPostId !== "string"
  ) {
    throw new Error(
      "ID dello spotted pending mancante."
    );
  }

  return eseguiRichiestaWorker(
    "/notify-pending",
    {
      pendingPostId:
        pendingPostId.trim()
    }
  );
};

/*
 * Spotted inviato senza account: non c'e' un Firebase ID token da
 * mandare, quindi al Worker arriva solo l'ID del documento e testo e
 * autore vengono riletti con il service account.
 */
export const notificaSpottedAnonimo = async ({
  postId = "",
  pendingPostId = ""
}) => {
  if (
    typeof postId !== "string" ||
    typeof pendingPostId !== "string"
  ) {
    throw new Error(
      "ID dello spotted anonimo non valido."
    );
  }

  const pubblicato = postId.trim();
  const pending = pendingPostId.trim();

  if (
    (!pubblicato && !pending) ||
    (pubblicato && pending)
  ) {
    throw new Error(
      "Indica uno e un solo spotted."
    );
  }

  return eseguiRichiestaWorkerPubblica(
    "/notify-anonymous-post",
    {
      postId: pubblicato,
      pendingPostId: pending
    }
  );
};

/*
 * Push di prova: il Worker la invia soltanto ai dispositivi
 * dell'utente autenticato, senza creare una notifica interna.
 */
export const inviaPushDiProva = async () => {
  return eseguiRichiestaWorker(
    "/test-push",
    {}
  );
};

export const notificaPostSegnalato = async (
  pendingPostId
) => {
  if (
    !pendingPostId ||
    typeof pendingPostId !== "string"
  ) {
    throw new Error(
      "ID dello spotted segnalato mancante."
    );
  }

  return eseguiRichiestaWorker(
    "/notify-report",
    {
      pendingPostId:
        pendingPostId.trim()
    }
  );
};

export const notificaNuovoUtente = async () => {
  return eseguiRichiestaWorker(
    "/notify-new-user",
    {}
  );
};

/*
 * Notifica tutti gli amministratori che hanno attiva la preferenza per
 * quel tipo di evento (nuovo iscritto, nuovo spotted, pending,
 * segnalazione). Elenco e preferenze li legge il Worker.
 */
export const notificaAmministratoriServer = async ({
  type,
  title,
  body,
  postId = null,
  inviaPush = true
}) => {
  return eseguiRichiestaWorker(
    "/notify-admins",
    {
      type,
      title,
      body,
      postId: postId || "",
      inviaPush
    }
  );
};

/*
 * Notifica immediata di un commento o di un like.
 *
 * Il Worker decide i destinatari (seguaci dello spotted con la
 * preferenza attiva, piu' gli admin che ricevono tutti i commenti o
 * tutti i like) e manda loro notifica e push.
 */
export const notificaAttivitaPost = async ({
  type,
  postId,
  eventId,
  testo = ""
}) => {
  if (
    !postId ||
    !eventId ||
    !type
  ) {
    return null;
  }

  return eseguiRichiestaWorker(
    "/notify-post-activity",
    {
      type,
      postId: String(postId).trim(),
      eventId: String(eventId).trim(),
      testo:
        typeof testo === "string"
          ? testo.slice(0, 240)
          : ""
    }
  );
};

/*
 * Comunicazione di servizio: notifica interna + push immediata a un
 * solo destinatario. L'elenco degli iscritti lo tiene il browser
 * dell'admin, cosi' ogni utente costa una invocazione del Worker e non
 * si supera il limite di sotto-richieste del piano gratuito.
 */
export const notificaComunicazioneServizio = async ({
  noticeId,
  text,
  recipientUserId
}) => {
  if (
    !noticeId ||
    !recipientUserId ||
    typeof noticeId !== "string" ||
    typeof recipientUserId !== "string"
  ) {
    throw new Error(
      "Dati della comunicazione di servizio mancanti."
    );
  }

  return eseguiRichiestaWorker(
    "/notify-service-notice",
    {
      noticeId: noticeId.trim(),
      recipientUserId:
        recipientUserId.trim(),
      text:
        typeof text === "string"
          ? text.slice(0, 500)
          : ""
    }
  );
};

/*
 * Sblocco del link di una proposta gruppo: il Worker conta i like,
 * segna lo sblocco e avvisa tutti quelli che avevano messo like. Gli
 * invii vanno a lotti, quindi si ripete finche' hasMore e' true.
 */
export const notificaSbloccoGruppo = async ({
  postId,
  cursor = ""
}) => {
  if (!postId || typeof postId !== "string") {
    return null;
  }

  return eseguiRichiestaWorker(
    "/notify-unlock",
    {
      postId: postId.trim(),
      cursor: String(cursor || "")
    }
  );
};

/*
 * Approvazione admin del cambio nickname: il Worker rinomina l'utente
 * e tutte le sue attività con una sola chiamata.
 */
export const approvaCambioNickname = async ({
  requestId
}) => {
  if (!requestId || typeof requestId !== "string") {
    throw new Error(
      "Richiesta di cambio nickname mancante."
    );
  }

  return eseguiRichiestaWorker(
    "/approve-nickname",
    {
      requestId: requestId.trim()
    }
  );
};

export const inviaPushAUtente = async ({
  recipientUserId,
  title,
  body,
  url = "/",
  notificationId = "",
  postId = ""
}) => {
  if (
    !recipientUserId ||
    typeof recipientUserId !== "string"
  ) {
    throw new Error(
      "UID del destinatario mancante."
    );
  }

  if (
    !title?.trim() ||
    !body?.trim()
  ) {
    throw new Error(
      "Titolo e testo sono obbligatori."
    );
  }

  return eseguiRichiestaWorker(
    "/send-to-user",
    {
      recipientUserId:
        recipientUserId.trim(),
      title: title.trim(),
      body: body.trim(),
      url,
      notificationId,
      postId
    }
  );
};
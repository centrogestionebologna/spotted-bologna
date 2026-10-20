import { auth } from "../firebase";

const WORKER_URL =
  "https://spotted-bologna-push.centrogestionebologna.workers.dev";

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
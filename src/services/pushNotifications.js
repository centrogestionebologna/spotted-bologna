import { getToken, deleteToken, onMessage } from "firebase/messaging";
import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc
} from "firebase/firestore";

import {
  auth,
  db,
  messagingPromise
} from "../firebase";

import { inviaPushDiProva } from "./pushSender";

const VAPID_KEY =
  process.env.REACT_APP_FIREBASE_VAPID_KEY;

/**
 * Su iPhone le notifiche push esistono solo per il sito installato
 * sulla schermata Home (iOS 16.4 o successivo): in una normale scheda
 * di Safari l'API non e' disponibile e l'attivazione fallirebbe senza
 * spiegare il perche'.
 */
export const infoSupportoPush = () => {
  const ua = navigator.userAgent || "";

  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1);

  const standalone =
    window.matchMedia?.(
      "(display-mode: standalone)"
    )?.matches === true ||
    window.navigator.standalone === true;

  return { iOS, standalone };
};

/**
 * Crea un identificatore stabile del token.
 * In questo modo non salviamo il token come ID diretto del documento.
 */
const generaIdToken = async (token) => {
  const dati = new TextEncoder().encode(token);

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    dati
  );

  const hashArray = Array.from(
    new Uint8Array(hashBuffer)
  );

  return hashArray
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Registra il service worker utilizzato da Firebase Messaging.
 */
const attendiAttivazioneServiceWorker = (
  serviceWorkerRegistration
) => {
  if (serviceWorkerRegistration.active) {
    return Promise.resolve(serviceWorkerRegistration);
  }

  const serviceWorker =
    serviceWorkerRegistration.installing ||
    serviceWorkerRegistration.waiting;

  if (!serviceWorker) {
    return navigator.serviceWorker.ready;
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          "Il service worker non è diventato attivo entro il tempo previsto."
        )
      );
    }, 15000);

    serviceWorker.addEventListener("statechange", () => {
      if (serviceWorker.state === "activated") {
        clearTimeout(timeout);
        resolve(serviceWorkerRegistration);
      }

      if (serviceWorker.state === "redundant") {
        clearTimeout(timeout);

        navigator.serviceWorker.ready
          .then(resolve)
          .catch(reject);
      }
    });
  });
};

export const registraServiceWorkerPush = async () => {
  if (!("serviceWorker" in navigator)) {
    throw new Error(
      "I service worker non sono supportati da questo browser."
    );
  }

  const registrazione =
    await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      {
        scope: "/"
      }
    );

  await registrazione.update();

  const registrazioneAttiva =
    await attendiAttivazioneServiceWorker(
      registrazione
    );

  await navigator.serviceWorker.ready;

  console.log(
    "Service worker push attivo:",
    registrazioneAttiva.scope
  );

  return registrazioneAttiva;
};

/**
 * Attiva le notifiche push per l'utente autenticato.
 */
/**
 * Salva (o aggiorna) il token del dispositivo sul profilo dell'utente.
 */
const salvaTokenPush = async (utente, token) => {
  const tokenId = await generaIdToken(token);

  const tokenRef = doc(
    db,
    "users",
    utente.uid,
    "pushTokens",
    tokenId
  );

  await setDoc(
    tokenRef,
    {
      token,
      enabled: true,
      userId: utente.uid,
      browser: navigator.userAgent,
      platform: navigator.platform || null,
      permission: Notification.permission,
      updatedAt: serverTimestamp()
    },
    {
      merge: true
    }
  );

  return tokenId;
};

/**
 * Riallinea il token push a ogni avvio dell'app.
 *
 * FCM puo' ruotare il token o invalidarlo (aggiornamento del browser,
 * dati del sito ripuliti, telefono riavviato dopo un lungo periodo):
 * se il vecchio token resta su Firestore il dispositivo smette di
 * ricevere notifiche senza nessun errore visibile. Qui, se il permesso
 * e' gia' stato concesso, il token viene semplicemente riscritto.
 */
export const sincronizzaTokenPush = async () => {
  const utente = auth.currentUser;

  if (!utente || !VAPID_KEY) {
    return null;
  }

  if (!("Notification" in window)) {
    return null;
  }

  if (Notification.permission !== "granted") {
    return null;
  }

  const supporto = infoSupportoPush();

  if (supporto.iOS && !supporto.standalone) {
    return null;
  }

  try {
    const messaging = await messagingPromise;

    if (!messaging) {
      return null;
    }

    const serviceWorkerRegistration =
      await registraServiceWorkerPush();

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration
    });

    if (!token) {
      return null;
    }

    await salvaTokenPush(utente, token);

    return token;
  } catch (errore) {
    console.warn(
      "Impossibile sincronizzare il token push:",
      errore
    );

    return null;
  }
};

/**
 * Mostra la notifica di sistema anche quando l'app e' aperta.
 *
 * Quando la pagina e' in primo piano il browser non visualizza da solo
 * il messaggio FCM (arriva solo a onMessage): senza questo passaggio,
 * su Android non compare nulla se l'app e' aperta.
 */
export const mostraNotificaInPrimoPiano = async (
  payload
) => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const titolo =
    payload?.notification?.title ||
    payload?.data?.title ||
    "Spotted Bologna";

  const corpo =
    payload?.notification?.body ||
    payload?.data?.body ||
    "Hai ricevuto una nuova notifica.";

  const notificationId =
    payload?.data?.notificationId || "";

  try {
    const registrazione =
      await navigator.serviceWorker.ready;

    await registrazione.showNotification(titolo, {
      body: corpo,
      icon: "/logo192.png",
      badge: "/logo192.png",
      tag:
        notificationId ||
        "spotted-bologna-notification",
      data: {
        url: payload?.data?.url || "/",
        notificationId: notificationId || null,
        postId: payload?.data?.postId || null
      }
    });
  } catch (errore) {
    console.warn(
      "Impossibile mostrare la notifica in primo piano:",
      errore
    );
  }
};

export const attivaNotifichePush = async () => {
  const utente = auth.currentUser;

  if (!utente) {
    throw new Error(
      "Devi effettuare l'accesso prima di attivare le notifiche."
    );
  }

  if (!VAPID_KEY) {
    throw new Error(
      "Chiave VAPID mancante. Controlla il file .env e riavvia React."
    );
  }

  const supporto = infoSupportoPush();

  if (supporto.iOS && !supporto.standalone) {
    throw new Error(
      "Su iPhone le notifiche funzionano solo dall'app installata: tocca Condividi, scegli “Aggiungi alla schermata Home” e riapri Spotted Bologna da li'."
    );
  }

  if (!("Notification" in window)) {
    throw new Error(
      "Questo browser non supporta le notifiche."
    );
  }

  const messaging = await messagingPromise;

  if (!messaging) {
    throw new Error(
      "Firebase Messaging non è supportato da questo browser."
    );
  }

  const permesso = await Notification.requestPermission();

  if (permesso === "denied") {
    throw new Error(
      "Le notifiche sono state bloccate. Riattivale dalle impostazioni del browser."
    );
  }

  if (permesso !== "granted") {
    throw new Error(
      "Il permesso per le notifiche non è stato concesso."
    );
  }

  const serviceWorkerRegistration =
    await registraServiceWorkerPush();

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration
  });

  if (!token) {
    throw new Error(
      "Firebase non ha restituito un token push."
    );
  }

  const tokenId = await salvaTokenPush(
    utente,
    token
  );

  return {
    success: true,
    tokenId,
    token
  };
};

/**
 * Disattiva le push sul browser corrente.
 */
export const disattivaNotifichePush = async () => {
  const utente = auth.currentUser;
  const messaging = await messagingPromise;

  if (!utente || !messaging || !VAPID_KEY) {
    return {
      success: false
    };
  }

  const serviceWorkerRegistration =
    await registraServiceWorkerPush();

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration
  });

  if (!token) {
    return {
      success: true
    };
  }

  const tokenId = await generaIdToken(token);

  await deleteDoc(
    doc(
      db,
      "users",
      utente.uid,
      "pushTokens",
      tokenId
    )
  );

  await deleteToken(messaging);

  return {
    success: true
  };
};

/**
 * Gestisce una notifica mentre Spotted Bologna è aperto.
 */
export const ascoltaNotificheInPrimoPiano = async (
  callback
) => {
  const messaging = await messagingPromise;

  if (!messaging) {
    return () => {};
  }

  return onMessage(messaging, (payload) => {
    console.log(
      "Notifica FCM ricevuta in primo piano:",
      payload
    );

    if (typeof callback === "function") {
      callback(payload);
    }
  });
};

/*
 * Verifica end-to-end: riallinea il token del dispositivo e chiede al
 * Worker una push reale. Se il permesso e' stato revocato o il token
 * non e' piu' valido, l'errore arriva subito invece di restare
 * invisibile fino alla prossima notifica.
 */
export const verificaNotifichePush = async () => {
  await attivaNotifichePush();

  return inviaPushDiProva();
};

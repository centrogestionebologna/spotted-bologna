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

const VAPID_KEY =
  process.env.REACT_APP_FIREBASE_VAPID_KEY;

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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    {
      merge: true
    }
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
/* global firebase */

importScripts(
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyDqZszRewn2JMSoIPkjaxkbXNxGFgn0dds",
  authDomain: "spotted-bologna-official.firebaseapp.com",
  projectId: "spotted-bologna-official",
  storageBucket: "spotted-bologna-official.firebasestorage.app",
  messagingSenderId: "626311585719",
  appId: "1:626311585719:web:c2fa429a66b48c41fd232"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Notifica ricevuta in background:",
    payload
  );

  /*
   * Se FCM riceve un messaggio contenente già il campo "notification",
   * il browser può mostrarlo automaticamente.
   *
   * Mostriamo manualmente soltanto i messaggi di tipo "data",
   * evitando notifiche duplicate.
   */
  if (payload.notification) {
    return;
  }

  const titolo =
    payload.data?.title ||
    "Spotted Bologna";

  const opzioni = {
    body:
      payload.data?.body ||
      "Hai ricevuto una nuova notifica.",
    icon: "/logo192.png",
    badge: "/logo192.png",
    tag:
      payload.data?.notificationId ||
      "spotted-bologna-notification",
    renotify: true,
    data: {
      url: payload.data?.url || "/",
      notificationId: payload.data?.notificationId || null,
      postId: payload.data?.postId || null
    }
  };

  return self.registration.showNotification(titolo, opzioni);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const destinazione =
    event.notification.data?.url ||
    "/";

  const urlDaAprire = new URL(
    destinazione,
    self.location.origin
  ).href;

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true
      })
      .then((finestre) => {
        for (const finestra of finestre) {
          if (
            finestra.url.startsWith(self.location.origin) &&
            "focus" in finestra
          ) {
            if ("navigate" in finestra) {
              return finestra
                .navigate(urlDaAprire)
                .then(() => finestra.focus());
            }

            return finestra.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(urlDaAprire);
        }

        return null;
      })
  );
});
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDqZszRewn2JMSoIPkjaxkbXNxGFgn0dds",
  authDomain: "spotted-bologna-official.firebaseapp.com",
  projectId: "spotted-bologna-official",
  storageBucket: "spotted-bologna-official.firebasestorage.app",
  messagingSenderId: "626311585719",
  appId: "1:626311585719:web:c2fa429a66b48c41fd232"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

export const messagingPromise = isSupported()
  .then((supportato) => {
    if (!supportato) {
      console.warn(
        "Firebase Cloud Messaging non è supportato da questo browser."
      );

      return null;
    }

    return getMessaging(app);
  })
  .catch((errore) => {
    console.error(
      "Errore durante l'inizializzazione di Firebase Messaging:",
      errore
    );

    return null;
  });

export default app;
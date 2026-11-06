import { useEffect, useRef, useState } from "react";

import Header from "./components/Header";
import AdminPanel from "./components/AdminPanel";
import Post from "./components/Post";
import ProfileCard from "./components/ProfileCard";

import "./App.css";

import {
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  runTransaction
} from "firebase/firestore";

import { auth, provider, db } from "./firebase";

import {
  inviaPushAUtente,
  aggiornaConteggioIscrittiServer,
  notificaAttivitaPost,
  notificaAmministratoriServer,
  notificaComunicazioneServizio,
  notificaSbloccoGruppo,
  approvaCambioNickname
} from "./services/pushSender";

import {
  ascoltaNotificheInPrimoPiano,
  mostraNotificaInPrimoPiano,
  sincronizzaTokenPush,
  attivaNotifichePush,
  infoSupportoPush
} from "./services/pushNotifications";

// Ridimensiona e comprime l'immagine, restituisce una stringa base64
const comprimiImmagine = (
  file,
  larghezzaMax = 800,
  qualita = 0.75
) =>
  new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onerror = () =>
      reject(new Error("Lettura file fallita"));

    reader.onload = () => {

      const img = new Image();

      img.onerror = () =>
        reject(new Error("Immagine non valida"));

      img.onload = () => {

        const scala = Math.min(
          1,
          larghezzaMax / img.width
        );

        const canvas =
          document.createElement("canvas");

        canvas.width =
          Math.round(img.width * scala);
        canvas.height =
          Math.round(img.height * scala);

        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(
          0, 0,
          canvas.width,
          canvas.height
        );
        ctx.drawImage(
          img, 0, 0,
          canvas.width,
          canvas.height
        );

        resolve(
          canvas.toDataURL("image/jpeg", qualita)
        );
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });

// Il documento publicStats/community e' scrivibile solo dal Worker con il
// service account (le regole Firestore bloccano i client e la collezione users
// non e' leggibile dagli utenti normali, quindi nemmeno un conteggio dal
// browser e' possibile). Il conteggio esatto lo calcola il Worker, che poi
// aggiorna il documento letto in tempo reale da tutti.
let ultimaRichiestaConteggio = 0;
const INTERVALLO_RICHIESTA_CONTEAGGIO = 5 * 60 * 1000;

const richiediConteggioIscrittiAggiornato = async (
  forza = false
) => {
  const adesso = Date.now();

  if (
    !forza &&
    adesso - ultimaRichiestaConteggio <
      INTERVALLO_RICHIESTA_CONTEAGGIO
  ) {
    return null;
  }

  ultimaRichiestaConteggio = adesso;

  try {
    const risultato =
      await aggiornaConteggioIscrittiServer(forza);

    const totale = Number(risultato?.numeroIscritti);

    return Number.isFinite(totale) ? totale : null;
  } catch (erroreConteggio) {
    ultimaRichiestaConteggio = 0;

    console.warn(
      "Conteggio iscritti non aggiornato dal Worker:",
      erroreConteggio
    );

    return null;
  }
};

function App() {
  const creaNotifica = async ({
    userId,
    type,
    title,
    body,
    postId = null,
    adminOnly = false,
    notificationId = null
  }) => {
    const payload = {
      userId,
      type,
      title,
      body,
      postId,
      adminOnly,
      read: false,
      createdAt: new Date().toISOString()
    };

    if (!notificationId) {
      const notificationRef = await addDoc(
        collection(db, "notifications"),
        payload
      );
      return { id: notificationRef.id, created: true };
    }

    const notificationRef = doc(db, "notifications", notificationId);
    return runTransaction(db, async (transaction) => {
      const existing = await transaction.get(notificationRef);
      if (existing.exists()) {
        return { id: notificationRef.id, created: false };
      }

      transaction.set(notificationRef, payload);
      return { id: notificationRef.id, created: true };
    });
  };

  const notificaUtente = async ({
    userId,
    type,
    title,
    body,
    postId = null,
    adminOnly = false,
    inviaPush = true,
    notificationId = null,
    salvaNotifica = true
  }) => {
    let notifica;
    try {
      if (!salvaNotifica) return;
      notifica = await creaNotifica({
        userId,
        type,
        title,
        body,
        postId,
        adminOnly,
        notificationId
      });
    } catch (errore) {
      console.error("Impossibile salvare la notifica:", errore);
    }

    if (!inviaPush || notifica?.created === false) return;

    try {
      await inviaPushAUtente({
        recipientUserId: userId,
        title,
        body,
        notificationId: notifica?.id || "",
        postId: postId || ""
      });
    } catch (errore) {
      console.warn(
        "Notifica salvata nell'app; invio push non riuscito:",
        errore
      );
    }
  };

  const notificaUtenteRef = useRef(notificaUtente);
  notificaUtenteRef.current = notificaUtente;

  /*
   * Le notifiche per gli amministratori le manda il Worker.
   *
   * Le regole Firestore non permettono a un utente normale di leggere
   * la collezione users: da qui non era possibile sapere chi sono gli
   * amministratori ne' quali preferenze hanno attive, quindi quando a
   * pubblicare o a segnalare era un utente gli admin non ricevevano
   * nulla. Il Worker usa il service account e conosce entrambe le cose.
   */
  const notificaAmministratori = async ({
    type,
    title,
    body,
    postId = null,
    inviaPush = true
  }) => {
    try {
      await notificaAmministratoriServer({
        type,
        title,
        body,
        postId,
        inviaPush
      });
    } catch (errore) {
      console.error(
        "Notifica agli amministratori non inviata:",
        errore
      );
    }
  };

  const [nickname, setNickname] = useState("");
  const [salvataggioNickname, setSalvataggioNickname] =
    useState(false);
  const [erroreNickname, setErroreNickname] = useState("");
  const [savedNickname, setSavedNickname] = useState("");
  const [gruppi, setGruppi] =
  useState([]);
  const [nomeGruppo, setNomeGruppo] =
  useState("");

  const [postFollowers, setPostFollowers] =
  useState([]);
const [followRequestInProgress, setFollowRequestInProgress] = useState({});
  const [
  descrizioneGruppo,
  setDescrizioneGruppo
  ] = useState("");

  const [fotoGruppo, setFotoGruppo] =
  useState("");

  const [linkGruppo, setLinkGruppo] =
  useState("");
  const [user, setUser] = useState(null);
  const [utenti, setUtenti] = useState([]);
  const [posts, setPosts] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [likes, setLikes] = useState([]);
  const [numeroIscritti, setNumeroIscritti] =
  useState(0);  const [postVisibili, setPostVisibili] =
  useState(10);
  const [
  postScreenshotVisibili,
  setPostScreenshotVisibili
  ] = useState(3); 
  const [utentiVisibili, setUtentiVisibili] =
  useState(3);
  const [paroleVietate, setParoleVietate] =
  useState([]);

  const [nuovaParola, setNuovaParola] =
  useState("");

const [notifications, setNotifications] =
  useState([]);

const [
  unreadNotifications,
  setUnreadNotifications
] = useState(0);

const [
  comunicazioniServizio,
  setComunicazioniServizio
] = useState([]);

const [
  mostraComunicazioneServizio,
  setMostraComunicazioneServizio
] = useState(false);

const [
  testoComunicazione,
  setTestoComunicazione
] = useState("");

const [
  invioComunicazioneInCorso,
  setInvioComunicazioneInCorso
] = useState(false);

const [
  progressoComunicazione,
  setProgressoComunicazione
] = useState("");

/*
 * Spotted da aprire da una notifica (link ?spotted=<id> o messaggio del
 * service worker): serve a scorrere fino alla card giusta invece di
 * lasciare l'utente in cima alla home.
 */
const [spottedDaAprire, setSpottedDaAprire] =
  useState("");

/*
 * Gli scroll ripetuti verso lo spotted vivono in un ref: azzerando lo
 * stato l'effect viene rieseguito e i tentativi successivi verrebbero
 * annullati dalla pulizia.
 */
const scrollSpottedTimersRef = useRef([]);

/*
 * Cambio nickname: la richiesta in attesa dell'utente, l'elenco che vede
 * l'admin e lo stato del pulsante di invio.
 */
const [richiestaNickname, setRichiestaNickname] =
  useState(null);

const [richiesteNickname, setRichiesteNickname] =
  useState([]);

const [
  richiestaNicknameInCorso,
  setRichiestaNicknameInCorso
] = useState(false);

const conteggioUtentiSincronizzatoRef = useRef(null);
const sincronizzazioneConteggioUtentiRef = useRef(Promise.resolve());
const pendingNotificheInCorsoRef = useRef(new Set());
const uidUtenteCaricatoRef = useRef(null);
const [avvioConcluso, setAvvioConcluso] = useState(false);

/*
 * Secondo passo del primo accesso: dopo il nickname l'utente sceglie
 * la frequenza dei riepiloghi e puo' attivare le push. Serve perche'
 * quasi nessuno andava a cercare le impostazioni dentro il profilo.
 */
const [passoNotifiche, setPassoNotifiche] = useState(false);
const [salvataggioNotifiche, setSalvataggioNotifiche] =
  useState(false);
const [attivazionePushOnboarding, setAttivazionePushOnboarding] =
  useState(false);
const [messaggioPushOnboarding, setMessaggioPushOnboarding] =
  useState("");
const [pushAttiveOnboarding, setPushAttiveOnboarding] =
  useState(false);

  const [newsletter, setNewsletter] =
  useState("mai");
  const [notifyComments, setNotifyComments] =
useState(true);

const [notifyPending, setNotifyPending] =
  useState(true);

const [notifyReports, setNotifyReports] =
  useState(true);

const [notifyNewUsers, setNotifyNewUsers] =
  useState(true);

const [notifyNewPosts, setNotifyNewPosts] =
  useState(true);

const [notifyAllComments, setNotifyAllComments] =
  useState(false);

const [notifyAllLikes, setNotifyAllLikes] =
  useState(false);

const [notifyLikes, setNotifyLikes] =
useState(false);

  const [ultimoInvio, setUltimoInvio] =
  useState(0);

const [gruppoInModifica, setGruppoInModifica] =
  useState(null);

const [nomeGruppoEdit, setNomeGruppoEdit] =
  useState("");

const [
  descrizioneGruppoEdit,
  setDescrizioneGruppoEdit
] = useState("");

const [fotoGruppoEdit, setFotoGruppoEdit] =
  useState("");

const [linkGruppoEdit, setLinkGruppoEdit] =
  useState("");


  const [isAdmin, setIsAdmin] = useState(false);
  const [ricercaUtente, setRicercaUtente] =
    useState("");
  const [ricercaSpotted, setRicercaSpotted] =
  useState("");
  const [spottedText, setSpottedText] = useState("");
  const [commentInputs, setCommentInputs] =
  useState({});
  const [
  approvalEnabledPosts,
  setApprovalEnabledPosts
] = useState(true);

const [
  approvalEnabledGroups,
  setApprovalEnabledGroups
] = useState(true);

const [
  mostraPropostaGruppo,
  setMostraPropostaGruppo
] = useState(false);

const [
  propostaDescrizione,
  setPropostaDescrizione
] = useState("");

const [
  propostaLink,
  setPropostaLink
] = useState("");

const [
  propostaTargetLike,
  setPropostaTargetLike
] = useState(10);

const assicuraProfiloUtente = async (currentUser) => {
  const userRef = doc(db, "users", currentUser.uid);
  const creato = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);

    if (snap.exists()) {
      return false;
    }

    transaction.set(userRef, {
      uid: currentUser.uid,
      name: currentUser.displayName || "",
      email: currentUser.email || "",
      role: "user",
      nickname: "",

      newsletter: "mai",

      notifyComments: true,
      notifyLikes: false,

      pushEnabled: false,

      notifyPending: true,
      notifyReports: true,
      notifyNewUsers: true,
      notifyNewPosts: true,
      adminNotificationsConfigured: false,
      notifyAllComments: false,
      notifyAllLikes: false,

      createdAt: new Date().toISOString()
    });
    return true;
  });

  if (creato) {
    await richiediConteggioIscrittiAggiornato(true);

    try {
      await notificaAmministratori({
        type: "new-user",
        title: "👤 Nuovo iscritto",
        body: `${currentUser.displayName || currentUser.email || "Un nuovo utente"} si è iscritto a Spotted Bologna.`,
        inviaPush: true
      });
    } catch (erroreNotifica) {
      console.error(
        "Utente creato, ma notifica admin non salvata:",
        erroreNotifica
      );
    }

  }

  return { userRef, creato };
};

// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {

  caricaPost();
  caricaCommenti();
  caricaLike();
  caricaImpostazioni();
  onAuthStateChanged(
    auth,
    async (currentUser) => {

      if (!currentUser) {
        uidUtenteCaricatoRef.current = null;
        setAvvioConcluso(true);
        return;
      }

      // Cambio account (o primo accesso): mostra la schermata di
      // caricamento invece di far vedere il passaggio da "Accedi con
      // Google" a "Scegli nickname" fino al profilo vero e proprio.
      const utenteCambiato =
        uidUtenteCaricatoRef.current !== currentUser.uid;

      uidUtenteCaricatoRef.current = currentUser.uid;

      if (utenteCambiato) {
        setAvvioConcluso(false);
        setSavedNickname("");
        setIsAdmin(false);
      }

      const timeoutProfilo = utenteCambiato
        ? setTimeout(() => {
            setAvvioConcluso(true);
          }, 12000)
        : null;

      try {

      setUser(currentUser);
      await caricaFollowers();
      caricaGruppi();
      const userRef = doc(
        db,
        "users",
        currentUser.uid
      );

      let userSnap =
        await getDoc(userRef);

      if (!userSnap.exists()) {
        try {
          await assicuraProfiloUtente(currentUser);
          userSnap = await getDoc(userRef);
        } catch (erroreProfilo) {
          console.error(
            "Impossibile creare il profilo utente:",
            erroreProfilo
          );
        }
      }

if (userSnap.exists()) {

  if (userSnap.data().banned) {

    await signOut(auth);

    alert(
      "Il tuo account è stato sospeso."
    );

    return;
  }

  if (
  userSnap.data().role ===
  "admin"
) {
  setIsAdmin(true);
  caricaPendingPosts();
  caricaParoleVietate();

}

  if (
    userSnap.data().nickname
  ) {
    setSavedNickname(
      userSnap.data().nickname
    );
  }

const datiUtente = userSnap.data();

if (
  datiUtente.notifyComments !== undefined
) {
  setNotifyComments(
    datiUtente.notifyComments
  );
}

if (
  datiUtente.notifyLikes !== undefined
) {
  setNotifyLikes(
    datiUtente.notifyLikes
  );
}

setNotifyPending(
  !datiUtente.adminNotificationsConfigured ||
  datiUtente.notifyPending !== false
);

setNotifyReports(
  !datiUtente.adminNotificationsConfigured ||
  datiUtente.notifyReports !== false
);

setNotifyNewUsers(
  !datiUtente.adminNotificationsConfigured ||
  datiUtente.notifyNewUsers !== false
);

setNotifyNewPosts(
  !datiUtente.adminNotificationsConfigured ||
  datiUtente.notifyNewPosts !== false
);

setNotifyAllComments(
  datiUtente.notifyAllComments === true
);

setNotifyAllLikes(
  datiUtente.notifyAllLikes === true
);

if (datiUtente.newsletter) {
  setNewsletter(
    datiUtente.newsletter
  );
}

}

      } catch (erroreAvvio) {
        console.error(
          "Errore durante il caricamento del profilo:",
          erroreAvvio
        );
      } finally {
        if (timeoutProfilo) {
          clearTimeout(timeoutProfilo);
        }

        setAvvioConcluso(true);
      }
    }
  );

  // Rete lenta o Firestore bloccato: non lasciare l'app sulla schermata
  // di avvio all'infinito.
  const timeoutAvvio = setTimeout(() => {
    setAvvioConcluso(true);
  }, 12000);

  return () => clearTimeout(timeoutAvvio);

// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  const caricaLike = async () => {
    const snapshot = await getDocs(
      collection(db, "likes")
    );

    const lista = [];

    snapshot.forEach((docu) => {
      lista.push({
        id: docu.id,
        ...docu.data()
      });
    });

    setLikes(lista);
  };

const caricaFollowers = async () => {
  const snapshot = await getDocs(
    collection(db, "postFollowers")
  );

  const lista = [];

  snapshot.forEach((docu) => {
    lista.push({
      id: docu.id,
      ...docu.data()
    });
  });

  setPostFollowers(lista);
};

const aggiornaUtenti = (snapshot) => {
  const lista = snapshot.docs.map((docu) => ({
    id: docu.id,
    ...docu.data()
  }));

  lista.sort(
    (a, b) =>
      new Date(b.createdAt || 0) -
      new Date(a.createdAt || 0)
  );

  setUtenti(lista);
};

// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  if (!isAdmin) return undefined;

  conteggioUtentiSincronizzatoRef.current = null;
  const unsubscribe = onSnapshot(
    collection(db, "users"),
    { includeMetadataChanges: true },
    (snapshot) => {
      aggiornaUtenti(snapshot);
      if (snapshot.metadata.fromCache) return;

      const conteggioReale = snapshot.size;
      setNumeroIscritti(conteggioReale);
      if (conteggioUtentiSincronizzatoRef.current === conteggioReale) return;

      conteggioUtentiSincronizzatoRef.current = conteggioReale;
      sincronizzazioneConteggioUtentiRef.current =
        sincronizzazioneConteggioUtentiRef.current
          .catch(() => {})
          .then(() =>
            richiediConteggioIscrittiAggiornato(true)
          )
          .catch((error) => {
            if (conteggioUtentiSincronizzatoRef.current === conteggioReale) {
              conteggioUtentiSincronizzatoRef.current = null;
            }
            console.error(
              "Impossibile sincronizzare il conteggio iscritti:",
              error
            );
          });
    },
    (error) => {
      console.error(
        "Errore aggiornamento dashboard utenti:",
        error
      );
    }
  );

  return () => unsubscribe();
}, [isAdmin]);

const caricaParoleVietate = async () => {

  const snapshot = await getDocs(
    collection(db, "bannedWords")
  );

  const lista = [];

  snapshot.forEach((docu) => {
    lista.push({
      id: docu.id,
      ...docu.data()
    });
  });

  setParoleVietate(lista);
};

const caricaImpostazioni = async () => {

  const snap = await getDoc(
    doc(db, "settings", "general")
  );

 if (snap.exists()) {

  setApprovalEnabledPosts(
    snap.data().approvalEnabledPosts ?? true
  );

  setApprovalEnabledGroups(
    snap.data().approvalEnabledGroups ?? true
  );

}

};

const caricaPost = async () => {
    const snapshot = await getDocs(collection(db, "posts"));

    const lista = [];

    snapshot.forEach((docu) => {
      lista.push({
        id: docu.id,
        ...docu.data()
      });
    });

    lista.sort(
  (a, b) =>
    new Date(b.createdAt || 0) -
    new Date(a.createdAt || 0)
);

setPosts(lista);
  };

  const caricaPendingPosts = async () => {
    const snapshot = await getDocs(
      collection(db, "pendingPosts")
    );

    const lista = [];

    snapshot.forEach((docu) => {
      lista.push({
        id: docu.id,
        ...docu.data()
      });
    });

    setPendingPosts(lista);
  };

  useEffect(() => {
    if (!isAdmin || !user) return undefined;

    let primoSnapshotServer = true;
    const unsubscribe = onSnapshot(
      collection(db, "pendingPosts"),
      async (snapshot) => {
        if (snapshot.metadata.fromCache) return;
        setPendingPosts(snapshot.docs.map((postDoc) => ({
          id: postDoc.id,
          ...postDoc.data()
        })));

        const pendingDaNotificare = primoSnapshotServer
          ? snapshot.docs
          : snapshot.docChanges()
              .filter((change) =>
                change.type === "added" && !change.doc.data().originalId
              )
              .map((change) => change.doc);
        primoSnapshotServer = false;
        if (pendingDaNotificare.length === 0) return;

        const nuoviDaNotificare = pendingDaNotificare.filter((pendingDoc) => {
          const notificationId = `pending_${pendingDoc.id}_${user.uid}`;
          if (pendingNotificheInCorsoRef.current.has(notificationId)) return false;
          pendingNotificheInCorsoRef.current.add(notificationId);
          return true;
        });
        if (nuoviDaNotificare.length === 0) return;

        let preferenzaAttiva = true;
        try {
          const profiloAdmin = await getDoc(doc(db, "users", user.uid));
          const datiAdmin = profiloAdmin.data();
          if (datiAdmin?.adminNotificationsConfigured) {
            preferenzaAttiva = datiAdmin.notifyPending !== false;
          }
        } catch (error) {
          console.error(
            "Impossibile verificare la preferenza per le notifiche pending:",
            error
          );
        }
        if (!preferenzaAttiva) {
          nuoviDaNotificare.forEach((pendingDoc) =>
            pendingNotificheInCorsoRef.current.delete(
              `pending_${pendingDoc.id}_${user.uid}`
            )
          );
          return;
        }

        await Promise.allSettled(
          nuoviDaNotificare.map((pendingDoc) => {
            const pending = {
              id: pendingDoc.id,
              ...pendingDoc.data()
            };
            return notificaUtenteRef.current({
              userId: user.uid,
              type: "pending",
              title: pending.type === "groupProposal"
                ? "📝 Nuovo contenuto da approvare"
                : "📝 Nuovo post da approvare",
              body: (
                pending.text ||
                "È arrivato un nuovo contenuto per la moderazione."
              ).slice(0, 240),
              postId: pending.id,
              adminOnly: true,
              notificationId: `pending_${pending.id}_${user.uid}`,
              inviaPush: true
            }).finally(() => {
              pendingNotificheInCorsoRef.current.delete(
                `pending_${pending.id}_${user.uid}`
              );
            });
          })
        );
      },
      (error) => {
        console.error(
          "Errore aggiornamento pending in tempo reale:",
          error
        );
      }
    );

    return () => unsubscribe();
  }, [isAdmin, user]);

  const caricaCommenti = async () => {
    const snapshot = await getDocs(
      collection(db, "comments")
    );

    const lista = [];

    snapshot.forEach((docu) => {
      lista.push({
        id: docu.id,
        ...docu.data()
      });
    });

    setComments(lista);
  };

  const loginGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, provider);

      const currentUser = result.user;

      const userRef = doc(db, "users", currentUser.uid);

      let userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await assicuraProfiloUtente(currentUser);
        userSnap = await getDoc(userRef);
      }

      if (userSnap.exists()) {

      
      if (userSnap.data().banned) {

  alert(
    "Il tuo account è stato sospeso."
  );

  await signOut(auth);

  return;
}
if (
  userSnap.data().role ===
  "admin"
) {
  setIsAdmin(true);

  caricaPendingPosts();


  caricaParoleVietate();

}

const datiUtente = userSnap.data();

if (datiUtente.nickname) {
  setSavedNickname(
    datiUtente.nickname
  );
}

if (datiUtente.newsletter) {
  setNewsletter(
    datiUtente.newsletter
  );
}

if (
  datiUtente.notifyComments !== undefined
) {
  setNotifyComments(
    datiUtente.notifyComments
  );
}

if (
  datiUtente.notifyLikes !== undefined
) {
  setNotifyLikes(
    datiUtente.notifyLikes
  );
}

setNotifyPending(
  !datiUtente.adminNotificationsConfigured ||
  datiUtente.notifyPending !== false
);

setNotifyReports(
  !datiUtente.adminNotificationsConfigured ||
  datiUtente.notifyReports !== false
);

setNotifyNewUsers(
  !datiUtente.adminNotificationsConfigured ||
  datiUtente.notifyNewUsers !== false
);

setNotifyNewPosts(
  !datiUtente.adminNotificationsConfigured ||
  datiUtente.notifyNewPosts !== false
);

setNotifyAllComments(
  datiUtente.notifyAllComments === true
);

setNotifyAllLikes(
  datiUtente.notifyAllLikes === true
);

      }


      setUser(currentUser);

    } catch (error) {
      console.error(error);
    }
  };

const salvaNickname = async () => {
  if (salvataggioNickname) return;

  setErroreNickname("");

  const utenteCorrente = auth.currentUser;

  if (!utenteCorrente?.uid) {
    setErroreNickname(
      "Sessione non valida. Esci e accedi di nuovo."
    );
    return;
  }

  const nicknamePulito = nickname.trim();

  if (nicknamePulito.length < 3) {
    setErroreNickname(
      "Il nickname deve contenere almeno 3 caratteri."
    );
    return;
  }

  if (nicknamePulito.length > 30) {
    setErroreNickname(
      "Il nickname può contenere massimo 30 caratteri."
    );
    return;
  }

  setSalvataggioNickname(true);

  try {
    // Crea il profilo se manca e salva il nickname. Tutto il blocco e'
    // sotto timeout: se Firestore e' bloccato (adblock, rete, regole)
    // le operazioni non terminano mai e il bottone sembrerebbe morto.
    await Promise.race([
      (async () => {
        await assicuraProfiloUtente(utenteCorrente);

        await setDoc(
          doc(db, "users", utenteCorrente.uid),
          { nickname: nicknamePulito },
          { merge: true }
        );
      })(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("timeout-salvataggio")),
          15000
        )
      )
    ]);

    setNickname(nicknamePulito);
    setSavedNickname(nicknamePulito);

    /* Nickname salvato: si passa alla scelta delle notifiche. */
    setPassoNotifiche(true);
  } catch (error) {
    console.error(
      "Errore durante il salvataggio del nickname:",
      error
    );

    if (error?.code === "permission-denied") {
      setErroreNickname(
        "Permesso negato da Firestore (controlla le regole su users/{uid})."
      );
    } else if (error?.message === "timeout-salvataggio") {
      setErroreNickname(
        "Nessuna risposta dal server. Controlla la connessione o disattiva eventuali blocchi pubblicità e riprova."
      );
    } else {
      setErroreNickname(
        "Non è stato possibile salvare il nickname. Riprova."
      );
    }
  } finally {
    setSalvataggioNickname(false);
  }
};

/*
 * Chiude il passo delle notifiche salvando la frequenza scelta. Il
 * fallimento non deve bloccare l'ingresso nell'app: le preferenze
 * restano modificabili dal profilo.
 */
const confermaOnboardingNotifiche = async () => {
  setSalvataggioNotifiche(true);

  try {
    if (user) {
      await setDoc(
        doc(db, "users", user.uid),
        {
          newsletter,
          notificheImpostate: true
        },
        { merge: true }
      );
    }
  } catch (errore) {
    console.warn(
      "Preferenze notifiche non salvate:",
      errore
    );
  } finally {
    setSalvataggioNotifiche(false);
    setPassoNotifiche(false);
  }
};

const attivaPushOnboarding = async () => {
  setAttivazionePushOnboarding(true);
  setMessaggioPushOnboarding("");

  try {
    await attivaNotifichePush();

    setPushAttiveOnboarding(true);
    setMessaggioPushOnboarding(
      "✅ Notifiche push attivate su questo dispositivo."
    );
  } catch (errore) {
    console.warn(
      "Attivazione push dal primo accesso fallita:",
      errore
    );

    setMessaggioPushOnboarding(
      `❌ ${errore.message}`
    );
  } finally {
    setAttivazionePushOnboarding(false);
  }
};

const inviaSpotted = async () => {
  const adesso = Date.now();

  if (adesso - ultimoInvio < 30000) {
    alert(
      "Attendi 30 secondi prima di inviare un altro spotted."
    );
    return;
  }

  const testoPulito = spottedText.trim();

  if (!testoPulito) {
    alert("Scrivi un messaggio");
    return;
  }

  if (testoPulito.length < 10) {
    alert(
      "Lo spotted deve contenere almeno 10 caratteri."
    );
    return;
  }

  if (testoPulito.length > 1000) {
    alert("Massimo 1000 caratteri.");
    return;
  }

  const testoMinuscolo =
    testoPulito.toLowerCase();

  const contieneParolaVietata =
    paroleVietate.some((parola) => {
      const parolaVietata =
        String(parola.word || "")
          .trim()
          .toLowerCase();

      return (
        parolaVietata &&
        testoMinuscolo.includes(
          parolaVietata
        )
      );
    });

  const vaInModerazione =
    contieneParolaVietata ||
    approvalEnabledPosts;

  const nuovoPost = {
    text: testoPulito,
    authorId: user?.uid || "anonimo",
    createdAt: new Date().toISOString(),
    status: vaInModerazione
      ? "pending"
      : "published",
    reports: 0,
    reportedBy: [],
    flagReason: contieneParolaVietata
      ? "Parola vietata"
      : null
  };

  /*
   * Il campo si svuota prima di toccare il server: salvataggio, push e
   * ricarico del feed avvengono dopo, senza far aspettare chi scrive.
   */
  setUltimoInvio(Date.now());
  setSpottedText("");

  try {
    if (vaInModerazione) {
      const pendingRef = await addDoc(
        collection(db, "pendingPosts"),
        nuovoPost
      );
      console.log(
        "Pending creato correttamente:",
        pendingRef.id
      );

      if (isAdmin) {
        caricaPendingPosts();
      }

      alert(
        "Il tuo spotted è stato inviato per l'approvazione."
      );
    } else {
      const postRef = await addDoc(
        collection(db, "posts"),
        nuovoPost
      );

      console.log(
        "Spotted pubblicato automaticamente:",
        postRef.id
      );

      notificaAmministratori({
        type: "new-post",
        title: "📝 Nuovo spotted pubblicato",
        body: (nuovoPost.text || "È stato pubblicato un nuovo spotted.").slice(0, 240),
        postId: postRef.id,
        inviaPush: true
      }).catch((erroreNotifica) => {
        console.warn(
          "Spotted pubblicato, notifica non inviata:",
          erroreNotifica
        );
      });

      caricaPost();

      alert(
        "Il tuo spotted è stato pubblicato."
      );
    }
  } catch (erroreSalvataggio) {
    console.error(
      "Errore durante l'invio dello spotted:",
      erroreSalvataggio
    );

    /* Niente cooldown e testo recuperato: il tentativo non è costato nulla. */
    setUltimoInvio(0);
    setSpottedText(testoPulito);

    alert(
      "Non è stato possibile inviare lo spotted. Riprova."
    );
  }
};

/*
 * Pubblica una comunicazione di servizio e la notifica subito a tutti
 * gli iscritti. Le notifiche le crea il Worker (service account),
 * perche' le regole Firestore impediscono al browser di scrivere
 * quelle degli altri utenti.
 */
const inviaComunicazioneServizio = async () => {
  if (!isAdmin) {
    alert(
      "Solo gli amministratori possono pubblicare una comunicazione di servizio."
    );
    return;
  }

  const testo =
    testoComunicazione.trim();

  if (!testo) {
    alert("Scrivi il testo della comunicazione.");
    return;
  }

  if (testo.length > 500) {
    alert("Massimo 500 caratteri.");
    return;
  }

  setInvioComunicazioneInCorso(true);
  setProgressoComunicazione("");

  try {
    const comunicazioneRef = await addDoc(
      collection(db, "serviceNotices"),
      {
        text: testo,
        authorId: user?.uid || "",
        authorName: savedNickname || "",
        createdAt: new Date().toISOString()
      }
    );

    setTestoComunicazione("");
    setMostraComunicazioneServizio(false);

    /*
     * Normalmente l'elenco arriva dal listener degli utenti; se non e'
     * ancora stato caricato lo leggiamo adesso, altrimenti la
     * comunicazione resterebbe pubblicata ma senza notifiche.
     */
    let elencoIscritti = utenti;

    if (elencoIscritti.length === 0) {
      const snapshotIscritti =
        await getDocs(
          collection(db, "users")
        );

      elencoIscritti =
        snapshotIscritti.docs.map(
          (docu) => ({
            id: docu.id,
            ...docu.data()
          })
        );
    }

    const destinatari = elencoIscritti.filter(
      (iscritto) =>
        iscritto?.id && !iscritto.banned
    );

    let notificati = 0;
    let falliti = 0;
    let dispositivi = 0;

    const coda = [...destinatari];

    /*
     * Quattro invii in parallelo: abbastanza per finire presto senza
     * aprire decine di richieste contemporanee al Worker.
     */
    const inviaSuccessivo = async () => {
      while (coda.length > 0) {
        const destinatario = coda.shift();

        try {
          const risultato =
            await notificaComunicazioneServizio({
              noticeId: comunicazioneRef.id,
              text: testo,
              recipientUserId: destinatario.id
            });

          notificati += 1;
          dispositivi +=
            Number(risultato?.sent) || 0;
        } catch (errore) {
          falliti += 1;

          console.warn(
            "Comunicazione non inviata a:",
            destinatario.id,
            errore
          );
        }

        setProgressoComunicazione(
          `Invio ${notificati + falliti}/${destinatari.length}`
        );
      }
    };

    await Promise.all(
      Array.from(
        {
          length: Math.min(4, coda.length)
        },
        inviaSuccessivo
      )
    );

    if (destinatari.length === 0) {
      alert(
        "Comunicazione pubblicata. Nessun iscritto da notificare al momento."
      );
    } else if (falliti > 0) {
      alert(
        `Comunicazione pubblicata. Notificata a ${notificati} iscritti su ${destinatari.length}: ${falliti} non raggiunti.`
      );
    } else {
      alert(
        `Comunicazione pubblicata e notificata a tutti (${notificati} iscritti, ${dispositivi} dispositivi).`
      );
    }
  } catch (errore) {
    console.error(
      "Errore durante la comunicazione di servizio:",
      errore
    );

    alert(
      "Non è stato possibile pubblicare la comunicazione. Riprova."
    );
  } finally {
    setInvioComunicazioneInCorso(false);
    setProgressoComunicazione("");
  }
};

const eliminaComunicazioneServizio = async (
  id
) => {
  if (!isAdmin) return;

  if (
    !window.confirm(
      "Eliminare questa comunicazione di servizio?"
    )
  ) {
    return;
  }

  try {
    await deleteDoc(
      doc(db, "serviceNotices", id)
    );
  } catch (errore) {
    console.error(
      "Errore eliminazione comunicazione di servizio:",
      errore
    );

    alert(
      "Non è stato possibile eliminare la comunicazione."
    );
  }
};

const inviaPropostaGruppo = async () => {
  if (!user) {
    alert("Devi essere registrato.");
    return;
  }

  const descrizionePulita =
    propostaDescrizione.trim();

  const linkPulito =
    propostaLink.trim();

  if (!descrizionePulita) {
    alert("Inserisci una descrizione.");
    return;
  }

  if (!linkPulito) {
    alert("Inserisci un link.");
    return;
  }

  if (
    !/^https?:\/\/.+/i.test(linkPulito)
  ) {
    alert(
      "Inserisci un link completo che inizi con http:// oppure https://"
    );
    return;
  }

  const contieneParolaVietata =
    paroleVietate.some((parola) => {
      const parolaVietata =
        String(parola.word || "")
          .trim()
          .toLowerCase();

      return (
        parolaVietata &&
        descrizionePulita
          .toLowerCase()
          .includes(parolaVietata)
      );
    });

  const vaInModerazione =
    contieneParolaVietata ||
    approvalEnabledGroups;

  const nuovaProposta = {
    type: "groupProposal",
    text: descrizionePulita,
    groupLink: linkPulito,
    requiredLikes: Math.max(
      1,
      Number(propostaTargetLike) || 10
    ),
    authorId: user.uid,
    createdAt: new Date().toISOString(),
    status: vaInModerazione
      ? "pending"
      : "published",
    reports: 0,
    reportedBy: [],
    unlockedAt: null,
    flagReason: contieneParolaVietata
      ? "Parola vietata"
      : null
  };

  try {
    if (vaInModerazione) {
      const pendingRef = await addDoc(
        collection(db, "pendingPosts"),
        nuovaProposta
      );
      console.log(
        "Proposta pending creata:",
        pendingRef.id
      );

      if (isAdmin) {
        await caricaPendingPosts();
      }

      alert(
        "Proposta inviata per l'approvazione."
      );
    } else {
      const postRef = await addDoc(
        collection(db, "posts"),
        nuovaProposta
      );

      await notificaAmministratori({
        type: "new-post",
        title: "📝 Nuovo spotted pubblicato",
        body: (nuovaProposta.text || "È stato pubblicato un nuovo spotted.").slice(0, 240),
        postId: postRef.id,
        inviaPush: true
      });

      await caricaPost();

      alert("Proposta pubblicata.");
    }

    setPropostaDescrizione("");
    setPropostaLink("");
    setPropostaTargetLike(10);
    setMostraPropostaGruppo(false);
  } catch (errore) {
    console.error(
      "Errore durante l'invio della proposta:",
      errore
    );

    alert(
      "Non è stato possibile inviare la proposta."
    );
  }
};

const approvaPost = async (post) => {

  // tolgo i campi tecnici che non devono finire in "posts"
  const { id, originalId, ...postData } = post;

  const datiDaPubblicare = {
    ...postData,
    reports: 0,
    reportedBy: []
  };

  if (originalId) {

    // spotted rimosso dalla community: riuso il suo id originale,
    // così commenti e like collegati tornano visibili
    await setDoc(
      doc(db, "posts", originalId),
      datiDaPubblicare
    );

    await notificaAmministratori({
      type: "new-post",
      title: "📝 Nuovo spotted pubblicato",
      body: (datiDaPubblicare.text || "È stato pubblicato un nuovo spotted.").slice(0, 240),
      postId: originalId,
      inviaPush: true
    });

  } else {

    const postRef = await addDoc(
      collection(db, "posts"),
      datiDaPubblicare
    );

    await notificaAmministratori({
      type: "new-post",
      title: "📝 Nuovo spotted pubblicato",
      body: (datiDaPubblicare.text || "È stato pubblicato un nuovo spotted.").slice(0, 240),
      postId: postRef.id,
      inviaPush: true
    });

  }

  await deleteDoc(
    doc(db, "pendingPosts", post.id)
  );

  await salvaLog(
    "Approva spotted",
    post.id
  );

  caricaPost();
  caricaPendingPosts();

};

const rifiutaPost = async (id) => {

  const postDaRifiutare = pendingPosts.find(
    (p) => p.id === id
  );

  // Se è uno spotted rimosso dalla community, cancello anche
  // commenti e like collegati al post originale
  if (postDaRifiutare?.originalId) {

    const idOriginale = postDaRifiutare.originalId;

    const commentiSnapshot = await getDocs(
      collection(db, "comments")
    );

    for (const commento of commentiSnapshot.docs) {

      if (commento.data().postId === idOriginale) {

        await deleteDoc(
          doc(db, "comments", commento.id)
        );

      }

    }

    const likeSnapshot = await getDocs(
      collection(db, "likes")
    );

    for (const like of likeSnapshot.docs) {

      if (like.data().postId === idOriginale) {

        await deleteDoc(
          doc(db, "likes", like.id)
        );

      }

    }

  }

  await deleteDoc(
    doc(db, "pendingPosts", id)
  );

  await salvaLog(
    "Rifiuta spotted",
    id
  );

  caricaPendingPosts();
  caricaCommenti();
  caricaLike();

};/*
 * Il campo si svuota subito e il commento si salva dopo: aspettare
 * lettura del profilo e notifica rendeva il pulsante lento.
 */
const inviaCommento = async (postId) => {

  const testo =
    commentInputs[postId] || "";

  if (!testo.trim()) {
    return;
  }

  setCommentInputs((correnti) => ({
    ...correnti,
    [postId]: ""
  }));

  try {
    let nicknameUtente = savedNickname;

    if (!nicknameUtente) {
      const userDoc = await getDoc(
        doc(db, "users", user.uid)
      );

      nicknameUtente =
        userDoc.data()?.nickname || "";
    }

    const commentoRef = await addDoc(
      collection(db, "comments"),
      {

        postId: postId,
        userId: user.uid,
        nickname: nicknameUtente,
        text: testo,
        createdAt: new Date().toISOString()
      }
    );

    /*
     * Le notifiche le manda il Worker: il browser di chi commenta non
     * puo' leggere i profili degli altri utenti (le regole Firestore lo
     * vietano) e quindi non sa chi segue lo spotted ne' chi ha attivo
     * l'avviso per i commenti. L'ID del commento rende la notifica unica.
     */
    notificaAttivitaPost({
      type: "comment",
      postId,
      eventId: commentoRef.id,
      testo
    }).catch((erroreNotifica) => {
      console.warn(
        "Commento salvato, notifica non inviata:",
        erroreNotifica
      );
    });

    caricaCommenti();
  } catch (errore) {
    console.error(
      "Commento non inviato:",
      errore
    );

    setCommentInputs((correnti) => ({
      ...correnti,
      [postId]: testo
    }));

    alert(
      "Non è stato possibile inviare il commento. Riprova."
    );
  }
};

/*
 * Like immediato: lo stato locale cambia subito (il cuore si accende
 * senza aspettare il server), poi il salvataggio, la notifica e
 * l'eventuale sblocco della proposta gruppo avvengono in background.
 * Se il salvataggio fallisce lo stato locale torna indietro.
 */
const toggleLike = async (postId) => {

  if (!user) return;

  const likeEsistente = likes.find(
    (like) =>
      like.postId === postId &&
      like.userId === user.uid
  );

  if (likeEsistente) {

    setLikes((correnti) =>
      correnti.filter(
        (like) => like.id !== likeEsistente.id
      )
    );

    deleteDoc(
      doc(db, "likes", likeEsistente.id)
    ).catch((errore) => {
        console.error(
          "Like non rimosso:",
          errore
        );

        setLikes((correnti) =>
          correnti.some(
            (like) => like.id === likeEsistente.id
          )
            ? correnti
            : [...correnti, likeEsistente]
        );
      });

    return;
  }

  const likeTemporaneo = {
    id: `temp-like-${user.uid}-${postId}-${Date.now()}`,
    postId,
    userId: user.uid,
    nickname: savedNickname || ""
  };

  setLikes((correnti) => [
    ...correnti,
    likeTemporaneo
  ]);

  try {
    const likeRef = await addDoc(
      collection(db, "likes"),
      {
        postId: postId,
        userId: user.uid,
        nickname: savedNickname || ""
      }
    );

    setLikes((correnti) =>
      correnti.map((like) =>
        like.id === likeTemporaneo.id
          ? { ...like, id: likeRef.id }
          : like
      )
    );

    /*
     * Nessuna rilettura della collezione qui: il like locale è già
     * quello giusto, e un getDocs lento poteva sovrascriverlo con uno
     * snapshot precedente facendo tornare il cuore bianco un istante.
     */

    /*
     * Come per i commenti: seguaci e preferenze le legge il Worker, e
     * l'ID del like impedisce che la stessa notifica parta due volte.
     */
    notificaAttivitaPost({
      type: "like",
      postId,
      eventId: likeRef.id
    }).catch((erroreNotifica) => {
      console.warn(
        "Like salvato, notifica non inviata:",
        erroreNotifica
      );
    });

    const postDaControllare = posts.find(
      (p) => p.id === postId
    );

    if (
      postDaControllare &&
      postDaControllare.type ===
        "groupProposal" &&
      !postDaControllare.unlockedAt
    ) {
      const totaleLike =
        likes.filter(
          (like) => like.postId === postId
        ).length + 1;

      const obiettivo = Math.max(
        1,
        Number(
          postDaControllare.requiredLikes
        ) || 10
      );

      if (totaleLike >= obiettivo) {
        sbloccaPropostaGruppo(postId);
      }
    }
  } catch (errore) {
    console.error(
      "Like non salvato:",
      errore
    );

    setLikes((correnti) =>
      correnti.filter(
        (like) => like.id !== likeTemporaneo.id
      )
    );

    alert(
      "Non è stato possibile registrare il like. Riprova."
    );
  }

};

/*
 * Come per il like: il campanello cambia subito e il salvataggio avviene
 * dopo, con ripristino dello stato se Firestore rifiuta.
 */
const toggleFollowPost = async (
  postId
) => {
  if (!user || followRequestInProgress[postId]) return;

  setFollowRequestInProgress((current) => ({
    ...current,
    [postId]: true
  }));

  const esistente = postFollowers.find(
    (follower) =>
      follower.postId === postId &&
      follower.userId === user.uid
  );

  if (esistente) {
    setPostFollowers((current) =>
      current.filter(
        (follower) => follower.id !== esistente.id
      )
    );

    deleteDoc(
      doc(db, "postFollowers", esistente.id)
    ).catch((errore) => {
      console.error(
        "Follow non rimosso:",
        errore
      );

      setPostFollowers((current) =>
        current.some(
          (follower) => follower.id === esistente.id
        )
          ? current
          : [...current, esistente]
      );
    });
  } else {
    const followerTemporaneo = {
      id: `temp-follow-${user.uid}-${postId}-${Date.now()}`,
      postId,
      userId: user.uid
    };

    setPostFollowers((current) => [
      ...current,
      followerTemporaneo
    ]);

    addDoc(
      collection(db, "postFollowers"),
      {
        postId,
        userId: user.uid,
        createdAt: new Date().toISOString()
      }
    )
      .then((followerRef) => {
        setPostFollowers((current) =>
          current.map((follower) =>
            follower.id === followerTemporaneo.id
              ? {
                  id: followerRef.id,
                  postId,
                  userId: user.uid
                }
              : follower
          )
        );
      })
      .catch((errore) => {
        console.error(
          "Follow non salvato:",
          errore
        );

        setPostFollowers((current) =>
          current.filter(
            (follower) =>
              follower.id !== followerTemporaneo.id
          )
        );
      });
  }

  setFollowRequestInProgress((current) => ({
    ...current,
    [postId]: false
  }));
};

const segnalaPost = async (postId) => {
  if (!user) {
    alert("Devi essere registrato.");
    return;
  }

  try {
    const postRef = doc(
      db,
      "posts",
      postId
    );

    const postSnap =
      await getDoc(postRef);

    if (!postSnap.exists()) {
      alert(
        "Questo spotted non è più disponibile."
      );
      return;
    }

    const dati = postSnap.data();

    const segnalatoriAttuali =
      Array.isArray(dati.reportedBy)
        ? dati.reportedBy
        : [];

    const giaSegnalato =
      segnalatoriAttuali.includes(
        user.uid
      );

    /*
     * Se l'utente aveva già segnalato il post,
     * una seconda pressione rimuove la segnalazione.
     */
    if (giaSegnalato) {
      const nuoviSegnalatori =
        segnalatoriAttuali.filter(
          (uid) => uid !== user.uid
        );

      await updateDoc(postRef, {
        reports:
          nuoviSegnalatori.length,
        reportedBy:
          nuoviSegnalatori
      });

      await caricaPost();

      return;
    }

    const conferma =
      window.confirm(
        "Vuoi davvero segnalare questo spotted?"
      );

    if (!conferma) {
      return;
    }

    const nuoviSegnalatori = [
      ...segnalatoriAttuali,
      user.uid
    ];

    const nuoviReport =
      nuoviSegnalatori.length;

    /*
     * Finché non si raggiungono 3 segnalazioni,
     * aggiorniamo soltanto il documento pubblico.
     */
    if (nuoviReport < 3) {
      await updateDoc(postRef, {
        reports: nuoviReport,
        reportedBy:
          nuoviSegnalatori
      });

      await notificaAmministratori({
        type: "report",
        title: "🚩 Nuova segnalazione",
        body: (dati.text || "Uno spotted è stato segnalato.").slice(0, 240),
        postId,
        inviaPush: true
      });

      await caricaPost();

      alert(
        "Segnalazione registrata."
      );

      return;
    }

    /*
     * Alla terza segnalazione, lo spotted viene
     * prima copiato in pendingPosts.
     */
    const pendingRef = await addDoc(
      collection(db, "pendingPosts"),
      {
        ...dati,
        status: "pending",
        reports: nuoviReport,
        reportedBy:
          nuoviSegnalatori,
        flagReason:
          "Segnalato dalla community",
        originalId: postId,
        movedToModerationAt:
          new Date().toISOString()
      }
    );

    await notificaAmministratori({
      type: "report",
      title: "🚩 Post segnalato",
      body: (dati.text || "Uno spotted ha raggiunto il limite di segnalazioni.").slice(0, 240),
      postId: pendingRef.id,
      inviaPush: true
    });

    console.log(
      "Post segnalato spostato in pending:",
      pendingRef.id
    );

    /*
     * Eliminiamo il post pubblico soltanto dopo
     * averlo copiato correttamente in pendingPosts.
     */
    await deleteDoc(postRef);

    await caricaPost();

    if (isAdmin) {
      await caricaPendingPosts();
    }

    alert(
      "Lo spotted ha raggiunto 3 segnalazioni ed è stato inviato alla moderazione."
    );
  } catch (errore) {
    console.error(
      "Errore durante la segnalazione:",
      errore
    );

    alert(
      "Non è stato possibile registrare la segnalazione."
    );
  }
};


const eliminaPost = async (postId) => {

  const conferma = window.confirm(
    "Vuoi davvero eliminare questo spotted?"
  );

  if (!conferma) return;

  const commentiSnapshot = await getDocs(
    collection(db, "comments")
  );

  for (const commento of commentiSnapshot.docs) {

    const dati = commento.data();

    if (dati.postId === postId) {

      await deleteDoc(
        doc(
          db,
          "comments",
          commento.id
        )
      );

    }

  }

  const likeSnapshot = await getDocs(
    collection(db, "likes")
  );

  for (const like of likeSnapshot.docs) {

    const dati = like.data();

    if (dati.postId === postId) {

      await deleteDoc(
        doc(
          db,
          "likes",
          like.id
        )
      );

    }

  }

  await deleteDoc(
    doc(db, "posts", postId)
  );

  caricaPost();
  caricaCommenti();
  caricaLike();
};
const logout = async () => {

  await signOut(auth);

  setUser(null);

  setSavedNickname("");

  setIsAdmin(false);

};
const toggleBan = async (
  uid,
  statoAttuale
) => {

  await updateDoc(
    doc(db, "users", uid),
    {
      banned: !statoAttuale
    }
  );
await salvaLog(
  statoAttuale
    ? "Sblocco utente"
    : "Ban utente",
  uid
);
};

const toggleApprovalPosts =
async () => {

  await updateDoc(
    doc(db, "settings", "general"),
    {
      approvalEnabledPosts:
        !approvalEnabledPosts
    }
  );

  setApprovalEnabledPosts(
    !approvalEnabledPosts
  );

};

const toggleApprovalGroups =
async () => {

  await updateDoc(
    doc(db, "settings", "general"),
    {
      approvalEnabledGroups:
        !approvalEnabledGroups
    }
  );

  setApprovalEnabledGroups(
    !approvalEnabledGroups
  );

};

const salvaNewsletter = async () => {

  if (!user) return;

await setDoc(
  doc(db, "users", user.uid),
  {
  newsletter,

  notifyComments,
  notifyLikes,

  ...(isAdmin && {
    notifyPending,
    notifyReports,
    notifyNewUsers,
    notifyNewPosts,
    notifyAllComments,
    notifyAllLikes,
    adminNotificationsConfigured: true
  })
},
  { merge: true }
);

  alert(
  "Preferenze notifiche salvate."
);

};

const aggiungiParolaVietata =
async () => {

  if (!nuovaParola.trim()) {
    return;
  }

const esisteGia =
  paroleVietate.some(
    (parola) =>
      parola.word.toLowerCase() ===
      nuovaParola.toLowerCase()
  );

if (esisteGia) {

  alert(
    "Questa parola è già presente."
  );

  return;
}

  await addDoc(
    collection(db, "bannedWords"),
    {
      word:
        nuovaParola.toLowerCase()
    }
  );

  setNuovaParola("");

  caricaParoleVietate();

};

const eliminaParolaVietata =
async (id) => {

  await deleteDoc(
    doc(
      db,
      "bannedWords",
      id
    )
  );

  caricaParoleVietate();

};
const salvaLog = async (
  azione,
  target
) => {

  await addDoc(
    collection(db, "adminLogs"),
    {
      action: azione,
      target: target,
      admin: savedNickname,
      createdAt:
        new Date().toISOString()
    }
  );

};
const eliminaUtente = async (uid) => {

  const conferma = window.confirm(
    "Eliminare questo utente?"
  );

  if (!conferma) return;

  const eliminato = await runTransaction(db, async (transaction) => {
    const userRef = doc(db, "users", uid);
    const userSnap = await transaction.get(userRef);

    if (!userSnap.exists()) return false;

    transaction.delete(userRef);
    return true;
  });

  if (eliminato) {
    await richiediConteggioIscrittiAggiornato(true);
  }

  await salvaLog(
    "Elimina utente",
    uid
  );
};

const selezionaFoto = async (e, setFoto) => {

  const file = e.target.files[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Seleziona un file immagine");
    return;
  }

  try {

    const base64 = await comprimiImmagine(file);

    if (base64.length > 900000) {
      alert("Immagine troppo pesante, scegline un'altra");
      return;
    }

    setFoto(base64);

  } catch (error) {
    console.error(error);
    alert("Impossibile caricare l'immagine");
  }
};

const aggiungiGruppo = async () => {

  if (!nomeGruppo.trim()) return;

  await addDoc(
    collection(db, "groups"),
    {
      name: nomeGruppo,
      description: descrizioneGruppo,
      photo: fotoGruppo,
      links: linkGruppo
        .split(",")
        .map((l) => l.trim()),
      createdAt:
        new Date().toISOString()
    }
  );

  setNomeGruppo("");
  setDescrizioneGruppo("");
  setFotoGruppo("");
  setLinkGruppo("");

  caricaGruppi();

  alert("Gruppo aggiunto");
};

const eliminaGruppo = async (id) => {

  const conferma = window.confirm(
    "Vuoi eliminare questo gruppo?"
  );

  if (!conferma) return;

  await deleteDoc(
    doc(db, "groups", id)
  );

  caricaGruppi();

};

const salvaModificaGruppo = async () => {

  if (!gruppoInModifica) return;

  await updateDoc(
    doc(db, "groups", gruppoInModifica),
    {
      name: nomeGruppoEdit,
      description: descrizioneGruppoEdit,
      photo: fotoGruppoEdit,
      links: linkGruppoEdit
        .split(",")
        .map((l) => l.trim())
    }
  );

  setGruppoInModifica(null);

  caricaGruppi();

  alert("Gruppo aggiornato");

};

const caricaGruppi = async () => {

  const snapshot = await getDocs(
    collection(db, "groups")
  );

  const lista = [];

  snapshot.forEach((docu) => {
    lista.push({
      id: docu.id,
      ...docu.data()
    });
  });

  setGruppi(lista);
};

useEffect(() => {

  if (!user) return;const notificheQuery = query(
  collection(db, "notifications"),
  where("userId", "==", user.uid)
);

const unsubscribe = onSnapshot(
  notificheQuery,
  (snapshot) => {

      const lista = [];

      snapshot.forEach((docu) => {

        const dati = docu.data();

        if (
          dati.userId === user.uid &&
          (!dati.adminOnly || isAdmin)
        ) {

          lista.push({
            id: docu.id,
            ...dati
          });

        }

      });

      lista.sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      );

      setNotifications(lista);

      setUnreadNotifications(
        lista.filter((n) => !n.read).length
      );
    },
    (error) => {
      console.error(
        "Errore listener notifiche:",
        error
      );
    }
  );

  return () => unsubscribe();

}, [user, isAdmin]);

/*
 * Comunicazioni di servizio: sono pubbliche, quindi il listener non
 * dipende dall'utente e la card compare anche a chi non ha fatto
 * l'accesso.
 */
useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, "serviceNotices"),
    (snapshot) => {
      const lista = snapshot.docs.map((docu) => ({
        id: docu.id,
        ...docu.data()
      }));

      lista.sort(
        (a, b) =>
          new Date(b.createdAt || 0) -
          new Date(a.createdAt || 0)
      );

      setComunicazioniServizio(lista);
    },
    (errore) => {
      console.error(
        "Errore listener comunicazioni di servizio:",
        errore
      );
    }
  );

  return () => unsubscribe();
}, []);

/*
 * Richiesta di cambio nickname dell'utente collegato.
 *
 * Quando l'admin l'approva il Worker rinomina anche commenti e like: qui
 * basta allineare il nickname mostrato, così l'utente lo vede subito
 * senza dover uscire e rientrare.
 */
useEffect(() => {
  if (!user) {
    setRichiestaNickname(null);
    return undefined;
  }

  const richiesteQuery = query(
    collection(db, "nicknameRequests"),
    where("userId", "==", user.uid)
  );

  const unsubscribe = onSnapshot(
    richiesteQuery,
    (snapshot) => {
      const lista = snapshot.docs.map((docu) => ({
        id: docu.id,
        ...docu.data()
      }));

      lista.sort(
        (a, b) =>
          new Date(b.createdAt || 0) -
          new Date(a.createdAt || 0)
      );

      setRichiestaNickname(
        lista.find(
          (richiesta) =>
            richiesta.status === "pending"
        ) || null
      );

      const approvata = lista.find(
        (richiesta) =>
          richiesta.status === "approved"
      );

      if (
        approvata?.newNickname &&
        approvata.newNickname !==
          approvata.oldNickname
      ) {
        setSavedNickname((corrente) =>
          corrente === approvata.newNickname
            ? corrente
            : approvata.newNickname
        );
        setNickname((corrente) =>
          corrente === approvata.newNickname
            ? corrente
            : approvata.newNickname
        );
      }
    },
    (errore) => {
      console.error(
        "Errore listener richieste nickname:",
        errore
      );
    }
  );

  return () => unsubscribe();
}, [user]);

/*
 * Elenco delle richieste da approvare: lo vede solo l'admin.
 */
useEffect(() => {
  if (!isAdmin) {
    setRichiesteNickname([]);
    return undefined;
  }

  const unsubscribe = onSnapshot(
    collection(db, "nicknameRequests"),
    (snapshot) => {
      const lista = snapshot.docs
        .map((docu) => ({
          id: docu.id,
          ...docu.data()
        }))
        .filter(
          (richiesta) =>
            richiesta.status === "pending"
        );

      lista.sort(
        (a, b) =>
          new Date(b.createdAt || 0) -
          new Date(a.createdAt || 0)
      );

      setRichiesteNickname(lista);
    },
    (errore) => {
      console.error(
        "Errore listener richieste nickname admin:",
        errore
      );
    }
  );

  return () => unsubscribe();
}, [isAdmin]);

/*
 * Il feed e' una lista sola: comunicazioni di servizio e spotted stanno
 * insieme, ordinati per data. Cosi' una comunicazione non resta ancorata
 * in cima ma scende quando viene pubblicato uno spotted piu' recente, e
 * segue la stessa paginazione di “Mostra altri spotted”.
 */
const testoRicerca = ricercaSpotted.toLowerCase();

const feed = [
  ...posts
    .filter((post) =>
      String(post.text || "")
        .toLowerCase()
        .includes(testoRicerca)
    )
    .map((post) => ({
      chiave: `post-${post.id}`,
      tipo: "post",
      createdAt: post.createdAt,
      post
    })),
  ...comunicazioniServizio.map(
    (comunicazione) => ({
      chiave: `comunicazione-${comunicazione.id}`,
      tipo: "comunicazione",
      createdAt: comunicazione.createdAt,
      comunicazione
    })
  )
].sort(
  (a, b) =>
    new Date(b.createdAt || 0) -
    new Date(a.createdAt || 0)
);

const nonLette =
  notifications.filter(
    (n) => !n.read
  ).length;

const markAllNotificationsRead =
async () => {

  const daSegnare = notifications.filter(
    (n) => !n.read
  );

  await Promise.all(
    daSegnare.map((n) =>
      updateDoc(
        doc(
          db,
          "notifications",
          n.id
        ),
        {
          read: true
        }
      ).catch((errore) => {
        console.error(
          "Notifica non segnata come letta:",
          n.id,
          errore
        );
      })
    )
  );
};

/*
 * Apre uno spotted chiesto da una notifica: toglie la ricerca admin (che
 * altrimenti filtrerebbe la card), poi l'effect qui sotto scorre fino
 * ad essa e la evidenzia.
 */
const apriSpotted = (postId) => {
  if (!postId) return;

  setRicercaSpotted("");
  setSpottedDaAprire(String(postId));
};

/*
 * Link ?spotted=<id>: le push lo mettono nell'URL, cosi' il clic sulla
 * notifica apre l'app gia' sullo spotted giusto.
 */
useEffect(() => {
  const parametri = new URLSearchParams(
    window.location.search
  );

  const spottedDaUrl = parametri.get("spotted");

  if (spottedDaUrl) {
    setSpottedDaAprire(spottedDaUrl);
  }
}, []);

/*
 * Scorre fino allo spotted richiesto. Se e' oltre “Mostra altri spotted”
 * allarga prima l'elenco, altrimenti la card non esisterebbe nel DOM.
 */
useEffect(() => {
  if (!spottedDaAprire || feed.length === 0) {
    return;
  }

  const indice = feed.findIndex(
    (elemento) =>
      elemento.tipo === "post" &&
      elemento.post.id === spottedDaAprire
  );

  if (indice === -1) {
    return;
  }

  if (indice + 1 > postVisibili) {
    setPostVisibili(indice + 1);
    return;
  }

  /*
   * Il profilo sta sopra al feed e si allunga mentre arrivano notifiche
   * e iscritti: aspettare un solo istante farebbe perdere lo scroll,
   * perche' la card scende mentre la pagina si carica. Si ripete quindi
   * lo scroll per qualche secondo e si disattiva il ripristino
   * automatico della posizione fatto dal browser.
   */
  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  const identificatore = `post-${spottedDaAprire}`;

  scrollSpottedTimersRef.current.forEach(
    clearTimeout
  );
  scrollSpottedTimersRef.current = [];

  const vaiAllaCard = () => {
    const card = document.getElementById(
      identificatore
    );

    if (!card) return;

    const alto =
      card.getBoundingClientRect().top +
      window.scrollY -
      90;

    window.scrollTo({
      top: Math.max(alto, 0),
      behavior: "smooth"
    });

    card.classList.add("post-evidenziato");
  };

  [150, 500, 1000, 1700, 2600].forEach(
    (ritardo) => {
      scrollSpottedTimersRef.current.push(
        setTimeout(vaiAllaCard, ritardo)
      );
    }
  );

  scrollSpottedTimersRef.current.push(
    setTimeout(() => {
      document
        .getElementById(identificatore)
        ?.classList.remove(
          "post-evidenziato"
        );
    }, 8000)
  );

  setSpottedDaAprire("");

  if (window.history.replaceState) {
    window.history.replaceState(
      {},
      "",
      window.location.pathname
    );
  }
}, [feed, spottedDaAprire, postVisibili]);

/*
 * Sblocco di una proposta gruppo: segna lo sblocco e chiede al Worker di
 * avvisare tutti quelli che avevano messo like. Gli invii vanno a lotti,
 * quindi si ripete finche' il Worker dice che ce ne sono altri.
 */
const sbloccaPropostaGruppo = async (postId) => {
  try {
    await updateDoc(
      doc(db, "posts", postId),
      {
        unlockedAt: new Date().toISOString()
      }
    );

    caricaPost();
  } catch (errore) {
    console.error(
      "Sblocco del gruppo non salvato:",
      errore
    );

    return;
  }

  let cursore = "";

  for (let giro = 0; giro < 40; giro += 1) {
    let risultato = null;

    try {
      risultato = await notificaSbloccoGruppo({
        postId,
        cursor: cursore
      });
    } catch (errore) {
      console.warn(
        "Notifica di sblocco non inviata:",
        errore
      );

      return;
    }

    if (!risultato?.hasMore) return;

    cursore = risultato.nextCursor || "";

    if (!cursore) return;
  }
};

/*
 * L'utente chiede il cambio nickname: non viene applicato subito, deve
 * approvarlo un admin.
 */
const richiediCambioNickname = async (
  nuovoNickname
) => {
  if (!user) {
    return {
      error: "Devi effettuare l'accesso."
    };
  }

  if (richiestaNickname) {
    return {
      error:
        "Hai già una richiesta in attesa di approvazione."
    };
  }

  const pulito = String(
    nuovoNickname || ""
  ).trim();

  if (pulito.length < 3) {
    return {
      error:
        "Il nickname deve contenere almeno 3 caratteri."
    };
  }

  if (pulito.length > 30) {
    return {
      error:
        "Il nickname può contenere massimo 30 caratteri."
    };
  }

  if (pulito === savedNickname) {
    return {
      error: "È già il tuo nickname."
    };
  }

  setRichiestaNicknameInCorso(true);

  try {
    await addDoc(
      collection(db, "nicknameRequests"),
      {
        userId: user.uid,
        oldNickname: savedNickname || "",
        newNickname: pulito,
        status: "pending",
        createdAt: new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null
      }
    );

    return { success: true };
  } catch (errore) {
    console.error(
      "Richiesta cambio nickname non inviata:",
      errore
    );

    return {
      error:
        "Non è stato possibile inviare la richiesta. Riprova."
    };
  } finally {
    setRichiestaNicknameInCorso(false);
  }
};

const approvaRichiestaNickname = async (
  richiesta
) => {
  if (!isAdmin || !richiesta) return;

  if (
    !window.confirm(
      `Approvare il cambio da «${richiesta.oldNickname}» a «${richiesta.newNickname}»?`
    )
  ) {
    return;
  }

  try {
    const risultato = await approvaCambioNickname({
      requestId: richiesta.id
    });

    if (
      richiesta.userId === user?.uid &&
      risultato?.nickname
    ) {
      setNickname(risultato.nickname);
      setSavedNickname(risultato.nickname);
    }

    alert(
      `Nickname aggiornato. Attività rinominate: ${risultato?.attivitaAggiornate || 0}.`
    );
  } catch (errore) {
    console.error(
      "Cambio nickname non approvato:",
      errore
    );

    alert(
      errore.message ||
        "Non è stato possibile approvare il cambio nickname."
    );
  }
};

const rifiutaRichiestaNickname = async (
  richiesta
) => {
  if (!isAdmin || !richiesta) return;

  try {
    await updateDoc(
      doc(db, "nicknameRequests", richiesta.id),
      {
        status: "rejected",
        reviewedAt: new Date().toISOString(),
        reviewedBy: user?.uid || null
      }
    );
  } catch (errore) {
    console.error(
      "Richiesta nickname non rifiutata:",
      errore
    );

    alert(
      "Non è stato possibile rifiutare la richiesta."
    );
  }
};

// Conteggio iscritti per chi non e' admin: il documento pubblico resta la
// sorgente in tempo reale, mentre il Worker (che ha il service account) viene
// invitato a ricalcolare il numero esatto e a riscriverlo. Ogni errore di rete
// lascia comunque attivo il listener.
useEffect(() => {
  if (!user || isAdmin) return undefined;

  const statsRef = doc(
    db,
    "publicStats",
    "community"
  );

  let attivo = true;

  const unsubscribe = onSnapshot(
    statsRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.metadata.fromCache) return;

      const valore = snapshot.exists()
        ? Number(snapshot.data().numeroIscritti) || 0
        : 0;

      setNumeroIscritti(valore);
    },
    (error) => {
      console.error(
        "Errore listener numero iscritti:",
        error
      );
    }
  );

  const allineaConteggioEsatto = async () => {
    const totale =
      await richiediConteggioIscrittiAggiornato();

    if (!attivo || totale === null) return;

    setNumeroIscritti(totale);
  };

  allineaConteggioEsatto();

  const intervallo = window.setInterval(
    allineaConteggioEsatto,
    10 * 60 * 1000
  );

  const suFocus = () => {
    allineaConteggioEsatto();
  };

  window.addEventListener("focus", suFocus);

  return () => {
    attivo = false;
    window.clearInterval(intervallo);
    window.removeEventListener("focus", suFocus);
    unsubscribe();
  };
}, [user, isAdmin]);

/*
 * Rinnova il token push a ogni avvio. FCM puo' ruotarlo o invalidarlo
 * (aggiornamento del browser, dati del sito ripuliti): senza questo
 * riallineamento il dispositivo smette di ricevere notifiche, come
 * succedeva al telefono, senza mostrare nessun errore.
 */
useEffect(() => {
  if (!user) return;

  sincronizzaTokenPush();
}, [user]);

/*
 * Con l'app aperta il browser non visualizza la notifica da solo
 * (su Android non compare proprio nulla): la mostriamo qui, con lo
 * stesso tag dell'evento, cosi' non si sovrappone a quella in background.
 */
useEffect(() => {
  if (!user) return undefined;

  let attivo = true;
  let annulla = () => {};

  ascoltaNotificheInPrimoPiano((payload) => {
    if (!attivo) return;

    mostraNotificaInPrimoPiano(payload);
  }).then((unsubscribe) => {
    if (typeof unsubscribe === "function") {
      annulla = unsubscribe;
    }
  });

  return () => {
    attivo = false;

    annulla();
  };
}, [user]);

if (!avvioConcluso) {
  return (
    <div className="splash-screen">
      <div className="splash-logo">
        <span className="splash-heart">♥</span>
        <span className="splash-word">SPOTTED</span>
        <span className="splash-word">BOLOGNA</span>
        <span className="splash-official">OFFICIAL</span>
      </div>
      <div className="splash-bar">
        <span />
      </div>
      <p className="splash-caption">Caricamento del tuo profilo…</p>
    </div>
  );
}

const supportoPushOnboarding = infoSupportoPush();

const pushGiaAttive =
  pushAttiveOnboarding ||
  (typeof Notification !== "undefined" &&
    Notification.permission === "granted");

return (
  <div className="app-container">

    <Header
  nickname={savedNickname}
  logout={logout}      unreadNotifications={
    unreadNotifications
  }
  onNotificationsClick={() => {
    document.getElementById("profile-notifications")?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
    document.getElementById("profile-notifications")?.setAttribute("open", "true");
  }}
/>
{user && savedNickname && !passoNotifiche && (
  <>      <ProfileCard
      nickname={savedNickname}
      iscritti={isAdmin ? utenti.length : numeroIscritti}
      newsletter={newsletter}
      setNewsletter={setNewsletter}
      notifyComments={notifyComments}
      setNotifyComments={setNotifyComments}
      notifyLikes={notifyLikes}
      setNotifyLikes={setNotifyLikes}
      notifyAllComments={notifyAllComments}
      setNotifyAllComments={setNotifyAllComments}
      notifyAllLikes={notifyAllLikes}
      setNotifyAllLikes={setNotifyAllLikes}
      notifyPending={notifyPending}
      setNotifyPending={setNotifyPending}
      notifyReports={notifyReports}
      setNotifyReports={setNotifyReports}
      notifyNewUsers={notifyNewUsers}
      setNotifyNewUsers={setNotifyNewUsers}
      notifyNewPosts={notifyNewPosts}
      setNotifyNewPosts={setNotifyNewPosts}
      salvaNewsletter={salvaNewsletter}
      isAdmin={isAdmin}
      notifications={notifications}
      nonLette={nonLette}
      markAllNotificationsRead={markAllNotificationsRead}
      apriSpotted={apriSpotted}
      richiestaNickname={richiestaNickname}
      richiediCambioNickname={richiediCambioNickname}
      richiestaNicknameInCorso={
        richiestaNicknameInCorso
      }
    />

  </>
)}

    {!user && (
      <div
  style={{
    marginBottom: "35px"
  }}
>
  <button onClick={loginGoogle}>
    Accedi con Google
  </button>

<div className="login-banner">
  ⬆️ ACCEDI CON GOOGLE
  <br />
  <span>
  Accedi e sblocca le nostre funzioni aggiuntive social e di gruppo 🚀
  </span>
</div>

</div>
    )}

{user && !savedNickname && (
  <div className="section-card">

    <h2>Scegli nickname</h2>

    <input
      value={nickname}
      maxLength={30}
      onChange={(e) =>
        setNickname(e.target.value)
      }
      onKeyDown={(e) => {
        if (e.key === "Enter") salvaNickname();
      }}
      placeholder="Nickname (3-30 caratteri)"
      disabled={salvataggioNickname}
    />

    {erroreNickname && (
      <p style={{ color: "#c0392b", margin: "8px 0" }}>
        {erroreNickname}
      </p>
    )}

    <button
      onClick={salvaNickname}
      disabled={salvataggioNickname}
    >
      {salvataggioNickname
        ? "Salvataggio..."
        : "Salva nickname"}
    </button>

  </div>
)}

{user && savedNickname && passoNotifiche && (
  <div className="section-card onboarding-notifiche">

    <h2>🔔 Come vuoi essere avvisato?</h2>

    <p className="onboarding-notifiche-intro">
      Scegli ogni quanto ricevere il riepilogo di Spotted Bologna.
      Puoi cambiarlo quando vuoi dal tuo profilo.
    </p>

    <div className="newsletter-options">

      <label className="newsletter-option">
        <input
          type="radio"
          name="onboarding-newsletter"
          checked={newsletter === "giornaliera"}
          onChange={() =>
            setNewsletter("giornaliera")
          }
        />
        <span>
          Giornaliera — un riepilogo ogni giorno alle 14
        </span>
      </label>

      <label className="newsletter-option">
        <input
          type="radio"
          name="onboarding-newsletter"
          checked={newsletter === "settimanale"}
          onChange={() =>
            setNewsletter("settimanale")
          }
        />
        <span>
          Settimanale — un riepilogo la domenica alle 14
        </span>
      </label>

      <label className="newsletter-option">
        <input
          type="radio"
          name="onboarding-newsletter"
          checked={newsletter === "mai"}
          onChange={() => setNewsletter("mai")}
        />
        <span>Mai — nessun riepilogo</span>
      </label>

    </div>

    <hr />

    <h3>Notifiche push</h3>

    <p>
      Le push arrivano subito, anche a sito chiuso: nuovi commenti e
      like sugli spotted che segui, più le novità importanti.
    </p>

    <button
      type="button"
      onClick={attivaPushOnboarding}
      disabled={
        attivazionePushOnboarding || pushGiaAttive
      }
    >
      {attivazionePushOnboarding
        ? "Attivazione..."
        : pushGiaAttive
        ? "🔔 Push attive su questo dispositivo"
        : "🔔 Attiva notifiche push"}
    </button>

    {supportoPushOnboarding.iOS &&
      !supportoPushOnboarding.standalone && (
        <p className="push-notifications-message">
          📱 Su iPhone le notifiche funzionano solo dall'app
          installata: tocca Condividi, scegli “Aggiungi alla
          schermata Home” e riapri Spotted Bologna dall'icona.
        </p>
      )}

    {messaggioPushOnboarding && (
      <p className="push-notifications-message">
        {messaggioPushOnboarding}
      </p>
    )}

    <div className="onboarding-notifiche-actions">
      <button
        type="button"
        onClick={confermaOnboardingNotifiche}
        disabled={salvataggioNotifiche}
      >
        {salvataggioNotifiche
          ? "Salvataggio..."
          : "Continua"}
      </button>
    </div>

  </div>
)}

{user && (!savedNickname || passoNotifiche) ? null : (
<>

<div className="section-card">

  <h2>📩 Invia uno Spotted</h2>

<textarea
  rows="4"
  cols="50"
  value={spottedText}
  onChange={(e) =>
    setSpottedText(e.target.value)
  }
  placeholder="Scrivi il tuo spotted anonimo..."
/>

<p
  style={{
    fontSize: "12px",
    color: "#999"
  }}
>
  {spottedText.length}/1000
</p>

<div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "15px"
  }}
>

  <button onClick={inviaSpotted}>
    Invia Spotted
  </button>

<div
  style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "8px"
  }}
>

{user && (
  <span
    onClick={() =>
      setMostraPropostaGruppo(
        !mostraPropostaGruppo
      )
    }
    style={{
      cursor: "pointer",
      color: "#ffffff",
      fontSize: "14px",
      fontWeight: "500",
      textDecoration: "underline"
    }}
  >
    + Proponi gruppo
  </span>
)}

{isAdmin && (
  <span
    onClick={() =>
      setMostraComunicazioneServizio(
        !mostraComunicazioneServizio
      )
    }
    style={{
      cursor: "pointer",
      color: "#f4c542",
      fontSize: "14px",
      fontWeight: "600",
      textDecoration: "underline"
    }}
  >
    + Comunicazione di servizio
  </span>
)}

</div>

</div>

{user && mostraPropostaGruppo && (
<div className="section-card">

  <h2>📚 Proponi un gruppo</h2>

  <p>
    Descrivi bene il gruppo.
    Non saranno disponibili commenti.
  </p>

  <textarea
    rows="5"
    value={propostaDescrizione}
    onChange={(e) =>
      setPropostaDescrizione(
        e.target.value
      )
    }
    placeholder="Descrivi il gruppo..."
  />

  <input
    type="text"
    value={propostaLink}
    onChange={(e) =>
      setPropostaLink(
        e.target.value
      )
    }
    placeholder="Link WhatsApp, Telegram o Instagram"
  />

<label
  style={{
    display: "block",
    marginTop: "15px",
    marginBottom: "8px",
    color: "#fff",
    fontWeight: "bold"
  }}
>
  ❤️ Numero di like necessari per rendere disponibile il link
</label>

<p
  style={{
    color: "#999",
    fontSize: "14px"
  }}
>
  Il link resterà nascosto fino al raggiungimento di questo numero di like.
</p>

<input
  type="number"
  min="1"
  value={propostaTargetLike}
  onChange={(e) =>
    setPropostaTargetLike(
      Number(e.target.value)
    )
  }
/>

<button
  onClick={inviaPropostaGruppo}
>
  📩 Invia proposta
</button>

</div>

)}

{isAdmin && mostraComunicazioneServizio && (
<div className="section-card service-notice-form">

  <h2>🔧 Comunicazione di servizio</h2>

  <p>
    Compare tra gli spotted con il bordo dorato e arriva subito come
    notifica e push a tutti gli iscritti. Non serve alcuna
    approvazione.
  </p>

  <textarea
    rows="4"
    value={testoComunicazione}
    maxLength={500}
    onChange={(e) =>
      setTestoComunicazione(
        e.target.value
      )
    }
    placeholder="Es. Sabato 8 novembre il servizio resterà chiuso per manutenzione."
  />

  <p
    style={{
      fontSize: "12px",
      color: "#999"
    }}
  >
    {testoComunicazione.length}/500
  </p>

  {progressoComunicazione && (
    <p
      style={{
        color: "#f4c542",
        fontSize: "13px"
      }}
    >
      {progressoComunicazione}
    </p>
  )}

  <button
    onClick={inviaComunicazioneServizio}
    disabled={invioComunicazioneInCorso}
  >
    {invioComunicazioneInCorso
      ? "Invio in corso..."
      : "📣 Pubblica e notifica tutti"}
  </button>

</div>
)}

</div>

{user && savedNickname && isAdmin && (
  <>

<details className="admin-dashboard">

<summary
  style={{
    cursor: "pointer",
    fontSize: "22px",
    fontWeight: "bold",
    marginBottom: "15px"
  }}
>
  📩 Pending ({pendingPosts.length + richiesteNickname.length})
</summary>

<div className="section-card">

<h3>✏️ Cambi nickname ({richiesteNickname.length})</h3>

{richiesteNickname.length === 0 && (
  <p>Nessuna richiesta di cambio nickname.</p>
)}

{richiesteNickname.map((richiesta) => (
  <div
    key={richiesta.id}
    className="user-card nickname-request"
  >
    <p>
      <strong>Da:</strong>{" "}
      {richiesta.oldNickname || "(vuoto)"}
    </p>

    <p>
      <strong>A:</strong>{" "}
      {richiesta.newNickname}
    </p>

    <p>
      <strong>Richiesta il:</strong>{" "}
      {richiesta.createdAt
        ? new Date(
            richiesta.createdAt
          ).toLocaleString("it-IT")
        : "-"}
    </p>

    <button
      onClick={() =>
        approvaRichiestaNickname(richiesta)
      }
    >
      ✅ Approva
    </button>

    <button
      onClick={() =>
        rifiutaRichiestaNickname(richiesta)
      }
      style={{
        marginLeft: "10px"
      }}
    >
      ❌ Rifiuta
    </button>
  </div>
))}

</div>

<h3>📝 Spotted da approvare ({pendingPosts.length})</h3>

{pendingPosts.length === 0 && (
  <p>Nessuno spotted in attesa.</p>
)}

  <AdminPanel
    pendingPosts={pendingPosts}
    approvaPost={approvaPost}
    rifiutaPost={rifiutaPost}
  />

</details>

<details className="admin-dashboard">

  <summary
    style={{
      cursor: "pointer",
      fontSize: "22px",
      fontWeight: "bold",
      marginBottom: "15px"
    }}
  >
    👥 Dashboard Community
  </summary>

<div>

  <button
    onClick={toggleApprovalPosts}
  >
    {approvalEnabledPosts
      ? "📝 Spotted: approvazione attiva"
      : "📝 Spotted: pubblicazione automatica"}
  </button>

  <button
    onClick={toggleApprovalGroups}
    style={{
      marginLeft: "10px"
    }}
  >
    {approvalEnabledGroups
      ? "📚 Gruppi: approvazione attiva"
      : "📚 Gruppi: pubblicazione automatica"}
  </button>

</div>

      <div className="stats-grid">

  <div className="stat-card">
    <h3>👥 Utenti</h3>
    <div className="stat-number">
      {utenti.length}
    </div>
  </div>

  <div className="stat-card">
    <h3>📝 Spotted</h3>
    <div className="stat-number">
      {posts.length}
    </div>
  </div>

  <div className="stat-card">
    <h3>❤️ Like</h3>
    <div className="stat-number">
      {likes.length}
    </div>
  </div>

  <div className="stat-card">
    <h3>💬 Commenti</h3>
    <div className="stat-number">
      {comments.length}
    </div>
  </div>

</div>

<details>
  <summary>🚫 Parole vietate</summary>

  <input
    type="text"
    placeholder="Nuova parola vietata"
    value={nuovaParola}
    onChange={(e) =>
      setNuovaParola(e.target.value)
    }
  />

  <button
    onClick={aggiungiParolaVietata}
  >
    Aggiungi
  </button>

  {paroleVietate.map((parola) => (
    <div key={parola.id}>
      {parola.word}

      <button
        onClick={() =>
          eliminaParolaVietata(
            parola.id
          )
        }
      >
        Elimina
      </button>
    </div>
  ))}

</details>

<details><summary>
👥 Utenti ({utenti.length})
</summary>

<input
  type="text"
  placeholder="Cerca nickname o email..."
  value={ricercaUtente}
  onChange={(e) =>
    setRicercaUtente(e.target.value)
  }
/>
      {utenti
  .filter((utente) => {

    const ricerca =
      ricercaUtente.toLowerCase();

    return (
      (utente.nickname || "")
        .toLowerCase()
        .includes(ricerca) ||

      (utente.email || "")
        .toLowerCase()
        .includes(ricerca)
    );
  })
  .slice(0, utentiVisibili)
  .map((utente) => (
        <div
  key={utente.id}
  className="user-card"
>
  <p>
    <strong>Nickname:</strong>{" "}
    {utente.nickname || "Non impostato"}
  </p>

  <p>
    <strong>Email:</strong>{" "}
    {utente.email}
  </p>

  <p>
    <strong>Ruolo:</strong>{" "}
    {utente.role}
  </p>

<p>
  <strong>Newsletter:</strong>{" "}
  {utente.newsletter || "Mai"}
</p>

  <p>
    <strong>Registrato il:</strong>{" "}
    {utente.createdAt
  ? new Date(
      utente.createdAt
    ).toLocaleDateString("it-IT")
  : "-"}
  </p>

  <p>
    <strong>Stato:</strong>{" "}
    {utente.banned
      ? "🔴 Bannato"
      : "🟢 Attivo"}
  </p>

  {utente.role !== "admin" && (
  <>
    <button
      onClick={() =>
        toggleBan(
          utente.uid,
          utente.banned
        )
      }
    >
      {utente.banned
        ? "✅ Sblocca"
        : "🚫 Banna"}
    </button>

    <button
      onClick={() =>
  eliminaUtente(utente.id)
      }
      style={{
        marginLeft: "10px"
      }}
    >
      🗑 Elimina
    </button>
  </>
)}

</div>
      ))}

{utenti.length > utentiVisibili && (
  <button
    onClick={() =>
      setUtentiVisibili(
        utentiVisibili + 3
      )
    }
  >
    Mostra altri
  </button>
)}
    </details>

</details>

<details className="admin-dashboard">

  <summary
    style={{
      cursor: "pointer",
      fontSize: "22px",
      fontWeight: "bold",
      marginBottom: "15px"
    }}
  >
    📸 Spotted pubblicati ({posts.length})
  </summary>

  {posts
    .slice(0, postScreenshotVisibili)
    .map((post) => (
      <Post
        key={post.id}
        post={post}
        comments={comments}
        likes={likes}
        user={null}
        isAdmin={false}
        showDownloadImage
      />
    ))}

  {posts.length > postScreenshotVisibili && (
    <button
      onClick={() =>
        setPostScreenshotVisibili(
  postScreenshotVisibili + 3
)
      }
    >
      Mostra altri
    </button>
  )}

</details>



  </>
)}

{user && (
  <details className="admin-dashboard">

<summary
  style={{
    cursor: "pointer",
    fontSize: "22px",
    fontWeight: "bold",
    marginBottom: "15px"
  }}
>
  📚 Gruppi ({gruppi.length})
</summary>

{isAdmin && (

  <div className="section-card">

<h2>➕ Nuovo gruppo</h2>
    <input
      type="text"
      placeholder="Nome gruppo"
      value={nomeGruppo}
      onChange={(e) =>
        setNomeGruppo(e.target.value)
      }
    />

    <textarea
      placeholder="Descrizione"
      value={descrizioneGruppo}
      onChange={(e) =>
        setDescrizioneGruppo(
          e.target.value
        )
      }
    />

      <label
      style={{
        display: "block",
        marginTop: "10px",
        color: "#ccc",
        fontSize: "14px"
      }}
    >
      📷 Foto del gruppo
    </label>

    <input
      key={fotoGruppo ? "con-foto" : "senza-foto"}
      type="file"
      accept="image/*"
      onChange={(e) =>
        selezionaFoto(e, setFotoGruppo)
      }
    />

    {fotoGruppo && (
      <div>
        <img
          src={fotoGruppo}
          alt="Anteprima"
          className="group-photo-preview"
        />
        <button
          onClick={() => setFotoGruppo("")}
        >
          Rimuovi foto
        </button>
      </div>
    )}

    <input
      type="text"
      placeholder="Link separati da virgola"
      value={linkGruppo}
      onChange={(e) =>
        setLinkGruppo(
          e.target.value
        )
      }
    />







    <button
      onClick={aggiungiGruppo}
    >
      ➕ Aggiungi gruppo
    </button>

  </div>

)}

{gruppi.map((gruppo) => (
  <div key={gruppo.id} className="group-card">

    {gruppo.photo && (
      <img
        className="group-photo"
        src={gruppo.photo}
        alt={gruppo.name}
      />
    )}

    <div className="group-info">

      <h3 className="group-title">
        {gruppo.name}
      </h3>

      {gruppo.description && (
        <p className="group-description">
          {gruppo.description}
        </p>
      )}

      <div className="group-links">
        {gruppo.links
          ?.filter((link) => link)
          .map((link, index) => (
            <a
              key={index}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="group-link-btn"
            >
              🔗 Apri gruppo
            </a>
          ))}
      </div>

      {isAdmin && (
        <div className="group-admin-actions">

          <button
            onClick={() => {
              setGruppoInModifica(gruppo.id);
              setNomeGruppoEdit(gruppo.name || "");
              setDescrizioneGruppoEdit(
                gruppo.description || ""
              );
              setFotoGruppoEdit(gruppo.photo || "");
              setLinkGruppoEdit(
                gruppo.links?.join(", ") || ""
              );
            }}
          >
            ✏️ Modifica
          </button>

          <button
            onClick={() =>
              eliminaGruppo(gruppo.id)
            }
          >
            🗑 Elimina
          </button>

        </div>
      )}

    </div>
  </div>
))}

{isAdmin && gruppoInModifica && (

  <div className="section-card">

    <h3>✏️ Modifica gruppo</h3>

    <input
      type="text"
      value={nomeGruppoEdit}
      onChange={(e) =>
        setNomeGruppoEdit(
          e.target.value
        )
      }
      placeholder="Nome gruppo"
    />

    <textarea
      value={descrizioneGruppoEdit}
      onChange={(e) =>
        setDescrizioneGruppoEdit(
          e.target.value
        )
      }
      placeholder="Descrizione"
    />

      <label
      style={{
        display: "block",
        marginTop: "10px",
        color: "#ccc",
        fontSize: "14px"
      }}
    >
      📷 Foto del gruppo
    </label>

    <input
      key={fotoGruppoEdit ? "con-foto" : "senza-foto"}
      type="file"
      accept="image/*"
      onChange={(e) =>
        selezionaFoto(e, setFotoGruppoEdit)
      }
    />

    {fotoGruppoEdit && (
      <div>
        <img
          src={fotoGruppoEdit}
          alt="Anteprima"
          className="group-photo-preview"
        />
        <button
          onClick={() => setFotoGruppoEdit("")}
        >
          Rimuovi foto
        </button>
      </div>
    )}

    <input
      type="text"
      value={linkGruppoEdit}
      onChange={(e) =>
        setLinkGruppoEdit(
          e.target.value
        )
      }
      placeholder="Link separati da virgola"
    />

    <button
      onClick={salvaModificaGruppo}
    >
      💾 Salva modifiche
    </button>

    <button
      onClick={() =>
        setGruppoInModifica(null)
      }
      style={{
        marginLeft: "10px"
      }}
    >
      ❌ Annulla
    </button>

  </div>

)}
  </details>
)}  

<h2>Spotted pubblicati</h2>
{isAdmin && (
<input
type="text"
placeholder="Cerca negli spotted..."
value={ricercaSpotted}
onChange={(e) =>
setRicercaSpotted(e.target.value)
}
/>
)}
{feed
  .slice(0, postVisibili)
  .map((elemento) =>
  elemento.tipo === "comunicazione" ? (
  <article
    key={elemento.chiave}
    className="service-notice"
  >
    <div className="service-notice-top">
      <span className="service-notice-label">
        🔧 COMUNICAZIONE DI SERVIZIO
      </span>

      {isAdmin && (
        <button
          className="service-notice-delete"
          onClick={() =>
            eliminaComunicazioneServizio(
              elemento.comunicazione.id
            )
          }
          aria-label="Elimina comunicazione di servizio"
          title="Elimina comunicazione"
        >
          ✕
        </button>
      )}
    </div>

    <p className="service-notice-text">
      {elemento.comunicazione.text}
    </p>

    <small className="service-notice-date">
      {new Date(
        elemento.comunicazione.createdAt
      ).toLocaleString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })}
    </small>
  </article>
  ) : (
  <Post
    key={elemento.chiave}
    post={elemento.post}
    comments={comments}
    user={user}
    commentInputs={commentInputs}
    setCommentInputs={setCommentInputs}
    inviaCommento={inviaCommento}
    likes={likes}
    toggleLike={toggleLike}
    isAdmin={isAdmin}
    caricaCommenti={caricaCommenti}
    eliminaPost={eliminaPost}
    segnalaPost={segnalaPost}
    postFollowers={postFollowers}
    toggleFollowPost={toggleFollowPost}
    followRequestInProgress={followRequestInProgress}
  />
  )
)}

{feed.length > postVisibili && (
  <button
    onClick={() =>
      setPostVisibili(
        postVisibili + 10
      )
    }
  >
    Mostra altri spotted
  </button>
)}

</>
)}

    </div>
  );
}

export default App;
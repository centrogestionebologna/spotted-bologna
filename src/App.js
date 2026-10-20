import { useEffect, useState } from "react";

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
  onSnapshot
} from "firebase/firestore";

import { auth, provider, db } from "./firebase";

import {
  notificaNuovoPending,
  notificaPostSegnalato,
  notificaNuovoUtente
} from "./services/pushSender";

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

function App() {
  const creaNotifica = async ({
  userId,
  type,
  title,
  body,
  postId = null
}) => {

  await addDoc(
    collection(db, "notifications"),
    {
      userId,
      type,
      title,
      body,
      postId,
      read: false,
      createdAt:
        new Date().toISOString()
    }
  );

};
  const [nickname, setNickname] = useState("");
  const [savedNickname, setSavedNickname] = useState("");
  const [gruppi, setGruppi] =
  useState([]);
  const [nomeGruppo, setNomeGruppo] =
  useState("");

  const [
  ultimoNumeroNotifiche,
  setUltimoNumeroNotifiche
] = useState(0);

  const [postFollowers, setPostFollowers] =
  useState([]);
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
  useState(0);
  const [postVisibili, setPostVisibili] =
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
  showNotifications,
  setShowNotifications
] = useState(false);

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

// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {

  caricaPost();
  caricaCommenti();
  caricaLike();
  caricaImpostazioni();
  onAuthStateChanged(
    auth,
    async (currentUser) => {

      if (!currentUser) return;

      setUser(currentUser);
      await caricaFollowers();
      caricaGruppi();
      caricaIscritti();
      const userRef = doc(
        db,
        "users",
        currentUser.uid
      );

      const userSnap =
        await getDoc(userRef);

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
  caricaUtenti();
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

if (
  datiUtente.notifyPending !== undefined
) {
  setNotifyPending(
    datiUtente.notifyPending
  );
}

if (
  datiUtente.notifyReports !== undefined
) {
  setNotifyReports(
    datiUtente.notifyReports
  );
}

if (
  datiUtente.notifyNewUsers !== undefined
) {
  setNotifyNewUsers(
    datiUtente.notifyNewUsers
  );
}

if (
  datiUtente.notifyAllComments !== undefined
) {
  setNotifyAllComments(
    datiUtente.notifyAllComments
  );
}

if (
  datiUtente.notifyAllLikes !== undefined
) {
  setNotifyAllLikes(
    datiUtente.notifyAllLikes
  );
}

if (datiUtente.newsletter) {
  setNewsletter(
    datiUtente.newsletter
  );
}

}

caricaIscritti();
caricaUtenti();
    }
  );

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

  const caricaIscritti = async () => {

  const snapshot = await getDocs(
    collection(db, "users")
  );

  setNumeroIscritti(snapshot.size);

};
const caricaUtenti = async () => {

  const snapshot = await getDocs(
    collection(db, "users")
  );

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

  setUtenti(lista);
};

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

      const userSnap = await getDoc(userRef);

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

  caricaUtenti();

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

if (
  datiUtente.notifyPending !== undefined
) {
  setNotifyPending(
    datiUtente.notifyPending
  );
}

if (
  datiUtente.notifyReports !== undefined
) {
  setNotifyReports(
    datiUtente.notifyReports
  );
}

if (
  datiUtente.notifyNewUsers !== undefined
) {
  setNotifyNewUsers(
    datiUtente.notifyNewUsers
  );
}

if (
  datiUtente.notifyAllComments !== undefined
) {
  setNotifyAllComments(
    datiUtente.notifyAllComments
  );
}

if (
  datiUtente.notifyAllLikes !== undefined
) {
  setNotifyAllLikes(
    datiUtente.notifyAllLikes
  );
}

      }

if (!userSnap.exists()) {
  await setDoc(userRef, {
    uid: currentUser.uid,
    name:
      currentUser.displayName || "",
    email:
      currentUser.email || "",
    role: "user",
    nickname: "",

    newsletter: "mai",

    notifyComments: true,
    notifyLikes: false,

    pushEnabled: false,

    notifyPending: false,
    notifyReports: false,
    notifyNewUsers: false,
    notifyAllComments: false,
    notifyAllLikes: false,

    createdAt:
      new Date().toISOString()
  });

  console.log(
    "Nuovo utente creato:",
    currentUser.uid
  );

  try {
    const risultatoNotifica =
      await notificaNuovoUtente();

    console.log(
      "Notifica nuovo utente completata:",
      risultatoNotifica
    );
  } catch (erroreNotifica) {
    console.error(
      "Utente creato, ma notifica admin non inviata:",
      erroreNotifica
    );
  }
}

      setUser(currentUser);

    } catch (error) {
      console.error(error);
    }
  };

const salvaNickname = async () => {
  try {
    if (!user) {
      alert("Devi effettuare il login.");
      return;
    }

    const nicknamePulito = nickname.trim();

    if (!nicknamePulito) {
      alert("Inserisci un nickname");
      return;
    }

    await setDoc(
      doc(db, "users", user.uid),
      {
        nickname: nicknamePulito
      },
      { merge: true }
    );

    setSavedNickname(nicknamePulito);

    alert("Nickname salvato!");

  } catch (error) {
    console.error(
      "Errore salvataggio nickname:",
      error
    );

    alert(
      "Errore: " +
      (error.message || "sconosciuto")
    );
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

      try {
        const risultatoNotifica =
          await notificaNuovoPending(
            pendingRef.id
          );

        console.log(
          "Notifica pending completata:",
          risultatoNotifica
        );
      } catch (erroreNotifica) {
        console.error(
          "Pending salvato, ma notifica non inviata:",
          erroreNotifica
        );
      }

      if (isAdmin) {
        await caricaPendingPosts();
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

      await caricaPost();

      alert(
        "Il tuo spotted è stato pubblicato."
      );
    }

    setUltimoInvio(Date.now());
    setSpottedText("");
  } catch (erroreSalvataggio) {
    console.error(
      "Errore durante l'invio dello spotted:",
      erroreSalvataggio
    );

    alert(
      "Non è stato possibile inviare lo spotted. Riprova."
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

      try {
        const risultatoNotifica =
          await notificaNuovoPending(
            pendingRef.id
          );

        console.log(
          "Notifica proposta completata:",
          risultatoNotifica
        );
      } catch (erroreNotifica) {
        console.error(
          "Proposta salvata, ma notifica non inviata:",
          erroreNotifica
        );
      }

      if (isAdmin) {
        await caricaPendingPosts();
      }

      alert(
        "Proposta inviata per l'approvazione."
      );
    } else {
      await addDoc(
        collection(db, "posts"),
        nuovaProposta
      );

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

  } else {

    await addDoc(
      collection(db, "posts"),
      datiDaPubblicare
    );

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

};

const inviaCommento = async (postId) => {

  const testo =
    commentInputs[postId] || "";

  if (!testo.trim()) {
    return;
  }

  const userDoc = await getDoc(
    doc(db, "users", user.uid)
  );

  const nicknameUtente =
    userDoc.data().nickname;

  await addDoc(collection(db, "comments"), {
  postId: postId,
  userId: user.uid,
  nickname: nicknameUtente,
  text: testo,
  createdAt: new Date().toISOString()
});

const utentiSnapshot =
 await getDocs(
  collection(db,"users")
 );

utentiSnapshot.forEach(async (u) => {

 if (
  u.data().role === "admin" &&
  u.data().notifyAllComments
 ) {

  await creaNotifica({
   userId: u.id,
   type: "comment",
   title: "💬 Nuovo commento",
   body: testo,
   postId
  });

 }

});

const followersSnapshot = await getDocs(
  collection(db, "postFollowers")
);

followersSnapshot.forEach(async (follower) => {

  const datiFollower = follower.data();

  if (
    datiFollower.postId === postId &&
    datiFollower.userId !== user.uid
  ) {

    const userFollower = await getDoc(
      doc(
        db,
        "users",
        datiFollower.userId
      )
    );

    if (
      userFollower.exists() &&
      userFollower.data().notifyComments
    ) {

      await creaNotifica({
        userId: datiFollower.userId,

        type: "comment",

        title:
          "💬 Nuovo commento",

        body:
          `${nicknameUtente} ha commentato uno spotted che segui`,

        postId
      });

    }
  }
});

  setCommentInputs({
  ...commentInputs,
  [postId]: ""
});


  caricaCommenti();
};

const toggleLike = async (postId) => {

  if (!user) return;

  const likeEsistente = likes.find(
    (like) =>
      like.postId === postId &&
      like.userId === user.uid
  );

  if (likeEsistente) {

    await deleteDoc(
      doc(db, "likes", likeEsistente.id)
    );

  } else {

    const userDoc = await getDoc(
      doc(db, "users", user.uid)
    );

    await addDoc(
      collection(db, "likes"),
      {
        postId: postId,
        userId: user.uid,
        nickname: userDoc.data().nickname
      }
    );

const followersSnapshot = await getDocs(
  collection(db, "postFollowers")
);

followersSnapshot.forEach(async (follower) => {

  const datiFollower = follower.data();

  if (
    datiFollower.postId === postId &&
    datiFollower.userId !== user.uid
  ) {

    const userFollower = await getDoc(
      doc(
        db,
        "users",
        datiFollower.userId
      )
    );

    if (
      userFollower.exists() &&
      userFollower.data().notifyLikes
    ) {

      await creaNotifica({
        userId: datiFollower.userId,

        type: "like",

        title:
          "❤️ Nuovo like",

        body:
          `${userDoc.data().nickname} ha lasciato un like`,

        postId
      });

    }
  }

});

const utentiSnapshot =
 await getDocs(
  collection(db,"users")
 );

utentiSnapshot.forEach(async (u) => {

 if (
  u.data().role === "admin" &&
  u.data().notifyAllLikes
 ) {

  await creaNotifica({
   userId: u.id,
   type: "like",
   title: "❤️ Nuovo like",
   body:
    userDoc.data().nickname,
   postId
  });

 }

});

  }

 caricaLike();

const postDaControllare =
  posts.find(
    (p) => p.id === postId
  );

if (
  postDaControllare &&
  postDaControllare.type ===
    "groupProposal"
) {

  const nuoviLike = await getDocs(
    collection(db, "likes")
  );

  const totaleLike =
    nuoviLike.docs.filter(
      (docu) =>
        docu.data().postId === postId
    ).length;

  if (
    totaleLike >=
      postDaControllare.requiredLikes &&
    !postDaControllare.unlockedAt
  ) {

    await updateDoc(
      doc(db, "posts", postId),
      {
        unlockedAt:
          new Date().toISOString()
      }
    );

    caricaPost();

  }

}

};

const toggleFollowPost = async (
  postId
) => {

  if (!user) return;

  const esistente =
    postFollowers.find(
      (f) =>
        f.postId === postId &&
        f.userId === user.uid
    );

  if (esistente) {

    await deleteDoc(
      doc(
        db,
        "postFollowers",
        esistente.id
      )
    );

  } else {

    await addDoc(
      collection(
        db,
        "postFollowers"
      ),
      {
        postId,
        userId: user.uid,
        createdAt:
          new Date().toISOString()
      }
    );
  }

  caricaFollowers();
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

    console.log(
      "Post segnalato spostato in pending:",
      pendingRef.id
    );

    /*
     * Dopo aver creato il pending, chiediamo
     * al Worker di notificare gli amministratori.
     *
     * Se la notifica fallisce, il post resta
     * comunque correttamente in moderazione.
     */
    try {
      const risultatoNotifica =
        await notificaPostSegnalato(
          pendingRef.id
        );

      console.log(
        "Notifica segnalazione completata:",
        risultatoNotifica
      );
    } catch (erroreNotifica) {
      console.error(
        "Post spostato in moderazione, ma notifica non inviata:",
        erroreNotifica
      );
    }

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
  caricaUtenti();
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

  notifyPending,
  notifyReports,
  notifyNewUsers,
  notifyAllComments,
  notifyAllLikes
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

  await deleteDoc(
    doc(db, "users", uid)
  );
await salvaLog(
  "Elimina utente",
  uid
);
  caricaUtenti();
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

const caricaNotifiche = async (
  uid = user?.uid
) => {

  if (!uid) return;

  const snapshot = await getDocs(
    collection(db, "notifications")
  );

  const lista = [];

  snapshot.forEach((docu) => {

    const dati = docu.data();

   if (
  dati.userId === uid
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
    lista.filter(
      (n) => !n.read
    ).length
  );

};

useEffect(() => {

  if (!user) return;

const notificheQuery = query(
  collection(db, "notifications"),
  where("userId", "==", user.uid)
);

const unsubscribe = onSnapshot(
  notificheQuery,
  (snapshot) => {

      const lista = [];

      snapshot.forEach((docu) => {

        const dati = docu.data();

        if (dati.userId === user.uid) {

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
        lista.filter(
          (n) => !n.read
        ).length
      );
},
  (error) => {
    console.error(
      "Errore notifiche:",
      error
    );
  }
);

  return () => unsubscribe();

}, [user]);

const nonLette =
  notifications.filter(
    (n) => !n.read
  ).length;

const markAllNotificationsRead =
async () => {

  for (const n of notifications) {

    if (!n.read) {

      await updateDoc(
        doc(
          db,
          "notifications",
          n.id
        ),
        {
          read: true
        }
      );

    }

  }
};











return (
  <div className="app-container">

    <Header
  nickname={savedNickname}
  logout={logout}
  unreadNotifications={
    unreadNotifications
  }
/>
{user && savedNickname && (
  <>
    <ProfileCard
      nickname={savedNickname}
      iscritti={numeroIscritti}
      newsletter={newsletter}
      setNewsletter={setNewsletter}
      notifyComments={notifyComments}
      setNotifyComments={setNotifyComments}
      notifyLikes={notifyLikes}
      setNotifyLikes={setNotifyLikes}
      salvaNewsletter={salvaNewsletter}
      isAdmin={isAdmin}
      notifications={notifications}
      nonLette={nonLette}
      markAllNotificationsRead={markAllNotificationsRead}
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
      onChange={(e) =>
        setNickname(e.target.value)
      }
      placeholder="Nickname"
    />

    <button onClick={salvaNickname}>
      Salva nickname
    </button>

  </div>
)}

{user && !savedNickname ? null : (
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
  📩 Pending ({pendingPosts.length})
</summary>

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

<details>
<summary>
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
{posts
  .filter((post) =>
    post.text
      .toLowerCase()
      .includes(
        ricercaSpotted.toLowerCase()
      )
  )
  .slice(0, postVisibili)
  .map((post) => (
  <Post
    key={post.id}
    post={post}
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
  />
))}

{posts.length > postVisibili && (
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
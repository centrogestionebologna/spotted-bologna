import Header from "./components/Header";
import AdminPanel from "./components/AdminPanel";
import Post from "./components/Post";
import "./App.css";
import ProfileCard from "./components/ProfileCard";
import { useState, useEffect } from "react";
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
  updateDoc
} from "firebase/firestore";

import { auth, provider, db } from "./firebase";

function App() {
  const [nickname, setNickname] = useState("");
  const [savedNickname, setSavedNickname] = useState("");
  const [gruppi, setGruppi] =
  useState([]);
  const [nomeGruppo, setNomeGruppo] =
  useState("");

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
  ] = useState(10); 
  const [utentiVisibili, setUtentiVisibili] =
  useState(10);
  const [paroleVietate, setParoleVietate] =
  useState([]);

  const [nuovaParola, setNuovaParola] =
  useState("");

  const [newsletter, setNewsletter] =
  useState("mai");
  const [ultimoInvio, setUltimoInvio] =
  useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ricercaUtente, setRicercaUtente] =
    useState("");
  const [ricercaSpotted, setRicercaSpotted] =
  useState("");
  const [spottedText, setSpottedText] = useState("");
  const [commentInputs, setCommentInputs] =
  useState({});
  const [approvalEnabled, setApprovalEnabled] =
  useState(true);

// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {

  caricaPost();
  caricaCommenti();
  caricaLike();
  caricaImpostazioni();
  caricaGruppi();
  onAuthStateChanged(
    auth,
    async (currentUser) => {

      if (!currentUser) return;

      setUser(currentUser);
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

  if (
    userSnap.data().newsletter
  ) {
    setNewsletter(
      userSnap.data().newsletter
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
    setApprovalEnabled(
      snap.data().approvalEnabled
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

        if (userSnap.data().nickname) {
          setSavedNickname(
            userSnap.data().nickname
          );
        if (
  userSnap.data().newsletter
) {
  setNewsletter(
    userSnap.data().newsletter
  );
}

        }

      }

      if (!userSnap.exists()) {
        await setDoc(userRef, {
  uid: currentUser.uid,
  name: currentUser.displayName,
  email: currentUser.email,
  role: "user",
  nickname: "",
  newsletter: "mai",
  createdAt: new Date().toISOString()
});
      }

      setUser(currentUser);

    } catch (error) {
      console.error(error);
    }
  };

  const salvaNickname = async () => {
    if (nickname.trim() === "") {
      alert("Inserisci un nickname");
      return;
    }

    const usersSnapshot = await getDocs(
      collection(db, "users")
    );

    let nicknameEsistente = false;

    usersSnapshot.forEach((u) => {
      const data = u.data();

      if (
        data.nickname &&
        data.nickname.toLowerCase() ===
          nickname.toLowerCase()
      ) {
        nicknameEsistente = true;
      }
    });

    if (nicknameEsistente) {
      alert("Nickname già utilizzato");
      return;
    }

    await setDoc(
      doc(db, "users", user.uid),
      {
        nickname: nickname
      },
      { merge: true }
    );

    setSavedNickname(nickname);

    alert("Nickname salvato!");
  };

const inviaSpotted = async () => {

  const adesso = Date.now();

  if (
    adesso - ultimoInvio < 30000
  ) {

    alert(
      "Attendi 30 secondi prima di inviare un altro spotted."
    );

    return;
  }

  if (spottedText.trim() === "") {

    alert("Scrivi un messaggio");

    return;
  }

  if (spottedText.length < 10) {

    alert(
      "Lo spotted deve contenere almeno 10 caratteri"
    );

    return;
  }

  if (spottedText.length > 1000) {

    alert(
      "Massimo 1000 caratteri"
    );

    return;
  }

const testo =
  spottedText.toLowerCase();

const contieneParolaVietata =
  paroleVietate.some(
    (parola) =>
      testo.includes(
        parola.word.toLowerCase()
      )
  );

const nuovoPost = {
  text: spottedText,
  authorId: user ? user.uid : "anonimo",
  createdAt: new Date().toISOString(),
  status: "pending",
  reports: 0,
  reportedBy: [],
  flagReason: contieneParolaVietata
    ? "Parola vietata"
    : null
};

const vaInModerazione =
  contieneParolaVietata ||
  approvalEnabled;
  if (vaInModerazione) {

  await addDoc(
    collection(db, "pendingPosts"),
    nuovoPost
  );

} else {

  await addDoc(
    collection(db, "posts"),
    nuovoPost
  );

  caricaPost();
}

alert(
  "Il tuo spotted è stato inviato per l'approvazione"
);

setUltimoInvio(Date.now());

setSpottedText("");
};


const approvaPost = async (post) => {

  await addDoc(collection(db, "posts"), {
  text: post.text,
  likes: 0,
  comments: 0,
  author: "admin",
  createdAt: post.createdAt,
  reports: post.reports || 0,
  reportedBy: post.reportedBy || []
});

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
    await deleteDoc(
      doc(db, "pendingPosts", id)
    );
await salvaLog(
  "Rifiuta spotted",
  id
);
    caricaPendingPosts();
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

  }

  caricaLike();
};

const segnalaPost = async (postId) => {

  if (!user) {
    alert("Devi essere registrato.");
    return;
  }

  const postRef = doc(db, "posts", postId);

  const postSnap = await getDoc(postRef);

  if (!postSnap.exists()) return;

  const dati = postSnap.data();

  if (
    dati.reportedBy &&
    dati.reportedBy.includes(user.uid)
  ) {

    const nuoviSegnalatori =
      dati.reportedBy.filter(
        (id) => id !== user.uid
      );

    await updateDoc(postRef, {
      reports: Math.max(
        (dati.reports || 1) - 1,
        0
      ),
      reportedBy: nuoviSegnalatori
    });

    caricaPost();

    return;
  }

  const conferma = window.confirm(
    "Vuoi davvero segnalare questo spotted?"
  );

  if (!conferma) {
    return;
  }

  const nuoviReport =
    (dati.reports || 0) + 1;

  const nuoviSegnalatori = [
    ...(dati.reportedBy || []),
    user.uid
  ];

  await updateDoc(postRef, {
    reports: nuoviReport,
    reportedBy: nuoviSegnalatori
  });

  caricaPost();

  if (nuoviReport >= 3) {

    await addDoc(
      collection(db, "pendingPosts"),
      {
        ...dati,
        reports: nuoviReport,
        reportedBy: nuoviSegnalatori,
        flagReason:
          "Segnalato dalla community"
      }
    );

    await deleteDoc(postRef);

    alert(
      "Lo spotted è stato rimosso e inviato alla moderazione."
    );

    caricaPost();
    caricaPendingPosts();
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

const toggleApproval = async () => {

  await updateDoc(
    doc(db, "settings", "general"),
    {
      approvalEnabled:
        !approvalEnabled
    }
  );

  setApprovalEnabled(
    !approvalEnabled
  );

};

const salvaNewsletter = async () => {

  if (!user) return;

  await setDoc(
    doc(db, "users", user.uid),
    {
      newsletter: newsletter
    },
    { merge: true }
  );

  alert(
    "Preferenze newsletter salvate"
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

return (
  <div className="app-container">

    <Header
      nickname={savedNickname}
      logout={logout}
    />
  {user && savedNickname && (
  <ProfileCard
    nickname={savedNickname}
    iscritti={numeroIscritti}
    newsletter={newsletter}
    setNewsletter={setNewsletter}
    salvaNewsletter={salvaNewsletter}
  />
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

  <button onClick={inviaSpotted}>
    Invia Spotted
  </button>

</div>

{user && savedNickname && isAdmin && (
  <>
    <AdminPanel
      pendingPosts={pendingPosts}
      approvaPost={approvaPost}
      rifiutaPost={rifiutaPost}
    />

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

      <h2>👥 Dashboard Community</h2>
      <button onClick={toggleApproval}>

  {approvalEnabled
    ? "✅ Approvazione attiva"
    : "⚡ Pubblicazione automatica"}

  </button>
      <div className="stats-grid">

  <div className="stat-card">
    <h3>📩 Pending</h3>
    <div className="stat-number">
      {pendingPosts.length}
    </div>
  </div>

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
      <hr />

<h3>🚫 Parole vietate</h3>

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
  <div
    key={parola.id}
    style={{
      marginTop: "10px"
    }}
  >
    {parola.word}

    <button
      style={{
        marginLeft: "10px"
      }}
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
        utentiVisibili + 10
      )
    }
  >
    Mostra altri utenti
  </button>
)}
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
  .sort(
    (a, b) =>
      new Date(b.createdAt || 0) -
      new Date(a.createdAt || 0)
  )
  .slice(
    0,
    postScreenshotVisibili
  )
    .map((post) => (

      <div
  key={post.id}
  className="screenshot-post"
>

        <p>{post.text}</p>

        <p
          style={{
            color: "#999",
            fontSize: "12px"
          }}
        >
          {
            new Date(
              post.createdAt
            ).toLocaleDateString("it-IT")
          }
        </p>

        <p>
          {
            likes.filter(
              (like) =>
                like.postId === post.id
            ).length
          }

          {" like - "}

          {
            comments.filter(
              (c) =>
                c.postId === post.id
            ).length
          }

          {" commenti"}
        </p>

      </div>

    ))}

  {posts.length > postScreenshotVisibili && (
    <button
      onClick={() =>
        setPostScreenshotVisibili(
  postScreenshotVisibili + 10
)
      }
    >
      Mostra altri spotted
    </button>
  )}

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
    📚 Gruppi
  </summary>

  <input
    type="text"
    placeholder="Nome gruppo"
    value={nomeGruppo}
    onChange={(e) =>
      setNomeGruppo(
        e.target.value
      )
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

  <input
    type="text"
    placeholder="URL foto"
    value={fotoGruppo}
    onChange={(e) =>
      setFotoGruppo(
        e.target.value
      )
    }
  />

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

  <button onClick={aggiungiGruppo}>
    ➕ Aggiungi gruppo
  </button>


</details>

  </>
)}

<hr />

{user && gruppi?.length > 0 && (
  <>
    <h2>📚 Gruppi</h2>

    {gruppi.map((gruppo) => (
      <div key={gruppo.id} className="group-card">
        <h3>{gruppo.name}</h3>

        {gruppo.photo && (
          <img src={gruppo.photo} alt={gruppo.name} />
        )}

        <p>{gruppo.description}</p>

        {gruppo.links?.map((link, index) => (
          <div key={index}>
            <a href={link} target="_blank" rel="noopener noreferrer">
              🔗 Apri gruppo
            </a>
          </div>
        ))}
      </div>
    ))}
  </>
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
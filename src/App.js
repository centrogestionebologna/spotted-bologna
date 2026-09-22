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

  const [user, setUser] = useState(null);
  const [utenti, setUtenti] = useState([]);
  const [posts, setPosts] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [likes, setLikes] = useState([]);
  const [numeroIscritti, setNumeroIscritti] =
  useState(0);

  const [newsletter, setNewsletter] =
  useState("mai");
  const [isAdmin, setIsAdmin] = useState(false);
  const [ricercaUtente, setRicercaUtente] =
    useState("");
  const [spottedText, setSpottedText] = useState("");
  const [commentInputs, setCommentInputs] =
  useState({});

// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {

  caricaPost();
  caricaCommenti();
  caricaLike();
  caricaUtenti();

  onAuthStateChanged(
    auth,
    async (currentUser) => {

      if (!currentUser) return;

      setUser(currentUser);
      caricaIscritti();
      caricaUtenti();
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
}

        if (
          userSnap.data().nickname
        ) {
          setSavedNickname(
            userSnap.data().nickname
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

  setUtenti(lista);
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
        if (userSnap.data().role === "admin") {
          setIsAdmin(true);
          caricaPendingPosts();
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
    if (spottedText.trim() === "") {
      alert("Scrivi un messaggio");
      return;
    }

    await addDoc(collection(db, "pendingPosts"), {
      text: spottedText,
      authorId: user.uid,
      createdAt: new Date().toISOString(),
      status: "pending"
    });

    alert("Spotted inviato per approvazione");

    setSpottedText("");

    caricaPendingPosts();
  };

  const approvaPost = async (post) => {
    await addDoc(collection(db, "posts"), {
      text: post.text,
      likes: 0,
      comments: 0,
      author: "admin"
    });

    await deleteDoc(
      doc(db, "pendingPosts", post.id)
    );

    caricaPost();
    caricaPendingPosts();
  };

  const rifiutaPost = async (id) => {
    await deleteDoc(
      doc(db, "pendingPosts", id)
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

  caricaUtenti();
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

return (
  <div className="app-container">

    <Header
      nickname={savedNickname}
      logout={logout}
    />
  {user && (
    <ProfileCard
  nickname={savedNickname}
  iscritti={numeroIscritti}
  newsletter={newsletter}
  setNewsletter={setNewsletter}
  salvaNewsletter={salvaNewsletter}
/>
)}

    {!user && (
      <button onClick={loginGoogle}>
        Accedi con Google
      </button>
    )}

    {user && (
  <>
    {!savedNickname ? (
      <>
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
      </>
    ) : null}

        <hr />

        <div className="section-card">

          <h2>Invia uno Spotted</h2>

          <textarea
            rows="4"
            cols="50"
            value={spottedText}
            onChange={(e) =>
              setSpottedText(e.target.value)
            }
            placeholder="Scrivi il tuo spotted anonimo..."
          />

          <button onClick={inviaSpotted}>
            Invia Spotted
          </button>

        </div>

      </>
    )}

{isAdmin && (
  <>
    <AdminPanel
      pendingPosts={pendingPosts}
      approvaPost={approvaPost}
      rifiutaPost={rifiutaPost}
    />

    <div className="admin-dashboard">

      <h2>👥 Dashboard Community</h2>

      <p>
        Totale utenti registrati: {utenti.length}
      </p>
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
    <strong>Registrato il:</strong>{" "}
    {utente.createdAt}
  </p>

  <p>
    <strong>Stato:</strong>{" "}
    {utente.banned
      ? "🔴 Bannato"
      : "🟢 Attivo"}
  </p>

  {utente.role !== "admin" && (
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
  )}

</div>
      ))}

    </div>
  </>
)}

      <hr />

      <h2>Spotted pubblicati</h2>

{posts.map((post) => (
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
/>
))}
    </div>
  );
}

export default App;
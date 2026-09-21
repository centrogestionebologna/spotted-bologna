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
  deleteDoc
} from "firebase/firestore";

import { auth, provider, db } from "./firebase";

function App() {
  const [nickname, setNickname] = useState("");
  const [savedNickname, setSavedNickname] = useState("");

  const [user, setUser] = useState(null);

  const [posts, setPosts] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [likes, setLikes] = useState([]);

  const [isAdmin, setIsAdmin] = useState(false);

  const [spottedText, setSpottedText] = useState("");
  const [commentInputs, setCommentInputs] =
  useState({});

useEffect(() => {

  caricaPost();
  caricaPendingPosts();
  caricaCommenti();
  caricaLike();

  onAuthStateChanged(
    auth,
    async (currentUser) => {

      if (!currentUser) return;

      setUser(currentUser);

      const userRef = doc(
        db,
        "users",
        currentUser.uid
      );

      const userSnap =
        await getDoc(userRef);

      if (userSnap.exists()) {

        if (
          userSnap.data().role ===
          "admin"
        ) {
          setIsAdmin(true);
        }

        if (
          userSnap.data().nickname
        ) {
          setSavedNickname(
            userSnap.data().nickname
          );
        }

      }

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

        if (userSnap.data().role === "admin") {
          setIsAdmin(true);
        }

        if (userSnap.data().nickname) {
          setSavedNickname(
            userSnap.data().nickname
          );
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

  await addDoc(
    collection(db, "comments"),
    {
      postId: postId,
      nickname: nicknameUtente,
      text: testo,
      createdAt: new Date().toISOString()
    }
  );

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

const logout = async () => {

  await signOut(auth);

  setUser(null);

  setSavedNickname("");

  setIsAdmin(false);

};

return (
  <div className="app-container">

    <Header
      nickname={savedNickname}
      logout={logout}
    />
    <ProfileCard
  nickname={savedNickname}
/>

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
  <AdminPanel
  pendingPosts={pendingPosts}
  approvaPost={approvaPost}
  rifiutaPost={rifiutaPost}
/>
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
/>
))}
    </div>
  );
}

export default App;
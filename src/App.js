import { useState, useEffect } from "react";
import { signInWithPopup } from "firebase/auth";
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
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [spottedText, setSpottedText] = useState("");

  useEffect(() => {
    caricaPost();
    caricaPendingPosts();
  }, []);

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

  const loginGoogle = async () => {

    try {

      const result = await signInWithPopup(auth, provider);

      const currentUser = result.user;

      const userRef = doc(db, "users", currentUser.uid);

      const userSnap = await getDoc(userRef);

      if (
        userSnap.exists() &&
        userSnap.data().role === "admin"
      ) {
        setIsAdmin(true);
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

    const usersSnapshot = await getDocs(collection(db, "users"));

    let nicknameEsistente = false;

    usersSnapshot.forEach((u) => {

      const data = u.data();

      if (
        data.nickname &&
        data.nickname.toLowerCase() === nickname.toLowerCase()
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

  return (
    <div style={{ padding: "20px" }}>

      <h1>SPOTTED BOLOGNA OFFICIAL</h1>

      {!user && (
        <button onClick={loginGoogle}>
          Accedi con Google
        </button>
      )}

      {user && (
        <>
          <h2>Scegli nickname</h2>

          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Nickname"
          />

          <button onClick={salvaNickname}>
            Salva nickname
          </button>

          <hr />

          <h2>Invia uno Spotted</h2>

          <textarea
            rows="4"
            cols="50"
            value={spottedText}
            onChange={(e) => setSpottedText(e.target.value)}
          />

          <br />

          <button onClick={inviaSpotted}>
            Invia Spotted
          </button>
        </>
      )}

      {isAdmin && (
        <div>

          <hr />

          <h2>Pannello Admin</h2>

          {pendingPosts.map((post) => (

            <div
              key={post.id}
              style={{
                border: "2px solid orange",
                padding: "10px",
                marginBottom: "10px"
              }}
            >

              <p>{post.text}</p>

              <button
                onClick={() => approvaPost(post)}
              >
                ✅ Approva
              </button>

              <button
                onClick={() => rifiutaPost(post.id)}
                style={{ marginLeft: "10px" }}
              >
                ❌ Rifiuta
              </button>

            </div>

          ))}

        </div>
      )}

      <hr />

      <h2>Spotted pubblicati</h2>

      {posts.map((post) => (

        <div
          key={post.id}
          style={{
            border: "1px solid gray",
            padding: "10px",
            marginBottom: "10px"
          }}
        >

          <p>{post.text}</p>

          <p>
            ❤️ {post.likes} | 💬 {post.comments}
          </p>

        </div>

      ))}

    </div>
  );
}

export default App;
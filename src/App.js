import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection
} from "firebase/firestore";

import { auth, provider, db } from "./firebase";

function App() {
  const [nickname, setNickname] = useState("");
  const [user, setUser] = useState(null);

  const loginGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, provider);

      const currentUser = result.user;

      const userRef = doc(db, "users", currentUser.uid);

      const userSnap = await getDoc(userRef);

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

    usersSnapshot.forEach((userDoc) => {
      const data = userDoc.data();

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

    const userRef = doc(db, "users", user.uid);

    await setDoc(
      userRef,
      {
        nickname: nickname
      },
      { merge: true }
    );

    alert("Nickname salvato!");
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
        <div>
          <h2>Scegli il tuo nickname</h2>

          <input
            type="text"
            placeholder="Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />

          <button
            onClick={salvaNickname}
            style={{ marginLeft: "10px" }}
          >
            Salva nickname
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
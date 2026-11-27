import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  limitToLast,
  onSnapshot,
  orderBy,
  query
} from "firebase/firestore";

import { db } from "../firebase";

/*
 * Chat dei gruppi creati dentro Spotted Bologna: solo testo ed emoji,
 * con i messaggi salvati in groupChats/{postId}/messages e aggiornati
 * in tempo reale. Si apre in un popup e si ispira a WhatsApp.
 */
const EMOJI = [
  "😀", "😂", "🥰", "😎", "😅", "🤩", "😭", "😡",
  "👍", "👎", "❤️", "🔥", "🎉", "🙌", "👏", "💚",
  "🤔", "😴", "🙃", "😇", "🥳", "😱", "🤯", "💪"
];

const oraMessaggio = (valore) => {
  const data = new Date(valore);

  if (Number.isNaN(data.getTime())) {
    return "";
  }

  return data.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit"
  });
};

function GroupChat({ group, user, nickname, onClose }) {
  const [messaggi, setMessaggi] = useState([]);
  const [testo, setTesto] = useState("");
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState("");
  const [emojiAperte, setEmojiAperte] = useState(false);

  const fondoRef = useRef(null);
  const inputRef = useRef(null);

  const nomeMostrato =
    nickname || user?.displayName || "Utente";

  /* I messaggi arrivano in diretta: la chat resta aperta e si aggiorna. */
  useEffect(() => {
    const messaggiRef = collection(
      db,
      "groupChats",
      group.id,
      "messages"
    );

    const messaggiQuery = query(
      messaggiRef,
      orderBy("createdAt", "asc"),
      limitToLast(200)
    );

    return onSnapshot(
      messaggiQuery,
      (snapshot) => {
        setMessaggi(
          snapshot.docs.map((documento) => ({
            id: documento.id,
            ...documento.data()
          }))
        );

        setErrore("");
      },
      (erroreChat) => {
        console.error(
          "Errore nel caricamento della chat:",
          erroreChat
        );

        setErrore(
          `Non è possibile caricare la chat: ${erroreChat.message}`
        );
      }
    );
  }, [group.id]);

  /* Ogni nuovo messaggio porta la chat in fondo, come su WhatsApp. */
  useEffect(() => {
    const fondo = fondoRef.current;

    if (fondo) {
      fondo.scrollTop = fondo.scrollHeight;
    }
  }, [messaggi.length]);

  /* La chat si chiude anche con Esc. */
  useEffect(() => {
    const gestisciTasto = (evento) => {
      if (evento.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", gestisciTasto);

    return () =>
      window.removeEventListener("keydown", gestisciTasto);
  }, [onClose]);

  const inviaMessaggio = async (evento) => {
    evento.preventDefault();

    const testoPulito = testo.trim();

    if (!testoPulito || invio) {
      return;
    }

    setInvio(true);
    setErrore("");

    try {
      await addDoc(
        collection(
          db,
          "groupChats",
          group.id,
          "messages"
        ),
        {
          postId: group.id,
          userId: user.uid,
          nickname: nomeMostrato,
          text: testoPulito.slice(0, 500),
          createdAt: new Date().toISOString()
        }
      );

      setTesto("");
      setEmojiAperte(false);
      inputRef.current?.focus();
    } catch (erroreInvio) {
      console.error(
        "Messaggio non inviato:",
        erroreInvio
      );

      setErrore(
        `Messaggio non inviato: ${erroreInvio.message}`
      );
    } finally {
      setInvio(false);
    }
  };

  return (
    <div
      className="pannello-sfondo chat-sfondo"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="chat-finestra"
        role="dialog"
        aria-modal="true"
        aria-label={`Chat del gruppo ${group.name}`}
        onClick={(evento) => evento.stopPropagation()}
      >

        <div className="chat-testa">

          <span className="chat-avatar" aria-hidden="true">
            💬
          </span>

          <div className="chat-testa-testi">
            <h2>{group.name}</h2>
            <small>Gruppo interno · solo testo ed emoji</small>
          </div>

          <button
            type="button"
            className="pannello-chiudi chat-chiudi"
            aria-label="Chiudi la chat"
            onClick={onClose}
          >
            ×
          </button>

        </div>

        <div className="chat-messaggi" ref={fondoRef}>

          {messaggi.length === 0 && !errore && (
            <p className="chat-vuota">
              Ancora nessun messaggio.
              <br />
              Scrivi tu il primo 👋
            </p>
          )}

          {messaggi.map((messaggio) => {
            const mio =
              messaggio.userId === user.uid;

            return (
              <div
                key={messaggio.id}
                className={`chat-bolla ${
                  mio
                    ? "chat-bolla-mia"
                    : "chat-bolla-altrui"
                }`}
              >
                {!mio && messaggio.nickname && (
                  <span className="chat-autore">
                    {messaggio.nickname}
                  </span>
                )}

                <span className="chat-testo">
                  {messaggio.text}
                </span>

                <span className="chat-ora">
                  {oraMessaggio(messaggio.createdAt)}
                </span>
              </div>
            );
          })}

        </div>

        {errore && (
          <p className="chat-errore">{errore}</p>
        )}

        {emojiAperte && (
          <div className="chat-emoji-panel">
            {EMOJI.map((emoji) => (
              <button
                type="button"
                key={emoji}
                aria-label={`Emoji ${emoji}`}
                onClick={() => {
                  setTesto((corrente) => corrente + emoji);
                  inputRef.current?.focus();
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <form
          className="chat-composer"
          onSubmit={inviaMessaggio}
        >
          <button
            type="button"
            className="chat-emoji-btn"
            aria-label="Emoji"
            aria-expanded={emojiAperte}
            onClick={() =>
              setEmojiAperte(!emojiAperte)
            }
          >
            😊
          </button>

          <input
            ref={inputRef}
            type="text"
            className="chat-input"
            value={testo}
            maxLength={500}
            placeholder="Scrivi un messaggio"
            onChange={(evento) =>
              setTesto(evento.target.value)
            }
          />

          <button
            type="submit"
            className="chat-invia"
            aria-label="Invia messaggio"
            disabled={invio || !testo.trim()}
          >
            {invio ? "…" : "➤"}
          </button>
        </form>

      </div>
    </div>
  );
}

export default GroupChat;

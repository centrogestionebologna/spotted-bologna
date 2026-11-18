import { useEffect, useState } from "react";

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where
} from "firebase/firestore";

import { db } from "../firebase";

const ORDINA_PER_DATA = (prima, seconda) =>
  new Date(seconda.createdAt || 0) -
  new Date(prima.createdAt || 0);

const dataBreve = (valore) => {
  if (!valore) return "";

  const data = new Date(valore);

  return Number.isNaN(data.getTime())
    ? ""
    : data.toLocaleDateString("it-IT");
};

function QuestionBox({
  user,
  isAdmin,
  nickname,
  pubblicaRisposta
}) {
  const [domandeAttive, setDomandeAttive] =
    useState([]);
  const [proposte, setProposte] = useState([]);
  const [
    domandaSelezionata,
    setDomandaSelezionata
  ] = useState("");
  const [risposta, setRisposta] = useState("");
  const [nuovaDomanda, setNuovaDomanda] =
    useState("");
  const [proposta, setProposta] = useState("");
  const [
    mostraProposta,
    setMostraProposta
  ] = useState(false);
  const [
    invioRisposta,
    setInvioRisposta
  ] = useState(false);
  const [invioDomanda, setInvioDomanda] =
    useState(false);
  const [
    invioProposta,
    setInvioProposta
  ] = useState(false);
  const [
    propostaInCorso,
    setPropostaInCorso
  ] = useState("");
  const [messaggio, setMessaggio] = useState("");
  const [errore, setErrore] = useState("");

  useEffect(() => {
    const domandeQuery = query(
      collection(db, "questions"),
      where("status", "==", "active")
    );

    const unsubscribe = onSnapshot(
      domandeQuery,
      (snapshot) => {
        const lista = snapshot.docs
          .map((documento) => ({
            id: documento.id,
            ...documento.data()
          }))
          .filter((domanda) => domanda.text)
          .sort(ORDINA_PER_DATA);

        setDomandeAttive(lista);
        setDomandaSelezionata((corrente) =>
          lista.some(
            (domanda) => domanda.id === corrente
          )
            ? corrente
            : lista[0]?.id || ""
        );
      },
      (erroreQuery) => {
        console.error(
          "Errore caricamento domande:",
          erroreQuery
        );

        setErrore(
          "Non riesco a caricare le domande. Riprova più tardi."
        );
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setProposte([]);
      return undefined;
    }

    const proposteQuery = query(
      collection(db, "questions"),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(
      proposteQuery,
      (snapshot) => {
        setProposte(
          snapshot.docs
            .map((documento) => ({
              id: documento.id,
              ...documento.data()
            }))
            .filter((domanda) => domanda.text)
            .sort(ORDINA_PER_DATA)
        );
      },
      (erroreQuery) => {
        console.error(
          "Errore caricamento proposte:",
          erroreQuery
        );

        setErrore(
          "Non riesco a caricare le proposte in attesa."
        );
      }
    );

    return unsubscribe;
  }, [isAdmin]);

  const inviaRisposta = async (event) => {
    event.preventDefault();

    const testo = risposta.trim();

    if (!testo || !domandaSelezionata) {
      setErrore(
        "Scrivi una risposta prima di inviarla."
      );
      return;
    }

    setInvioRisposta(true);
    setErrore("");
    setMessaggio("");

    const domanda = domandeAttive.find(
      (elemento) =>
        elemento.id === domandaSelezionata
    );

    if (!domanda) {
      setErrore(
        "La domanda selezionata non è più disponibile."
      );
      setInvioRisposta(false);
      return;
    }

    try {
      if (typeof pubblicaRisposta !== "function") {
        throw new Error(
          "Pubblicazione risposta non disponibile."
        );
      }

      /*
       * La risposta viene pubblicata nella collezione posts come
       * uno spotted normale: domanda + risposta, senza autore.
       */
      await pubblicaRisposta(domanda, testo);

      setRisposta("");
      setMessaggio(
        "Risposta pubblicata come spotted anonimo. La trovi nel feed."
      );
    } catch (erroreInvio) {
      console.error(
        "Errore invio risposta:",
        erroreInvio
      );

      setErrore(
        "Non è stato possibile inviare la risposta. Riprova."
      );
    } finally {
      setInvioRisposta(false);
    }
  };

  const aggiungiDomanda = async () => {
    const testo = nuovaDomanda.trim();

    if (!testo) {
      setErrore("Scrivi il testo della domanda.");
      return;
    }

    setInvioDomanda(true);
    setErrore("");
    setMessaggio("");

    try {
      await addDoc(
        collection(db, "questions"),
        {
          text: testo.slice(0, 200),
          status: "active",
          createdAt: new Date().toISOString(),
          authorId: user?.uid || "admin",
          authorName:
            nickname || "Admin"
        }
      );

      setNuovaDomanda("");
      setMessaggio(
        "Domanda pubblicata: ora è selezionabile da tutti."
      );
    } catch (erroreInvio) {
      console.error(
        "Errore creazione domanda:",
        erroreInvio
      );

      setErrore(
        "Non è stato possibile pubblicare la domanda."
      );
    } finally {
      setInvioDomanda(false);
    }
  };

  const inviaProposta = async () => {
    const testo = proposta.trim();

    if (!testo || !user) return;

    setInvioProposta(true);
    setErrore("");
    setMessaggio("");

    try {
      await addDoc(
        collection(db, "questions"),
        {
          text: testo.slice(0, 200),
          status: "pending",
          createdAt: new Date().toISOString(),
          authorId: user.uid,
          authorName:
            nickname || "Utente"
        }
      );

      setProposta("");
      setMostraProposta(false);
      setMessaggio(
        "Proposta inviata: sarà visibile solo dopo l'approvazione di un admin."
      );
    } catch (erroreInvio) {
      console.error(
        "Errore invio proposta:",
        erroreInvio
      );

      setErrore(
        "Non è stato possibile inviare la proposta."
      );
    } finally {
      setInvioProposta(false);
    }
  };

  const cambiaStatoProposta = async (
    id,
    stato
  ) => {
    setPropostaInCorso(`${id}-${stato}`);
    setErrore("");
    setMessaggio("");

    try {
      await updateDoc(doc(db, "questions", id), {
        status: stato,
        reviewedAt: new Date().toISOString(),
        reviewedBy: user?.uid || null
      });

      setMessaggio(
        stato === "active"
          ? "Domanda approvata: ora è selezionabile."
          : "Proposta rifiutata."
      );
    } catch (erroreInvio) {
      console.error(
        "Errore revisione proposta:",
        erroreInvio
      );

      setErrore(
        "Non è stato possibile aggiornare la proposta."
      );
    } finally {
      setPropostaInCorso("");
    }
  };

  return (
    <section className="section-card question-box">
      <div className="question-head">
        <div>
          <span className="question-eyebrow">
            Domanda della community
          </span>
          <h2>💬 Rispondi a questa domanda...</h2>
        </div>

        <span className="question-anon-badge">
          🕶️ Anonima
        </span>
      </div>

      <p className="question-intro">
        Scegli una domanda e racconta la tua esperienza.
        La risposta diventerà uno spotted anonimo nel feed,
        con domanda e risposta.
      </p>

      {domandeAttive.length === 0 ? (
        <p className="question-empty">
          Nessuna domanda attiva al momento.
          {isAdmin
            ? " Aggiungine una qui sotto."
            : " Torna a trovarci presto."}
        </p>
      ) : (
        <form
          className="question-answer-form"
          onSubmit={inviaRisposta}
        >
          <span
            className="question-list-label"
            id="domanda-community-label"
          >
            Scegli la domanda
          </span>

          <div
            className="question-list"
            role="radiogroup"
            aria-labelledby="domanda-community-label"
          >
            {domandeAttive.map((domanda) => (
              <label
                key={domanda.id}
                className={`question-option ${
                  domandaSelezionata === domanda.id
                    ? "is-selected"
                    : ""
                }`}
              >
                <input
                  type="radio"
                  name="domanda-community"
                  value={domanda.id}
                  checked={
                    domandaSelezionata ===
                    domanda.id
                  }
                  onChange={(evento) =>
                    setDomandaSelezionata(
                      evento.target.value
                    )
                  }
                />

                <span className="question-option-text">
                  {domanda.text}
                </span>

                <span
                  className="question-option-check"
                  aria-hidden="true"
                >
                  ✓
                </span>
              </label>
            ))}
          </div>

          <label htmlFor="risposta-domanda">
            La tua risposta
          </label>

          <textarea
            id="risposta-domanda"
            rows="4"
            maxLength={500}
            value={risposta}
            onChange={(evento) =>
              setRisposta(evento.target.value)
            }
            placeholder="Scrivi qui la tua risposta anonima..."
          />

          <p className="question-publish-note">
            🕶️ La risposta sarà pubblicata come spotted
            anonimo, con domanda e risposta.
          </p>

          <div className="question-form-footer">
            <span>{risposta.length}/500</span>

            <button
              type="submit"
              className="question-submit"
              disabled={
                invioRisposta ||
                !risposta.trim() ||
                !domandaSelezionata
              }
            >
              {invioRisposta
                ? "Pubblicazione..."
                : "Pubblica risposta anonima"}
            </button>
          </div>
        </form>
      )}

      {messaggio && (
        <p
          className="question-message"
          role="status"
        >
          {messaggio}
        </p>
      )}

      {errore && (
        <p
          className="question-error"
          role="alert"
        >
          {errore}
        </p>
      )}

      {isAdmin && (
        <div className="question-admin-panel">
          <h3>🛠️ Aggiungi una domanda</h3>

          <p>
            La domanda sarà subito selezionabile da tutti
            gli utenti.
          </p>

          <textarea
            rows="3"
            maxLength={200}
            value={nuovaDomanda}
            onChange={(evento) =>
              setNuovaDomanda(evento.target.value)
            }
            placeholder="Es. Qual è il tuo posto preferito a Bologna?"
          />

          <div className="question-form-footer">
            <span>{nuovaDomanda.length}/200</span>

            <button
              type="button"
              onClick={aggiungiDomanda}
              disabled={
                invioDomanda ||
                !nuovaDomanda.trim()
              }
            >
              {invioDomanda
                ? "Pubblicazione..."
                : "Aggiungi domanda"}
            </button>
          </div>

          {proposte.length > 0 && (
            <div className="question-pending">
              <h4>
                Proposte in attesa ({proposte.length})
              </h4>

              {proposte.map((domanda) => (
                <article
                  className="question-pending-item"
                  key={domanda.id}
                >
                  <p>{domanda.text}</p>

                  <small>
                    {domanda.authorName ||
                      "Utente"}{" "}
                    · {dataBreve(domanda.createdAt)}
                  </small>

                  <div className="question-pending-actions">
                    <button
                      type="button"
                      onClick={() =>
                        cambiaStatoProposta(
                          domanda.id,
                          "active"
                        )
                      }
                      disabled={Boolean(
                        propostaInCorso
                      )}
                    >
                      ✅ Approva
                    </button>

                    <button
                      type="button"
                      className="question-reject-btn"
                      onClick={() =>
                        cambiaStatoProposta(
                          domanda.id,
                          "rejected"
                        )
                      }
                      disabled={Boolean(
                        propostaInCorso
                      )}
                    >
                      Rifiuta
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {user && !isAdmin && (
        <div className="question-proposal">
          <button
            type="button"
            className="question-proposal-toggle"
            onClick={() =>
              setMostraProposta(
                (corrente) => !corrente
              )
            }
          >
            {mostraProposta
              ? "Chiudi proposta"
              : "+ Proponi una domanda"}
          </button>

          {mostraProposta && (
            <div className="question-proposal-form">
              <p>
                La proposta sarà visibile agli admin e
                comparirà tra le domande solo dopo
                l'approvazione.
              </p>

              <textarea
                rows="3"
                maxLength={200}
                value={proposta}
                onChange={(evento) =>
                  setProposta(evento.target.value)
                }
                placeholder="Scrivi la domanda che vorresti vedere..."
              />

              <div className="question-form-footer">
                <span>{proposta.length}/200</span>

                <button
                  type="button"
                  onClick={inviaProposta}
                  disabled={
                    invioProposta ||
                    !proposta.trim()
                  }
                >
                  {invioProposta
                    ? "Invio..."
                    : "Invia proposta"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default QuestionBox;

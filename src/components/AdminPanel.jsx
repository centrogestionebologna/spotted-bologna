import { useEffect, useRef, useState } from "react";

import { creaImmagineSpotted } from "../utils/immagineSpotted";
import { creaCaptionInstagram } from "../utils/captionInstagram";
import { esportaJpeg } from "../utils/esportaJpeg";

import {
  leggiConfigurazioneInstagram
} from "../services/instagramPublisher";

const linkValido = (link) =>
  /^https?:\/\//i.test(link || "");

const pubblicitaRilevata = (post) =>
  /^Pubblicità rilevata:/i.test(
    String(post.flagReason || "")
  );

const dettaglioPubblicita = (post) =>
  String(post.flagReason || "")
    .replace(/^Pubblicità rilevata:\s*/i, "")
    .trim();

const chiaveUtente = (utente) => utente?.id || utente?.uid || "";

/*
 * Uno spotted puo' arrivare da un utente loggato oppure senza autore:
 * le risposte alle domande e i vecchi spotted non hanno un authorId.
 */
const nomeDaUid = (uid, utenti) => {
  if (!uid || uid === "anonimo") {
    return "Utente anonimo";
  }

  const utente = utenti.find(
    (voce) => chiaveUtente(voce) === uid
  );

  return (
    utente?.nickname ||
    utente?.name ||
    "Utente sconosciuto"
  );
};

const nomiSegnalatori = (reportedBy, utenti) =>
  (Array.isArray(reportedBy) ? reportedBy : []).map(
    (uid) => nomeDaUid(uid, utenti)
  );

/*
 * Anteprima e pubblicazione su Instagram di uno spotted in attesa:
 * l'admin vede la card, puo' correggere la descrizione e solo dopo
 * pubblica e approva.
 */
function InstagramBox({
  post,
  pubblicaInstagram,
  auto = true,
  hashtags = ""
}) {
  const [anteprima, setAnteprima] = useState("");
  const [caption, setCaption] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState("");
  const [tentatoAuto, setTentatoAuto] = useState(false);
  const contenitoreRef = useRef(null);

  const apriAnteprima = async () => {
    setErrore("");
    setInCorso(true);

    try {
      const configurazione =
        await leggiConfigurazioneInstagram();

      if (!configurazione.configured) {
        setErrore(
          "Instagram non è ancora collegato: manca il token di accesso nel Worker."
        );

        return;
      }

      const { canvas } = await creaImmagineSpotted(
        post,
        0,
        "instagram"
      );

      setCaption(
        creaCaptionInstagram(
          post.text,
          hashtags
        )
      );
      setAnteprima(esportaJpeg(canvas));
    } catch (erroreCard) {
      setErrore(
        erroreCard.message ||
          "Impossibile creare l'immagine."
      );
    } finally {
      setInCorso(false);
    }
  };

  /*
   * Con la pubblicazione automatica attiva non serve preparare la
   * card a mano: quando l'admin apre lo spotted la card e' gia'
   * pronta e deve solo confermare.
   */
  useEffect(() => {
    if (!auto || tentatoAuto || !pubblicaInstagram) {
      return;
    }

    const nodo = contenitoreRef.current;

    /*
     * La card si prepara solo quando lo spotted entra nello schermo:
     * con molti spotted in coda non parte un rendering per ognuno.
     */
    if (
      !nodo ||
      typeof IntersectionObserver === "undefined"
    ) {
      setTentatoAuto(true);
      apriAnteprima();
      return undefined;
    }

    const osservatore = new IntersectionObserver(
      (voci) => {
        if (voci.some((voce) => voce.isIntersecting)) {
          osservatore.disconnect();
          setTentatoAuto(true);
          apriAnteprima();
        }
      },
      { rootMargin: "200px" }
    );

    osservatore.observe(nodo);

    return () => osservatore.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!pubblicaInstagram) {
    return null;
  }

  const conferma = async () => {
    setErrore("");
    setInCorso(true);

    try {
      await pubblicaInstagram(
        post,
        caption.trim(),
        anteprima
      );

      setAnteprima("");
    } catch (errorePubblicazione) {
      setErrore(
        errorePubblicazione.message ||
          "Pubblicazione non riuscita."
      );
    } finally {
      setInCorso(false);
    }
  };

  if (!anteprima) {
    return (
      <div
        ref={contenitoreRef}
        style={{ marginTop: "12px" }}
      >
        <button
          onClick={apriAnteprima}
          disabled={inCorso}
        >
          {inCorso
            ? "⏳ Preparo la card..."
            : auto
              ? "📸 Prepara la card"
              : "📸 Pubblica su Instagram"}
        </button>

        {errore && (
          <p className="admin-pending-meta">
            {errore}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: "12px",
        border: "1px solid rgba(183,28,28,0.6)",
        borderRadius: "12px",
        padding: "12px"
      }}
    >
      <img
        src={anteprima}
        alt="Anteprima della card per Instagram"
        style={{
          width: "100%",
          maxWidth: "260px",
          borderRadius: "10px",
          display: "block",
          margin: "0 auto 12px"
        }}
      />

      <label
        style={{
          display: "block",
          marginBottom: "6px",
          fontWeight: "bold"
        }}
      >
        Descrizione Instagram
      </label>

      <textarea
        value={caption}
        onChange={(evento) =>
          setCaption(
            evento.target.value.slice(0, 2200)
          )
        }
        rows={8}
        style={{
          width: "100%",
          boxSizing: "border-box"
        }}
      />

      <p
        className="admin-pending-meta"
        style={{ fontSize: "12px" }}
      >
        {caption.length}/2200 caratteri
      </p>

      <div className="admin-pending-actions">
        <button
          onClick={conferma}
          disabled={inCorso || !caption.trim()}
        >
          {inCorso
            ? "⏳ Pubblico..."
            : "✅ Approva e pubblica"}
        </button>

        <button
          onClick={() => setAnteprima("")}
          disabled={inCorso}
        >
          Annulla
        </button>
      </div>

      {errore && (
        <p className="admin-pending-meta">
          {errore}
        </p>
      )}
    </div>
  );
}

function AdminPanel({
  pendingPosts,
  approvaPost,
  rifiutaPost,
  pubblicaInstagram,
  instagramAuto = true,
  instagramHashtags = "",
  utenti = []
}) {
  return (
    <>
      {pendingPosts.map((post) => {
        const isPubblicita = pubblicitaRilevata(post);
        const dettaglio = dettaglioPubblicita(post);
        const segnalatori = nomiSegnalatori(
          post.reportedBy,
          utenti
        );

        return (
          <article
            key={post.id}
            className={`admin-pending-card${
              isPubblicita ? " is-advertising" : ""
            }`}
          >
            <div className="admin-pending-head">
              <h3>
                {post.type === "groupProposal"
                  ? "📚 Proposta Gruppo"
                  : "📝 Spotted Normale"}
              </h3>

              {isPubblicita && (
                <span className="admin-pending-ad-badge">
                  🛡️ Pubblicità
                </span>
              )}
            </div>

            {isPubblicita && (
              <div className="admin-pending-ad-alert">
                <strong>
                  Pubblicità rilevata automaticamente
                </strong>

                <p>{dettaglio}</p>

                <p className="admin-pending-ad-help">
                  Controlla link, profili, contatti e linguaggio
                  promozionale prima di approvare.
                </p>
              </div>
            )}

            <p className="admin-pending-text">
              {post.text || "Testo non disponibile."}
            </p>

            {post.type === "groupProposal" && (
              <>
                {post.groupKind === "interno" ? (
                  <p className="admin-pending-meta">
                    <strong>💬 Gruppo interno:</strong>
                    <br />
                    {post.groupName || "Senza nome"} — chat
                    nella piattaforma
                  </p>
                ) : (
                  <p className="admin-pending-meta">
                    <strong>🔗 Link gruppo:</strong>
                    <br />
                    {linkValido(post.groupLink) ? (
                      <a
                        className="admin-pending-link"
                        href={post.groupLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {post.groupLink}
                      </a>
                    ) : (
                      <span className="admin-pending-invalid-link">
                        Link non valido: {post.groupLink}
                      </span>
                    )}
                  </p>
                )}

                <p className="admin-pending-meta">
                  <strong>❤️ Like richiesti:</strong>{" "}
                  {post.requiredLikes}
                </p>
              </>
            )}

            <p className="admin-pending-meta">
              <strong>👤 Autore:</strong>{" "}
              {nomeDaUid(post.authorId, utenti)}
            </p>

            {post.reports > 0 && (
              <p className="admin-pending-meta">
                🚩 Segnalazioni: {post.reports}
                {segnalatori.length > 0 &&
                  ` — ${segnalatori.join(", ")}`}
              </p>
            )}

            {post.flagReason && !isPubblicita && (
              <p className="admin-pending-meta">
                🚩 Motivo: {post.flagReason}
              </p>
            )}

            <div className="admin-pending-actions">
              <button onClick={() => approvaPost(post)}>
                ✅ Approva
              </button>

              <button onClick={() => rifiutaPost(post.id)}>
                ❌ Rifiuta
              </button>
            </div>

            <InstagramBox
              post={post}
              pubblicaInstagram={pubblicaInstagram}
              auto={instagramAuto}
              hashtags={instagramHashtags}
            />
          </article>
        );
      })}
    </>
  );
}

export default AdminPanel;

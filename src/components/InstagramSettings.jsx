import { useEffect, useState } from "react";

import {
  leggiAccountInstagram,
  rinnovaTokenInstagram
} from "../services/instagramPublisher";

const formattaData = (valore) => {
  if (!valore) return "—";

  const data = new Date(valore);

  if (Number.isNaN(data.getTime())) return "—";

  return data.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
};

const giorniAllaScadenza = (valore) => {
  if (!valore) return null;

  const data = new Date(valore);

  if (Number.isNaN(data.getTime())) return null;

  return Math.ceil(
    (data.getTime() - Date.now()) / 86400000
  );
};

const etichettaTipoAccount = (tipo) => {
  if (tipo === "BUSINESS") return "Account Business";
  if (tipo === "MEDIA_CREATOR") return "Account Creator";

  return "Account personale";
};

const tronca = (testo, massimo = 120) => {
  const pulito = String(testo || "").trim();

  return pulito.length > massimo
    ? `${pulito.slice(0, massimo - 1)}…`
    : pulito;
};

/*
 * Pannello Instagram della dashboard: collegamento, token, hashtag e
 * coda di pubblicazione in un unico posto.
 */
function InstagramSettings({
  pendingPosts = [],
  posts = [],
  autoPublish = true,
  onToggleAuto = () => {},
  hashtags = "",
  onSaveHashtags = () => {}
}) {
  const [stato, setStato] = useState(null);
  const [errore, setErrore] = useState("");
  const [messaggio, setMessaggio] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [rinnovo, setRinnovo] = useState(false);
  const [bozzaHashtag, setBozzaHashtag] =
    useState(hashtags);

  useEffect(() => {
    setBozzaHashtag(hashtags);
  }, [hashtags]);

  const carica = async () => {
    setErrore("");
    setInCorso(true);

    try {
      setStato(await leggiAccountInstagram());
    } catch (erroreCaricamento) {
      setStato(null);
      setErrore(
        erroreCaricamento.message ||
          "Impossibile leggere il collegamento Instagram."
      );
    } finally {
      setInCorso(false);
    }
  };

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const forzaRinnovo = async () => {
    setErrore("");
    setMessaggio("");
    setRinnovo(true);

    try {
      const risultato = await rinnovaTokenInstagram();

      setMessaggio(
        risultato.rinnovato
          ? `Token rinnovato. Nuova scadenza: ${formattaData(
              risultato.scadeIl
            )}.`
          : "Il token era già valido: nessun rinnovo necessario."
      );

      await carica();
    } catch (erroreRinnovo) {
      setErrore(
        erroreRinnovo.message ||
          "Rinnovo del token non riuscito."
      );
    } finally {
      setRinnovo(false);
    }
  };

  const salvaHashtag = async () => {
    setErrore("");
    setMessaggio("");

    try {
      await onSaveHashtags(bozzaHashtag);
      setMessaggio("Hashtag salvati.");
    } catch (erroreSalvataggio) {
      setErrore(
        erroreSalvataggio.message ||
          "Impossibile salvare gli hashtag."
      );
    }
  };

  const account = stato?.account || null;
  const collegato = Boolean(stato?.configured && account);
  const giorniRimanenti = giorniAllaScadenza(
    stato?.scadeIl
  );

  const pubblicati = posts
    .filter(
      (post) =>
        post.instagram &&
        (post.instagram.permalink ||
          post.instagram.mediaId)
    )
    .sort(
      (a, b) =>
        new Date(b.instagram?.publishedAt || 0) -
        new Date(a.instagram?.publishedAt || 0)
    )
    .slice(0, 5);

  const inCoda = pendingPosts.slice(0, 5);

  return (
    <div className="community-rules-grid">
      <section className="community-card community-rules-wide">
        <div className="community-card-head">
          <div>
            <h3>Collegamento Instagram</h3>
            <span>
              La pagina che riceve gli spotted e lo stato del token
            </span>
          </div>

          <span
            className={`community-card-badge ${
              collegato ? "is-connected" : ""
            }`}
          >
            {inCorso
              ? "verifico…"
              : collegato
                ? "collegato"
                : stato?.configured
                  ? "token da verificare"
                  : "non collegato"}
          </span>
        </div>

        {inCorso && !stato && (
          <div className="community-empty">
            Verifico il collegamento con Instagram…
          </div>
        )}

        {stato && (
          <>
            {account ? (
              <div className="instagram-profile">
                <span className="instagram-profile-avatar">
                  📸
                </span>

                <div className="instagram-profile-copy">
                  <strong>@{account.username}</strong>
                  <small>
                    {etichettaTipoAccount(
                      account.accountType
                    )}{" "}
                    · {account.mediaCount} post pubblicati
                  </small>
                </div>
              </div>
            ) : (
              <>
                <p className="community-rules-text">
                  {stato.configured
                    ? "Il token è presente ma Instagram non ha risposto. Rinnova il token o controlla che la pagina sia ancora collegata all'app."
                    : "Nessun token Instagram impostato. Crea il token nella Meta Business Suite e salvalo come secret INSTAGRAM_ACCESS_TOKEN sul Worker: dopo questa operazione il collegamento è attivo e il token si rinnova da solo."}
                </p>

                {stato.configured && stato.errore && (
                  <p className="instagram-feedback is-error">
                    Instagram risponde: {stato.errore}
                  </p>
                )}
              </>
            )}

            <div className="instagram-meta-grid">
              <div>
                <span>Token rinnovato</span>
                <strong>
                  {formattaData(stato.rinnovatoIl)}
                </strong>
              </div>

              <div>
                <span>Scadenza token</span>
                <strong>
                  {formattaData(stato.scadeIl)}
                </strong>
              </div>

              <div>
                <span>Giorni residui</span>
                <strong>
                  {giorniRimanenti === null
                    ? "—"
                    : `${giorniRimanenti} giorni`}
                </strong>
              </div>

              <div>
                <span>Token letto da</span>
                <strong>
                  {stato.origineToken === "firestore"
                    ? "rinnovo del Worker"
                    : "secret Cloudflare"}
                </strong>
              </div>
            </div>

            {giorniRimanenti !== null &&
              giorniRimanenti <= 10 &&
              giorniRimanenti >= 0 && (
                <p className="community-chart-note">
                  Il token scade tra {giorniRimanenti} giorni.
                  Il Worker lo rinnova da solo ogni ora, ma puoi
                  forzare il rinnovo da qui.
                </p>
              )}
          </>
        )}

        <div className="instagram-actions">
          <button
            type="button"
            className="community-secondary-btn"
            onClick={carica}
            disabled={inCorso}
          >
            {inCorso
              ? "Verifico…"
              : "Verifica collegamento"}
          </button>

          <button
            type="button"
            className="community-primary-btn"
            onClick={forzaRinnovo}
            disabled={rinnovo}
          >
            {rinnovo ? "Rinnovo…" : "Rinnova token"}
          </button>
        </div>

        {errore && (
          <p className="instagram-feedback is-error">
            {errore}
          </p>
        )}

        {messaggio && (
          <p className="instagram-feedback">
            {messaggio}
          </p>
        )}
      </section>

      <section className="community-card">
        <div className="community-card-head">
          <div>
            <h3>Pubblicazione automatica</h3>
            <span>Decidi quanto deve fare l'admin</span>
          </div>

          <span className="community-card-badge">
            {autoPublish ? "attiva" : "manuale"}
          </span>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={autoPublish}
          className={`community-switch-row ${
            autoPublish ? "is-on" : ""
          }`}
          onClick={onToggleAuto}
        >
          <span className="community-switch-copy">
            <strong>📸 Instagram a ogni approvazione</strong>
            <small>
              {autoPublish
                ? "Quando approvi uno spotted la card e la descrizione sono pronte e la pubblicazione parte da sole"
                : "Devi prima preparare la card e poi confermare la pubblicazione"}
            </small>
          </span>

          <span className="community-switch" aria-hidden="true">
            <span />
          </span>
        </button>

        <p className="community-chart-note">
          In ogni caso la pubblicazione su Instagram avviene solo
          quando premi “Approva e pubblica”: se Instagram
          rifiuta, lo spotted resta in moderazione e non viene
          perso.
        </p>
      </section>

      <section className="community-card">
        <div className="community-card-head">
          <div>
            <h3>Hashtag aggiuntivi</h3>
            <span>
              Si aggiungono a quelli fissi e a quelli dello spotted
            </span>
          </div>

          <span className="community-card-badge">
            max 30
          </span>
        </div>

        <textarea
          className="instagram-hashtag-input"
          rows={3}
          value={bozzaHashtag}
          onChange={(evento) =>
            setBozzaHashtag(evento.target.value)
          }
          placeholder="#spottedbologna #universitabologna"
          aria-label="Hashtag aggiuntivi per Instagram"
        />

        <div className="instagram-actions">
          <button
            type="button"
            className="community-primary-btn"
            onClick={salvaHashtag}
          >
            Salva hashtag
          </button>
        </div>

        <p className="community-chart-note">
          Vengono uniti a #spottedbologna, #spotted, #bologna,
          #bolognaitaly e #emiliaromagna, senza duplicati.
        </p>
      </section>

      <section className="community-card">
        <div className="community-card-head">
          <div>
            <h3>In coda per Instagram</h3>
            <span>
              {pendingPosts.length} spotted in moderazione
            </span>
          </div>

          <span className="community-card-badge">
            ⏳ da approvare
          </span>
        </div>

        {inCoda.length === 0 ? (
          <div className="community-empty">
            Nessuno spotted in attesa: la coda è vuota.
          </div>
        ) : (
          <div className="instagram-list">
            {inCoda.map((post) => (
              <div
                className="instagram-row"
                key={post.id}
              >
                <span className="instagram-row-text">
                  {tronca(post.text) ||
                    "Spotted senza testo"}
                </span>

                <span className="instagram-row-badge">
                  {post.instagram?.mediaId
                    ? "già su Instagram"
                    : "in attesa"}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="community-chart-note">
          L'approvazione e la pubblicazione si fanno in
          “Spotted da approvare”, qui sopra.
        </p>
      </section>

      <section className="community-card community-rules-wide">
        <div className="community-card-head">
          <div>
            <h3>Ultimi post su Instagram</h3>
            <span>
              Pubblicati da Spotted Bologna, con link diretto
            </span>
          </div>

          <span className="community-card-badge">
            {pubblicati.length} recenti
          </span>
        </div>

        {pubblicati.length === 0 ? (
          <div className="community-empty">
            Nessuno spotted è ancora stato pubblicato su
            Instagram.
          </div>
        ) : (
          <div className="instagram-list">
            {pubblicati.map((post) => (
              <a
                className="instagram-row is-link"
                key={post.id}
                href={
                  post.instagram?.permalink || undefined
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="instagram-row-text">
                  {tronca(post.text) ||
                    "Spotted senza testo"}
                </span>

                <span className="instagram-row-badge">
                  {post.instagram?.publishedAt
                    ? formattaData(
                        post.instagram.publishedAt
                      )
                    : "pubblicato"}
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default InstagramSettings;

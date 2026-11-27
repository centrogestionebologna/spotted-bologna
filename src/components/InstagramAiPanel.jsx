import { useEffect, useState } from "react";

import { creaImmagineSpotted } from "../utils/immagineSpotted";
import { esportaJpeg } from "../utils/esportaJpeg";

import {
  leggiAiInstagram,
  salvaSkillInstagram,
  generaBozzeInstagram,
  pubblicaBozzaInstagram,
  scartaBozzaInstagram
} from "../services/instagramPublisher";

/*
 * IA e skill di scrittura per Instagram: da qui l'admin vede quali
 * skill sono attive, cosa comprendono, genera nuove bozze e approva o
 * scarta quelle proposte.
 */
function InstagramAiPanel() {
  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState("");
  const [messaggio, setMessaggio] = useState("");
  const [caricamento, setCaricamento] = useState(true);
  const [generazione, setGenerazione] = useState(false);
  const [quantita, setQuantita] = useState(3);
  const [bozzaInCorso, setBozzaInCorso] = useState("");
  const [caption, setCaption] = useState({});

  const carica = async () => {
    setErrore("");
    setCaricamento(true);

    try {
      setDati(await leggiAiInstagram());
    } catch (erroreCaricamento) {
      setDati(null);
      setErrore(
        erroreCaricamento.message ||
          "Impossibile leggere lo stato dell'IA."
      );
    } finally {
      setCaricamento(false);
    }
  };

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skills = dati?.skills || [];
  const attive = skills.filter((skill) => skill.attiva);
  const bozze = dati?.bozze || [];

  const cambiaSkill = async (id) => {
    if (!dati) return;

    setErrore("");
    setMessaggio("");

    const prossime = dati.skills
      .filter((skill) =>
        skill.id === id ? !skill.attiva : skill.attiva
      )
      .map((skill) => skill.id);

    setDati({
      ...dati,
      skills: dati.skills.map((skill) => ({
        ...skill,
        attiva: prossime.includes(skill.id)
      }))
    });

    try {
      const risultato = await salvaSkillInstagram(prossime);

      setDati((precedente) =>
        precedente
          ? { ...precedente, skills: risultato.skills }
          : precedente
      );
    } catch (erroreSalvataggio) {
      setErrore(
        erroreSalvataggio.message ||
          "Impossibile salvare le skill."
      );

      carica();
    }
  };

  const genera = async () => {
    setErrore("");
    setMessaggio("");
    setGenerazione(true);

    try {
      const risultato = await generaBozzeInstagram(quantita);

      setDati((precedente) =>
        precedente
          ? {
              ...precedente,
              bozze: [...risultato.bozze, ...precedente.bozze]
            }
          : precedente
      );

      setMessaggio(
        `${risultato.bozze.length} ${
          risultato.bozze.length === 1
            ? "bozza pronta"
            : "bozze pronte"
        } da approvare.`
      );
    } catch (erroreGenerazione) {
      setErrore(
        erroreGenerazione.message ||
          "Generazione non riuscita."
      );
    } finally {
      setGenerazione(false);
    }
  };

  const testoCaption = (bozza) =>
    caption[bozza.id] ?? bozza.caption;

  const pubblica = async (bozza) => {
    const descrizione = testoCaption(bozza).trim();

    if (!descrizione) {
      setErrore("La descrizione non può essere vuota.");
      return;
    }

    if (
      !window.confirm(
        "Pubblicare questa bozza su Instagram?"
      )
    ) {
      return;
    }

    setErrore("");
    setMessaggio("");
    setBozzaInCorso(bozza.id);

    try {
      const { canvas } = await creaImmagineSpotted(
        { text: bozza.testo },
        0,
        "instagram"
      );

      const risultato = await pubblicaBozzaInstagram({
        draftId: bozza.id,
        caption: descrizione,
        immagineBase64: esportaJpeg(canvas)
      });

      setDati((precedente) =>
        precedente
          ? {
              ...precedente,
              bozze: precedente.bozze.filter(
                (voce) => voce.id !== bozza.id
              )
            }
          : precedente
      );

      setMessaggio(
        `Bozza pubblicata su Instagram.${
          risultato.permalink
            ? ` ${risultato.permalink}`
            : ""
        }`
      );
    } catch (errorePubblicazione) {
      setErrore(
        errorePubblicazione.message ||
          "Pubblicazione non riuscita."
      );
    } finally {
      setBozzaInCorso("");
    }
  };

  const scarta = async (bozza) => {
    if (
      !window.confirm(
        "Scartare questa bozza? Non verrà pubblicata."
      )
    ) {
      return;
    }

    setErrore("");
    setMessaggio("");
    setBozzaInCorso(bozza.id);

    try {
      await scartaBozzaInstagram(bozza.id);

      setDati((precedente) =>
        precedente
          ? {
              ...precedente,
              bozze: precedente.bozze.filter(
                (voce) => voce.id !== bozza.id
              )
            }
          : precedente
      );

      setMessaggio("Bozza scartata.");
    } catch (erroreScarto) {
      setErrore(
        erroreScarto.message ||
          "Impossibile scartare la bozza."
      );
    } finally {
      setBozzaInCorso("");
    }
  };

  return (
    <div className="community-rules-grid">
      <section className="community-card community-rules-wide">
        <div className="community-card-head">
          <div>
            <h3>IA per i contenuti</h3>
            <span>
              Propone nuovi post, tu approvi e basta
            </span>
          </div>

          <span
            className={`community-card-badge${
              dati?.configured ? " is-connected" : ""
            }`}
          >
            {caricamento
              ? "verifico…"
              : dati?.configured
                ? "attiva"
                : "da attivare"}
          </span>
        </div>

        {caricamento && !dati && (
          <div className="community-empty">
            Leggo lo stato dell'IA…
          </div>
        )}

        {dati && (
          <>
            <p className="community-rules-text">
              {dati.configured
                ? `Modello ${dati.modello}${
                    dati.gratuito
                      ? " su Workers AI, senza costi aggiuntivi"
                      : ""
                  }. Le bozze vengono salvate e restano ferme finché non premi “Approva e pubblica”: nessun contenuto arriva su Instagram da solo.`
                : "L'IA non è ancora attiva: nel Worker aggiungi un binding Workers AI con nome AI (Cloudflare lo include gratis, senza carta né chiavi). Poi ricarica questa pagina."}
            </p>

            <div className="instagram-ai-controls">
              <label>
                <span>Quante bozze</span>

                <select
                  value={quantita}
                  onChange={(evento) =>
                    setQuantita(
                      Number(evento.target.value)
                    )
                  }
                  aria-label="Numero di bozze da generare"
                >
                  {[1, 2, 3, 4, 5].map((valore) => (
                    <option key={valore} value={valore}>
                      {valore}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="community-primary-btn"
                onClick={genera}
                disabled={
                  generazione || !dati.configured
                }
              >
                {generazione
                  ? "⏳ Scrivo le bozze…"
                  : "✨ Genera bozze"}
              </button>
            </div>

            <p className="community-chart-note">
              La generazione usa gli ultimi spotted come spunto di
              tono e le skill attive qui sotto. Non inventa
              fatti, non cita locali o persone e non mette link.
            </p>
          </>
        )}

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

      <section className="community-card community-rules-wide">
        <div className="community-card-head">
          <div>
            <h3>Skill attive</h3>
            <span>
              Le istruzioni di scrittura che l'IA deve seguire
            </span>
          </div>

          <span className="community-card-badge">
            {attive.length}/{skills.length} attive
          </span>
        </div>

        {skills.length === 0 ? (
          <div className="community-empty">
            Nessuna skill disponibile.
          </div>
        ) : (
          <div className="instagram-skill-list">
            {skills.map((skill) => (
              <div
                className="instagram-skill"
                key={skill.id}
              >
                <div className="instagram-skill-head">
                  <div className="instagram-skill-copy">
                    <strong>{skill.nome}</strong>
                    <small>{skill.descrizione}</small>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={skill.attiva}
                    aria-label={`Attiva ${skill.nome}`}
                    className={`community-switch-row instagram-skill-switch${
                      skill.attiva ? " is-on" : ""
                    }`}
                    onClick={() =>
                      cambiaSkill(skill.id)
                    }
                  >
                    <span
                      className="community-switch"
                      aria-hidden="true"
                    >
                      <span />
                    </span>
                  </button>
                </div>

                <details className="instagram-skill-dettagli">
                  <summary>
                    Cosa comprende
                  </summary>

                  <p>{skill.istruzioni}</p>
                </details>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="community-card community-rules-wide">
        <div className="community-card-head">
          <div>
            <h3>Bozze da approvare</h3>
            <span>
              Controlla il testo, aggiusta la descrizione, poi
              pubblica
            </span>
          </div>

          <span className="community-card-badge">
            {bozze.length} in attesa
          </span>
        </div>

        {bozze.length === 0 ? (
          <div className="community-empty">
            Nessuna bozza in attesa. Generane qualcuna con
            “Genera bozze”.
          </div>
        ) : (
          <div className="instagram-bozze">
            {bozze.map((bozza) => (
              <article
                className="instagram-bozza"
                key={bozza.id}
              >
                <p className="instagram-bozza-testo">
                  {bozza.testo}
                </p>

                <label className="instagram-bozza-label">
                  Descrizione Instagram
                </label>

                <textarea
                  className="instagram-hashtag-input"
                  rows={6}
                  value={testoCaption(bozza)}
                  onChange={(evento) =>
                    setCaption((precedente) => ({
                      ...precedente,
                      [bozza.id]: evento.target.value.slice(
                        0,
                        2200
                      )
                    }))
                  }
                  aria-label={`Descrizione della bozza ${bozza.testo.slice(0, 40)}`}
                />

                <p className="community-chart-note">
                  {testoCaption(bozza).length}/2200 caratteri
                  {bozza.createdAt
                    ? ` · proposta il ${new Date(
                        bozza.createdAt
                      ).toLocaleDateString("it-IT")}`
                    : ""}
                </p>

                <div className="instagram-actions">
                  <button
                    type="button"
                    className="community-primary-btn"
                    onClick={() => pubblica(bozza)}
                    disabled={
                      bozzaInCorso === bozza.id
                    }
                  >
                    {bozzaInCorso === bozza.id
                      ? "⏳ Pubblico…"
                      : "✅ Approva e pubblica"}
                  </button>

                  <button
                    type="button"
                    className="community-secondary-btn"
                    onClick={() => scarta(bozza)}
                    disabled={
                      bozzaInCorso === bozza.id
                    }
                  >
                    Scarta
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default InstagramAiPanel;

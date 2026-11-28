import { useEffect, useMemo, useRef, useState } from "react";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query
} from "firebase/firestore";

import { db } from "../firebase";
import { analizzaPubblicita } from "../utils/moderazione";
import {
  notificaNuovoPending,
  notificaSpottedAnonimo
} from "../services/pushSender";

/*
 * Il Fiume: una chat effimera dove chiunque lascia un pensiero che
 * scivola via con la corrente e sparisce dopo dieci secondi.
 * I messaggi vivono in riverMessages e vengono cancellati appena
 * escono dalla scena, così il fiume resta sempre pulito.
 */
const COLLEZIONE = "riverMessages";
const DURATA = 10000;
const CARATTERI_MASSIMI = 80;
const RITMO_AGGIORNAMENTO = 200;

/* Con quattro voci contemporanee il fiume entra in piena. */
const SOGLIA_PIENA = 4;

/* Quante foglie passate restano nella memoria del fiume. */
const MEMORIA_MASSIMA = 12;
const CHIAVE_MEMORIA = "spotted-fiume-memoria";

/* Ogni voce è una foglia diversa: il glifo dipende dal client. */
const GLIFI = ["🍃", "🪶", "🌾", "🕊️", "🐟", "🌙"];

const creaClientId = () => {
  if (typeof window === "undefined") {
    return "fiume";
  }

  try {
    const salvato = window.sessionStorage.getItem(
      "spotted-fiume-client"
    );

    if (salvato) {
      return salvato;
    }

    const nuovo = `f-${Math.random()
      .toString(36)
      .slice(2, 10)}`;

    window.sessionStorage.setItem(
      "spotted-fiume-client",
      nuovo
    );

    return nuovo;
  } catch (errore) {
    return "fiume";
  }
};

/* La memoria sopravvive a un ricarico della pagina. */
const leggiMemoriaSalvata = () => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const salvata = JSON.parse(
      window.sessionStorage.getItem(CHIAVE_MEMORIA) || "[]"
    );

    if (!Array.isArray(salvata)) {
      return [];
    }

    return salvata
      .filter(
        (voce) =>
          voce &&
          typeof voce.id === "string" &&
          typeof voce.text === "string" &&
          voce.text.trim()
      )
      .slice(0, MEMORIA_MASSIMA);
  } catch (errore) {
    return [];
  }
};

const hashTesto = (valore) => {
  let hash = 0;

  for (let i = 0; i < valore.length; i += 1) {
    hash = (hash * 31 + valore.charCodeAt(i)) % 100000;
  }

  return hash;
};

/*
 * Corsia, inclinazione e ritardo visivo: la corrente scende dall'alto
 * verso il basso e non è mai dritta.
 */
const stileFoglia = (id) => {
  const hash = hashTesto(id);
  const corsie = [34, 46, 58, 70];
  const corsia = corsie[hash % corsie.length];
  const scarto = (hash % 5) - 2;
  const rotazione = ((hash % 11) - 5) * 0.6;

  return {
    corsia: corsia + scarto,
    rotazione,
    glifo: GLIFI[hash % GLIFI.length]
  };
};

const etaMessaggio = (messaggio, adesso) => {
  const istante = Number(messaggio.createdAtMs);

  if (Number.isFinite(istante) && istante > 0) {
    return adesso - istante;
  }

  const data = new Date(messaggio.createdAt || 0).getTime();

  return Number.isNaN(data) ? DURATA : adesso - data;
};

/* Chiave per non ripetere due volte la stessa foglia in memoria. */
const chiaveTesto = (testo) =>
  String(testo || "")
    .trim()
    .toLowerCase();

function RiverChat({ user, isAdmin = false }) {
  const [messaggi, setMessaggi] = useState([]);
  const [adesso, setAdesso] = useState(() => Date.now());
  const [testo, setTesto] = useState("");
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState("");
  const [avviso, setAvviso] = useState("");
  const [sassi, setSassi] = useState([]);
  const [suono, setSuono] = useState(false);
  const [memoria, setMemoria] = useState(leggiMemoriaSalvata);
  const [memoriaAperta, setMemoriaAperta] = useState(false);
  const [inviate, setInviate] = useState({});

  const clientIdRef = useRef(creaClientId());
  const pulizieRef = useRef(new Set());
  const visteRef = useRef(new Map());
  const inputRef = useRef(null);
  const audioRef = useRef(null);

  /* La corrente arriva in tempo reale: leggo solo l'ultimo tratto. */
  useEffect(() => {
    const messaggiQuery = query(
      collection(db, COLLEZIONE),
      orderBy("createdAtMs", "desc"),
      limit(40)
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
      (erroreFiume) => {
        console.error(
          "Errore nel caricamento del fiume:",
          erroreFiume
        );

        setErrore(
          `Il fiume è in secca: ${erroreFiume.message}`
        );
      }
    );
  }, []);

  /* Un battito leggero fa sparire le foglie allo scadere dei 10 secondi. */
  useEffect(() => {
    const battito = window.setInterval(
      () => setAdesso(Date.now()),
      RITMO_AGGIORNAMENTO
    );

    return () => window.clearInterval(battito);
  }, []);

  /* Il fiume ricorda anche dopo un ricarico. */
  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        CHIAVE_MEMORIA,
        JSON.stringify(memoria)
      );
    } catch (erroreSalvataggio) {
      /* Uno spazio pieno non deve fermare il fiume. */
    }
  }, [memoria]);

  /*
   * Le foglie passate da un pezzo vengono tolte dal database.
   * Se le regole non lo permettono, il messaggio resta invisibile
   * lato client: nessun errore mostrato all'utente.
   */
  useEffect(() => {
    messaggi.forEach((messaggio) => {
      const eta = etaMessaggio(messaggio, Date.now());

      if (eta < DURATA + 4000) {
        return;
      }

      if (pulizieRef.current.has(messaggio.id)) {
        return;
      }

      pulizieRef.current.add(messaggio.id);

      deleteDoc(doc(db, COLLEZIONE, messaggio.id)).catch(
        () => {}
      );
    });
  }, [messaggi]);

  const visibili = useMemo(
    () =>
      messaggi
        .map((messaggio) => ({
          ...messaggio,
          eta: etaMessaggio(messaggio, adesso)
        }))
        .filter(
          (messaggio) =>
            messaggio.eta >= 0 && messaggio.eta < DURATA
        )
        .sort((prima, seconda) => seconda.eta - prima.eta),
    [messaggi, adesso]
  );

  /*
   * Quando una foglia esce dalla scena finisce nella memoria del
   * fiume: da lì può diventare uno spotted, mai pubblicato da solo.
   */
  useEffect(() => {
    /* La memoria è roba da amministratori: per gli altri non esiste. */
    if (!isAdmin) {
      visteRef.current.clear();
      return;
    }

    const presenti = new Set(
      visibili.map((messaggio) => messaggio.id)
    );
    const uscite = [];

    visteRef.current.forEach((voce, id) => {
      if (!presenti.has(id)) {
        uscite.push(voce);
        visteRef.current.delete(id);
      }
    });

    visibili.forEach((messaggio) => {
      visteRef.current.set(messaggio.id, {
        id: messaggio.id,
        text: messaggio.text
      });
    });

    if (uscite.length === 0) {
      return;
    }

    setMemoria((precedenti) => {
      const unite = [...uscite, ...precedenti];
      const senzaDoppioni = unite.filter(
        (voce, indice, elenco) =>
          elenco.findIndex(
            (altra) =>
              chiaveTesto(altra.text) === chiaveTesto(voce.text)
          ) === indice
      );

      return senzaDoppioni.slice(0, MEMORIA_MASSIMA);
    });
  }, [visibili, isAdmin]);

  /* Chiudo il fiume sonoro quando la card sparisce. */
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      audioRef.current = null;

      if (!audio) {
        return;
      }

      try {
        audio.sorgente.stop();
        audio.respiro.stop();
        audio.ctx.close();
      } catch (erroreChiusura) {
        /* Il contesto era già chiuso: niente da fare. */
      }
    };
  }, []);

  const alternaSuono = () => {
    if (typeof window === "undefined") {
      return;
    }

    if (suono) {
      const audio = audioRef.current;
      audioRef.current = null;
      setSuono(false);

      if (!audio) {
        return;
      }

      try {
        audio.guadagno.gain.cancelScheduledValues(
          audio.ctx.currentTime
        );
        audio.guadagno.gain.setTargetAtTime(
          0,
          audio.ctx.currentTime,
          0.15
        );

        window.setTimeout(() => {
          try {
            audio.sorgente.stop();
            audio.respiro.stop();
            audio.ctx.close();
          } catch (erroreChiusura) {
            /* Già fermo. */
          }
        }, 700);
      } catch (erroreSuono) {
        console.warn(
          "Suono del fiume non fermato:",
          erroreSuono
        );
      }

      return;
    }

    const Contesto =
      window.AudioContext || window.webkitAudioContext;

    if (!Contesto) {
      setAvviso(
        "Questo browser non sa far scorrere il fiume in audio."
      );

      return;
    }

    try {
      const ctx = new Contesto();
      const buffer = ctx.createBuffer(
        1,
        ctx.sampleRate * 2,
        ctx.sampleRate
      );
      const dati = buffer.getChannelData(0);
      let precedente = 0;

      for (let i = 0; i < dati.length; i += 1) {
        const bianco = Math.random() * 2 - 1;
        precedente = (precedente + 0.02 * bianco) / 1.02;
        dati[i] = precedente * 3.4;
      }

      const sorgente = ctx.createBufferSource();
      sorgente.buffer = buffer;
      sorgente.loop = true;

      const filtro = ctx.createBiquadFilter();
      filtro.type = "lowpass";
      filtro.frequency.value = 1100;
      filtro.Q.value = 0.7;

      const guadagno = ctx.createGain();
      guadagno.gain.value = 0;

      /* Un respiro lento fa salire e scendere l'acqua. */
      const respiro = ctx.createOscillator();
      respiro.frequency.value = 0.09;

      const respiroGain = ctx.createGain();
      respiroGain.gain.value = 0.03;

      sorgente.connect(filtro);
      filtro.connect(guadagno);
      respiro.connect(respiroGain);
      respiroGain.connect(guadagno.gain);
      guadagno.connect(ctx.destination);

      sorgente.start();
      respiro.start();

      if (ctx.state === "suspended") {
        ctx.resume();
      }

      guadagno.gain.linearRampToValueAtTime(
        0.06,
        ctx.currentTime + 1.6
      );

      audioRef.current = {
        ctx,
        sorgente,
        respiro,
        guadagno
      };

      setSuono(true);
      setAvviso("");
    } catch (erroreSuono) {
      console.warn(
        "Suono del fiume non avviato:",
        erroreSuono
      );

      setAvviso(
        "Il fiume non riesce a suonare in questo momento."
      );
    }
  };

  const piena = visibili.length >= SOGLIA_PIENA;

  const inviaMessaggio = async (evento) => {
    evento.preventDefault();

    const pulito = testo.trim().slice(0, CARATTERI_MASSIMI);

    if (!pulito || invio) {
      return;
    }

    /*
     * Link, contatti e linguaggio promozionale non scendono nel
     * fiume: la foglia diventa un sasso e affonda subito.
     */
    const analisi = analizzaPubblicita(pulito);

    if (analisi.rilevata) {
      const sasso = {
        id: `sasso-${Date.now()}`,
        text: pulito
      };

      setTesto("");
      setErrore("");
      setSassi((precedenti) => [...precedenti, sasso]);
      setAvviso(
        "Quella foglia era un sasso: niente link, contatti o pubblicità. Riprova senza."
      );

      window.setTimeout(() => {
        setSassi((precedenti) =>
          precedenti.filter((voce) => voce.id !== sasso.id)
        );
      }, 3400);

      return;
    }

    setInvio(true);
    setErrore("");
    setAvviso("");

    const adessoInvio = Date.now();

    try {
      const creato = await addDoc(
        collection(db, COLLEZIONE),
        {
          text: pulito,
          createdAt: new Date(adessoInvio).toISOString(),
          createdAtMs: adessoInvio,
          authorId: user?.uid || "anonimo",
          clientId: clientIdRef.current
        }
      );

      setTesto("");
      setAdesso(Date.now());
      inputRef.current?.focus();

      /* La foglia si toglie dal fiume appena supera la foce. */
      window.setTimeout(() => {
        deleteDoc(doc(db, COLLEZIONE, creato.id)).catch(
          () => {}
        );
      }, DURATA + 2500);
    } catch (erroreInvio) {
      console.error(
        "Messaggio non affidato alla corrente:",
        erroreInvio
      );

      setErrore(
        `Messaggio non inviato: ${erroreInvio.message}`
      );
    } finally {
      setInvio(false);
    }
  };

  /*
   * Dalla memoria del fiume allo spotted: si passa sempre dal
   * pending, nessuna foglia viene pubblicata da sola.
   */
  const mandaInPending = async (voce) => {
    if (!isAdmin) {
      return;
    }

    if (
      inviate[voce.id] === "invio" ||
      inviate[voce.id] === "fatto"
    ) {
      return;
    }

    setInviate((precedenti) => ({
      ...precedenti,
      [voce.id]: "invio"
    }));
    setAvviso("");
    setErrore("");

    try {
      const creato = await addDoc(
        collection(db, "pendingPosts"),
        {
          text: voce.text,
          authorId: user?.uid || "anonimo",
          createdAt: new Date().toISOString(),
          status: "pending",
          reports: 0,
          reportedBy: [],
          flagReason: null,
          origine: "fiume"
        }
      );

      const notifica = user
        ? notificaNuovoPending(creato.id)
        : notificaSpottedAnonimo({
            pendingPostId: creato.id
          });

      notifica.catch((erroreNotifica) => {
        console.warn(
          "Spotted dalla memoria del fiume, notifica non inviata:",
          erroreNotifica
        );
      });

      setInviate((precedenti) => ({
        ...precedenti,
        [voce.id]: "fatto"
      }));
      setAvviso(
        "Foglia salvata: è in approvazione, nessuno la vede prima di un admin."
      );
    } catch (errorePending) {
      console.error(
        "Foglia non salvata dalla memoria del fiume:",
        errorePending
      );

      setInviate((precedenti) => ({
        ...precedenti,
        [voce.id]: "errore"
      }));
      setAvviso(
        `Non è stato possibile salvare la foglia: ${errorePending.message}`
      );
    }
  };

  return (
    <section className="section-card river-card">
      <div className="river-head">
        <div>
          <span className="river-eyebrow">
            Dieci secondi, poi acqua
          </span>
          <h2>🌊 Il Fiume</h2>
        </div>

        <div className="river-head-azioni">
          <button
            type="button"
            className={`river-suono${suono ? " is-on" : ""}`}
            onClick={alternaSuono}
            aria-pressed={suono}
            title={
              suono
                ? "Zittisci il fiume"
                : "Ascolta il fiume"
            }
          >
            {suono ? "🔊" : "🔈"}
            <span className="river-suono-testo">
              {suono ? "Zitto" : "Ascolta"}
            </span>
          </button>

          <span
            className={`river-badge${
              piena ? " is-piena" : ""
            }`}
          >
            {piena ? "🌊 Piena" : "⏳ 10s"}
          </span>
        </div>
      </div>

      <p className="river-intro">
        Una chat che non resta. Scrivi quello che ti passa per la
        testa e affidalo alla corrente: la foglia scende dall'alto,
        resta in acqua dieci secondi e poi non esiste più. Nessuno
        può rileggerla, nemmeno tu. Puoi lanciarne quante vuoi. Le
        foglie con link o pubblicità affondano come sassi.
      </p>

      <div
        className={`river-scena${piena ? " is-piena" : ""}`}
        role="log"
        aria-live="polite"
        aria-label="Messaggi che scorrono nel fiume"
      >
        <div className="river-cielo" aria-hidden="true">
          <span className="river-luna" />
          <span className="river-lucciola river-lucciola-a" />
          <span className="river-lucciola river-lucciola-b" />
          <span className="river-lucciola river-lucciola-c" />
        </div>

        <div className="river-sponda river-sponda-sx" aria-hidden="true" />
        <div className="river-sponda river-sponda-dx" aria-hidden="true" />

        <div className="river-acqua" aria-hidden="true">
          <span className="river-onda river-onda-a" />
          <span className="river-onda river-onda-b" />
          <span className="river-onda river-onda-c" />
        </div>

        <div className="river-brume" aria-hidden="true" />

        {visibili.map((messaggio) => {
          const stile = stileFoglia(messaggio.id);
          const secondi = Math.min(
            DURATA,
            Math.max(0, messaggio.eta)
          ) / 1000;

          return (
            <div
              key={messaggio.id}
              className="river-foglia"
              style={{
                left: `${stile.corsia}%`,
                animationDelay: `-${secondi}s`
              }}
            >
              <div
                className="river-foglia-corpo"
                style={{
                  "--river-rot": `${stile.rotazione}deg`
                }}
              >
                <span
                  className="river-foglia-glifo"
                  aria-hidden="true"
                >
                  {stile.glifo}
                </span>
                <span className="river-foglia-testo">
                  {messaggio.text}
                </span>
              </div>
            </div>
          );
        })}

        {sassi.map((sasso) => (
          <div
            key={sasso.id}
            className="river-sasso"
            aria-hidden="true"
          >
            <span className="river-sasso-glifo">🪨</span>
            <span className="river-sasso-testo">
              {sasso.text}
            </span>
          </div>
        ))}

        {visibili.length === 0 &&
          sassi.length === 0 &&
          !errore && (
            <p className="river-vuoto">
              La corrente è liscia.
              <br />
              Lancia la prima foglia 🌿
            </p>
          )}
      </div>

      <form
        className="river-composer"
        onSubmit={inviaMessaggio}
      >
        <input
          ref={inputRef}
          type="text"
          className="river-input"
          value={testo}
          maxLength={CARATTERI_MASSIMI}
          placeholder="Affida un pensiero alla corrente…"
          aria-label="Messaggio per il fiume"
          onChange={(evento) =>
            setTesto(evento.target.value)
          }
        />

        <button
          type="submit"
          className="river-invia"
          disabled={invio || !testo.trim()}
        >
          {invio ? "…" : "Lascia andare 🌿"}
        </button>
      </form>

      <div className="river-piede">
        <span className="river-conteggio">
          {visibili.length === 0
            ? "Nessuna voce nella corrente"
            : `${visibili.length} ${
                visibili.length === 1 ? "voce" : "voci"
              } nella corrente`}
        </span>

        <span className="river-nota">
          Foglie anonime · dieci secondi in acqua
        </span>
      </div>

      {isAdmin && (
        <div className="river-memoria">
          <button
            type="button"
            className="river-memoria-toggle"
            aria-expanded={memoriaAperta}
            onClick={() =>
              setMemoriaAperta((aperta) => !aperta)
            }
          >
            🫧 Memoria del fiume
            {memoria.length > 0 && (
              <span className="river-memoria-conteggio">
                {memoria.length}
              </span>
            )}
            <span className="river-memoria-freccia">
              {memoriaAperta ? "▾" : "▸"}
            </span>
          </button>

          {memoriaAperta && (
            <div className="river-memoria-corpo">
              <p className="river-memoria-nota">
                Solo gli admin vedono questa memoria. Le foglie
                appena passate si possono mandare come spotted:
                finiscono sempre in approvazione, mai online da
                sole.
              </p>

              {memoria.length === 0 ? (
                <p className="river-memoria-vuoto">
                  Il fiume non ricorda ancora niente.
                </p>
              ) : (
                <ul className="river-memoria-lista">
                  {memoria.map((voce) => {
                    const stato = inviate[voce.id] || "";

                    return (
                      <li
                        key={voce.id}
                        className="river-memoria-voce"
                      >
                        <p className="river-memoria-testo">
                          {voce.text}
                        </p>

                        <button
                          type="button"
                          className={`river-memoria-azione${
                            stato === "fatto"
                              ? " is-fatto"
                              : ""
                          }${
                            stato === "errore"
                              ? " is-errore"
                              : ""
                          }`}
                          disabled={
                            stato === "invio" ||
                            stato === "fatto"
                          }
                          onClick={() =>
                            mandaInPending(voce)
                          }
                        >
                          {stato === "fatto"
                            ? "In approvazione ✓"
                            : stato === "invio"
                            ? "Invio…"
                            : stato === "errore"
                            ? "Riprova"
                            : "📩 Spotted"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {avviso && (
        <p className="river-avviso" role="status">
          {avviso}
        </p>
      )}

      {errore && (
        <p className="river-errore" role="alert">
          {errore}
        </p>
      )}
    </section>
  );
}

export default RiverChat;

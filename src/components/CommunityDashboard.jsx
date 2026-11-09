import { useEffect, useMemo, useState } from "react";

const PAGINA_UTENTI = 10;

const SEZIONI = [
  { key: "panoramica", etichetta: "Panoramica", icona: "📊" },
  { key: "utenti", etichetta: "Utenti", icona: "👥" },
  { key: "regole", etichetta: "Regole", icona: "⚙️" }
];

const NEWSLETTER_OPTIONS = [
  {
    key: "immediata",
    etichetta: "Immediata",
    descrizione: "Push a ogni nuovo spotted",
    colore: "#f4c542"
  },
  {
    key: "giornaliera",
    etichetta: "Giornaliera",
    descrizione: "Ogni giorno alle 14",
    colore: "#4fc3f7"
  },
  {
    key: "settimanale",
    etichetta: "Settimanale",
    descrizione: "Domenica alle 14",
    colore: "#b388ff"
  },
  {
    key: "mai",
    etichetta: "Mai",
    descrizione: "Nessun riepilogo",
    colore: "#6b7280"
  }
];

const PREFERENZE_ADMIN = [
  {
    key: "notifyNewUsers",
    short: "Iscritti",
    etichetta: "Nuovi iscritti",
    predefinito: true
  },
  {
    key: "notifyNewPosts",
    short: "Post",
    etichetta: "Nuovi post pubblicati",
    predefinito: true
  },
  {
    key: "notifyPending",
    short: "Pending",
    etichetta: "Spotted in moderazione",
    predefinito: true
  },
  {
    key: "notifyReports",
    short: "Segnal.",
    etichetta: "Segnalazioni",
    predefinito: true
  },
  {
    key: "notifyAllComments",
    short: "Commenti",
    etichetta: "Tutti i commenti",
    predefinito: false
  },
  {
    key: "notifyAllLikes",
    short: "Like",
    etichetta: "Tutti i like",
    predefinito: false
  }
];

const ATTIVITA_VUOTA = Object.freeze({
  posts: 0,
  comments: 0,
  likes: 0,
  follows: 0
});

const FORMATO_NUMERO = new Intl.NumberFormat("it-IT");

const COLORI_AVATAR = [
  "#f4c542",
  "#4fc3f7",
  "#b388ff",
  "#fb7185",
  "#34d399",
  "#fb923c"
];

const chiaveUtente = (utente) => utente?.uid || utente?.id || "";

const dataDaValore = (valore) => {
  if (!valore) return null;

  if (typeof valore.toDate === "function") {
    return valore.toDate();
  }

  if (valore instanceof Date) {
    return valore;
  }

  if (
    typeof valore === "object" &&
    Number.isFinite(valore.seconds)
  ) {
    return new Date(valore.seconds * 1000);
  }

  const data = new Date(valore);

  return Number.isNaN(data.getTime()) ? null : data;
};

const dataBreve = (valore) => {
  const data = dataDaValore(valore);

  if (!data) return "—";

  return data.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const dataEstesa = (valore) => {
  const data = dataDaValore(valore);

  if (!data) return "—";

  return data.toLocaleString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const capitalizza = (testo) =>
  testo ? testo.charAt(0).toUpperCase() + testo.slice(1) : "";

const iniziali = (utente) => {
  const testo = String(
    utente?.nickname ||
      utente?.name ||
      utente?.email ||
      "?"
  ).trim();

  const parti = testo.split(/\s+/).filter(Boolean);

  if (parti.length === 0) return "?";
  if (parti.length === 1) return parti[0].slice(0, 2).toUpperCase();

  return (
    parti[0].charAt(0) +
    parti[parti.length - 1].charAt(0)
  ).toUpperCase();
};

const coloreAvatar = (utente) => {
  const base = String(
    chiaveUtente(utente) ||
      utente?.nickname ||
      utente?.email ||
      "?"
  );

  let hash = 0;

  for (let indice = 0; indice < base.length; indice += 1) {
    hash = (hash * 31 + base.charCodeAt(indice)) >>> 0;
  }

  return COLORI_AVATAR[hash % COLORI_AVATAR.length];
};

const stileAvatar = (utente) => {
  const colore = coloreAvatar(utente);

  return {
    color: colore,
    background: `${colore}1f`,
    borderColor: `${colore}55`
  };
};

const valoreNewsletter = (valore) =>
  NEWSLETTER_OPTIONS.some((opzione) => opzione.key === valore)
    ? valore
    : "mai";

const opzioneNewsletter = (valore) =>
  NEWSLETTER_OPTIONS.find(
    (opzione) => opzione.key === valoreNewsletter(valore)
  ) || NEWSLETTER_OPTIONS[NEWSLETTER_OPTIONS.length - 1];

const attivaPreferenza = (utente, preferenza) => {
  if (!utente || utente.role !== "admin") return false;

  if (utente.adminNotificationsConfigured !== true) {
    return preferenza.predefinito;
  }

  return preferenza.predefinito
    ? utente[preferenza.key] !== false
    : utente[preferenza.key] === true;
};

const totaleAttivita = (attivita) =>
  attivita.posts +
  attivita.comments +
  attivita.likes +
  attivita.follows;

const valoreLeggibile = (valore) => {
  if (valore === null || valore === undefined) return "—";

  if (typeof valore === "object") {
    try {
      return JSON.stringify(valore);
    } catch {
      return String(valore);
    }
  }

  return String(valore);
};

function KpiCard({ icona, etichetta, valore, dettaglio, tono = "" }) {
  return (
    <div className={`community-kpi ${tono ? `is-${tono}` : ""}`}>
      <span className="community-kpi-icon" aria-hidden="true">
        {icona}
      </span>

      <div className="community-kpi-copy">
        <span className="community-kpi-label">{etichetta}</span>
        <strong className="community-kpi-value">
          {FORMATO_NUMERO.format(valore)}
        </strong>
        <span className="community-kpi-meta">{dettaglio}</span>
      </div>
    </div>
  );
}

function DonutChart({ segmenti, totale, centro }) {
  let offset = 0;

  return (
    <div className="community-donut-wrap">
      <svg
        className="community-donut"
        viewBox="0 0 42 42"
        role="img"
        aria-label={`${totale} utenti divisi per frequenza dei riepiloghi`}
      >
        <circle
          className="community-donut-bg"
          cx="21"
          cy="21"
          r="15.9155"
        />

        {segmenti.map((segmento) => {
          const percentuale = totale
            ? (segmento.valore / totale) * 100
            : 0;

          const cerchio = (
            <circle
              key={segmento.key}
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke={segmento.colore}
              strokeWidth="5"
              strokeDasharray={`${percentuale} ${100 - percentuale}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 21 21)"
            />
          );

          offset += percentuale;

          return cerchio;
        })}
      </svg>

      <div className="community-donut-center" aria-hidden="true">
        <strong>{FORMATO_NUMERO.format(totale)}</strong>
        <span>{centro}</span>
      </div>
    </div>
  );
}

function TrendChart({ giorni, totale, precedente }) {
  const massimo = Math.max(
    1,
    ...giorni.map((giorno) => giorno.valore)
  );

  const differenza = totale - precedente;

  return (
    <div className="community-trend">
      <div className="community-trend-bars">
        {giorni.map((giorno) => (
          <div
            className="community-trend-col"
            key={giorno.chiave}
            title={`${giorno.etichettaCompleta}: ${giorno.valore} nuovi iscritti`}
          >
            <span className="community-trend-value">
              {giorno.valore}
            </span>

            <div className="community-trend-track">
              <span
                className="community-trend-bar"
                style={{
                  height: `${Math.max(
                    4,
                    (giorno.valore / massimo) * 100
                  )}%`
                }}
              />
            </div>

            <span className="community-trend-label">
              {giorno.etichetta}
            </span>
          </div>
        ))}
      </div>

      <div className="community-trend-foot">
        <span>
          <strong>{FORMATO_NUMERO.format(totale)}</strong> nuovi
          questa settimana
        </span>

        <span
          className={
            differenza > 0
              ? "is-up"
              : differenza < 0
              ? "is-down"
              : ""
          }
        >
          {differenza === 0
            ? "Come i 7 giorni precedenti"
            : `${differenza > 0 ? "+" : "−"}${Math.abs(
                differenza
              )} rispetto ai 7 giorni precedenti`}
        </span>
      </div>
    </div>
  );
}

function PreferenzeBarre({ amministratori, conteggi }) {
  const totale = amministratori.length;

  return (
    <div className="community-bars">
      {PREFERENZE_ADMIN.map((preferenza) => {
        const valore = conteggi[preferenza.key] || 0;
        const percentuale = totale
          ? Math.round((valore / totale) * 100)
          : 0;

        return (
          <div className="community-bar-row" key={preferenza.key}>
            <span
              className="community-bar-label"
              title={preferenza.etichetta}
            >
              {preferenza.etichetta}
            </span>

            <div className="community-bar-track">
              <span
                className="community-bar-fill"
                style={{ width: `${percentuale}%` }}
              />
            </div>

            <span className="community-bar-value">
              {valore}/{totale}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ModaleUtente({
  utente,
  attivita,
  dispositiviPush,
  conteggioPushInCorso,
  caricaDispositiviPush,
  toggleBan,
  eliminaUtente,
  onClose,
  descriviNewsletter,
  descriviSiNo,
  altriDatiUtente
}) {
  const uid = chiaveUtente(utente);
  const push = dispositiviPush[uid];
  const extra = altriDatiUtente(utente) || [];

  useEffect(() => {
    const gestisciTasto = (evento) => {
      if (evento.key === "Escape") onClose();
    };

    document.addEventListener("keydown", gestisciTasto);

    return () =>
      document.removeEventListener("keydown", gestisciTasto);
  }, [onClose]);

  return (
    <div
      className="pannello-sfondo"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="pannello community-user-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-user-modal-title"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="pannello-testa">
          <h2 id="community-user-modal-title">👤 Scheda utente</h2>

          <button
            type="button"
            className="pannello-chiudi"
            onClick={onClose}
            aria-label="Chiudi scheda utente"
          >
            ×
          </button>
        </div>

        <div className="pannello-corpo community-modal-body">
          <div className="community-modal-profile">
            <span
              className="community-avatar community-avatar-lg"
              style={stileAvatar(utente)}
            >
              {iniziali(utente)}
            </span>

            <div className="community-modal-identity">
              <h3>{utente.nickname || "Senza nickname"}</h3>
              <p>{utente.name || "Nome non disponibile"}</p>
              <p className="community-modal-email">
                {utente.email || "Email non disponibile"}
              </p>

              <div className="community-profile-badges">
                <span
                  className={`community-badge ${
                    utente.role === "admin" ? "is-admin" : ""
                  }`}
                >
                  {utente.role === "admin" ? "Admin" : "Utente"}
                </span>

                <span
                  className={`community-badge ${
                    utente.banned ? "is-banned" : "is-active"
                  }`}
                >
                  {utente.banned ? "Bannato" : "Attivo"}
                </span>
              </div>
            </div>
          </div>

          <div className="community-modal-kpis">
            <div>
              <strong>{attivita.posts}</strong>
              <span>Spotted</span>
            </div>

            <div>
              <strong>{attivita.comments}</strong>
              <span>Commenti</span>
            </div>

            <div>
              <strong>{attivita.likes}</strong>
              <span>Like</span>
            </div>

            <div>
              <strong>{attivita.follows}</strong>
              <span>Spotted seguiti</span>
            </div>
          </div>

          <section className="community-modal-section">
            <h4>Preferenze</h4>

            <div className="community-detail-row">
              <span>Riepilogo</span>
              <strong>{descriviNewsletter(utente.newsletter)}</strong>
            </div>

            <div className="community-detail-row">
              <span>Notifiche impostate</span>
              <strong>
                {descriviSiNo(utente.notificheImpostate)}
              </strong>
            </div>

            <div className="community-detail-row">
              <span>Push abilitate sul profilo</span>
              <strong>{descriviSiNo(utente.pushEnabled)}</strong>
            </div>

            <div className="community-detail-row">
              <span>Dispositivi push</span>
              <strong>
                {push === undefined
                  ? "Non verificato"
                  : push === null
                  ? "Non disponibile"
                  : `${push} ${
                      push === 1 ? "dispositivo" : "dispositivi"
                    }`}
              </strong>
            </div>

            <button
              type="button"
              className="community-secondary-btn"
              onClick={() => caricaDispositiviPush(uid)}
              disabled={Boolean(conteggioPushInCorso[uid])}
            >
              {conteggioPushInCorso[uid]
                ? "Controllo in corso..."
                : "📱 Verifica dispositivi push"}
            </button>
          </section>

          {utente.role === "admin" && (
            <section className="community-modal-section">
              <h4>Notifiche admin</h4>

              <div className="community-pref-list">
                {PREFERENZE_ADMIN.map((preferenza) => {
                  const attiva = attivaPreferenza(
                    utente,
                    preferenza
                  );

                  return (
                    <div
                      className={`community-pref-row ${
                        attiva ? "is-on" : ""
                      }`}
                      key={preferenza.key}
                    >
                      <span>{preferenza.etichetta}</span>
                      <span className="community-pref-state">
                        {attiva ? "Attiva" : "Disattivata"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="community-modal-section">
            <h4>Dati account</h4>

            <div className="community-detail-row">
              <span>UID</span>
              <code className="community-uid">{uid}</code>
            </div>

            <div className="community-detail-row">
              <span>Registrato il</span>
              <strong>{dataEstesa(utente.createdAt)}</strong>
            </div>

            <div className="community-detail-row">
              <span>Stato</span>
              <strong>
                {utente.banned ? "Bannato" : "Attivo"}
              </strong>
            </div>
          </section>

          {extra.length > 0 && (
            <details className="community-extra">
              <summary>
                Altri dati ({extra.length})
              </summary>

              <div className="community-extra-list">
                {extra.map(([chiave, valore]) => (
                  <div key={chiave}>
                    <span>{chiave}</span>
                    <code>{valoreLeggibile(valore)}</code>
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className="community-modal-actions">
            {utente.role !== "admin" ? (
              <>
                <button
                  type="button"
                  className="community-secondary-btn"
                  onClick={() =>
                    toggleBan(uid, Boolean(utente.banned))
                  }
                >
                  {utente.banned
                    ? "✅ Sblocca utente"
                    : "🚫 Banna utente"}
                </button>

                <button
                  type="button"
                  className="community-danger-btn"
                  onClick={() => eliminaUtente(utente)}
                >
                  🗑 Elimina utente
                </button>
              </>
            ) : (
              <p className="community-modal-note">
                Gli account admin non possono essere bannati o
                eliminati da questa scheda.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModaleParoleVietate({
  parole,
  nuovaParola,
  setNuovaParola,
  aggiungiParolaVietata,
  eliminaParolaVietata,
  onClose
}) {
  useEffect(() => {
    const gestisciTasto = (evento) => {
      if (evento.key === "Escape") onClose();
    };

    document.addEventListener("keydown", gestisciTasto);

    return () =>
      document.removeEventListener("keydown", gestisciTasto);
  }, [onClose]);

  return (
    <div
      className="pannello-sfondo"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="pannello community-words-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-words-modal-title"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="pannello-testa">
          <h2 id="community-words-modal-title">
            🚫 Parole vietate
          </h2>

          <button
            type="button"
            className="pannello-chiudi"
            onClick={onClose}
            aria-label="Chiudi parole vietate"
          >
            ×
          </button>
        </div>

        <div className="pannello-corpo">
          <p className="community-modal-note">
            Gli spotted che contengono queste parole vanno
            automaticamente in moderazione.
          </p>

          <form
            className="community-word-form"
            onSubmit={(evento) => {
              evento.preventDefault();
              aggiungiParolaVietata();
            }}
          >
            <input
              type="text"
              placeholder="Nuova parola vietata"
              value={nuovaParola}
              onChange={(evento) =>
                setNuovaParola(evento.target.value)
              }
              aria-label="Nuova parola vietata"
            />

            <button type="submit" className="community-primary-btn">
              Aggiungi
            </button>
          </form>

          <div className="community-word-list">
            {parole.length === 0 && (
              <div className="community-empty">
                Nessuna parola vietata.
              </div>
            )}

            {parole.map((parola) => (
              <div className="community-word-row" key={parola.id}>
                <span>{parola.word}</span>

                <button
                  type="button"
                  className="community-word-delete"
                  onClick={() => eliminaParolaVietata(parola.id)}
                >
                  Elimina
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CommunityDashboard({
  utenti = [],
  posts = [],
  comments = [],
  likes = [],
  postFollowers = [],
  pendingPosts = [],
  richiesteNickname = [],
  approvalEnabledPosts = true,
  approvalEnabledGroups = true,
  toggleApprovalPosts = () => {},
  toggleApprovalGroups = () => {},
  paroleVietate = [],
  nuovaParola = "",
  setNuovaParola = () => {},
  aggiungiParolaVietata = () => {},
  eliminaParolaVietata = () => {},
  dispositiviPush = {},
  conteggioPushInCorso = {},
  caricaDispositiviPush = () => {},
  toggleBan = () => {},
  eliminaUtente = () => {},
  descriviNewsletter = (valore) =>
    opzioneNewsletter(valore).etichetta,
  descriviSiNo = (valore, predefinito = false) =>
    (valore === undefined ? predefinito : valore)
      ? "Sì"
      : "No",
  altriDatiUtente = () => []
}) {
  const [sezione, setSezione] = useState("panoramica");
  const [ricerca, setRicerca] = useState("");
  const [filtroRuolo, setFiltroRuolo] = useState("tutti");
  const [filtroNewsletter, setFiltroNewsletter] =
    useState("tutte");
  const [filtroStato, setFiltroStato] = useState("tutti");
  const [ordinamento, setOrdinamento] = useState("recenti");
  const [pagina, setPagina] = useState(1);
  const [utenteApertoId, setUtenteApertoId] = useState(null);
  const [paroleAperte, setParoleAperte] = useState(false);

  useEffect(() => {
    setPagina(1);
  }, [
    ricerca,
    filtroRuolo,
    filtroNewsletter,
    filtroStato,
    ordinamento
  ]);

  const attivitaPerUtente = useMemo(() => {
    const mappa = new Map();

    utenti.forEach((utente) => {
      mappa.set(chiaveUtente(utente), {
        posts: 0,
        comments: 0,
        likes: 0,
        follows: 0
      });
    });

    const incrementa = (uid, campo) => {
      if (!uid) return;

      const attivita = mappa.get(uid);

      if (attivita) attivita[campo] += 1;
    };

    posts.forEach((post) => incrementa(post.authorId, "posts"));
    comments.forEach((commento) =>
      incrementa(commento.userId, "comments")
    );
    likes.forEach((like) => incrementa(like.userId, "likes"));
    postFollowers.forEach((follow) =>
      incrementa(follow.userId, "follows")
    );

    return mappa;
  }, [utenti, posts, comments, likes, postFollowers]);

  const attivitaDi = (utente) =>
    attivitaPerUtente.get(chiaveUtente(utente)) || ATTIVITA_VUOTA;

  const conteggiNewsletter = useMemo(() => {
    const base = {
      immediata: 0,
      giornaliera: 0,
      settimanale: 0,
      mai: 0
    };

    utenti.forEach((utente) => {
      base[valoreNewsletter(utente.newsletter)] += 1;
    });

    return base;
  }, [utenti]);

  const amministratori = useMemo(
    () => utenti.filter((utente) => utente.role === "admin"),
    [utenti]
  );

  const conteggiPreferenzeAdmin = useMemo(() => {
    const base = {};

    PREFERENZE_ADMIN.forEach((preferenza) => {
      base[preferenza.key] = amministratori.filter((utente) =>
        attivaPreferenza(utente, preferenza)
      ).length;
    });

    return base;
  }, [amministratori]);

  const oggi = useMemo(() => {
    const adesso = new Date();
    return new Date(
      adesso.getFullYear(),
      adesso.getMonth(),
      adesso.getDate()
    );
  }, []);

  const domani = useMemo(() => {
    const data = new Date(oggi);
    data.setDate(data.getDate() + 1);
    return data;
  }, [oggi]);

  const inizioUltimi7 = useMemo(() => {
    const data = new Date(oggi);
    data.setDate(data.getDate() - 6);
    return data;
  }, [oggi]);

  const inizio7Precedenti = useMemo(() => {
    const data = new Date(inizioUltimi7);
    data.setDate(data.getDate() - 7);
    return data;
  }, [inizioUltimi7]);

  const nuoviUltimi7 = useMemo(
    () =>
      utenti.filter((utente) => {
        const data = dataDaValore(utente.createdAt);
        return data && data >= inizioUltimi7 && data < domani;
      }).length,
    [utenti, inizioUltimi7, domani]
  );

  const nuoviPrecedenti7 = useMemo(
    () =>
      utenti.filter((utente) => {
        const data = dataDaValore(utente.createdAt);
        return (
          data &&
          data >= inizio7Precedenti &&
          data < inizioUltimi7
        );
      }).length,
    [utenti, inizio7Precedenti, inizioUltimi7]
  );

  const giorniNuovi = useMemo(() => {
    const giorni = [];

    for (let indice = 6; indice >= 0; indice -= 1) {
      const inizio = new Date(oggi);
      inizio.setDate(oggi.getDate() - indice);

      const fine = new Date(inizio);
      fine.setDate(inizio.getDate() + 1);

      const valore = utenti.filter((utente) => {
        const data = dataDaValore(utente.createdAt);
        return data && data >= inizio && data < fine;
      }).length;

      giorni.push({
        chiave: inizio.toISOString(),
        etichetta: capitalizza(
          inizio
            .toLocaleDateString("it-IT", { weekday: "short" })
            .replace(".", "")
        ),
        etichettaCompleta: inizio.toLocaleDateString("it-IT", {
          weekday: "long",
          day: "2-digit",
          month: "long"
        }),
        valore
      });
    }

    return giorni;
  }, [utenti, oggi]);

  const utentiAttivi7 = useMemo(() => {
    const idsUtenti = new Set(utenti.map(chiaveUtente));
    const attivi = new Set();

    const recente = (valore) => {
      const data = dataDaValore(valore);
      return data && data >= inizioUltimi7 && data < domani;
    };

    posts.forEach((post) => {
      if (recente(post.createdAt) && idsUtenti.has(post.authorId)) {
        attivi.add(post.authorId);
      }
    });

    comments.forEach((commento) => {
      if (
        recente(commento.createdAt) &&
        idsUtenti.has(commento.userId)
      ) {
        attivi.add(commento.userId);
      }
    });

    likes.forEach((like) => {
      if (recente(like.createdAt) && idsUtenti.has(like.userId)) {
        attivi.add(like.userId);
      }
    });

    return attivi.size;
  }, [utenti, posts, comments, likes, inizioUltimi7, domani]);

  const topUtenti = useMemo(
    () =>
      utenti
        .map((utente) => {
          const attivita =
            attivitaPerUtente.get(chiaveUtente(utente)) ||
            ATTIVITA_VUOTA;

          return {
            utente,
            attivita,
            totale: totaleAttivita(attivita)
          };
        })
        .filter((voce) => voce.totale > 0)
        .sort((a, b) => b.totale - a.totale)
        .slice(0, 5),
    [utenti, attivitaPerUtente]
  );

  const utentiFiltrati = useMemo(() => {
    const testoRicerca = ricerca.trim().toLowerCase();

    const lista = utenti.filter((utente) => {
      if (testoRicerca) {
        const testo = [
          utente.nickname,
          utente.name,
          utente.email,
          chiaveUtente(utente)
        ]
          .join(" ")
          .toLowerCase();

        if (!testo.includes(testoRicerca)) return false;
      }

      if (
        filtroRuolo === "admin" &&
        utente.role !== "admin"
      ) {
        return false;
      }

      if (
        filtroRuolo === "utenti" &&
        utente.role === "admin"
      ) {
        return false;
      }

      if (filtroStato === "attivi" && utente.banned) {
        return false;
      }

      if (filtroStato === "bannati" && !utente.banned) {
        return false;
      }

      if (
        filtroNewsletter !== "tutte" &&
        valoreNewsletter(utente.newsletter) !== filtroNewsletter
      ) {
        return false;
      }

      return true;
    });

    return lista.sort((a, b) => {
      if (ordinamento === "nickname") {
        return String(a.nickname || a.name || "").localeCompare(
          String(b.nickname || b.name || ""),
          "it"
        );
      }

      if (ordinamento === "attivita") {
        return (
          totaleAttivita(
            attivitaPerUtente.get(chiaveUtente(b)) ||
              ATTIVITA_VUOTA
          ) -
          totaleAttivita(
            attivitaPerUtente.get(chiaveUtente(a)) ||
              ATTIVITA_VUOTA
          )
        );
      }

      const dataA =
        dataDaValore(a.createdAt)?.getTime() || 0;
      const dataB =
        dataDaValore(b.createdAt)?.getTime() || 0;

      return ordinamento === "meno-recenti"
        ? dataA - dataB
        : dataB - dataA;
    });
  }, [
    utenti,
    ricerca,
    filtroRuolo,
    filtroStato,
    filtroNewsletter,
    ordinamento,
    attivitaPerUtente
  ]);

  const totalePagine = Math.max(
    1,
    Math.ceil(utentiFiltrati.length / PAGINA_UTENTI)
  );

  const paginaCorrente = Math.min(pagina, totalePagine);

  const utentiPagina = utentiFiltrati.slice(
    (paginaCorrente - 1) * PAGINA_UTENTI,
    paginaCorrente * PAGINA_UTENTI
  );

  const filtriAttivi =
    Boolean(ricerca.trim()) ||
    filtroRuolo !== "tutti" ||
    filtroNewsletter !== "tutte" ||
    filtroStato !== "tutti" ||
    ordinamento !== "recenti";

  const resetFiltri = () => {
    setRicerca("");
    setFiltroRuolo("tutti");
    setFiltroNewsletter("tutte");
    setFiltroStato("tutti");
    setOrdinamento("recenti");
  };

  const utenteAperto = utenteApertoId
    ? utenti.find(
        (utente) => chiaveUtente(utente) === utenteApertoId
      ) || null
    : null;

  const apriUtente = (utente) => {
    setUtenteApertoId(chiaveUtente(utente));
  };

  const gestisciEliminazione = async (utente) => {
    await eliminaUtente(chiaveUtente(utente));
  };

  const segmentiNewsletter = NEWSLETTER_OPTIONS.map(
    (opzione) => ({
      ...opzione,
      valore: conteggiNewsletter[opzione.key] || 0,
      percentuale: utenti.length
        ? Math.round(
            ((conteggiNewsletter[opzione.key] || 0) /
              utenti.length) *
              100
          )
        : 0
    })
  );

  const totaleGruppi = posts.filter(
    (post) => post.type === "groupProposal"
  ).length;

  const totaleSpotted = posts.length - totaleGruppi;
  const inModerazione =
    pendingPosts.length + richiesteNickname.length;

  return (
    <div className="community-dashboard">
      <div className="community-dashboard-head">
        <div>
          <span className="community-eyebrow">
            Amministrazione
          </span>
          <h2>Community in numeri</h2>
          <p className="community-dashboard-subtitle">
            Persone, preferenze e attività di Spotted Bologna in
            un unico posto.
          </p>
        </div>

        <span className="community-status">
          <span className="community-status-dot" />
          Dati aggiornati
        </span>
      </div>

      <div
        className="community-tabs"
        role="tablist"
        aria-label="Sezioni della dashboard"
      >
        {SEZIONI.map((voce) => (
          <button
            key={voce.key}
            type="button"
            role="tab"
            aria-selected={sezione === voce.key}
            className={`community-tab ${
              sezione === voce.key ? "is-active" : ""
            }`}
            onClick={() => setSezione(voce.key)}
          >
            <span aria-hidden="true">{voce.icona}</span>
            {voce.etichetta}

            {voce.key === "utenti" && (
              <span className="community-tab-count">
                {utenti.length}
              </span>
            )}

            {voce.key === "regole" &&
              paroleVietate.length > 0 && (
                <span className="community-tab-count">
                  {paroleVietate.length}
                </span>
              )}
          </button>
        ))}
      </div>

      {sezione === "panoramica" && (
        <>
          <div className="community-kpis">
            <KpiCard
              icona="👥"
              etichetta="Iscritti"
              valore={utenti.length}
              dettaglio={`+${nuoviUltimi7} negli ultimi 7 giorni`}
            />

            <KpiCard
              icona="📝"
              etichetta="Spotted"
              valore={totaleSpotted}
              dettaglio={`${totaleGruppi} gruppi pubblicati`}
            />

            <KpiCard
              icona="⏳"
              etichetta="In moderazione"
              valore={inModerazione}
              dettaglio={`${pendingPosts.length} spotted · ${richiesteNickname.length} nickname`}
              tono={inModerazione > 0 ? "warning" : ""}
            />

            <KpiCard
              icona="💬"
              etichetta="Interazioni"
              valore={comments.length + likes.length}
              dettaglio={`${comments.length} commenti · ${likes.length} like`}
            />

            <KpiCard
              icona="⚡"
              etichetta="Attivi 7 giorni"
              valore={utentiAttivi7}
              dettaglio={`su ${utenti.length} iscritti`}
            />
          </div>

          <div className="community-charts">
            <section className="community-card community-chart-card">
              <div className="community-card-head">
                <div>
                  <h3>Riepiloghi</h3>
                  <span>Come gli iscritti vogliono essere aggiornati</span>
                </div>

                <span className="community-card-badge">
                  {utenti.length} utenti
                </span>
              </div>

              <div className="community-donut-layout">
                <DonutChart
                  segmenti={segmentiNewsletter}
                  totale={utenti.length}
                  centro="iscritti"
                />

                <div className="community-legend">
                  {segmentiNewsletter.map((segmento) => (
                    <div
                      className="community-legend-row"
                      key={segmento.key}
                    >
                      <span
                        className="community-dot"
                        style={{
                          background: segmento.colore
                        }}
                      />
                      <span className="community-legend-label">
                        {segmento.etichetta}
                      </span>
                      <strong>{segmento.valore}</strong>
                      <span className="community-legend-percent">
                        {segmento.percentuale}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="community-chart-note">
                “Immediata” riceve una push a ogni nuovo spotted;
                le altre frequenze ricevono il riepilogo scelto.
              </p>
            </section>

            <section className="community-card community-chart-card">
              <div className="community-card-head">
                <div>
                  <h3>Nuovi iscritti</h3>
                  <span>Andamento degli ultimi 7 giorni</span>
                </div>

                <span className="community-card-badge">
                  {nuoviUltimi7} nuovi
                </span>
              </div>

              <TrendChart
                giorni={giorniNuovi}
                totale={nuoviUltimi7}
                precedente={nuoviPrecedenti7}
              />
            </section>

            <section className="community-card community-chart-card">
              <div className="community-card-head">
                <div>
                  <h3>Preferenze admin</h3>
                  <span>Cosa vogliono ricevere gli amministratori</span>
                </div>

                <span className="community-card-badge">
                  {amministratori.length} admin
                </span>
              </div>

              {amministratori.length === 0 ? (
                <div className="community-empty">
                  Nessun account admin configurato.
                </div>
              ) : (
                <PreferenzeBarre
                  amministratori={amministratori}
                  conteggi={conteggiPreferenzeAdmin}
                />
              )}
            </section>

            <section className="community-card community-chart-card">
              <div className="community-card-head">
                <div>
                  <h3>Top contributor</h3>
                  <span>Chi anima di più la community</span>
                </div>

                <span className="community-card-badge">
                  attività totale
                </span>
              </div>

              {topUtenti.length === 0 ? (
                <div className="community-empty">
                  Ancora nessuna attività registrata.
                </div>
              ) : (
                <div className="community-top-list">
                  {topUtenti.map(
                    ({ utente, attivita, totale }) => (
                      <button
                        type="button"
                        className="community-top-row"
                        key={chiaveUtente(utente)}
                        onClick={() => apriUtente(utente)}
                      >
                        <span
                          className="community-avatar community-avatar-sm"
                          style={stileAvatar(utente)}
                        >
                          {iniziali(utente)}
                        </span>

                        <span className="community-top-main">
                          <span className="community-top-name">
                            {utente.nickname ||
                              utente.name ||
                              "Utente"}
                          </span>

                          <span className="community-top-track">
                            <span
                              className="community-top-fill"
                              style={{
                                width: `${Math.max(
                                  6,
                                  (totale /
                                    (topUtenti[0]?.totale || 1)) *
                                    100
                                )}%`
                              }}
                            />
                          </span>

                          <span className="community-top-detail">
                            {attivita.posts} post ·{" "}
                            {attivita.comments} commenti ·{" "}
                            {attivita.likes} like
                          </span>
                        </span>

                        <span className="community-top-score">
                          {FORMATO_NUMERO.format(totale)}
                        </span>
                      </button>
                    )
                  )}
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {sezione === "utenti" && (
        <section className="community-card community-users-card">
          <div className="community-users-head">
            <div>
              <h3>Utenti e preferenze</h3>
              <p>
                {utentiFiltrati.length} di {utenti.length} utenti
                {" · "}
                {amministratori.length} admin
              </p>
            </div>

            <span className="community-card-badge">
              Tutti i dati
            </span>
          </div>

          <div className="community-toolbar">
            <label className="community-search">
              <span aria-hidden="true">🔎</span>
              <input
                type="search"
                placeholder="Cerca nickname, nome, email o UID..."
                value={ricerca}
                onChange={(evento) =>
                  setRicerca(evento.target.value)
                }
                aria-label="Cerca utenti"
              />
            </label>

            <select
              value={filtroRuolo}
              onChange={(evento) =>
                setFiltroRuolo(evento.target.value)
              }
              aria-label="Filtra per ruolo"
            >
              <option value="tutti">Tutti i ruoli</option>
              <option value="admin">Solo admin</option>
              <option value="utenti">Solo utenti</option>
            </select>

            <select
              value={filtroNewsletter}
              onChange={(evento) =>
                setFiltroNewsletter(evento.target.value)
              }
              aria-label="Filtra per riepilogo"
            >
              <option value="tutte">Tutti i riepiloghi</option>

              {NEWSLETTER_OPTIONS.map((opzione) => (
                <option key={opzione.key} value={opzione.key}>
                  {opzione.etichetta}
                </option>
              ))}
            </select>

            <select
              value={filtroStato}
              onChange={(evento) =>
                setFiltroStato(evento.target.value)
              }
              aria-label="Filtra per stato"
            >
              <option value="tutti">Tutti gli stati</option>
              <option value="attivi">Attivi</option>
              <option value="bannati">Bannati</option>
            </select>

            <select
              value={ordinamento}
              onChange={(evento) =>
                setOrdinamento(evento.target.value)
              }
              aria-label="Ordina utenti"
            >
              <option value="recenti">Più recenti</option>
              <option value="meno-recenti">Meno recenti</option>
              <option value="attivita">Più attivi</option>
              <option value="nickname">Nickname A-Z</option>
            </select>

            {filtriAttivi && (
              <button
                type="button"
                className="community-reset"
                onClick={resetFiltri}
              >
                Azzera
              </button>
            )}
          </div>

          {utentiFiltrati.length === 0 ? (
            <div className="community-empty">
              <p>Nessun utente corrisponde ai filtri.</p>
              <button
                type="button"
                className="community-secondary-btn"
                onClick={resetFiltri}
              >
                Azzera filtri
              </button>
            </div>
          ) : (
            <>
              <div className="community-table-wrap">
                <table className="community-users-table">
                  <thead>
                    <tr>
                      <th>Utente</th>
                      <th>Ruolo</th>
                      <th className="community-col-newsletter">
                        Riepilogo
                      </th>
                      <th className="community-col-prefs">
                        Notifiche admin
                      </th>
                      <th className="community-col-activity">
                        Attività
                      </th>
                      <th className="community-col-push">Push</th>
                      <th className="community-col-date">
                        Registrato
                      </th>
                      <th aria-label="Apri scheda" />
                    </tr>
                  </thead>

                  <tbody>
                    {utentiPagina.map((utente) => {
                      const uid = chiaveUtente(utente);
                      const attivita = attivitaDi(utente);
                      const push = dispositiviPush[uid];
                      const newsletter =
                        opzioneNewsletter(utente.newsletter);

                      return (
                        <tr
                          key={uid}
                          onClick={() => apriUtente(utente)}
                        >
                          <td>
                            <div className="community-user-cell">
                              <span
                                className="community-avatar"
                                style={stileAvatar(utente)}
                              >
                                {iniziali(utente)}
                              </span>

                              <span className="community-user-text">
                                <strong>
                                  {utente.nickname ||
                                    "Senza nickname"}
                                </strong>
                                <small>
                                  {utente.name ||
                                    utente.email ||
                                    "—"}
                                </small>
                              </span>
                            </div>
                          </td>

                          <td>
                            <span
                              className={`community-badge ${
                                utente.role === "admin"
                                  ? "is-admin"
                                  : utente.banned
                                  ? "is-banned"
                                  : "is-active"
                              }`}
                            >
                              {utente.role === "admin"
                                ? "Admin"
                                : "Utente"}
                              {utente.banned ? " · bannato" : ""}
                            </span>
                          </td>

                          <td className="community-col-newsletter">
                            <span
                              className="community-newsletter"
                              style={{ color: newsletter.colore }}
                            >
                              <span
                                className="community-dot"
                                style={{
                                  background: newsletter.colore
                                }}
                              />
                              {newsletter.etichetta}
                            </span>
                          </td>

                          <td className="community-col-prefs">
                            {utente.role === "admin" ? (
                              <div className="community-chips">
                                {PREFERENZE_ADMIN.map(
                                  (preferenza) => {
                                    const attiva =
                                      attivaPreferenza(
                                        utente,
                                        preferenza
                                      );

                                    return (
                                      <span
                                        key={preferenza.key}
                                        className={`community-chip ${
                                          attiva ? "is-on" : ""
                                        }`}
                                        title={`${preferenza.etichetta}: ${
                                          attiva
                                            ? "attiva"
                                            : "disattivata"
                                        }`}
                                      >
                                        {preferenza.short}
                                      </span>
                                    );
                                  }
                                )}
                              </div>
                            ) : (
                              <span className="community-muted">
                                —
                              </span>
                            )}
                          </td>

                          <td className="community-col-activity">
                            <div className="community-activity-list">
                              <span title="Spotted pubblicati">
                                <strong>{attivita.posts}</strong> 📝
                              </span>
                              <span title="Commenti">
                                <strong>{attivita.comments}</strong>{" "}
                                💬
                              </span>
                              <span title="Like">
                                <strong>{attivita.likes}</strong> ❤️
                              </span>
                            </div>
                          </td>

                          <td className="community-col-push">
                            {push === undefined ? (
                              <button
                                type="button"
                                className="community-mini-btn"
                                onClick={(evento) => {
                                  evento.stopPropagation();
                                  caricaDispositiviPush(uid);
                                }}
                                disabled={Boolean(
                                  conteggioPushInCorso[uid]
                                )}
                              >
                                {conteggioPushInCorso[uid]
                                  ? "..."
                                  : "Verifica"}
                              </button>
                            ) : push === null ? (
                              <span className="community-muted">
                                n/d
                              </span>
                            ) : (
                              <span className="community-push-count">
                                📱 {push}
                              </span>
                            )}
                          </td>

                          <td className="community-col-date">
                            <span className="community-date">
                              {dataBreve(utente.createdAt)}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="community-open-btn"
                              onClick={(evento) => {
                                evento.stopPropagation();
                                apriUtente(utente);
                              }}
                              aria-label={`Apri scheda di ${
                                utente.nickname || "questo utente"
                              }`}
                            >
                              ›
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="community-pagination">
                <span>
                  Pagina {paginaCorrente} di {totalePagine}
                  {" · "}
                  {utentiFiltrati.length} utenti
                </span>

                <div>
                  <button
                    type="button"
                    className="community-page-btn"
                    onClick={() =>
                      setPagina((corrente) =>
                        Math.max(1, corrente - 1)
                      )
                    }
                    disabled={paginaCorrente <= 1}
                  >
                    ← Precedente
                  </button>

                  <button
                    type="button"
                    className="community-page-btn"
                    onClick={() =>
                      setPagina((corrente) =>
                        Math.min(totalePagine, corrente + 1)
                      )
                    }
                    disabled={paginaCorrente >= totalePagine}
                  >
                    Successiva →
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {sezione === "regole" && (
        <div className="community-rules-grid">
          <section className="community-card">
            <div className="community-card-head">
              <div>
                <h3>Flusso di pubblicazione</h3>
                <span>Decidi cosa deve passare dalla moderazione</span>
              </div>

              <span className="community-card-badge">
                impostazioni live
              </span>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={approvalEnabledPosts}
              className={`community-switch-row ${
                approvalEnabledPosts ? "is-on" : ""
              }`}
              onClick={toggleApprovalPosts}
            >
              <span className="community-switch-copy">
                <strong>📝 Spotted</strong>
                <small>
                  {approvalEnabledPosts
                    ? "Approvazione manuale prima della pubblicazione"
                    : "Pubblicazione automatica"}
                </small>
              </span>

              <span
                className="community-switch"
                aria-hidden="true"
              >
                <span />
              </span>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={approvalEnabledGroups}
              className={`community-switch-row ${
                approvalEnabledGroups ? "is-on" : ""
              }`}
              onClick={toggleApprovalGroups}
            >
              <span className="community-switch-copy">
                <strong>📚 Gruppi</strong>
                <small>
                  {approvalEnabledGroups
                    ? "Approvazione manuale prima della pubblicazione"
                    : "Pubblicazione automatica"}
                </small>
              </span>

              <span
                className="community-switch"
                aria-hidden="true"
              >
                <span />
              </span>
            </button>

            <p className="community-chart-note">
              Le modifiche sono immediate per tutti gli utenti.
            </p>
          </section>

          <section className="community-card">
            <div className="community-card-head">
              <div>
                <h3>Parole vietate</h3>
                <span>
                  {paroleVietate.length}{" "}
                  {paroleVietate.length === 1
                    ? "parola bloccata"
                    : "parole bloccate"}
                </span>
              </div>

              <span className="community-card-badge">🛡️</span>
            </div>

            <p className="community-rules-text">
              Gli spotted che contengono queste parole vanno
              automaticamente in moderazione.
            </p>

            <div className="community-word-chips">
              {paroleVietate.length === 0 && (
                <span className="community-muted">
                  Nessuna parola vietata.
                </span>
              )}

              {paroleVietate.slice(0, 6).map((parola) => (
                <span
                  className="community-word-chip"
                  key={parola.id}
                >
                  {parola.word}
                </span>
              ))}

              {paroleVietate.length > 6 && (
                <span className="community-word-chip">
                  +{paroleVietate.length - 6}
                </span>
              )}
            </div>

            <button
              type="button"
              className="community-primary-btn"
              onClick={() => setParoleAperte(true)}
            >
              Gestisci parole vietate
            </button>
          </section>
        </div>
      )}

      {utenteAperto && (
        <ModaleUtente
          utente={utenteAperto}
          attivita={attivitaDi(utenteAperto)}
          dispositiviPush={dispositiviPush}
          conteggioPushInCorso={conteggioPushInCorso}
          caricaDispositiviPush={caricaDispositiviPush}
          toggleBan={toggleBan}
          eliminaUtente={gestisciEliminazione}
          onClose={() => setUtenteApertoId(null)}
          descriviNewsletter={descriviNewsletter}
          descriviSiNo={descriviSiNo}
          altriDatiUtente={altriDatiUtente}
        />
      )}

      {paroleAperte && (
        <ModaleParoleVietate
          parole={paroleVietate}
          nuovaParola={nuovaParola}
          setNuovaParola={setNuovaParola}
          aggiungiParolaVietata={aggiungiParolaVietata}
          eliminaParolaVietata={eliminaParolaVietata}
          onClose={() => setParoleAperte(false)}
        />
      )}
    </div>
  );
}

export default CommunityDashboard;

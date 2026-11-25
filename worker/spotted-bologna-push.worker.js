const encoder = new TextEncoder();

/*
 * Instagram: versione dell'API e giorni dopo i quali il token di
 * accesso (valido 60 giorni) viene rinnovato dal cron.
 */
const VERSIONE_API_INSTAGRAM = "v27.0";
const GIORNI_PRIMA_DEL_RINNOVO = 40;

/*
 * IA per i contenuti Instagram: endpoint OpenAI-compatibile, modello e
 * limite di bozze generate per richiesta. La chiave vive solo nei
 * secret del Worker.
 */
const AI_CHAT_URL =
  "https://freebuff.com/api/v1/paid/chat/completions";
const AI_MODELLO_PREDEFINITO =
  "deepseek/deepseek-v4-flash";
const MASSIMO_BOZZE_PER_RICHIESTA = 5;

/*
 * Le skill sono le istruzioni di scrittura che l'IA deve seguire: sono
 * le stesse SKILL.md fornite dall'admin, riportate qui perche' il
 * Worker non legge file. Dal pannello si possono attivare o spegnere.
 */
const SKILL_INSTAGRAM = [
  {
    id: "ig-viral",
    nome: "Ricerca contenuti virali",
    descrizione:
      "Trova cosa funziona adesso nel settore, con rapporti di performance rispetto alla media dell'account.",
    attivaPredefinita: true,
    istruzioni:
      "Studia un piccolo campione di account diretti, adiacenti e piu' grandi. Le views da sole non bastano: usa il multiplo rispetto alla mediana recente dell'account (sopra 3x segnale forte, sotto 1.5x quasi normale). Per ogni esempio annota account, dimensione pubblico, mediana, views, hook, primo testo, durata, CTA e fonte. Riporta formule ricorrenti, differenze tra vincenti e baseline e 3 direzioni originali. Non copiare script altrui."
  },
  {
    id: "ig-plan",
    nome: "Piano settimanale",
    descrizione:
      "Costruisce un calendario di una settimana con pilastri, formati e obiettivi.",
    attivaPredefinita: true,
    istruzioni:
      "Pianifica sulla capacita' reale di produzione. Scegli 3-5 pilastri di contenuto e assegna a ogni post un obiettivo: reach, fiducia, prova, conversazione o conversione. Per ogni voce indica giorno, formato, tema, hook, prova necessaria, CTA e possibilita' di riuso. Non inventare orari di pubblicazione ottimali."
  },
  {
    id: "ig-repurpose",
    nome: "Riuso di contenuti lunghi",
    descrizione:
      "Trasforma un contenuto lungo in piu' contenuti autonomi per la settimana.",
    attivaPredefinita: true,
    istruzioni:
      "Estrai idee distinte, non pezzi tagliati. Ogni contenuto deve reggersi da solo per chi non ha visto la fonte. Conserva fatti e citazioni, non inventare esempi. Varia hook e angoli per non sembrare ripetitivo."
  },
  {
    id: "ig-caption",
    nome: "Descrizione del post",
    descrizione:
      "Scrive la caption: primi 125 caratteri utili, apertura concreta, un solo invito.",
    attivaPredefinita: true,
    istruzioni:
      "Scrivi caption che guadagnano il tap. I primi 125 caratteri devono funzionare da soli. Apri con una riga concreta, mai con 'nuovo post' o 'sono felice di condividere'. Usa la voce dell'utente, conserva i fatti, non inventare numeri. Preferisci termini di ricerca naturali dentro le frasi. Un solo invito all'azione. Hashtag contenuti."
  },
  {
    id: "ig-human",
    nome: "Scrittura naturale",
    descrizione:
      "Toglie il tono artificiale e le frasi fatte, senza cambiare i fatti.",
    attivaPredefinita: true,
    istruzioni:
      "Conserva fatti, nomi, numeri e significato. Elimina caratteri Unicode invisibili, frasi fatte, simmetria eccessiva, enfasi finta e linguaggio da 'creator'. Niente trattini lunghi inutili. Obiettivo: testo naturale, scritto come si parla. Non promettere di aggirare rilevatori."
  },
  {
    id: "ig-carousel",
    nome: "Carosello",
    descrizione:
      "Trasforma un'idea in un carosello da 5-10 slide. Al momento non pubblicabile dall'app.",
    attivaPredefinita: false,
    istruzioni:
      "5-10 slide. La prima e' una promessa, non un titolo. La seconda deve premiare subito lo swipe. Ogni slide si capisce a colpo d'occhio e fa un passo avanti. Per ogni slide: titolo, testo, direzione visiva. Testo minimo per il telefono. Chiudi con un solo invito."
  },
  {
    id: "ig-reel",
    nome: "Reel",
    descrizione:
      "Scrive un Reel con tre hook, script parlato e tempi. Richiede video per la pubblicazione.",
    attivaPredefinita: false,
    istruzioni:
      "Parti da un'idea vera e specifica. Scrivi tre hook davvero diversi tra loro, con hook parlato e hook a schermo (max sei parole), poi valuta ciascuno 0-100 su lunghezza, specificita', posta in gioco, front-loading e indirizzo al pubblico. Script: hook 0-2s, contesto 2-7s, un'idea per battuta, ultimi 3s payoff e un solo invito. 15-45 secondi, linguaggio parlato."
  },
  {
    id: "ig-story",
    nome: "Storie",
    descrizione:
      "Pianifica una sequenza di Storie con sticker usati solo se servono.",
    attivaPredefinita: false,
    istruzioni:
      "3-7 frame. Il primo cattura l'attenzione, quelli centrali aggiungono contesto o prova, l'ultimo chiede una sola azione. Usa sticker solo con un compito preciso: sondaggio per partecipare, domanda per ricerca, quiz per interazione, link per l'azione. Niente funnel in DM senza consenso."
  },
  {
    id: "ig-profile",
    nome: "Audit del profilo",
    descrizione:
      "Valuta nome, bio, CTA, in evidenza e post fissati del profilo.",
    attivaPredefinita: false,
    istruzioni:
      "Valuta su 100: chiarezza identita', specificita' del pubblico, proposta di valore, prova, ricercabilita', CTA, chiarezza del link, coerenza visiva, post fissati, in evidenza, fiducia e attrito. Se mancano informazioni segna 'sconosciuto' invece di indovinare. Restituisci priorita' di intervento e 2-3 bio alternative."
  },
  {
    id: "ig-audit",
    nome: "Analisi dei risultati",
    descrizione:
      "Legge i risultati reali dei post pubblicati e dice cosa ripetere, testare o fermare.",
    attivaPredefinita: false,
    istruzioni:
      "Usa dati reali. Normalizza: views e reach rispetto alla baseline dell'account, salvataggi e condivisioni per reach, follow per reach, retention per i video. Non confrontare views grezze tra account diversi. Per ogni post identifica hook, promessa, formato, prova, ritmo, CTA e risultato. Separa evidenza e ipotesi. Chiudi con ripeti, testa, ferma e un prossimo esperimento."
  }
];

const SKILL_ATTIVE_PREDEFINITE = SKILL_INSTAGRAM
  .filter((skill) => skill.attivaPredefinita)
  .map((skill) => skill.id);

/*
 * Converte una stringa o un ArrayBuffer nel formato Base64 URL-safe
 * richiesto dai JWT.
 */
function base64UrlEncode(input) {
  let bytes;

  if (typeof input === "string") {
    bytes = encoder.encode(input);
  } else {
    bytes = new Uint8Array(input);
  }

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/*
 * Converte la chiave privata PEM del service account
 * in un formato utilizzabile dalla Web Crypto API.
 */
function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

/*
 * Crea il JWT firmato del service account.
 */
async function creaJwtServiceAccount(serviceAccount) {
  const adesso = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: serviceAccount.private_key_id
  };

  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: adesso,
    exp: adesso + 3600,
    scope: [
      "https://www.googleapis.com/auth/firebase.messaging",
      "https://www.googleapis.com/auth/datastore"
    ].join(" ")
  };

  const headerEncoded = base64UrlEncode(
    JSON.stringify(header)
  );

  const payloadEncoded = base64UrlEncode(
    JSON.stringify(payload)
  );

  const contenutoDaFirmare =
    `${headerEncoded}.${payloadEncoded}`;

  const chiavePrivata =
    await crypto.subtle.importKey(
      "pkcs8",
      pemToArrayBuffer(
        serviceAccount.private_key
      ),
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256"
      },
      false,
      ["sign"]
    );

  const firma = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    chiavePrivata,
    encoder.encode(contenutoDaFirmare)
  );

  return (
    `${contenutoDaFirmare}.` +
    `${base64UrlEncode(firma)}`
  );
}

/*
 * Ottiene un token OAuth Google utilizzabile sia per FCM
 * sia per Firestore.
 */
/*
 * Il token OAuth di Google dura un'ora: riutilizzarlo evita una
 * richiesta per ogni notifica. Serve perche' i riepiloghi mandano un
 * messaggio a ogni iscritto e il piano gratuito di Workers consente
 * poche sotto-richieste per esecuzione.
 */
const cacheAccessToken = new Map();

async function ottieniAccessToken(serviceAccount) {
  const chiave =
    serviceAccount?.client_email || "default";

  const salvato =
    cacheAccessToken.get(chiave);

  if (
    salvato &&
    salvato.scadenza > Date.now() + 60000
  ) {
    return salvato.token;
  }

  const jwt =
    await creaJwtServiceAccount(serviceAccount);

  const risposta = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type:
          "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt
      })
    }
  );

  const risultato = await risposta.json();

  if (
    !risposta.ok ||
    !risultato.access_token
  ) {
    console.error(
      "Errore OAuth Google:",
      risultato
    );

    throw new Error(
      "Impossibile ottenere il token OAuth Google."
    );
  }

  const durata =
    Number(risultato.expires_in) || 3600;

  cacheAccessToken.set(chiave, {
    token: risultato.access_token,
    scadenza:
      Date.now() + durata * 1000
  });

  return risultato.access_token;
}

/*
 * Legge il Firebase ID token dall'header Authorization.
 */
function leggiBearerToken(request) {
  const authorization =
    request.headers.get("Authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice(7).trim();
}

/*
 * Verifica il Firebase ID token ricevuto dal frontend.
 */
async function verificaFirebaseIdToken(
  idToken,
  env
) {
  const endpoint =
    "https://identitytoolkit.googleapis.com/v1/" +
    "accounts:lookup" +
    `?key=${env.FIREBASE_WEB_API_KEY}`;

  const risposta = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      idToken
    })
  });

  const risultato = await risposta.json();

  if (
    !risposta.ok ||
    !Array.isArray(risultato.users) ||
    !risultato.users[0]?.localId
  ) {
    console.error(
      "Firebase ID token non valido:",
      risultato
    );

    throw new Error(
      "Sessione Firebase non valida o scaduta."
    );
  }

  return {
    uid: risultato.users[0].localId,
    email: risultato.users[0].email || null
  };
}

/*
 * Converte i valori restituiti dalla REST API di Firestore.
 */
function valoreFirestore(campo) {
  if (!campo) {
    return null;
  }

  if ("stringValue" in campo) {
    return campo.stringValue;
  }

  if ("booleanValue" in campo) {
    return campo.booleanValue;
  }

  if ("integerValue" in campo) {
    return Number(campo.integerValue);
  }

  if ("doubleValue" in campo) {
    return Number(campo.doubleValue);
  }

  if ("timestampValue" in campo) {
    return campo.timestampValue;
  }

  return null;
}

/*
 * Legge un campo Firestore di tipo array di stringhe.
 */
function listaFirestore(campo) {
  const valori = campo?.arrayValue?.values;

  if (!Array.isArray(valori)) {
    return null;
  }

  return valori
    .map(valoreFirestore)
    .filter(
      (valore) => typeof valore === "string"
    );
}

/*
 * Recupera il documento Firestore dell'utente autenticato.
 *
 * Usa il Firebase ID token, quindi questa richiesta
 * rispetta le Firestore Security Rules.
 */
async function recuperaUtenteFirestore(
  uid,
  idToken,
  env
) {
  const endpoint =
    `https://firestore.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/databases/(default)/` +
    `documents/users/${encodeURIComponent(uid)}`;

  const risposta = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`
    }
  });

  const risultato = await risposta.json();

  if (!risposta.ok) {
    console.error(
      "Errore lettura utente Firestore:",
      risultato
    );

    throw new Error(
      "Impossibile verificare il profilo dell'utente."
    );
  }

  const fields = risultato.fields || {};

  return {
    uid,
    role: valoreFirestore(fields.role),
    isAdmin: valoreFirestore(fields.isAdmin),
    admin: valoreFirestore(fields.admin)
  };
}

/*
 * Controlla se il profilo appartiene a un amministratore.
 */
function utenteAmministratore(profilo) {
  // Solo role === "admin", coerente con isAdmin() delle regole Firestore.
  // I campi isAdmin/admin NON vanno considerati: un utente potrebbe
  // scriverli sul proprio profilo.
  return profilo.role === "admin";
}

/*
 * Recupera tutti i token push attivi di un determinato utente.
 *
 * Questa richiesta usa il token OAuth del service account.
 */
async function recuperaTokenUtente({
  env,
  recipientUserId,
  accessToken
}) {
  const endpoint =
    `https://firestore.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/databases/(default)/` +
    `documents/users/` +
    `${encodeURIComponent(recipientUserId)}/pushTokens`;

  const risposta = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (risposta.status === 404) {
    return [];
  }

  const risultato = await risposta.json();

  if (!risposta.ok) {
    console.error(
      "Errore lettura pushTokens:",
      risultato
    );

    throw new Error(
      "Impossibile recuperare i dispositivi del destinatario."
    );
  }

  const documenti = risultato.documents || [];

  return documenti
    .map((documento) => {
      const fields = documento.fields || {};

      return {
        documentName: documento.name,
        token: valoreFirestore(fields.token),
        enabled: valoreFirestore(fields.enabled)
      };
    })
    .filter((elemento) => {
      return (
        typeof elemento.token === "string" &&
        elemento.token.trim() !== "" &&
        elemento.enabled !== false
      );
    });
}

/*
 * Elimina da Firestore un token che FCM ha dichiarato
 * definitivamente non valido.
 */
async function eliminaTokenScaduto({
  documentName,
  accessToken
}) {
  const endpoint =
    `https://firestore.googleapis.com/v1/` +
    `${documentName}`;

  const risposta = await fetch(endpoint, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (
    !risposta.ok &&
    risposta.status !== 404
  ) {
    console.error(
      "Impossibile eliminare il token scaduto:",
      await risposta.text()
    );
  }
}

/*
 * Determina se l'errore restituito da FCM
 * indica che il token deve essere eliminato.
 */
function tokenFCMNonValido(risultato) {
  const dettaglioFCM =
    risultato?.error?.details?.find(
      (dettaglio) =>
        dettaglio["@type"] ===
        "type.googleapis.com/google.firebase.fcm.v1.FcmError"
    );

  const codice =
    dettaglioFCM?.errorCode || "";

  /*
   * Solo questi due errori indicano davvero un token inutilizzabile.
   * INVALID_ARGUMENT invece segnala spesso un problema del messaggio:
   * eliminare il token in quel caso faceva sparire in silenzio i
   * dispositivi (telefono compreso) e non ricevevano piu' nulla.
   */
  return (
    codice === "UNREGISTERED" ||
    codice === "SENDER_ID_MISMATCH"
  );
}

/*
 * Trasforma un percorso interno in un indirizzo assoluto.
 */
function creaUrlAssoluto(percorso, env) {
  const origine =
    env.APP_URL ||
    env.ALLOWED_ORIGIN ||
    "http://localhost:3000";

  try {
    if (
      typeof percorso === "string" &&
      (
        percorso.startsWith("https://") ||
        percorso.startsWith("http://")
      )
    ) {
      return percorso;
    }

    return new URL(
      typeof percorso === "string"
        ? percorso
        : "/",
      origine
    ).href;
  } catch {
    return new URL("/", origine).href;
  }
}

/*
 * Invia una singola notifica a un singolo token FCM.
 */
async function inviaPush({
  env,
  token,
  title,
  body,
  url,
  notificationId,
  postId,
  accessToken
}) {
  let tokenOAuth = accessToken;

  if (!tokenOAuth) {
    const serviceAccount = JSON.parse(
      env.FIREBASE_SERVICE_ACCOUNT
    );

    tokenOAuth =
      await ottieniAccessToken(serviceAccount);
  }

  const endpoint =
    `https://fcm.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/messages:send`;

  /*
   * Se la notifica riguarda uno spotted, il clic deve portare su quello
   * spotted e non sulla home: l'app legge ?spotted=<id> e scorre fino
   * alla card. La home resta il ripiego quando l'URL e' già esplicito.
   */
  const destinazione =
    postId &&
    (!url || url === "/")
      ? `/?spotted=${encodeURIComponent(postId)}`
      : url;

  const urlAssoluto =
    creaUrlAssoluto(destinazione, env);

  /*
   * FCM accetta come destinazione del clic solo URL HTTPS: se APP_URL
   * non e' configurato finisce qui un indirizzo http (o localhost) che
   * farebbe fallire l'intero invio con INVALID_ARGUMENT anche su
   * telefono. Meglio ometterlo.
   */
  const linkSicuro =
    typeof urlAssoluto === "string" &&
    urlAssoluto.startsWith("https://")
      ? urlAssoluto
      : null;

  /*
   * Messaggio volutamente data-only: la notifica viene mostrata dal
   * service worker con showNotification. Affidarsi alla visualizzazione
   * automatica del payload "notification" lascia alcuni telefoni,
   * soprattutto iOS/PWA, senza avviso pur avendo ricevuto la push.
   */
  const webpush = {
    /*
     * Urgenza alta: con la priorita' normale Android puo' rimandare
     * la consegna finche' il telefono non esce dalla modalita' doze,
     * e la notifica sembra non arrivare mai. La TTL tiene il messaggio
     * in coda per un giorno se il dispositivo e' spento.
     */
    headers: {
      Urgency: "high",
      TTL: "86400"
    }
  };

  if (linkSicuro) {
    webpush.fcm_options = {
      link: linkSicuro
    };
  }

  const messaggio = {
    message: {
      token,

      data: {
        title,
        body,
        url: linkSicuro || "/",
        notificationId:
          notificationId || "",
        postId:
          postId || ""
      },

      webpush
    }
  };

  const risposta = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenOAuth}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(messaggio)
  });

  const risultato = await risposta.json();

  if (!risposta.ok) {
    console.error(
      "Errore invio FCM:",
      risultato
    );

    const errore = new Error(
      risultato.error?.message ||
      "FCM ha rifiutato il messaggio."
    );

    errore.fcmResult = risultato;
    errore.fcmStatus = risposta.status;

    throw errore;
  }

  return risultato;
}

/*
 * Invia la notifica a tutti i dispositivi registrati
 * dal destinatario.
 */
async function inviaPushAUtente({
  env,
  recipientUserId,
  title,
  body,
  url,
  notificationId,
  postId,
  accessToken: accessTokenPassato
}) {
  const serviceAccount = JSON.parse(
    env.FIREBASE_SERVICE_ACCOUNT
  );

  const accessToken =
    accessTokenPassato ||
    (await ottieniAccessToken(serviceAccount));

  const dispositivi =
    await recuperaTokenUtente({
      env,
      recipientUserId,
      accessToken
    });

  if (dispositivi.length === 0) {
    return {
      success: true,
      totalDevices: 0,
      sent: 0,
      failed: 0,
      removedTokens: 0,
      results: []
    };
  }

  const risultati = [];

  let inviati = 0;
  let falliti = 0;
  let tokenEliminati = 0;

  for (const dispositivo of dispositivi) {
    try {
      const risultato = await inviaPush({
        env,
        token: dispositivo.token,
        title,
        body,
        url,
        notificationId,
        postId,
        accessToken
      });

      inviati += 1;

      risultati.push({
        success: true,
        messageId: risultato.name
      });
    } catch (errore) {
      falliti += 1;

      const tokenNonValido =
        tokenFCMNonValido(
          errore.fcmResult
        );

      if (tokenNonValido) {
        await eliminaTokenScaduto({
          documentName:
            dispositivo.documentName,
          accessToken
        });

        tokenEliminati += 1;
      }

      risultati.push({
        success: false,
        removed: tokenNonValido,
        error: errore.message
      });
    }
  }

  return {
    success:
      inviati > 0 ||
      dispositivi.length === 0,
    totalDevices: dispositivi.length,
    sent: inviati,
    failed: falliti,
    removedTokens: tokenEliminati,
    results: risultati
  };
}

/*
 * Controlla se l'origine rientra nell'elenco ALLOWED_ORIGIN
 * (una o piu' origini separate da virgola).
 */
function origineInElenco(origin, env) {
  const elenco = String(
    env.ALLOWED_ORIGIN || ""
  )
    .split(",")
    .map((voce) =>
      voce.trim().replace(/\/$/, "")
    )
    .filter(Boolean);

  if (elenco.length === 0) {
    return true;
  }

  const originePulita = String(
    origin || ""
  ).replace(/\/$/, "");

  return elenco.includes(originePulita);
}

/*
 * Header CORS.
 *
 * Il Worker risponde sempre all'origine che ha effettuato la richiesta:
 * gli endpoint sono protetti dal Firebase ID token nell'header
 * Authorization e non da cookie di sessione, quindi un sito terzo non
 * puo' impersonare l'utente. Vincolare l'origine bloccherebbe soltanto
 * il sito vero quando cambia indirizzo (dominio nuovo, Pages, IP di
 * prova da telefono) facendo fallire in silenzio notifiche e conteggio
 * iscritti: ALLOWED_ORIGIN resta come elenco di riferimento e finisce
 * nei log quando arriva un'origine diversa.
 */
function creaHeadersCors(origin, env) {
  const origineRisposta =
    typeof origin === "string" &&
    /^https?:\/\/[^\s]+$/.test(origin)
      ? origin
      : env.ALLOWED_ORIGIN;

  return {
    "Access-Control-Allow-Origin":
      origineRisposta,
    "Access-Control-Allow-Methods":
      "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",
    "Content-Type":
      "application/json",
    "Vary":
      "Origin"
  };
}

/*
 * Crea una risposta JSON uniforme.
 */
function rispostaJson(
  dati,
  status,
  origin,
  env
) {
  return new Response(
    JSON.stringify(dati),
    {
      status,
      headers:
        creaHeadersCors(origin, env)
    }
  );
}

/*
 * Worker principale.
 */

async function leggiDocumentoConServiceAccount({
  env,
  percorso,
  accessToken
}) {
  const endpoint =
    `https://firestore.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/databases/(default)/` +
    `documents/${percorso}`;

  const risposta = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (risposta.status === 404) {
    return null;
  }

  const risultato = await risposta.json();

  if (!risposta.ok) {
    console.error(
      "Errore lettura documento Firestore:",
      risultato
    );

    throw new Error(
      "Impossibile leggere il documento Firestore."
    );
  }

  return risultato;
}

/*
 * Crea un documento Firestore con un ID generato da Firestore.
 */
async function creaDocumentoConServiceAccount({
  env,
  accessToken,
  collectionId,
  fields
}) {
  const endpoint =
    `https://firestore.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/databases/(default)/` +
    `documents/${collectionId}`;

  const risposta = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields })
  });

  const risultato = await risposta
    .json()
    .catch(() => null);

  if (!risposta.ok) {
    console.error(
      "Errore creazione documento Firestore:",
      risultato
    );

    throw new Error(
      "Impossibile creare il documento su Firestore."
    );
  }

  return risultato;
}

/*
 * Scrive o aggiorna un documento Firestore con il service account.
 */
async function scriviDocumentoConServiceAccount({
  env,
  accessToken,
  percorso,
  fields,
  campiAggiornati = []
}) {
  const maschera = campiAggiornati.length
    ? `?${campiAggiornati
        .map(
          (campo) =>
            `updateMask.fieldPaths=${encodeURIComponent(
              campo
            )}`
        )
        .join("&")}`
    : "";

  const endpoint =
    `https://firestore.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/databases/(default)/` +
    `documents/${percorso}${maschera}`;

  const risposta = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields })
  });

  if (!risposta.ok) {
    console.error(
      "Errore scrittura documento Firestore:",
      await risposta.text()
    );

    throw new Error(
      "Impossibile salvare i dati su Firestore."
    );
  }

  return risposta.json();
}

/* ------------------------------------------------------------------ *
 * Instagram
 * ------------------------------------------------------------------ */

async function leggiConfigurazioneInstagram({
  env,
  accessToken
}) {
  try {
    const documento =
      await leggiDocumentoConServiceAccount({
        env,
        accessToken,
        percorso: "config/instagram"
      });

    if (!documento) {
      return null;
    }

    return {
      token: valoreFirestore(
        documento.fields?.accessToken
      ),
      rinnovatoIl: valoreFirestore(
        documento.fields?.rinnovatoIl
      ),
      scadeIl: valoreFirestore(
        documento.fields?.scadeIl
      ),
      aiSkills: listaFirestore(
        documento.fields?.aiSkills
      )
    };
  } catch (errore) {
    console.warn(
      "Configurazione Instagram non leggibile:",
      errore
    );

    return null;
  }
}

/*
 * Il token rinnovato non puo' essere scritto nei secret del Worker,
 * quindi vive su Firestore e ha la precedenza su quello nei secret.
 */
async function tokenInstagram({ env, accessToken }) {
  const configurazione =
    await leggiConfigurazioneInstagram({
      env,
      accessToken
    });

  return (
    configurazione?.token ||
    env.INSTAGRAM_ACCESS_TOKEN ||
    ""
  );
}

/*
 * Il token di Instagram dura 60 giorni: il cron lo rinnova prima della
 * scadenza, altrimenti la pubblicazione si fermerebbe in silenzio.
 */
async function rinnovaTokenInstagramSeNecessario(
  env,
  { forza = false } = {}
) {
  try {
    const serviceAccount = JSON.parse(
      env.FIREBASE_SERVICE_ACCOUNT
    );

    const accessToken =
      await ottieniAccessToken(serviceAccount);

    const configurazione =
      await leggiConfigurazioneInstagram({
        env,
        accessToken
      });

    const tokenAttuale =
      configurazione?.token ||
      env.INSTAGRAM_ACCESS_TOKEN ||
      "";

    if (!tokenAttuale) {
      return {
        token: "",
        rinnovato: false,
        errore: "Token Instagram non configurato."
      };
    }

    const rinnovatoIl = configurazione?.rinnovatoIl
      ? Date.parse(configurazione.rinnovatoIl)
      : 0;

    if (
      !forza &&
      Number.isFinite(rinnovatoIl) &&
      rinnovatoIl > 0 &&
      Date.now() - rinnovatoIl <
        GIORNI_PRIMA_DEL_RINNOVO * 86400000
    ) {
      return {
        token: tokenAttuale,
        rinnovato: false
      };
    }

    const risposta = await fetch(
      "https://graph.instagram.com/refresh_access_token" +
        `?grant_type=ig_refresh_token` +
        `&access_token=${encodeURIComponent(
          tokenAttuale
        )}`
    );

    const risultato = await risposta.json();

    if (
      !risposta.ok ||
      !risultato.access_token
    ) {
      console.error(
        "Rinnovo token Instagram non riuscito:",
        risultato
      );

      return {
        token: tokenAttuale,
        rinnovato: false,
        errore: messaggioErroreInstagram(risultato)
      };
    }

    await scriviDocumentoConServiceAccount({
      env,
      accessToken,
      percorso: "config/instagram",
      campiAggiornati: [
        "accessToken",
        "rinnovatoIl",
        "scadeIl"
      ],
      fields: {
        accessToken: {
          stringValue: risultato.access_token
        },
        rinnovatoIl: {
          stringValue: new Date().toISOString()
        },
        scadeIl: {
          stringValue: new Date(
            Date.now() +
              (Number(risultato.expires_in) ||
                5184000) *
                1000
          ).toISOString()
        }
      }
    });

    return {
      token: risultato.access_token,
      rinnovato: true
    };
  } catch (errore) {
    console.error(
      "Errore rinnovo token Instagram:",
      errore
    );

    return {
      token: "",
      rinnovato: false,
      errore:
        errore.message ||
        "Errore durante il rinnovo del token Instagram."
    };
  }
}

function base64InBytes(base64) {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);

  for (let i = 0; i < binario.length; i += 1) {
    bytes[i] = binario.charCodeAt(i);
  }

  return bytes;
}

function messaggioErroreInstagram(risultato) {
  const errore = risultato?.error;

  if (!errore) {
    return "Instagram ha rifiutato la pubblicazione.";
  }

  return (
    errore.error_user_msg ||
    errore.message ||
    "Instagram ha rifiutato la pubblicazione."
  );
}

/*
 * Dati del profilo collegato: servono al pannello per far vedere
 * quale pagina Instagram sta ricevendo gli spotted.
 */
async function informazioniAccountInstagram(token) {
  const risposta = await fetch(
    `https://graph.instagram.com/` +
      `${VERSIONE_API_INSTAGRAM}/me` +
      `?fields=username,account_type,media_count` +
      `&access_token=${encodeURIComponent(token)}`
  );

  const dati = await risposta.json().catch(() => ({}));

  if (!risposta.ok || dati.error) {
    throw new Error(
      messaggioErroreInstagram(dati)
    );
  }

  return {
    username: dati.username || "",
    accountType: dati.account_type || "",
    mediaCount: Number(dati.media_count) || 0
  };
}

/*
 * Pubblica lo spotted su Instagram: salva la card, la espone a un URL
 * pubblico (Instagram scarica l'immagine da li') e chiama media +
 * media_publish.
 */
async function pubblicaImmagineSuInstagram({
  token,
  imageUrl,
  caption
}) {
  const creazione = await fetch(
    `https://graph.instagram.com/` +
      `${VERSIONE_API_INSTAGRAM}/me/media`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: token
      })
    }
  );

  const contenitore = await creazione
    .json()
    .catch(() => ({}));

  if (!creazione.ok || !contenitore.id) {
    console.error(
      "Instagram ha rifiutato il contenitore:",
      contenitore
    );

    throw new Error(
      messaggioErroreInstagram(contenitore)
    );
  }

  const pubblicazione = await fetch(
    `https://graph.instagram.com/` +
      `${VERSIONE_API_INSTAGRAM}/me/media_publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        creation_id: contenitore.id,
        access_token: token
      })
    }
  );

  const pubblicato = await pubblicazione
    .json()
    .catch(() => ({}));

  if (!pubblicazione.ok || !pubblicato.id) {
    console.error(
      "Instagram non ha pubblicato il contenitore:",
      pubblicato
    );

    throw new Error(
      messaggioErroreInstagram(pubblicato)
    );
  }

  let permalink = "";

  try {
    const informazioni = await fetch(
      `https://graph.instagram.com/` +
        `${VERSIONE_API_INSTAGRAM}/` +
        `${encodeURIComponent(pubblicato.id)}` +
        `?fields=permalink` +
        `&access_token=${encodeURIComponent(token)}`
    );

    const dati = await informazioni
      .json()
      .catch(() => ({}));

    permalink = dati.permalink || "";
  } catch (errore) {
    console.warn(
      "Permalink Instagram non recuperato:",
      errore
    );
  }

  return {
    mediaId: pubblicato.id,
    permalink
  };
}

/*
 * Pubblica lo spotted su Instagram usando la card gia' disegnata e
 * salvata dal pannello.
 */
async function pubblicaSuInstagram({
  env,
  accessToken,
  origin,
  postId,
  caption,
  immagineBase64,
  token
}) {
  /*
   * Lo spotted puo' essere ancora in attesa di approvazione: in quel
   * caso la card viene pubblicata su Instagram e il mediaId finisce sul
   * documento pending, cosi' l'approvazione lo copia nel post e un
   * secondo tentativo non pubblica due volte.
   */
  let percorsoDocumento =
    `posts/${encodeURIComponent(postId)}`;

  let documentoPost =
    await leggiDocumentoConServiceAccount({
      env,
      accessToken,
      percorso: percorsoDocumento
    });

  if (!documentoPost) {
    percorsoDocumento =
      `pendingPosts/${encodeURIComponent(postId)}`;

    documentoPost =
      await leggiDocumentoConServiceAccount({
        env,
        accessToken,
        percorso: percorsoDocumento
      });
  }

  if (!documentoPost) {
    const errore = new Error(
      "Lo spotted non esiste più: potrebbe essere stato rifiutato."
    );

    errore.status = 404;
    throw errore;
  }

  const campiInstagram =
    documentoPost.fields?.instagram?.mapValue
      ?.fields || {};

  const mediaEsistente = valoreFirestore(
    campiInstagram.mediaId
  );

  if (mediaEsistente) {
    const permalinkEsistente =
      valoreFirestore(campiInstagram.permalink) || "";

    return {
      mediaId: mediaEsistente,
      permalink: permalinkEsistente,
      instagram: {
        mediaId: mediaEsistente,
        permalink: permalinkEsistente,
        caption:
          valoreFirestore(campiInstagram.caption) || "",
        publishedAt:
          valoreFirestore(
            campiInstagram.publishedAt
          ) || ""
      },
      giaPubblicato: true
    };
  }

  await scriviDocumentoConServiceAccount({
    env,
    accessToken,
    percorso: `instagramMedia/${encodeURIComponent(
      postId
    )}`,
    campiAggiornati: [
      "postId",
      "jpegBase64",
      "createdAt"
    ],
    fields: {
      postId: { stringValue: postId },
      jpegBase64: {
        stringValue: immagineBase64
      },
      createdAt: {
        stringValue: new Date().toISOString()
      }
    }
  });

  const imageUrl =
    `${origin}/media/${encodeURIComponent(postId)}.jpg`;

  const { mediaId, permalink } =
    await pubblicaImmagineSuInstagram({
      token,
      imageUrl,
      caption
    });

  const datiInstagram = {
    mediaId,
    permalink,
    caption,
    publishedAt: new Date().toISOString()
  };

  await scriviDocumentoConServiceAccount({
    env,
    accessToken,
    percorso: percorsoDocumento,
    campiAggiornati: ["instagram"],
    fields: {
      instagram: {
        mapValue: {
          fields: {
            mediaId: {
              stringValue: datiInstagram.mediaId
            },
            permalink: {
              stringValue: datiInstagram.permalink
            },
            caption: {
              stringValue: datiInstagram.caption
            },
            publishedAt: {
              stringValue:
                datiInstagram.publishedAt
            }
          }
        }
      }
    }
  });

  return {
    mediaId: datiInstagram.mediaId,
    permalink: datiInstagram.permalink,
    instagram: datiInstagram
  };
}

/* ------------------------------------------------------------------ *
 * Instagram: bozze generate dall'IA
 * ------------------------------------------------------------------ */

/*
 * Legge le bozze ancora da approvare. Una sola query senza filtri:
 * cosi' non serve creare indici Firestore, il filtro e l'ordinamento
 * li fa il Worker.
 */
async function elencaBozzeInstagram({
  env,
  accessToken
}) {
  const endpoint =
    `https://firestore.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/databases/(default)/` +
    `documents:runQuery`;

  const risposta = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [
          {
            collectionId: "instagramDrafts",
            allDescendants: false
          }
        ],
        limit: 50
      }
    })
  });

  const risultato = await risposta
    .json()
    .catch(() => null);

  if (!risposta.ok || !Array.isArray(risultato)) {
    console.error(
      "Errore lettura bozze Instagram:",
      risultato
    );

    return [];
  }

  return risultato
    .filter((elemento) => elemento.document)
    .map((elemento) => {
      const fields = elemento.document.fields || {};

      return {
        id: elemento.document.name.split("/").pop(),
        testo:
          valoreFirestore(fields.testo) || "",
        caption:
          valoreFirestore(fields.caption) || "",
        stato: valoreFirestore(fields.stato) || "",
        fonte: valoreFirestore(fields.fonte) || "",
        createdAt:
          valoreFirestore(fields.createdAt) || "",
        mediaId:
          valoreFirestore(fields.mediaId) || "",
        permalink:
          valoreFirestore(fields.permalink) || "",
        publishedAt:
          valoreFirestore(fields.publishedAt) || ""
      };
    })
    .filter((bozza) => bozza.stato === "bozza")
    .sort((a, b) =>
      String(b.createdAt).localeCompare(
        String(a.createdAt)
      )
    )
    .slice(0, 20);
}

/*
 * Estrae le bozze dal testo restituito dal modello. I modelli a volte
 * incapsulano il JSON tra backtick o aggiungono una frase: si prova il
 * parse diretto e poi quello del primo oggetto JSON.
 */
function estraiBozze(contenuto, massimo) {
  const pulito = String(contenuto || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  let dati = null;

  try {
    dati = JSON.parse(pulito);
  } catch {
    const inizio = pulito.indexOf("{");
    const fine = pulito.lastIndexOf("}");

    if (inizio >= 0 && fine > inizio) {
      try {
        dati = JSON.parse(
          pulito.slice(inizio, fine + 1)
        );
      } catch {
        dati = null;
      }
    }
  }

  const elenco = Array.isArray(dati)
    ? dati
    : Array.isArray(dati?.bozze)
      ? dati.bozze
      : Array.isArray(dati?.posts)
        ? dati.posts
        : [];

  const visti = new Set();
  const bozze = [];

  for (const voce of elenco) {
    const testo = String(
      voce?.testo || voce?.text || ""
    )
      .replace(/\s+/g, " ")
      .trim();

    const caption = String(
      voce?.caption || voce?.descrizione || ""
    )
      .replace(/\r/g, "")
      .trim()
      .slice(0, 2000);

    if (testo.length < 20 || !caption) continue;

    const chiave = testo.toLowerCase();

    if (visti.has(chiave)) continue;

    visti.add(chiave);

    bozze.push({
      testo: testo.slice(0, 280),
      caption
    });

    if (bozze.length >= massimo) break;
  }

  return bozze;
}

/*
 * Chiede all'IA nuovi contenuti per il profilo: legge gli ultimi
 * spotted come riferimento di tono, applica le skill attive e salva le
 * bozze in attesa di approvazione.
 */
async function generaBozzeInstagram({
  env,
  accessToken,
  quantita
}) {
  const apiKey = env.OPENAI_API_KEY || "";

  if (!apiKey) {
    const errore = new Error(
      "IA non configurata: aggiungi la chiave OPENAI_API_KEY nei secret del Worker."
    );

    errore.status = 503;
    throw errore;
  }

  const modello =
    env.AI_MODEL || AI_MODELLO_PREDEFINITO;

  const configurazione =
    await leggiConfigurazioneInstagram({
      env,
      accessToken
    });

  const attive =
    configurazione?.aiSkills?.length
      ? configurazione.aiSkills
      : SKILL_ATTIVE_PREDEFINITE;

  const skills = SKILL_INSTAGRAM.filter((skill) =>
    attive.includes(skill.id)
  );

  const inizioISO = new Date(
    Date.now() - 45 * 86400000
  ).toISOString();

  const recenti = await recuperaAnteprimePost({
    env,
    accessToken,
    inizioISO,
    limite: 40
  });

  const elencoRecenti =
    recenti
      .map(
        (spotted, indice) =>
          `${indice + 1}. ${spotted.text}`
      )
      .join("\n") || "Nessuno spotted recente.";

  const istruzioniSkill = skills
    .map(
      (skill) =>
        `### ${skill.nome}\n${skill.istruzioni}`
    )
    .join("\n\n");

  const messaggioSistema = [
    "Sei il social media editor di Spotted Bologna, la pagina Instagram degli spotted universitari e della vita bolognese.",
    "Scrivi in italiano, con un tono naturale e diretto: come una persona che parla, non come un'agenzia.",
    "Regole assolute:\n- Non inventare fatti, numeri, prezzi, nomi, citazioni o esperienze: niente dati attribuiti a persone o locali reali.\n- Niente pubblicita', link, contatti, offerte o inviti a scrivere in privato.\n- Non citare marchi o persone reali.\n- Il testo della card sta in 1-3 frasi brevi, massimo 280 caratteri, senza emoji.\n- La caption ha i primi 125 caratteri utili da soli, massimo 2 emoji e massimo 8 hashtag pertinenti.\n- Mai 'nuovo post', 'sono felice di condividere' o frasi generiche.\n- Un solo invito all'azione nella caption.",
    `Skill attive da seguire:\n\n${istruzioniSkill}`
  ].join("\n\n");

  const messaggioUtente = [
    `Proponi ${quantita} nuovi contenuti per un post immagine singolo del profilo.`, 
    "Ogni contenuto deve essere autonomo, adatto a una card quadrata con testo grande e a un pubblico di studenti a Bologna.",
    "Spunti non vincolanti dagli ultimi spotted (solo per tono e temi, non copiarli):",
    elencoRecenti,
    'Rispondi SOLO con JSON valido in questa forma: {"bozze":[{"testo":"testo della card","caption":"descrizione con hashtag"}]}'
  ].join("\n\n");

  const risposta = await fetch(
    env.AI_CHAT_URL || AI_CHAT_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modello,
        temperature: 0.8,
        messages: [
          {
            role: "system",
            content: messaggioSistema
          },
          {
            role: "user",
            content: messaggioUtente
          }
        ],
        response_format: {
          type: "json_object"
        }
      })
    }
  );

  const risultato = await risposta
    .json()
    .catch(() => ({}));

  if (!risposta.ok) {
    console.error(
      "IA ha rifiutato la generazione:",
      risultato
    );

    const errore = new Error(
      risultato?.error?.message ||
        "L'IA non ha risposto. Riprova tra poco."
    );

    errore.status = 502;
    throw errore;
  }

  const contenuto =
    risultato?.choices?.[0]?.message?.content || "";

  const bozze = estraiBozze(
    contenuto,
    quantita
  );

  if (bozze.length === 0) {
    const errore = new Error(
      "L'IA non ha restituito bozze valide. Riprova."
    );

    errore.status = 502;
    throw errore;
  }

  const adesso = new Date().toISOString();
  const create = [];

  for (const bozza of bozze) {
    const creato =
      await creaDocumentoConServiceAccount({
        env,
        accessToken,
        collectionId: "instagramDrafts",
        fields: {
          testo: {
            stringValue: bozza.testo
          },
          caption: {
            stringValue: bozza.caption
          },
          stato: {
            stringValue: "bozza"
          },
          fonte: {
            stringValue: "ai"
          },
          modello: {
            stringValue: modello
          },
          skills: {
            arrayValue: {
              values: skills.map((skill) => ({
                stringValue: skill.id
              }))
            }
          },
          createdAt: {
            stringValue: adesso
          }
        }
      });

    create.push({
      id: creato?.name?.split("/").pop() || "",
      ...bozza,
      stato: "bozza",
      fonte: "ai",
      createdAt: adesso
    });
  }

  return {
    modello,
    skills: skills.map((skill) => skill.id),
    bozze: create
  };
}

async function recuperaAmministratori({
  env,
  accessToken
}) {
  const endpoint =
    `https://firestore.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/databases/(default)/` +
    `documents:runQuery`;

  const risposta = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [
          {
            collectionId: "users",
            allDescendants: false
          }
        ],
        where: {
          fieldFilter: {
            field: {
              fieldPath: "role"
            },
            op: "EQUAL",
            value: {
              stringValue: "admin"
            }
          }
        }
      }
    })
  });

  const risultato = await risposta.json();

  if (!risposta.ok) {
    console.error(
      "Errore ricerca amministratori:",
      risultato
    );

    throw new Error(
      "Impossibile recuperare gli amministratori."
    );
  }

  return risultato
    .filter((elemento) => elemento.document)
    .map((elemento) => {
      const documento = elemento.document;
      const fields = documento.fields || {};

      return {
        uid:
          documento.name.split("/").pop(),
        role:
          valoreFirestore(fields.role),
        notifyPending:
  valoreFirestore(
    fields.notifyPending
  ),
notifyReports:
  valoreFirestore(
    fields.notifyReports
  ),
notifyNewUsers:
  valoreFirestore(
    fields.notifyNewUsers
  ),
notifyNewPosts:
  valoreFirestore(
    fields.notifyNewPosts
  ),
adminNotificationsConfigured:
  valoreFirestore(
    fields.adminNotificationsConfigured
  ),
notifyAllComments:
  valoreFirestore(
    fields.notifyAllComments
  ),
notifyAllLikes:
  valoreFirestore(
    fields.notifyAllLikes
  ),
newsletter:
  valoreFirestore(
    fields.newsletter
  )
      };
    });
}

async function creaNotificaInterna({
  env,
  accessToken,
  userId,
  type,
  title,
  body,
  postId = null,
  notificationId = null,
  adminOnly = false,
  previews = []
}) {
  /*
   * Con un ID esplicito la notifica viene creata una volta sola: se il
   * documento esiste gia' (stesso evento, stesso utente) Firestore
   * risponde 409 e la push non parte. E' quello che impedisce ai
   * riepiloghi e alle notifiche di commenti/like di arrivare doppi.
   */
  const suffisso = notificationId
    ? `?documentId=${encodeURIComponent(
        notificationId
      )}`
    : "";

  const endpoint =
    `https://firestore.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/databases/(default)/` +
    `documents/notifications${suffisso}`;

  const fields = {
    userId: {
      stringValue: userId
    },
    type: {
      stringValue: type
    },
    title: {
      stringValue: title
    },
    body: {
      stringValue: body
    },
    read: {
      booleanValue: false
    },
    adminOnly: {
      booleanValue: adminOnly === true
    },
    createdAt: {
      stringValue:
        new Date().toISOString()
    }
  };

  if (postId) {
    fields.postId = {
      stringValue: postId
    };
  } else {
    fields.postId = {
      nullValue: null
    };
  }

  if (
    Array.isArray(previews) &&
    previews.length > 0
  ) {
    fields.previews = {
      arrayValue: {
        values: previews.map((preview) => ({
          mapValue: {
            fields: {
              postId: {
                stringValue: String(
                  preview.postId || ""
                )
              },
              text: {
                stringValue: String(
                  preview.text || ""
                )
              },
              createdAt: preview.createdAt
                ? {
                    stringValue:
                      preview.createdAt
                  }
                : {
                    nullValue: null
                  }
            }
          }
        }))
      }
    };
  }

  const risposta = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization:
        `Bearer ${accessToken}`,
      "Content-Type":
        "application/json"
    },
    body: JSON.stringify({
      fields
    })
  });

  if (risposta.status === 409) {
    return null;
  }

  const risultato = await risposta.json();

  if (!risposta.ok) {
    console.error(
      "Errore creazione notifica interna:",
      risultato
    );

    throw new Error(
      "Impossibile creare la notifica interna."
    );
  }

  return risultato;
}

async function prenotaInvioPending({
  env,
  accessToken,
  pendingPostId
}) {
  const dispatchId =
    `pending_${pendingPostId}`;

  const endpoint =
    `https://firestore.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/databases/(default)/` +
    `documents/pushDispatches` +
    `?documentId=${encodeURIComponent(dispatchId)}`;

  const risposta = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization:
        `Bearer ${accessToken}`,
      "Content-Type":
        "application/json"
    },
    body: JSON.stringify({
      fields: {
        type: {
          stringValue: "pending"
        },
        sourceId: {
          stringValue: pendingPostId
        },
        createdAt: {
          timestampValue:
            new Date().toISOString()
        }
      }
    })
  });

  if (risposta.status === 409) {
    return false;
  }

  const risultato = await risposta.json();

  if (!risposta.ok) {
    console.error(
      "Errore prenotazione invio:",
      risultato
    );

    throw new Error(
      "Impossibile registrare l'invio della notifica."
    );
  }

  return true;
}

async function prenotaInvioSegnalazione({
  env,
  accessToken,
  pendingPostId
}) {
  const dispatchId =
    `report_${pendingPostId}`;

  const endpoint =
    `https://firestore.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/databases/(default)/` +
    `documents/pushDispatches` +
    `?documentId=${encodeURIComponent(dispatchId)}`;

  const risposta = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization:
        `Bearer ${accessToken}`,
      "Content-Type":
        "application/json"
    },
    body: JSON.stringify({
      fields: {
        type: {
          stringValue: "report"
        },
        sourceId: {
          stringValue: pendingPostId
        },
        createdAt: {
          timestampValue:
            new Date().toISOString()
        }
      }
    })
  });

  if (risposta.status === 409) {
    return false;
  }

  const risultato =
    await risposta.json();

  if (!risposta.ok) {
    console.error(
      "Errore prenotazione notifica segnalazione:",
      risultato
    );

    throw new Error(
      "Impossibile registrare la notifica della segnalazione."
    );
  }

  return true;
}

async function prenotaInvioNuovoUtente({
  env,
  accessToken,
  userId
}) {
  const dispatchId =
    `newUser_${userId}`;

  const endpoint =
    `https://firestore.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/databases/(default)/` +
    `documents/pushDispatches` +
    `?documentId=${encodeURIComponent(
      dispatchId
    )}`;

  const risposta = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization:
        `Bearer ${accessToken}`,
      "Content-Type":
        "application/json"
    },
    body: JSON.stringify({
      fields: {
        type: {
          stringValue: "newUser"
        },
        sourceId: {
          stringValue: userId
        },
        createdAt: {
          timestampValue:
            new Date().toISOString()
        }
      }
    })
  });

  if (risposta.status === 409) {
    return false;
  }

  const risultato =
    await risposta.json();

  if (!risposta.ok) {
    console.error(
      "Errore prenotazione notifica nuovo utente:",
      risultato
    );

    throw new Error(
      "Impossibile registrare la notifica del nuovo utente."
    );
  }

  return true;
}

/*
 * Prenota l'invio di una notifica gia' salvata nell'app.
 *
 * pushDispatches e' scrivibile solo dal service account, quindi il
 * "lucchetto" vale anche quando la notifica viene richiesta piu' volte
 * (per esempio riaprendo o ricaricando la pagina): la seconda richiesta
 * trova il documento e non manda nulla.
 */
async function prenotaInvioNotifica({
  env,
  accessToken,
  notificationId
}) {
  const dispatchId =
    `notif_${notificationId}`;

  const endpoint =
    `https://firestore.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/databases/(default)/` +
    `documents/pushDispatches` +
    `?documentId=${encodeURIComponent(
      dispatchId
    )}`;

  const risposta = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization:
        `Bearer ${accessToken}`,
      "Content-Type":
        "application/json"
    },
    body: JSON.stringify({
      fields: {
        type: {
          stringValue: "notification"
        },
        sourceId: {
          stringValue: notificationId
        },
        createdAt: {
          timestampValue:
            new Date().toISOString()
        }
      }
    })
  });

  if (risposta.status === 409) {
    return false;
  }

  if (!risposta.ok) {
    /*
     * Un errore di prenotazione non deve bloccare la notifica: meglio
     * rischiare un duplicato che perdere l'avviso.
     */
    console.error(
      "Errore prenotazione notifica:",
      await risposta.text()
    );
  }

  return true;
}

/*
 * Aggiorna publicStats/community.numeroIscritti con il numero reale di
 * documenti in "users" (aggregazione count). Essendo un conteggio e non
 * un incremento, e' idempotente e si riallinea da solo anche per gli
 * utenti gia' registrati. Gli errori non devono bloccare le notifiche.
 */
async function aggiornaNumeroIscritti({
  env,
  accessToken
}) {
  try {
    const base =
      `https://firestore.googleapis.com/v1/projects/` +
      `${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;

    const rispostaCount = await fetch(
      `${base}:runAggregationQuery`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          structuredAggregationQuery: {
            structuredQuery: {
              from: [
                { collectionId: "users" }
              ]
            },
            aggregations: [
              {
                alias: "totale",
                count: {}
              }
            ]
          }
        })
      }
    );

    const risultatoCount =
      await rispostaCount.json();

    if (!rispostaCount.ok) {
      console.error(
        "Errore conteggio iscritti:",
        risultatoCount
      );
      return null;
    }

    const totale = Number(
      risultatoCount?.[0]?.result
        ?.aggregateFields?.totale
        ?.integerValue
    );

    if (!Number.isFinite(totale)) {
      return null;
    }

    const rispostaScrittura = await fetch(
      `${base}/publicStats/community` +
        `?updateMask.fieldPaths=numeroIscritti` +
        `&updateMask.fieldPaths=updatedAt`,
      {
        method: "PATCH",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          fields: {
            numeroIscritti: {
              integerValue:
                String(totale)
            },
            updatedAt: {
              timestampValue:
                new Date().toISOString()
            }
          }
        })
      }
    );

    if (!rispostaScrittura.ok) {
      console.error(
        "Errore scrittura numeroIscritti:",
        await rispostaScrittura.text()
      );
      return null;
    }

    return totale;
  } catch (errore) {
    console.error(
      "Errore aggiornamento numeroIscritti:",
      errore
    );
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Notifiche agli amministratori
 * ------------------------------------------------------------------ */

const PREFERENZA_ADMIN = {
  "new-user": "notifyNewUsers",
  "new-post": "notifyNewPosts",
  pending: "notifyPending",
  report: "notifyReports"
};

/*
 * ID stabile della notifica per un singolo admin, cosi' lo stesso
 * evento (spotted da approvare, segnalazione, nuovo iscritto) non gli
 * viene recapitato due volte quando la pagina viene ricaricata.
 */
function idNotificaAdmin({
  type,
  postId,
  attore,
  adminUid
}) {
  if (postId) {
    return `${type}_${postId}_${adminUid}`;
  }

  return `${type}_${attore.uid}_${adminUid}`;
}

/*
 * Notifica tutti gli amministratori che hanno attiva la preferenza per
 * quel tipo di evento.
 *
 * Prima lo faceva il browser dell'autore: ma un utente normale non
 * puo' leggere la collezione users (regole Firestore), quindi elenco e
 * preferenze degli admin erano invisibili e le notifiche non
 * partivano. Con il service account funziona per tutti.
 */
async function notificaAmministratoriServer({
  env,
  accessToken,
  attore,
  type,
  title,
  testo,
  postId = null,
  inviaPush = true
}) {
  const campo = PREFERENZA_ADMIN[type];

  if (!campo) {
    throw new Error(
      "Tipo di notifica per gli amministratori non valido."
    );
  }

  const amministratori =
    await recuperaAmministratori({
      env,
      accessToken
    });

  const abilitati = amministratori.filter(
    (admin) => {
      /* Chi si iscrive non deve ricevere la notifica di se stesso. */
      if (
        type === "new-user" &&
        admin.uid === attore.uid
      ) {
        return false;
      }

      if (admin.adminNotificationsConfigured) {
        return admin[campo] !== false;
      }

      return true;
    }
  );

  let notificate = 0;
  let pushInviate = 0;
  let pushFallite = 0;

  for (const admin of abilitati) {
    const notificationId = idNotificaAdmin({
      type,
      postId,
      attore,
      adminUid: admin.uid
    });

    try {
      const notifica =
        await creaNotificaInterna({
          env,
          accessToken,
          userId: admin.uid,
          type,
          title,
          body: testo,
          postId,
          notificationId,
          adminOnly: true
        });

      if (!notifica) continue;

      notificate += 1;

      if (!inviaPush) continue;

      /*
       * "Nuovi post pubblicati" e' l'unico avviso che ha un
       * equivalente nel riepilogo: chi ha scelto giornaliera o
       * settimanale lo trova li' e non riceve anche la push
       * immediata. La preferenza "Immediata" controlla proprio
       * questa push. Pending, segnalazioni e nuovi iscritti restano
       * invece sempre immediati.
       */
      if (
        type === "new-post" &&
        admin.newsletter !== "immediata"
      ) {
        continue;
      }

      const push = await inviaPushAUtente({
        env,
        accessToken,
        recipientUserId: admin.uid,
        title,
        body: testo,
        url: "/",
        notificationId,
        postId: postId || ""
      });

      pushInviate += push.sent;
      pushFallite += push.failed;
    } catch (errore) {
      console.error(
        "Notifica admin non inviata a",
        admin.uid,
        errore
      );
    }
  }

  return {
    admins: amministratori.length,
    enabled: abilitati.length,
    notificate,
    pushInviate,
    pushFallite
  };
}

/* ------------------------------------------------------------------ *
 * Notifiche per commenti e like su uno spotted
 * ------------------------------------------------------------------ */

/*
 * Il browser di chi commenta non puo' leggere i profili degli altri
 * utenti (le regole Firestore lo vietano) e quindi non riesce a sapere
 * chi segue lo spotted ne' quali preferenze ha attive: le notifiche
 * arrivavano solo ad alcune categorie. Qui il service account legge
 * seguaci e preferenze e scrive le notifiche al posto loro.
 */
async function recuperaFollowerPost({
  env,
  accessToken,
  postId
}) {
  const endpoint =
    `https://firestore.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/databases/(default)/` +
    `documents:runQuery`;

  const risposta = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [
          {
            collectionId: "postFollowers",
            allDescendants: false
          }
        ],
        where: {
          fieldFilter: {
            field: {
              fieldPath: "postId"
            },
            op: "EQUAL",
            value: {
              stringValue: postId
            }
          }
        }
      }
    })
  });

  const risultato = await risposta.json();

  if (!risposta.ok) {
    console.error(
      "Errore ricerca seguaci dello spotted:",
      risultato
    );

    return [];
  }

  return risultato
    .filter((elemento) => elemento.document)
    .map((elemento) =>
      valoreFirestore(
        elemento.document.fields?.userId
      )
    )
    .filter(
      (userId) =>
        typeof userId === "string" &&
        userId !== ""
    );
}

/*
 * Tutti i profili, con le preferenze di notifica.
 */
async function recuperaProfiliUtenti({
  env,
  accessToken
}) {
  const endpoint =
    `https://firestore.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/databases/(default)/` +
    `documents:runQuery`;

  const risposta = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [
          {
            collectionId: "users",
            allDescendants: false
          }
        ]
      }
    })
  });

  const risultato = await risposta.json();

  if (!risposta.ok) {
    console.error(
      "Errore lettura profili:",
      risultato
    );

    throw new Error(
      "Impossibile leggere i profili degli utenti."
    );
  }

  return risultato
    .filter((elemento) => elemento.document)
    .map((elemento) => {
      const documento = elemento.document;
      const fields = documento.fields || {};

      return {
        uid: documento.name.split("/").pop(),
        nickname:
          valoreFirestore(fields.nickname),
        role: valoreFirestore(fields.role),
        newsletter:
          valoreFirestore(fields.newsletter),
        notifyAllComments: valoreFirestore(
          fields.notifyAllComments
        ),
        notifyAllLikes: valoreFirestore(
          fields.notifyAllLikes
        )
      };
    });
}

/*
 * Notifica immediata di un commento o di un like.
 *
 * Destinatari: chi segue lo spotted, sempre (se segui uno spotted vuoi
 * sapere sia dei like sia dei commenti), piu' gli amministratori che
 * hanno attivato “tutti i commenti” / “tutti i like”.
 */
/*
 * Anteprima breve del testo di uno spotted, per far capire subito a
 * quale spotted si riferisce una notifica di commento o di like.
 */
function anteprimaTesto(testo, massimo = 70) {
  const pulito = String(testo || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!pulito) return "";

  return pulito.length > massimo
    ? `${pulito.slice(0, massimo).trim()}…`
    : pulito;
}

/*
 * Documenti di una collezione con un campo uguale a un valore.
 * Una sola query: serve sia per i like di uno spotted sia per
 * rinominare in blocco commenti e like di un utente.
 */
async function recuperaDocumentiPerCampo({
  env,
  accessToken,
  collectionId,
  campo,
  valore
}) {
  const endpoint =
    `https://firestore.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/databases/(default)/` +
    `documents:runQuery`;

  const risposta = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [
          {
            collectionId,
            allDescendants: false
          }
        ],
        where: {
          fieldFilter: {
            field: {
              fieldPath: campo
            },
            op: "EQUAL",
            value: {
              stringValue: valore
            }
          }
        }
      }
    })
  });

  const risultato = await risposta.json();

  if (!risposta.ok) {
    console.error(
      "Errore ricerca documenti:",
      collectionId,
      risultato
    );

    return [];
  }

  if (!Array.isArray(risultato)) return [];

  return risultato
    .filter((elemento) => elemento.document)
    .map((elemento) => ({
      name: elemento.document.name,
      fields: elemento.document.fields || {}
    }));
}

/*
 * Aggiorna più documenti in una sola richiesta Firestore.
 *
 * Una PATCH per documento esaurirebbe in fretta il limite di
 * sotto-richieste del piano gratuito: con :commit l'aggiornamento di
 * tutte le attività di un utente costa una sola chiamata.
 */
async function aggiornaDocumentiInBlocco({
  env,
  accessToken,
  documenti
}) {
  if (documenti.length === 0) return 0;

  const endpoint =
    `https://firestore.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/databases/(default)/` +
    `documents:commit`;

  let aggiornati = 0;

  /* Il limite Firestore e' 500 scritture per commit. */
  for (let inizio = 0; inizio < documenti.length; inizio += 400) {
    const lotto = documenti.slice(inizio, inizio + 400);

    const writes = lotto.map((documento) => ({
      update: {
        name: documento.name,
        fields: documento.fields
      },
      updateMask: {
        fieldPaths: Object.keys(
          documento.fields
        )
      }
    }));

    const risposta = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ writes })
    });

    const risultato = await risposta
      .json()
      .catch(() => null);

    if (!risposta.ok) {
      console.error(
        "Errore aggiornamento in blocco:",
        risultato
      );

      throw new Error(
        "Impossibile aggiornare i documenti collegati."
      );
    }

    aggiornati += lotto.length;
  }

  return aggiornati;
}

async function notificaAttivitaPost({
  env,
  accessToken,
  attore,
  type,
  postId,
  eventId,
  testo
}) {
  const campoAdmin =
    type === "like"
      ? "notifyAllLikes"
      : "notifyAllComments";

  const titolo =
    type === "like"
      ? "❤️ Nuovo like"
      : "💬 Nuovo commento";

  const nome =
    (attore.nickname || "Un utente")
      .toString()
      .slice(0, 60);

  /*
   * Il testo dello spotted nell'anteprima: senza, chi riceve la
   * notifica non sa a quale spotted si riferisce il commento o il like.
   */
  const documentoPost =
    await leggiDocumentoConServiceAccount({
      env,
      accessToken,
      percorso: `posts/${postId}`
    }).catch(() => null);

  const anteprima = anteprimaTesto(
    valoreFirestore(
      documentoPost?.fields?.text
    )
  );

  const riferimentoSpotted = anteprima
    ? `«${anteprima}»`
    : "uno spotted che segui";

  const corpoFollower =
    type === "like"
      ? `${nome} ha messo like su ${riferimentoSpotted}`
      : `${nome} ha commentato ${riferimentoSpotted}`;

  const corpoAdmin =
    type === "like"
      ? `${nome} ha messo like su ${riferimentoSpotted}`
      : testo
        ? `${nome}: ${testo}`
        : `${nome} ha commentato ${riferimentoSpotted}`;

  const profili =
    await recuperaProfiliUtenti({
      env,
      accessToken
    });

  const profiloPerUid = new Map(
    profili.map((profilo) => [
      profilo.uid,
      profilo
    ])
  );

  const destinatari = new Map();

  const seguaci =
    await recuperaFollowerPost({
      env,
      accessToken,
      postId
    });

  for (const uid of seguaci) {
    if (uid === attore.uid) continue;

    destinatari.set(uid, {
      body: corpoFollower
    });
  }

  for (const profilo of profili) {
    if (profilo.uid === attore.uid) continue;
    if (profilo.role !== "admin") continue;
    if (profilo[campoAdmin] !== true) continue;
    if (destinatari.has(profilo.uid)) continue;

    destinatari.set(profilo.uid, {
      body: corpoAdmin
    });
  }

  let notificate = 0;
  let pushInviate = 0;
  let pushFallite = 0;

  for (const [uid, dato] of destinatari) {
    const notificationId =
      `activity_${type}_${eventId}_${uid}`;

    try {
      const notifica =
        await creaNotificaInterna({
          env,
          accessToken,
          userId: uid,
          type,
          title: titolo,
          body: dato.body,
          postId,
          notificationId
        });

      if (!notifica) continue;

      notificate += 1;

      const push =
        await inviaPushAUtente({
          env,
          accessToken,
          recipientUserId: uid,
          title: titolo,
          body: dato.body,
          url: "/",
          notificationId,
          postId
        });

      pushInviate += push.sent;
      pushFallite += push.failed;
    } catch (errore) {
      console.error(
        "Notifica attività non inviata a",
        uid,
        errore
      );
    }
  }

  return {
    type,
    postId,
    destinatari: destinatari.size,
    notificate,
    pushInviate,
    pushFallite
  };
}

/* ------------------------------------------------------------------ *
 * Riepiloghi giornalieri e settimanali
 * ------------------------------------------------------------------ */

const FUSO_ITALIA = "Europe/Rome";
const ORA_RIEPILOGO = 14;

/* Data locale italiana nel formato YYYY-MM-DD. */
function dataChiaveItalia(adesso) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_ITALIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(adesso);
}

/* Ora e giorno della settimana in Italia. */
function partiDataItalia(adesso) {
  const parti = new Intl.DateTimeFormat(
    "it-IT",
    {
      timeZone: FUSO_ITALIA,
      hour: "2-digit",
      hourCycle: "h23",
      weekday: "short"
    }
  ).formatToParts(adesso);

  const ora = Number(
    parti.find(
      (parte) => parte.type === "hour"
    )?.value
  );

  const giorno =
    parti.find(
      (parte) => parte.type === "weekday"
    )?.value || "";

  return { ora, giorno };
}

/* Quanti documenti sono stati creati dopo un certo istante. */
async function contaDocumentiCreatiDopo({
  env,
  accessToken,
  collectionId,
  inizioISO
}) {
  const endpoint =
    `https://firestore.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/databases/(default)/` +
    `documents:runAggregationQuery`;

  const risposta = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      structuredAggregationQuery: {
        structuredQuery: {
          from: [
            {
              collectionId,
              allDescendants: false
            }
          ],
          where: {
            fieldFilter: {
              field: {
                fieldPath: "createdAt"
              },
              op: "GREATER_THAN_OR_EQUAL",
              value: {
                stringValue: inizioISO
              }
            }
          }
        },
        aggregations: [
          {
            alias: "totale",
            count: {}
          }
        ]
      }
    })
  });

  const risultato = await risposta.json();

  if (!risposta.ok) {
    console.error(
      `Errore conteggio ${collectionId}:`,
      risultato
    );

    return 0;
  }

  const totale = Number(
    risultato?.[0]?.result
      ?.aggregateFields?.totale
      ?.integerValue
  );

  return Number.isFinite(totale) ? totale : 0;
}

/*
 * Larghezza di una riga di notifica push: oltre questa soglia il testo
 * dello spotted viene tagliato con i puntini, cosi' ogni spotted resta
 * su una riga sola.
 */
const MASSIMO_CARATTERI_RIGA_PUSH = 42;

/*
 * Le push web hanno un limite di circa 4 KB per messaggio: il corpo
 * viene fermato prima, con una riga finale che dice quanti spotted
 * non ci stanno. Il conto e' in byte perche' emoji e accenti pesano
 * piu' di un carattere.
 */
const MASSIMO_BYTE_CORPO_PUSH = 3500;

const codificatoreTestoPush = new TextEncoder();

function byteTestoPush(testo) {
  return codificatoreTestoPush.encode(
    String(testo || "")
  ).length;
}

/*
 * Testo di uno spotted ridotto a una riga: si taglia sull'ultima
 * parola intera e si chiude con i puntini.
 */
function rigaSpottedPush(
  testo,
  massimo = MASSIMO_CARATTERI_RIGA_PUSH
) {
  const pulito = String(testo || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!pulito) return "";

  if (pulito.length <= massimo) return pulito;

  const tagliato = pulito.slice(
    0,
    Math.max(1, massimo - 3)
  );

  const ultimoSpazio = tagliato.lastIndexOf(" ");

  const base =
    ultimoSpazio > massimo * 0.5
      ? tagliato.slice(0, ultimoSpazio)
      : tagliato;

  return `${base.trim()}...`;
}

/*
 * Corpo della push di riepilogo: il conteggio in testa e poi tutti gli
 * spotted del periodo, uno per riga.
 */
function componiCorpoPushRiepilogo({
  spots,
  corpo,
  intestazione,
  righe
}) {
  if (spots === 0 || righe.length === 0) {
    return corpo;
  }

  const voci = righe.map(
    (riga) => `• ${riga}`
  );

  const scelte = [];
  let byteTotali = byteTestoPush(intestazione);

  for (const voce of voci) {
    const byteVoce = byteTestoPush(voce) + 1;

    /*
     * Si tiene spazio per la riga finale "...e altri N spotted".
     */
    if (
      byteTotali + byteVoce >
      MASSIMO_BYTE_CORPO_PUSH - 40
    ) {
      break;
    }

    scelte.push(voce);
    byteTotali += byteVoce;
  }

  const mancanti = voci.length - scelte.length;

  if (mancanti > 0) {
    scelte.push(`...e altri ${mancanti} spotted`);
  }

  return [intestazione, ...scelte].join("\n");
}

/*
 * Recupera gli spotted del periodo per il riepilogo.
 * Una sola query per riepilogo, non una per destinatario.
 */
async function recuperaAnteprimePost({
  env,
  accessToken,
  inizioISO,
  limite = null
}) {
  const endpoint =
    `https://firestore.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/databases/(default)/` +
    `documents:runQuery`;

  const risposta = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [
          {
            collectionId: "posts",
            allDescendants: false
          }
        ],
        where: {
          fieldFilter: {
            field: {
              fieldPath: "createdAt"
            },
            op: "GREATER_THAN_OR_EQUAL",
            value: {
              stringValue: inizioISO
            }
          }
        },
        orderBy: [
          {
            field: {
              fieldPath: "createdAt"
            },
            direction: "DESCENDING"
          }
        ],
        ...(limite ? { limit: limite } : {})
      }
    })
  });

  const risultato = await risposta
    .json()
    .catch(() => null);

  if (!risposta.ok) {
    console.error(
      "Errore anteprime riepilogo:",
      risultato
    );

    return [];
  }

  if (!Array.isArray(risultato)) return [];

  return risultato
    .filter((elemento) => elemento.document)
    .map((elemento) => {
      const documento = elemento.document;
      const fields = documento.fields || {};
      const testo = valoreFirestore(fields.text);
      const createdAt = valoreFirestore(
        fields.createdAt
      );

      if (!testo) return null;

      return {
        postId: documento.name.split("/").pop(),
        text: anteprimaTesto(testo, 140),
        createdAt:
          typeof createdAt === "string"
            ? createdAt
            : ""
      };
    })
    .filter(Boolean);
}

/*
 * Invia il riepilogo a chi ha scelto quella frequenza.
 *
 * period: "daily" (ultime 24 ore) oppure "weekly" (ultimi 7 giorni).
 * L'ID della notifica contiene giorno e utente: se il riepilogo viene
 * ricalcolato (retry del cron, prova manuale) non arriva due volte.
 */
async function eseguiRiepilogo({
  env,
  period,
  dryRun = false
}) {
  const serviceAccount = JSON.parse(
    env.FIREBASE_SERVICE_ACCOUNT
  );

  const accessToken =
    await ottieniAccessToken(serviceAccount);

  const adesso = new Date();

  const settimanale = period === "weekly";

  const durata = settimanale
    ? 7 * 24 * 60 * 60 * 1000
    : 24 * 60 * 60 * 1000;

  const inizioISO = new Date(
    adesso.getTime() - durata
  ).toISOString();

  const spots =
    await contaDocumentiCreatiDopo({
      env,
      accessToken,
      collectionId: "posts",
      inizioISO
    });

  /*
   * Tutti gli spotted del periodo: la push li elenca uno per riga.
   */
  const anteprime =
    await recuperaAnteprimePost({
      env,
      accessToken,
      inizioISO
    });

  const titolo = settimanale
    ? "📅 Riepilogo della settimana"
    : "☀️ Riepilogo di ieri";

  /*
   * Se non e' stato pubblicato nulla, il riepilogo invita a scrivere:
   * una notifica vuota sarebbe solo rumore.
   */
  const corpo =
    spots === 0
      ? "Nessuno nuovo spotted, scrivine uno te!"
      : settimanale
        ? `Questa settimana ${spots} nuovi spotted.`
        : `Ieri ${spots} nuovi spotted.`;

  /*
   * La push elenca tutti gli spotted del periodo, uno per riga e
   * tagliati ai puntini quando superano una riga di notifica.
   */
  const corpoPush = componiCorpoPushRiepilogo({
    spots,
    corpo,
    intestazione: settimanale
      ? `Questa settimana ${spots} nuovi spotted`
      : `Ieri ${spots} nuovi spotted`,
    righe: anteprime
      .map((anteprima) =>
        rigaSpottedPush(anteprima.text)
      )
      .filter(Boolean)
  });

  const preferenza = settimanale
    ? "settimanale"
    : "giornaliera";

  const profili = await recuperaProfiliUtenti({
    env,
    accessToken
  });

  const destinatari = profili.filter(
    (profilo) =>
      profilo.newsletter === preferenza
  );

  const chiave =
    `${settimanale ? "weekly" : "daily"}_` +
    `${dataChiaveItalia(adesso)}`;

  if (dryRun) {
    return {
      period,
      inizio: inizioISO,
      titolo,
      corpo,
      corpoPush,
      previews: anteprime.slice(0, 3),
      spots,
      destinatari: destinatari.length,
      notificate: 0,
      pushInviate: 0,
      pushFallite: 0
    };
  }

  let notificate = 0;
  let pushInviate = 0;
  let pushFallite = 0;

  for (const profilo of destinatari) {
    const notificationId =
      `${chiave}_${profilo.uid}`;

    try {
      const notifica =
        await creaNotificaInterna({
          env,
          accessToken,
          userId: profilo.uid,
          type: "digest",
          title: titolo,
          body: corpo,
          postId: null,
          notificationId,
          previews: anteprime.slice(0, 3)
        });

      if (!notifica) continue;

      notificate += 1;

      const push = await inviaPushAUtente({
        env,
        accessToken,
        recipientUserId: profilo.uid,
        title: titolo,
        body: corpoPush,
        url: "/",
        notificationId,
        postId: ""
      });

      pushInviate += push.sent;
      pushFallite += push.failed;
    } catch (errore) {
      console.error(
        "Riepilogo non inviato a",
        profilo.uid,
        errore
      );
    }
  }

  console.log(
    `Riepilogo ${period} ${chiave}:`,
    spots,
    "spotted,",
    notificate,
    "notifiche,",
    pushInviate,
    "push"
  );

  return {
    period,
    inizio: inizioISO,
    titolo,
    corpo,
    corpoPush,
    previews: anteprime.slice(0, 3),
    spots,
    destinatari: destinatari.length,
    notificate,
    pushInviate,
    pushFallite
  };
}

/*
 * Eseguito dal cron di Cloudflare ogni ora: manda i riepiloghi solo
 * quando in Italia sono le 14 (e la domenica anche quello settimanale).
 * Controllare l'ora qui invece che nel cron mantiene l'orario giusto
 * anche con il cambio dell'ora legale.
 */
async function eseguiRiepiloghiAutomatici(env) {
  const adesso = new Date();
  const { ora, giorno } = partiDataItalia(adesso);

  if (ora !== ORA_RIEPILOGO) {
    return;
  }

  /*
   * Un errore nel riepilogo giornaliero non deve impedire quello
   * settimanale, che la domenica parte subito dopo.
   */
  try {
    await eseguiRiepilogo({
      env,
      period: "daily"
    });
  } catch (errore) {
    console.error(
      "Riepilogo giornaliero non inviato:",
      errore
    );
  }

  if (giorno.toLowerCase().startsWith("dom")) {
    try {
      await eseguiRiepilogo({
        env,
        period: "weekly"
      });
    } catch (errore) {
      console.error(
        "Riepilogo settimanale non inviato:",
        errore
      );
    }
  }
}

export default {
  /*
   * Cron Trigger: ogni ora, l'orario vero viene deciso in
   * eseguiRiepiloghiAutomatici.
   */
  async scheduled(event, env, ctx) {
    const esecuzione = eseguiRiepiloghiAutomatici(
      env
    ).catch((errore) => {
      console.error(
        "Errore riepiloghi automatici:",
        errore
      );
    });

    /*
     * Il token Instagram scade dopo 60 giorni: lo rinnoviamo con lo
     * stesso cron dei riepiloghi, senza bloccare l'invio.
     */
    const manutenzioneInstagram =
      rinnovaTokenInstagramSeNecessario(env).catch(
        (errore) => {
          console.error(
            "Errore manutenzione Instagram:",
            errore
          );
        }
      );

    if (ctx?.waitUntil) {
      ctx.waitUntil(esecuzione);
      ctx.waitUntil(manutenzioneInstagram);
    } else {
      await esecuzione;
      await manutenzioneInstagram;
    }
  },

  async fetch(request, env) {
    const origin =
      request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers:
          creaHeadersCors(origin, env)
      });
    }

    const urlRichiesta =
      new URL(request.url);

    /*
     * Endpoint pubblico di controllo.
     */
    if (
      request.method === "GET" &&
      urlRichiesta.pathname === "/"
    ) {



      return rispostaJson(
        {
          success: true,
          service:
            "Spotted Bologna Push Worker",
          status: "online"
        },
        200,
        origin,
        env
      );
    }

    /*
     * Push di prova richiesta dall'utente autenticato: serve a
     * verificare permesso, token e consegna senza creare una
     * notifica nella campanella. Ogni utente puo' testare solo i
     * propri dispositivi.
     */
    if (
      request.method === "POST" &&
      urlRichiesta.pathname === "/test-push"
    ) {
      try {
        if (origin && !origineInElenco(origin, env)) {
          console.warn(
            "Origine fuori da ALLOWED_ORIGIN:",
            origin
          );
        }

        const idToken = leggiBearerToken(request);

        if (!idToken) {
          return rispostaJson(
            {
              success: false,
              error:
                "Token Firebase Authentication mancante."
            },
            401,
            origin,
            env
          );
        }

        const identita =
          await verificaFirebaseIdToken(
            idToken,
            env
          );

        const risultato =
          await inviaPushAUtente({
            env,
            recipientUserId: identita.uid,
            title: "Spotted Bologna",
            body: "Le notifiche sono attive!",
            url: "/",
            notificationId: "test-push"
          });

        if (risultato.totalDevices === 0) {
          return rispostaJson(
            {
              success: false,
              error:
                "Nessun dispositivo registrato: attiva prima le notifiche push."
            },
            400,
            origin,
            env
          );
        }

        if (risultato.sent === 0) {
          return rispostaJson(
            {
              success: false,
              error:
                "FCM non ha consegnato la notifica. Riprova tra poco.",
              totalDevices:
                risultato.totalDevices,
              sent: 0,
              failed: risultato.failed
            },
            502,
            origin,
            env
          );
        }

        return rispostaJson(
          {
            success: true,
            totalDevices:
              risultato.totalDevices,
            sent: risultato.sent,
            failed: risultato.failed
          },
          200,
          origin,
          env
        );
      } catch (errore) {
        console.error(
          "Errore endpoint /test-push:",
          errore
        );

        return rispostaJson(
          {
            success: false,
            error:
              errore.message ||
              "Errore durante l'invio della notifica di prova."
          },
          500,
          origin,
          env
        );
      }
    }

    /*
     * Immagine pubblica della card: e' l'URL che Instagram scarica
     * quando crea il contenitore. La stessa immagine finisce sul
     * profilo, quindi non c'e' nulla di privato da proteggere.
     */
    if (
      (request.method === "GET" ||
        request.method === "HEAD") &&
      urlRichiesta.pathname.startsWith("/media/") &&
      urlRichiesta.pathname.endsWith(".jpg")
    ) {
      const postId = urlRichiesta.pathname.slice(
        "/media/".length,
        -".jpg".length
      );

      if (!/^[A-Za-z0-9_-]+$/.test(postId)) {
        return new Response("Not found", {
          status: 404
        });
      }

      try {
        const serviceAccount = JSON.parse(
          env.FIREBASE_SERVICE_ACCOUNT
        );

        const accessToken =
          await ottieniAccessToken(serviceAccount);

        const documento =
          await leggiDocumentoConServiceAccount({
            env,
            accessToken,
            percorso:
              `instagramMedia/${encodeURIComponent(
                postId
              )}`
          });

        const base64 = valoreFirestore(
          documento?.fields?.jpegBase64
        );

        if (!base64) {
          return new Response("Not found", {
            status: 404
          });
        }

        return new Response(base64InBytes(base64), {
          status: 200,
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control":
              "public, max-age=31536000, immutable"
          }
        });
      } catch (errore) {
        console.error(
          "Errore immagine Instagram:",
          errore
        );

        return new Response("Errore immagine", {
          status: 500
        });
      }
    }

    /*
     * Endpoint per inviare una push a tutti i dispositivi
     * di un determinato utente.
     *
     * In questa fase è utilizzabile soltanto dall'admin.
     */
    if (
      request.method === "POST" &&
      urlRichiesta.pathname ===
        "/send-to-user"
    ) {
      try {
        if (origin && !origineInElenco(origin, env)) {
          console.warn(
            "Origine fuori da ALLOWED_ORIGIN:",
            origin
          );
        }

        const idToken =
          leggiBearerToken(request);

        if (!idToken) {
          return rispostaJson(
            {
              success: false,
              error:
                "Token Firebase Authentication mancante."
            },
            401,
            origin,
            env
          );
        }

        const identita =
          await verificaFirebaseIdToken(
            idToken,
            env
          );

        const profilo =
          await recuperaUtenteFirestore(
            identita.uid,
            idToken,
            env
          );

        if (
          !utenteAmministratore(profilo)
        ) {
          return rispostaJson(
            {
              success: false,
              error:
                "Solo gli amministratori possono usare questo endpoint."
            },
            403,
            origin,
            env
          );
        }

        let corpo;

        try {
          corpo = await request.json();
        } catch {
          return rispostaJson(
            {
              success: false,
              error:
                "Corpo JSON della richiesta non valido."
            },
            400,
            origin,
            env
          );
        }

        const recipientUserId =
          typeof corpo.recipientUserId ===
          "string"
            ? corpo.recipientUserId.trim()
            : "";

        const title =
          typeof corpo.title === "string"
            ? corpo.title.trim()
            : "";

        const body =
          typeof corpo.body === "string"
            ? corpo.body.trim()
            : "";

        if (
          !recipientUserId ||
          !title ||
          !body
        ) {
          return rispostaJson(
            {
              success: false,
              error:
                "recipientUserId, title e body sono obbligatori."
            },
            400,
            origin,
            env
          );
        }

        if (
          recipientUserId.length > 128 ||
          title.length > 100 ||
          body.length > 500
        ) {
          return rispostaJson(
            {
              success: false,
              error:
                "Uno o più campi superano la lunghezza consentita."
            },
            400,
            origin,
            env
          );
        }

        const notificationId =
          typeof corpo.notificationId ===
          "string"
            ? corpo.notificationId.trim()
            : "";

        /*
         * La notifica interna viene salvata prima della push: il suo ID
         * identifica l'evento in modo stabile. Se lo stesso invio viene
         * ripetuto (ricarica della pagina, piu' schede aperte) la
         * prenotazione esiste gia' e il destinatario non riceve una
         * seconda copia.
         */
        if (notificationId) {
          const serviceAccount =
            JSON.parse(
              env.FIREBASE_SERVICE_ACCOUNT
            );

          const accessToken =
            await ottieniAccessToken(
              serviceAccount
            );

          const prenotato =
            await prenotaInvioNotifica({
              env,
              accessToken,
              notificationId
            });

          if (!prenotato) {
            return rispostaJson(
              {
                success: true,
                alreadySent: true,
                recipientUserId,
                notificationId,
                totalDevices: 0,
                sent: 0,
                failed: 0,
                removedTokens: 0,
                results: []
              },
              200,
              origin,
              env
            );
          }
        }

        const risultato =
          await inviaPushAUtente({
            env,
            recipientUserId,
            title,
            body,
            url:
              typeof corpo.url === "string"
                ? corpo.url
                : "/",
            notificationId,
            postId:
              typeof corpo.postId === "string"
                ? corpo.postId
                : ""
          });

        return rispostaJson(
          {
            ...risultato,
            recipientUserId,
            sentBy: identita.uid
          },
          200,
          origin,
          env
        );
      } catch (errore) {
        console.error(
          "Errore endpoint /send-to-user:",
          errore
        );

        return rispostaJson(
          {
            success: false,
            error:
              errore.message ||
              "Errore durante l'invio della push."
          },
          500,
          origin,
          env
        );
      }
    }

if (
  request.method === "POST" &&
  urlRichiesta.pathname ===
    "/notify-pending"
) {
  try {
    if (origin && !origineInElenco(origin, env)) {
      console.warn(
        "Origine fuori da ALLOWED_ORIGIN:",
        origin
      );
    }

    const idToken =
      leggiBearerToken(request);

    if (!idToken) {
      return rispostaJson(
        {
          success: false,
          error:
            "Token Firebase Authentication mancante."
        },
        401,
        origin,
        env
      );
    }

    const identita =
      await verificaFirebaseIdToken(
        idToken,
        env
      );

    let corpo;

    try {
      corpo = await request.json();
    } catch {
      return rispostaJson(
        {
          success: false,
          error:
            "Corpo JSON non valido."
        },
        400,
        origin,
        env
      );
    }

    const pendingPostId =
      typeof corpo.pendingPostId ===
      "string"
        ? corpo.pendingPostId.trim()
        : "";

    if (!pendingPostId) {
      return rispostaJson(
        {
          success: false,
          error:
            "pendingPostId è obbligatorio."
        },
        400,
        origin,
        env
      );
    }

    const serviceAccount = JSON.parse(
      env.FIREBASE_SERVICE_ACCOUNT
    );

    const accessToken =
      await ottieniAccessToken(
        serviceAccount
      );

    const pendingDocumento =
      await leggiDocumentoConServiceAccount({
        env,
        percorso:
          `pendingPosts/` +
          `${encodeURIComponent(
            pendingPostId
          )}`,
        accessToken
      });

    if (!pendingDocumento) {
      return rispostaJson(
        {
          success: false,
          error:
            "Lo spotted pending non esiste."
        },
        404,
        origin,
        env
      );
    }

    const pendingFields =
      pendingDocumento.fields || {};

    const authorId =
      valoreFirestore(
        pendingFields.authorId
      );

    const profiloRichiedente =
      await recuperaUtenteFirestore(
        identita.uid,
        idToken,
        env
      );

    const richiedenteAdmin =
      utenteAmministratore(
        profiloRichiedente
      );

    if (
      authorId !== identita.uid &&
      !richiedenteAdmin
    ) {
      return rispostaJson(
        {
          success: false,
          error:
            "Non puoi notificare uno spotted creato da un altro utente."
        },
        403,
        origin,
        env
      );
    }

    const invioPrenotato =
      await prenotaInvioPending({
        env,
        accessToken, 
        pendingPostId
      });

    if (!invioPrenotato) {
      return rispostaJson(
        {
          success: true,
          alreadySent: true,
          adminsFound: 0,
          internalNotifications: 0,
          pushSent: 0,
          pushFailed: 0
        },
        200,
        origin,
        env
      );
    }

    const amministratori =
      await recuperaAmministratori({
        env,
        accessToken
      });

    const amministratoriAbilitati =
      amministratori.filter(
        (admin) =>
          admin.notifyPending !== false
      );

    let notificheInterneCreate = 0;
    let pushInviate = 0;
    let pushFallite = 0;

    for (
      const admin
      of amministratoriAbilitati
    ) {
      /*
       * Stesso ID della notifica che l'app crea dal browser
       * dell'admin: chi arriva secondo prende un 409 e non duplica.
       */
      const notificaInterna =
        await creaNotificaInterna({
          env,
          accessToken,
          userId: admin.uid,
          type: "pending",
          title:
            "📩 Nuovo spotted pending",
          body:
            "Richiede approvazione",
          postId: pendingPostId,
          notificationId:
            `pending_${pendingPostId}_${admin.uid}`
        });

      if (!notificaInterna) continue;

      notificheInterneCreate += 1;

      /*
       * La push non dipende dalla frequenza dei riepiloghi:
       * una moderazione in attesa va segnalata subito.
       */
      const risultatoPush =
        await inviaPushAUtente({
          env,
          recipientUserId:
            admin.uid,
          title:
            "📩 Nuovo spotted pending",
          body:
            "Un nuovo spotted richiede approvazione.",
          url: "/",
          notificationId:
            `pending_${pendingPostId}`,
          postId:
            pendingPostId
        });

      pushInviate +=
        risultatoPush.sent;

      pushFallite +=
        risultatoPush.failed;
    }

    return rispostaJson(
      {
        success: true,
        alreadySent: false,
        adminsFound:
          amministratori.length,
        adminsEnabled:
          amministratoriAbilitati.length,
        internalNotifications:
          notificheInterneCreate,
        pushSent:
          pushInviate,
        pushFailed:
          pushFallite
      },
      200,
      origin,
      env
    );
  } catch (errore) {
    console.error(
      "Errore endpoint /notify-pending:",
      errore
    );

    return rispostaJson(
      {
        success: false,
        error:
          errore.message ||
          "Errore durante la notifica pending."
      },
      500,
      origin,
      env
    );
  }
}

if (
  request.method === "POST" &&
  urlRichiesta.pathname ===
    "/notify-report"
) {
  try {
    if (origin && !origineInElenco(origin, env)) {
      console.warn(
        "Origine fuori da ALLOWED_ORIGIN:",
        origin
      );
    }

    const idToken =
      leggiBearerToken(request);

    if (!idToken) {
      return rispostaJson(
        {
          success: false,
          error:
            "Token Firebase Authentication mancante."
        },
        401,
        origin,
        env
      );
    }

    await verificaFirebaseIdToken(
      idToken,
      env
    );

    let corpo;

    try {
      corpo = await request.json();
    } catch {
      return rispostaJson(
        {
          success: false,
          error:
            "Corpo JSON non valido."
        },
        400,
        origin,
        env
      );
    }

    const pendingPostId =
      typeof corpo.pendingPostId ===
      "string"
        ? corpo.pendingPostId.trim()
        : "";

    if (!pendingPostId) {
      return rispostaJson(
        {
          success: false,
          error:
            "pendingPostId è obbligatorio."
        },
        400,
        origin,
        env
      );
    }

    const serviceAccount = JSON.parse(
      env.FIREBASE_SERVICE_ACCOUNT
    );

    const accessToken =
      await ottieniAccessToken(
        serviceAccount
      );

    const pendingDocumento =
      await leggiDocumentoConServiceAccount({
        env,
        percorso:
          `pendingPosts/` +
          `${encodeURIComponent(
            pendingPostId
          )}`,
        accessToken
      });

    if (!pendingDocumento) {
      return rispostaJson(
        {
          success: false,
          error:
            "Il documento pending non esiste."
        },
        404,
        origin,
        env
      );
    }

    const pendingFields =
      pendingDocumento.fields || {};

    const flagReason =
      valoreFirestore(
        pendingFields.flagReason
      );

    const originalId =
      valoreFirestore(
        pendingFields.originalId
      );

    if (
      flagReason !==
        "Segnalato dalla community" ||
      !originalId
    ) {
      return rispostaJson(
        {
          success: false,
          error:
            "Il documento non corrisponde a uno spotted segnalato."
        },
        400,
        origin,
        env
      );
    }

    const invioPrenotato =
      await prenotaInvioSegnalazione({
        env,
        accessToken,
        pendingPostId
      });

    if (!invioPrenotato) {
      return rispostaJson(
        {
          success: true,
          alreadySent: true,
          adminsFound: 0,
          adminsEnabled: 0,
          internalNotifications: 0,
          pushSent: 0,
          pushFailed: 0
        },
        200,
        origin,
        env
      );
    }

    const amministratori =
      await recuperaAmministratori({
        env,
        accessToken
      });

    const amministratoriAbilitati =
      amministratori.filter(
        (admin) =>
          admin.notifyReports !== false
      );

    let notificheInterneCreate = 0;
    let pushInviate = 0;
    let pushFallite = 0;

    for (
      const admin
      of amministratoriAbilitati
    ) {
      /*
       * ID stabile per admin: se l'endpoint viene richiamato (doppio
       * clic, retry) la notifica non viene duplicata e la push non
       * riparte.
       */
      const notificationId =
        `report_${pendingPostId}_${admin.uid}`;

      const notifica =
        await creaNotificaInterna({
          env,
          accessToken,
          userId: admin.uid,
          type: "report",
          title:
            "🚩 Spotted segnalato",
          body:
            "Uno spotted ha raggiunto 3 segnalazioni ed è stato rimosso dalla community.",
          /*
           * Lo spotted pubblico e' gia' stato cancellato: senza
           * postId la notifica non offre un collegamento che
           * porterebbe a una card inesistente.
           */
          postId: null,
          notificationId
        });

      if (!notifica) continue;

      notificheInterneCreate += 1;

      const risultatoPush =
        await inviaPushAUtente({
          env,
          recipientUserId:
            admin.uid,
          title:
            "🚩 Spotted segnalato",
          body:
            "Uno spotted ha raggiunto 3 segnalazioni e richiede moderazione.",
          url: "/",
          notificationId,
          postId: ""
        });

      pushInviate +=
        risultatoPush.sent;

      pushFallite +=
        risultatoPush.failed;
    }

    return rispostaJson(
      {
        success: true,
        alreadySent: false,
        adminsFound:
          amministratori.length,
        adminsEnabled:
          amministratoriAbilitati.length,
        internalNotifications:
          notificheInterneCreate,
        pushSent:
          pushInviate,
        pushFailed:
          pushFallite
      },
      200,
      origin,
      env
    );
  } catch (errore) {
    console.error(
      "Errore endpoint /notify-report:",
      errore
    );

    return rispostaJson(
      {
        success: false,
        error:
          errore.message ||
          "Errore durante la notifica della segnalazione."
      },
      500,
      origin,
      env
    );
  }
}

if (
  request.method === "POST" &&
  urlRichiesta.pathname ===
    "/notify-new-user"
) {
  try {
    if (origin && !origineInElenco(origin, env)) {
      console.warn(
        "Origine fuori da ALLOWED_ORIGIN:",
        origin
      );
    }

    const idToken =
      leggiBearerToken(request);

    if (!idToken) {
      return rispostaJson(
        {
          success: false,
          error:
            "Token Firebase Authentication mancante."
        },
        401,
        origin,
        env
      );
    }

    const identita =
      await verificaFirebaseIdToken(
        idToken,
        env
      );

    const serviceAccount = JSON.parse(
      env.FIREBASE_SERVICE_ACCOUNT
    );

    const accessToken =
      await ottieniAccessToken(
        serviceAccount
      );

    /*
     * Il profilo deve esistere davvero in Firestore.
     * Nome e nickname si leggono da qui, mai dal corpo
     * della richiesta, cosi' non sono falsificabili.
     */
    const documentoUtente =
      await leggiDocumentoConServiceAccount({
        env,
        percorso:
          `users/${encodeURIComponent(
            identita.uid
          )}`,
        accessToken
      });

    if (!documentoUtente) {
      return rispostaJson(
        {
          success: false,
          error:
            "Il profilo del nuovo utente non esiste."
        },
        404,
        origin,
        env
      );
    }

    const fields =
      documentoUtente.fields || {};

    const uidDocumento =
      valoreFirestore(fields.uid);

    if (
      uidDocumento &&
      uidDocumento !== identita.uid
    ) {
      return rispostaJson(
        {
          success: false,
          error:
            "Il profilo non corrisponde all'utente autenticato."
        },
        403,
        origin,
        env
      );
    }

    /*
     * Contatore pubblico: e' un conteggio reale, quindi puo'
     * essere aggiornato anche se la notifica era gia' partita.
     */
    const numeroIscritti =
      await aggiornaNumeroIscritti({
        env,
        accessToken
      });

    const invioPrenotato =
      await prenotaInvioNuovoUtente({
        env,
        accessToken,
        userId: identita.uid
      });

    if (!invioPrenotato) {
      return rispostaJson(
        {
          success: true,
          alreadySent: true,
          numeroIscritti,
          adminsFound: 0,
          adminsEnabled: 0,
          internalNotifications: 0,
          pushSent: 0,
          pushFailed: 0
        },
        200,
        origin,
        env
      );
    }

    const nome =
      valoreFirestore(fields.name);

    const nickname =
      valoreFirestore(fields.nickname);

    const descrizioneUtente =
      (nickname || nome || "Un nuovo utente")
        .toString()
        .slice(0, 60);

    const amministratori =
      await recuperaAmministratori({
        env,
        accessToken
      });

    const amministratoriAbilitati =
      amministratori.filter(
        (admin) =>
          admin.notifyNewUsers !== false &&
          admin.uid !== identita.uid
      );

    let notificheInterneCreate = 0;
    let pushInviate = 0;
    let pushFallite = 0;

    for (
      const admin
      of amministratoriAbilitati
    ) {
      /*
       * Un errore su un admin non deve impedire la notifica
       * agli altri: l'invio e' gia' stato prenotato, quindi
       * un secondo tentativo non verrebbe eseguito.
       */
      try {
        await creaNotificaInterna({
          env,
          accessToken,
          userId: admin.uid,
          type: "newUser",
          title: "👤 Nuovo iscritto",
          body:
            `${descrizioneUtente} si è registrato.`,
          postId: null
        });

        notificheInterneCreate += 1;
      } catch (erroreInterna) {
        console.error(
          "Notifica interna nuovo utente fallita per",
          admin.uid,
          erroreInterna
        );
      }

      try {
        const risultatoPush =
          await inviaPushAUtente({
            env,
            recipientUserId:
              admin.uid,
            title:
              "👤 Nuovo iscritto",
            body:
              `${descrizioneUtente} si è registrato.`,
            url: "/",
            notificationId:
              `newUser_${identita.uid}`,
            postId: ""
          });

        pushInviate +=
          risultatoPush.sent;

        pushFallite +=
          risultatoPush.failed;
      } catch (errorePush) {
        pushFallite += 1;

        console.error(
          "Push nuovo utente fallita per",
          admin.uid,
          errorePush
        );
      }
    }

    return rispostaJson(
      {
        success: true,
        alreadySent: false,
        numeroIscritti,
        adminsFound:
          amministratori.length,
        adminsEnabled:
          amministratoriAbilitati.length,
        internalNotifications:
          notificheInterneCreate,
        pushSent:
          pushInviate,
        pushFailed:
          pushFallite
      },
      200,
      origin,
      env
    );
  } catch (errore) {
    console.error(
      "Errore endpoint /notify-new-user:",
      errore
    );

    return rispostaJson(
      {
        success: false,
        error:
          errore.message ||
          "Errore durante la notifica del nuovo utente."
      },
      500,
      origin,
      env
    );
  }
}

    /*
     * Conteggio pubblico degli iscritti.
     *
     * Le regole Firestore permettono la lettura di
     * publicStats/community a tutti, ma la scrittura solo al
     * service account, e la collezione users non e' leggibile
     * dagli utenti normali: quindi il numero esatto puo' essere
     * calcolato e pubblicato soltanto qui. Il client chiama
     * questo endpoint all'avvio e poi legge il documento in
     * tempo reale tramite il listener.
     */
    if (
      request.method === "POST" &&
      urlRichiesta.pathname ===
        "/community-count"
    ) {
      try {
        if (origin && !origineInElenco(origin, env)) {
          console.warn(
            "Origine fuori da ALLOWED_ORIGIN:",
            origin
          );
        }

        const idToken =
          leggiBearerToken(request);

        if (!idToken) {
          return rispostaJson(
            {
              success: false,
              error:
                "Token Firebase Authentication mancante."
            },
            401,
            origin,
            env
          );
        }

        await verificaFirebaseIdToken(
          idToken,
          env
        );

        const serviceAccount = JSON.parse(
          env.FIREBASE_SERVICE_ACCOUNT
        );

        const accessToken =
          await ottieniAccessToken(
            serviceAccount
          );

        const numeroIscritti =
          await aggiornaNumeroIscritti({
            env,
            accessToken
          });

        if (numeroIscritti === null) {
          return rispostaJson(
            {
              success: false,
              error:
                "Conteggio iscritti non disponibile."
            },
            500,
            origin,
            env
          );
        }

        return rispostaJson(
          {
            success: true,
            numeroIscritti
          },
          200,
          origin,
          env
        );
      } catch (errore) {
        console.error(
          "Errore endpoint /community-count:",
          errore
        );

        return rispostaJson(
          {
            success: false,
            error:
              errore.message ||
              "Errore durante il conteggio degli iscritti."
          },
          500,
          origin,
          env
        );
      }
    }

    /*
     * Notifica di uno spotted inviato senza account.
     *
     * Chi pubblica da non loggato non ha un Firebase ID token, quindi
     * non puo' chiamare /notify-admins. Qui il Worker riceve solo
     * l'ID del documento e rilegge testo e autore con il service
     * account: il contenuto della notifica non e' falsificabile.
     * La data limita gli invii ai soli spotted appena creati, perche'
     * il feed e' pubblico e senza questo controllo si potrebbero far
     * ripartire notifiche per vecchi spotted anonimi.
     */
    if (
      request.method === "POST" &&
      urlRichiesta.pathname ===
        "/notify-anonymous-post"
    ) {
      try {
        if (origin && !origineInElenco(origin, env)) {
          console.warn(
            "Origine fuori da ALLOWED_ORIGIN:",
            origin
          );
        }

        const corpo = await request
          .json()
          .catch(() => ({}));

        const postId =
          typeof corpo.postId === "string"
            ? corpo.postId.trim()
            : "";

        const pendingPostId =
          typeof corpo.pendingPostId === "string"
            ? corpo.pendingPostId.trim()
            : "";

        if (
          (!postId && !pendingPostId) ||
          (postId && pendingPostId)
        ) {
          return rispostaJson(
            {
              success: false,
              error:
                "Indica uno e un solo spotted."
            },
            400,
            origin,
            env
          );
        }

        const identificativo =
          postId || pendingPostId;

        if (
          identificativo.length > 128 ||
          identificativo.includes("/")
        ) {
          return rispostaJson(
            {
              success: false,
              error: "ID spotted non valido."
            },
            400,
            origin,
            env
          );
        }

        const serviceAccount = JSON.parse(
          env.FIREBASE_SERVICE_ACCOUNT
        );

        const accessToken =
          await ottieniAccessToken(
            serviceAccount
          );

        const documento =
          await leggiDocumentoConServiceAccount(
            {
              env,
              accessToken,
              percorso: postId
                ? `posts/${encodeURIComponent(
                    postId
                  )}`
                : `pendingPosts/${encodeURIComponent(
                    pendingPostId
                  )}`
            }
          );

        if (!documento) {
          return rispostaJson(
            {
              success: false,
              error: "Lo spotted non esiste."
            },
            404,
            origin,
            env
          );
        }

        const campi = documento.fields || {};

        if (
          valoreFirestore(campi.authorId) !==
          "anonimo"
        ) {
          return rispostaJson(
            {
              success: false,
              error:
                "Lo spotted non è anonimo."
            },
            403,
            origin,
            env
          );
        }

        const createdAt = valoreFirestore(
          campi.createdAt
        );

        const eta =
          Date.now() -
          new Date(createdAt).getTime();

        if (
          !createdAt ||
          !Number.isFinite(eta) ||
          eta > 15 * 60 * 1000
        ) {
          return rispostaJson(
            {
              success: false,
              error:
                "Lo spotted non è recente."
            },
            400,
            origin,
            env
          );
        }

        const testo = String(
          valoreFirestore(campi.text) || ""
        ).trim();

        /*
         * Le risposte alle domande sono spotted anonimi con domanda e
         * risposta: l'avviso deve dirlo, altrimenti agli admin arriva
         * solo la risposta senza il contesto della domanda.
         */
        const domanda = String(
          valoreFirestore(campi.questionText) || ""
        ).trim();

        const isQuestionAnswer =
          valoreFirestore(campi.type) ===
            "questionAnswer" ||
          Boolean(domanda);

        await notificaAmministratoriServer({
          env,
          accessToken,
          attore: { uid: "anonimo" },
          type: postId
            ? "new-post"
            : "pending",
          title: postId
            ? isQuestionAnswer
              ? "💬 Nuova risposta a una domanda"
              : "📝 Nuovo spotted pubblicato"
            : "📩 Nuovo spotted pending",
          testo: postId
            ? (
                isQuestionAnswer && domanda
                  ? `“${domanda}”\n${testo}`
                  : testo ||
                    "È stato pubblicato un nuovo spotted."
              ).slice(0, 240)
            : "Richiede approvazione",
          postId: identificativo,
          inviaPush: true
        });

        /*
         * Nessun conteggio nel corpo: l'endpoint e' pubblico e non
         * serve esporre quanti admin o dispositivi ci sono.
         */
        return rispostaJson(
          { success: true },
          200,
          origin,
          env
        );
      } catch (errore) {
        console.error(
          "Errore endpoint /notify-anonymous-post:",
          errore
        );

        return rispostaJson(
          {
            success: false,
            error:
              errore.message ||
              "Errore durante la notifica dello spotted anonimo."
          },
          500,
          origin,
          env
        );
      }
    }

    /*
     * Notifica agli amministratori (nuovo iscritto, nuovo spotted,
     * pending, segnalazione). La chiama il browser dell'autore
     * dell'azione; l'elenco admin e le preferenze li legge il Worker.
     */
    if (
      request.method === "POST" &&
      urlRichiesta.pathname ===
        "/notify-admins"
    ) {
      try {
        const idToken =
          leggiBearerToken(request);

        if (!idToken) {
          return rispostaJson(
            {
              success: false,
              error:
                "Token Firebase Authentication mancante."
            },
            401,
            origin,
            env
          );
        }

        const identita =
          await verificaFirebaseIdToken(
            idToken,
            env
          );

        const corpo = await request
          .json()
          .catch(() => ({}));

        const type =
          typeof corpo.type === "string"
            ? corpo.type.trim()
            : "";

        const title =
          typeof corpo.title === "string"
            ? corpo.title.trim().slice(0, 120)
            : "";

        const testo =
          typeof corpo.body === "string"
            ? corpo.body.trim().slice(0, 300)
            : "";

        const postId =
          typeof corpo.postId === "string" &&
          corpo.postId.trim() !== ""
            ? corpo.postId.trim()
            : null;

        if (!PREFERENZA_ADMIN[type] || !title || !testo) {
          return rispostaJson(
            {
              success: false,
              error:
                "Tipo, titolo o testo della notifica non validi."
            },
            400,
            origin,
            env
          );
        }

        const serviceAccount = JSON.parse(
          env.FIREBASE_SERVICE_ACCOUNT
        );

        const accessToken =
          await ottieniAccessToken(
            serviceAccount
          );

        const risultato =
          await notificaAmministratoriServer({
            env,
            accessToken,
            attore: { uid: identita.uid },
            type,
            title,
            testo,
            postId,
            inviaPush: corpo.inviaPush !== false
          });

        return rispostaJson(
          {
            success: true,
            ...risultato
          },
          200,
          origin,
          env
        );
      } catch (errore) {
        console.error(
          "Errore endpoint /notify-admins:",
          errore
        );

        return rispostaJson(
          {
            success: false,
            error:
              errore.message ||
              "Errore durante la notifica agli amministratori."
          },
          500,
          origin,
          env
        );
      }
    }

    /*
     * Notifica immediata di un commento o di un like.
     *
     * La chiama il browser dell'autore del commento/like: qui il
     * service account legge seguaci e preferenze e manda le notifiche
     * a chi le ha attive.
     */
    if (
      request.method === "POST" &&
      urlRichiesta.pathname ===
        "/notify-post-activity"
    ) {
      try {
        const idToken =
          leggiBearerToken(request);

        if (!idToken) {
          return rispostaJson(
            {
              success: false,
              error:
                "Token Firebase Authentication mancante."
            },
            401,
            origin,
            env
          );
        }

        const identita =
          await verificaFirebaseIdToken(
            idToken,
            env
          );

        const corpo = await request
          .json()
          .catch(() => ({}));

        const type =
          corpo.type === "like"
            ? "like"
            : corpo.type === "comment"
              ? "comment"
              : "";

        const postId =
          typeof corpo.postId === "string"
            ? corpo.postId.trim()
            : "";

        const eventId =
          typeof corpo.eventId === "string"
            ? corpo.eventId.trim()
            : "";

        const testo =
          typeof corpo.testo === "string"
            ? corpo.testo.trim().slice(0, 240)
            : "";

        if (!type || !postId || !eventId) {
          return rispostaJson(
            {
              success: false,
              error:
                "Tipo, spotted o evento mancante."
            },
            400,
            origin,
            env
          );
        }

        const serviceAccount = JSON.parse(
          env.FIREBASE_SERVICE_ACCOUNT
        );

        const accessToken =
          await ottieniAccessToken(
            serviceAccount
          );

        const documentoAttore =
          await leggiDocumentoConServiceAccount(
            {
              env,
              accessToken,
              percorso:
                `users/${identita.uid}`
            }
          );

        const attore = {
          uid: identita.uid,
          nickname: valoreFirestore(
            documentoAttore?.fields?.nickname
          )
        };

        const risultato =
          await notificaAttivitaPost({
            env,
            accessToken,
            attore,
            type,
            postId,
            eventId,
            testo
          });

        return rispostaJson(
          {
            success: true,
            ...risultato
          },
          200,
          origin,
          env
        );
      } catch (errore) {
        console.error(
          "Errore endpoint /notify-post-activity:",
          errore
        );

        return rispostaJson(
          {
            success: false,
            error:
              errore.message ||
              "Errore durante la notifica dell'attività."
          },
          500,
          origin,
          env
        );
      }
    }

    /*
     * Comunicazione di servizio: l'admin la pubblica e arriva come
     * notifica interna + push immediata a un destinatario per
     * chiamata. Il fan-out lo pilota il browser dell'admin, che ha
     * gia' l'elenco degli iscritti: una invocazione per utente resta
     * dentro il limite di sotto-richieste del piano gratuito, che un
     * ciclo unico su tutti gli iscritti supererebbe.
     */
    if (
      request.method === "POST" &&
      urlRichiesta.pathname ===
        "/notify-service-notice"
    ) {
      try {
        const idToken =
          leggiBearerToken(request);

        if (!idToken) {
          return rispostaJson(
            {
              success: false,
              error:
                "Token Firebase Authentication mancante."
            },
            401,
            origin,
            env
          );
        }

        const identita =
          await verificaFirebaseIdToken(
            idToken,
            env
          );

        const profilo =
          await recuperaUtenteFirestore(
            identita.uid,
            idToken,
            env
          );

        if (
          !utenteAmministratore(profilo)
        ) {
          return rispostaJson(
            {
              success: false,
              error:
                "Solo gli amministratori possono pubblicare una comunicazione di servizio."
            },
            403,
            origin,
            env
          );
        }

        let corpo;

        try {
          corpo = await request.json();
        } catch {
          return rispostaJson(
            {
              success: false,
              error:
                "Corpo JSON della richiesta non valido."
            },
            400,
            origin,
            env
          );
        }

        const noticeId =
          typeof corpo.noticeId === "string"
            ? corpo.noticeId.trim()
            : "";

        const recipientUserId =
          typeof corpo.recipientUserId ===
          "string"
            ? corpo.recipientUserId.trim()
            : "";

        const testo =
          typeof corpo.text === "string"
            ? corpo.text.trim()
            : "";

        if (
          !noticeId ||
          !recipientUserId ||
          !testo
        ) {
          return rispostaJson(
            {
              success: false,
              error:
                "noticeId, recipientUserId e text sono obbligatori."
            },
            400,
            origin,
            env
          );
        }

        if (
          noticeId.length > 200 ||
          recipientUserId.length > 128 ||
          testo.length > 500
        ) {
          return rispostaJson(
            {
              success: false,
              error:
                "Uno o più campi superano la lunghezza consentita."
            },
            400,
            origin,
            env
          );
        }

        const serviceAccount =
          JSON.parse(
            env.FIREBASE_SERVICE_ACCOUNT
          );

        const accessToken =
          await ottieniAccessToken(
            serviceAccount
          );

        const titolo =
          "🔧 Comunicazione di servizio";

        const notificationId =
          `service_${noticeId}_${recipientUserId}`;

        /*
         * La notifica interna viene creata una volta sola: con un
         * nuovo tentativo (doppio clic, ricarica) l'ID esiste gia' e
         * il destinatario non riceve una seconda push.
         */
        const notifica =
          await creaNotificaInterna({
            env,
            accessToken,
            userId: recipientUserId,
            type: "service",
            title: titolo,
            body: testo.slice(0, 500),
            postId: null,
            notificationId
          });

        if (!notifica) {
          return rispostaJson(
            {
              success: true,
              alreadySent: true,
              recipientUserId,
              notificationId,
              totalDevices: 0,
              sent: 0,
              failed: 0
            },
            200,
            origin,
            env
          );
        }

        const push =
          await inviaPushAUtente({
            env,
            accessToken,
            recipientUserId,
            title: titolo,
            body: testo.slice(0, 200),
            url: "/",
            notificationId,
            postId: ""
          });

        return rispostaJson(
          {
            success: true,
            recipientUserId,
            notificationId,
            ...push
          },
          200,
          origin,
          env
        );
      } catch (errore) {
        console.error(
          "Errore endpoint /notify-service-notice:",
          errore
        );

        return rispostaJson(
          {
            success: false,
            error:
              errore.message ||
              "Errore durante l'invio della comunicazione di servizio."
          },
          500,
          origin,
          env
        );
      }
    }

    /*
     * Sblocco del link di una proposta gruppo.
     *
     * La chiama l'utente che ha appena dato il like decisivo: qui il
     * service account conta i like, segna lo sblocco e avvisa tutti
     * quelli che avevano messo like. Gli invii viaggiano a lotti per
     * non superare le sotto-richieste del piano gratuito; il browser
     * ripete la chiamata finche' hasMore resta true.
     */
    if (
      request.method === "POST" &&
      urlRichiesta.pathname ===
        "/notify-unlock"
    ) {
      try {
        const idToken =
          leggiBearerToken(request);

        if (!idToken) {
          return rispostaJson(
            {
              success: false,
              error:
                "Token Firebase Authentication mancante."
            },
            401,
            origin,
            env
          );
        }

        await verificaFirebaseIdToken(
          idToken,
          env
        );

        const corpo = await request
          .json()
          .catch(() => ({}));

        const postId =
          typeof corpo.postId === "string"
            ? corpo.postId.trim()
            : "";

        const cursore =
          typeof corpo.cursor === "string"
            ? corpo.cursor.trim()
            : "";

        if (!postId) {
          return rispostaJson(
            {
              success: false,
              error: "postId mancante."
            },
            400,
            origin,
            env
          );
        }

        const serviceAccount = JSON.parse(
          env.FIREBASE_SERVICE_ACCOUNT
        );

        const accessToken =
          await ottieniAccessToken(
            serviceAccount
          );

        const documentoPost =
          await leggiDocumentoConServiceAccount(
            {
              env,
              accessToken,
              percorso: `posts/${postId}`
            }
          );

        if (!documentoPost) {
          return rispostaJson(
            {
              success: false,
              error:
                "Questo spotted non esiste più."
            },
            404,
            origin,
            env
          );
        }

        const campiPost =
          documentoPost.fields || {};

        const requiredLikes = Math.max(
          1,
          Number(
            valoreFirestore(
              campiPost.requiredLikes
            )
          ) || 10
        );

        const testoPost = String(
          valoreFirestore(campiPost.text) ||
            ""
        );

        const likes =
          await recuperaDocumentiPerCampo({
            env,
            accessToken,
            collectionId: "likes",
            campo: "postId",
            valore: postId
          });

        if (likes.length < requiredLikes) {
          return rispostaJson(
            {
              success: false,
              error:
                "Il link si sblocca solo quando i like raggiungono l'obiettivo."
            },
            400,
            origin,
            env
          );
        }

        if (
          !valoreFirestore(
            campiPost.unlockedAt
          )
        ) {
          await aggiornaDocumentiInBlocco({
            env,
            accessToken,
            documenti: [
              {
                name: documentoPost.name,
                fields: {
                  unlockedAt: {
                    stringValue:
                      new Date().toISOString()
                  }
                }
              }
            ]
          });
        }

        const destinatari = Array.from(
          new Set(
            likes
              .map((like) =>
                valoreFirestore(
                  like.fields.userId
                )
              )
              .filter(
                (uid) =>
                  typeof uid === "string" &&
                  uid !== ""
              )
          )
        ).sort();

        const LOTTO = 8;

        const indiceCursore =
          cursore > ""
            ? destinatari.indexOf(cursore)
            : -1;

        const inizio = Math.max(
          indiceCursore + 1,
          0
        );

        const lotto = destinatari.slice(
          inizio,
          inizio + LOTTO
        );

        const titolo = "🎉 Gruppo sbloccato";

        const anteprima = anteprimaTesto(
          testoPost
        );

        const corpoNotifica = anteprima
          ? `Il link di «${anteprima}» è disponibile.`
          : "Il link del gruppo è disponibile.";

        let notificati = 0;
        let pushInviate = 0;
        let pushFallite = 0;

        for (const uid of lotto) {
          const notificationId =
            `unlock_${postId}_${uid}`;

          try {
            const notifica =
              await creaNotificaInterna({
                env,
                accessToken,
                userId: uid,
                type: "unlock",
                title: titolo,
                body: corpoNotifica,
                postId,
                notificationId
              });

            if (!notifica) continue;

            notificati += 1;

            const push =
              await inviaPushAUtente({
                env,
                accessToken,
                recipientUserId: uid,
                title: titolo,
                body: corpoNotifica,
                url: "/",
                notificationId,
                postId
              });

            pushInviate += push.sent;
            pushFallite += push.failed;
          } catch (errore) {
            console.error(
              "Notifica sblocco non inviata a",
              uid,
              errore
            );
          }
        }

        return rispostaJson(
          {
            success: true,
            totaleDestinatari: destinatari.length,
            notificati,
            pushInviate,
            pushFallite,
            hasMore:
              inizio + lotto.length <
              destinatari.length,
            nextCursor:
              lotto[lotto.length - 1] || ""
          },
          200,
          origin,
          env
        );
      } catch (errore) {
        console.error(
          "Errore endpoint /notify-unlock:",
          errore
        );

        return rispostaJson(
          {
            success: false,
            error:
              errore.message ||
              "Errore durante la notifica dello sblocco."
          },
          500,
          origin,
          env
        );
      }
    }

    /*
     * Approvazione del cambio nickname (solo admin).
     *
     * Il service account rinomina l'utente e tutte le sue attività
     * (commenti e like) in un solo commit: dalle regole Firestore un
     * admin non potrebbe riscrivere i documenti altrui, e una PATCH per
     * documento esaurirebbe le sotto-richieste del piano gratuito.
     */
    if (
      request.method === "POST" &&
      urlRichiesta.pathname ===
        "/approve-nickname"
    ) {
      try {
        const idToken =
          leggiBearerToken(request);

        if (!idToken) {
          return rispostaJson(
            {
              success: false,
              error:
                "Token Firebase Authentication mancante."
            },
            401,
            origin,
            env
          );
        }

        const identita =
          await verificaFirebaseIdToken(
            idToken,
            env
          );

        const profilo =
          await recuperaUtenteFirestore(
            identita.uid,
            idToken,
            env
          );

        if (
          !utenteAmministratore(profilo)
        ) {
          return rispostaJson(
            {
              success: false,
              error:
                "Solo gli amministratori possono approvare un cambio nickname."
            },
            403,
            origin,
            env
          );
        }

        const corpo = await request
          .json()
          .catch(() => ({}));

        const requestId =
          typeof corpo.requestId === "string"
            ? corpo.requestId.trim()
            : "";

        if (!requestId) {
          return rispostaJson(
            {
              success: false,
              error: "requestId mancante."
            },
            400,
            origin,
            env
          );
        }

        const serviceAccount = JSON.parse(
          env.FIREBASE_SERVICE_ACCOUNT
        );

        const accessToken =
          await ottieniAccessToken(
            serviceAccount
          );

        const richiesta =
          await leggiDocumentoConServiceAccount(
            {
              env,
              accessToken,
              percorso:
                `nicknameRequests/${requestId}`
            }
          );

        if (!richiesta) {
          return rispostaJson(
            {
              success: false,
              error:
                "Richiesta di cambio nickname non trovata."
            },
            404,
            origin,
            env
          );
        }

        const campiRichiesta =
          richiesta.fields || {};

        const userId = String(
          valoreFirestore(
            campiRichiesta.userId
          ) || ""
        );

        const vecchioNickname = String(
          valoreFirestore(
            campiRichiesta.oldNickname
          ) || ""
        );

        const nuovoNickname = String(
          valoreFirestore(
            campiRichiesta.newNickname
          ) || ""
        ).trim();

        const stato = String(
          valoreFirestore(
            campiRichiesta.status
          ) || ""
        );

        if (!userId || !nuovoNickname) {
          return rispostaJson(
            {
              success: false,
              error:
                "La richiesta non contiene utente o nuovo nickname."
            },
            400,
            origin,
            env
          );
        }

        if (stato !== "pending") {
          return rispostaJson(
            {
              success: false,
              error:
                "Questa richiesta è già stata gestita."
            },
            409,
            origin,
            env
          );
        }

        if (
          nuovoNickname.length < 3 ||
          nuovoNickname.length > 30
        ) {
          return rispostaJson(
            {
              success: false,
              error:
                "Il nickname deve contenere da 3 a 30 caratteri."
            },
            400,
            origin,
            env
          );
        }

        const documentiDaRinominare =
          vecchioNickname
            ? [
                ...(await recuperaDocumentiPerCampo({
                  env,
                  accessToken,
                  collectionId: "comments",
                  campo: "nickname",
                  valore: vecchioNickname
                })),
                ...(await recuperaDocumentiPerCampo({
                  env,
                  accessToken,
                  collectionId: "likes",
                  campo: "nickname",
                  valore: vecchioNickname
                }))
              ]
            : [];

        if (documentiDaRinominare.length > 0) {
          await aggiornaDocumentiInBlocco({
            env,
            accessToken,
            documenti:
              documentiDaRinominare.map(
                (documento) => ({
                  name: documento.name,
                  fields: {
                    nickname: {
                      stringValue:
                        nuovoNickname
                    }
                  }
                })
              )
          });
        }

        const utente =
          await leggiDocumentoConServiceAccount(
            {
              env,
              accessToken,
              percorso: `users/${userId}`
            }
          );

        const daAggiornare = [
          {
            name: richiesta.name,
            fields: {
              status: {
                stringValue: "approved"
              },
              reviewedAt: {
                stringValue:
                  new Date().toISOString()
              },
              reviewedBy: {
                stringValue: identita.uid
              }
            }
          }
        ];

        if (utente) {
          daAggiornare.push({
            name: utente.name,
            fields: {
              nickname: {
                stringValue: nuovoNickname
              }
            }
          });
        }

        await aggiornaDocumentiInBlocco({
          env,
          accessToken,
          documenti: daAggiornare
        });

        /*
         * L'utente vede subito l'esito: notifica interna + push.
         */
        const notificationId =
          `nickname_${requestId}`;

        const notifica =
          await creaNotificaInterna({
            env,
            accessToken,
            userId,
            type: "nickname",
            title: "✅ Nickname aggiornato",
            body:
              `Il tuo nuovo nickname è «${nuovoNickname}».`,
            postId: null,
            notificationId
          });

        if (notifica) {
          await inviaPushAUtente({
            env,
            accessToken,
            recipientUserId: userId,
            title: "✅ Nickname aggiornato",
            body:
              `Il tuo nuovo nickname è «${nuovoNickname}».`,
            url: "/",
            notificationId,
            postId: ""
          }).catch((errore) => {
            console.warn(
              "Nickname aggiornato, push non inviata:",
              errore
            );
          });
        }

        return rispostaJson(
          {
            success: true,
            userId,
            nickname: nuovoNickname,
            attivitaAggiornate:
              documentiDaRinominare.length
          },
          200,
          origin,
          env
        );
      } catch (errore) {
        console.error(
          "Errore endpoint /approve-nickname:",
          errore
        );

        return rispostaJson(
          {
            success: false,
            error:
              errore.message ||
              "Errore durante il cambio nickname."
          },
          500,
          origin,
          env
        );
      }
    }

    /*
     * Prova manuale dei riepiloghi, riservata agli admin.
     * Con dryRun: true calcola testo e destinatari senza inviare nulla.
     */
    if (
      request.method === "POST" &&
      urlRichiesta.pathname === "/digest"
    ) {
      try {
        const idToken =
          leggiBearerToken(request);

        if (!idToken) {
          return rispostaJson(
            {
              success: false,
              error:
                "Token Firebase Authentication mancante."
            },
            401,
            origin,
            env
          );
        }

        const identita =
          await verificaFirebaseIdToken(
            idToken,
            env
          );

        const profilo =
          await recuperaUtenteFirestore(
            identita.uid,
            idToken,
            env
          );

        if (!utenteAmministratore(profilo)) {
          return rispostaJson(
            {
              success: false,
              error:
                "Solo gli amministratori possono inviare i riepiloghi."
            },
            403,
            origin,
            env
          );
        }

        const corpo = await request
          .json()
          .catch(() => ({}));

        const risultato = await eseguiRiepilogo({
          env,
          period:
            corpo.period === "weekly"
              ? "weekly"
              : "daily",
          dryRun: corpo.dryRun === true
        });

        return rispostaJson(
          {
            success: true,
            ...risultato
          },
          200,
          origin,
          env
        );
      } catch (errore) {
        console.error(
          "Errore endpoint /digest:",
          errore
        );

        return rispostaJson(
          {
            success: false,
            error:
              errore.message ||
              "Errore durante il riepilogo."
          },
          500,
          origin,
          env
        );
      }
    }

    /*
     * Dice al pannello admin se il Worker ha un token Instagram
     * utilizzabile.
     */
    if (
      request.method === "GET" &&
      urlRichiesta.pathname === "/instagram/config"
    ) {
      try {
        const idToken =
          leggiBearerToken(request);

        if (!idToken) {
          return rispostaJson(
            {
              success: false,
              error:
                "Token Firebase Authentication mancante."
            },
            401,
            origin,
            env
          );
        }

        const identita =
          await verificaFirebaseIdToken(
            idToken,
            env
          );

        const profilo =
          await recuperaUtenteFirestore(
            identita.uid,
            idToken,
            env
          );

        if (!utenteAmministratore(profilo)) {
          return rispostaJson(
            {
              success: false,
              error:
                "Solo gli amministratori possono pubblicare su Instagram."
            },
            403,
            origin,
            env
          );
        }

        const serviceAccount = JSON.parse(
          env.FIREBASE_SERVICE_ACCOUNT
        );

        const accessToken =
          await ottieniAccessToken(serviceAccount);

        const configurazione =
          await leggiConfigurazioneInstagram({
            env,
            accessToken
          });

        return rispostaJson(
          {
            success: true,
            configured: Boolean(
              configurazione?.token ||
                env.INSTAGRAM_ACCESS_TOKEN
            ),
            rinnovatoIl:
              configurazione?.rinnovatoIl || null,
            scadeIl:
              configurazione?.scadeIl || null
          },
          200,
          origin,
          env
        );
      } catch (errore) {
        console.error(
          "Errore endpoint /instagram/config:",
          errore
        );

        return rispostaJson(
          {
            success: false,
            error:
              errore.message ||
              "Errore configurazione Instagram."
          },
          500,
          origin,
          env
        );
      }
    }

    /*
     * Dati del profilo Instagram collegato: username, tipo di account,
     * numero di post e scadenza del token. Serve al pannello della
     * dashboard per verificare il collegamento.
     */
    if (
      request.method === "GET" &&
      urlRichiesta.pathname === "/instagram/account"
    ) {
      try {
        const idToken =
          leggiBearerToken(request);

        if (!idToken) {
          return rispostaJson(
            {
              success: false,
              error:
                "Token Firebase Authentication mancante."
            },
            401,
            origin,
            env
          );
        }

        const identita =
          await verificaFirebaseIdToken(
            idToken,
            env
          );

        const profilo =
          await recuperaUtenteFirestore(
            identita.uid,
            idToken,
            env
          );

        if (!utenteAmministratore(profilo)) {
          return rispostaJson(
            {
              success: false,
              error:
                "Solo gli amministratori possono vedere il collegamento Instagram."
            },
            403,
            origin,
            env
          );
        }

        const serviceAccount = JSON.parse(
          env.FIREBASE_SERVICE_ACCOUNT
        );

        const accessToken =
          await ottieniAccessToken(serviceAccount);

        const configurazione =
          await leggiConfigurazioneInstagram({
            env,
            accessToken
          });

        const token =
          configurazione?.token ||
          env.INSTAGRAM_ACCESS_TOKEN ||
          "";

        const datiConfigurazione = {
          rinnovatoIl:
            configurazione?.rinnovatoIl || null,
          scadeIl: configurazione?.scadeIl || null
        };

        if (!token) {
          return rispostaJson(
            {
              success: true,
              configured: false,
              account: null,
              ...datiConfigurazione
            },
            200,
            origin,
            env
          );
        }

        try {
          const account =
            await informazioniAccountInstagram(
              token
            );

          return rispostaJson(
            {
              success: true,
              configured: true,
              account,
              ...datiConfigurazione
            },
            200,
            origin,
            env
          );
        } catch (erroreAccount) {
          console.error(
            "Profilo Instagram non leggibile:",
            erroreAccount
          );

          return rispostaJson(
            {
              success: true,
              configured: true,
              account: null,
              errore:
                erroreAccount.message ||
                "Instagram non ha risposto.",
              ...datiConfigurazione
            },
            200,
            origin,
            env
          );
        }
      } catch (errore) {
        console.error(
          "Errore endpoint /instagram/account:",
          errore
        );

        return rispostaJson(
          {
            success: false,
            error:
              errore.message ||
              "Errore collegamento Instagram."
          },
          500,
          origin,
          env
        );
      }
    }

    /*
     * Rinnova subito il token Instagram: il cron lo fa gia' da solo
     * prima della scadenza, ma dal pannello si puo' forzare il
     * rinnovo quando Instagram segnala un problema.
     */
    if (
      request.method === "POST" &&
      urlRichiesta.pathname === "/instagram/refresh"
    ) {
      try {
        const idToken =
          leggiBearerToken(request);

        if (!idToken) {
          return rispostaJson(
            {
              success: false,
              error:
                "Token Firebase Authentication mancante."
            },
            401,
            origin,
            env
          );
        }

        const identita =
          await verificaFirebaseIdToken(
            idToken,
            env
          );

        const profilo =
          await recuperaUtenteFirestore(
            identita.uid,
            idToken,
            env
          );

        if (!utenteAmministratore(profilo)) {
          return rispostaJson(
            {
              success: false,
              error:
                "Solo gli amministratori possono rinnovare il token Instagram."
            },
            403,
            origin,
            env
          );
        }

        const rinnovo =
          await rinnovaTokenInstagramSeNecessario(
            env,
            { forza: true }
          );

        if (!rinnovo?.token) {
          return rispostaJson(
            {
              success: false,
              error:
                rinnovo?.errore ||
                "Token Instagram non configurato."
            },
            503,
            origin,
            env
          );
        }

        if (rinnovo.errore) {
          return rispostaJson(
            {
              success: false,
              error: rinnovo.errore
            },
            502,
            origin,
            env
          );
        }

        const serviceAccount = JSON.parse(
          env.FIREBASE_SERVICE_ACCOUNT
        );

        const accessToken =
          await ottieniAccessToken(serviceAccount);

        const configurazione =
          await leggiConfigurazioneInstagram({
            env,
            accessToken
          });

        return rispostaJson(
          {
            success: true,
            rinnovato: rinnovo.rinnovato,
            rinnovatoIl:
              configurazione?.rinnovatoIl || null,
            scadeIl:
              configurazione?.scadeIl || null
          },
          200,
          origin,
          env
        );
      } catch (errore) {
        console.error(
          "Errore endpoint /instagram/refresh:",
          errore
        );

        return rispostaJson(
          {
            success: false,
            error:
              errore.message ||
              "Errore durante il rinnovo del token Instagram."
          },
          500,
          origin,
          env
        );
      }
    }

    /*
     * Pubblica su Instagram lo spotted appena approvato.
     */
    if (
      request.method === "POST" &&
      urlRichiesta.pathname === "/instagram/publish"
    ) {
      try {
        const idToken =
          leggiBearerToken(request);

        if (!idToken) {
          return rispostaJson(
            {
              success: false,
              error:
                "Token Firebase Authentication mancante."
            },
            401,
            origin,
            env
          );
        }

        const identita =
          await verificaFirebaseIdToken(
            idToken,
            env
          );

        const profilo =
          await recuperaUtenteFirestore(
            identita.uid,
            idToken,
            env
          );

        if (!utenteAmministratore(profilo)) {
          return rispostaJson(
            {
              success: false,
              error:
                "Solo gli amministratori possono pubblicare su Instagram."
            },
            403,
            origin,
            env
          );
        }

        const corpo = await request
          .json()
          .catch(() => ({}));

        const postId = String(
          corpo.postId || ""
        ).trim();

        const caption = String(
          corpo.caption || ""
        ).slice(0, 2200);

        const immagineBase64 = String(
          corpo.imageBase64 || ""
        )
          .replace(/^data:[^;]+;base64,/, "")
          .replace(/\s/g, "");

        if (!postId || !immagineBase64) {
          return rispostaJson(
            {
              success: false,
              error:
                "Post o immagine mancanti."
            },
            400,
            origin,
            env
          );
        }

        if (!/^[A-Za-z0-9_-]+$/.test(postId)) {
          return rispostaJson(
            {
              success: false,
              error: "ID post non valido."
            },
            400,
            origin,
            env
          );
        }

        if (!immagineBase64.startsWith("/9j/")) {
          return rispostaJson(
            {
              success: false,
              error:
                "Instagram accetta solo immagini JPEG."
            },
            400,
            origin,
            env
          );
        }

        if (immagineBase64.length > 850000) {
          return rispostaJson(
            {
              success: false,
              error:
                "Immagine troppo pesante per la pubblicazione."
            },
            413,
            origin,
            env
          );
        }

        const serviceAccount = JSON.parse(
          env.FIREBASE_SERVICE_ACCOUNT
        );

        const accessToken =
          await ottieniAccessToken(serviceAccount);

        const token = await tokenInstagram({
          env,
          accessToken
        });

        if (!token) {
          return rispostaJson(
            {
              success: false,
              error:
                "Instagram non è configurato: manca il token di accesso nel Worker."
            },
            503,
            origin,
            env
          );
        }

        const risultato = await pubblicaSuInstagram({
          env,
          accessToken,
          origin: urlRichiesta.origin,
          postId,
          caption,
          immagineBase64,
          token
        });

        return rispostaJson(
          {
            success: true,
            ...risultato
          },
          200,
          origin,
          env
        );
      } catch (errore) {
        console.error(
          "Errore endpoint /instagram/publish:",
          errore
        );

        return rispostaJson(
          {
            success: false,
            error:
              errore.message ||
              "Errore durante la pubblicazione su Instagram."
          },
          errore.status || 500,
          origin,
          env
        );
      }
    }

    /*
     * Stato dell'IA, catalogo delle skill e bozze in attesa.
     */
    if (
      request.method === "GET" &&
      urlRichiesta.pathname === "/instagram/ai"
    ) {
      try {
        const idToken =
          leggiBearerToken(request);

        if (!idToken) {
          return rispostaJson(
            {
              success: false,
              error:
                "Token Firebase Authentication mancante."
            },
            401,
            origin,
            env
          );
        }

        const identita =
          await verificaFirebaseIdToken(
            idToken,
            env
          );

        const profilo =
          await recuperaUtenteFirestore(
            identita.uid,
            idToken,
            env
          );

        if (!utenteAmministratore(profilo)) {
          return rispostaJson(
            {
              success: false,
              error:
                "Solo gli amministratori possono gestire l'IA di Instagram."
            },
            403,
            origin,
            env
          );
        }

        const serviceAccount = JSON.parse(
          env.FIREBASE_SERVICE_ACCOUNT
        );

        const accessToken =
          await ottieniAccessToken(serviceAccount);

        const configurazione =
          await leggiConfigurazioneInstagram({
            env,
            accessToken
          });

        const attive =
          configurazione?.aiSkills?.length
            ? configurazione.aiSkills
            : SKILL_ATTIVE_PREDEFINITE;

        return rispostaJson(
          {
            success: true,
            configured: Boolean(
              env.OPENAI_API_KEY
            ),
            modello:
              env.AI_MODEL ||
              AI_MODELLO_PREDEFINITO,
            skills: SKILL_INSTAGRAM.map(
              (skill) => ({
                id: skill.id,
                nome: skill.nome,
                descrizione: skill.descrizione,
                istruzioni: skill.istruzioni,
                attiva: attive.includes(skill.id)
              })
            ),
            bozze: await elencaBozzeInstagram({
              env,
              accessToken
            })
          },
          200,
          origin,
          env
        );
      } catch (errore) {
        console.error(
          "Errore endpoint /instagram/ai:",
          errore
        );

        return rispostaJson(
          {
            success: false,
            error:
              errore.message ||
              "Errore lettura IA Instagram."
          },
          500,
          origin,
          env
        );
      }
    }

    /*
     * Attiva o spegne le skill usate per generare i contenuti.
     */
    if (
      request.method === "POST" &&
      urlRichiesta.pathname ===
        "/instagram/ai/skills"
    ) {
      try {
        const idToken =
          leggiBearerToken(request);

        if (!idToken) {
          return rispostaJson(
            {
              success: false,
              error:
                "Token Firebase Authentication mancante."
            },
            401,
            origin,
            env
          );
        }

        const identita =
          await verificaFirebaseIdToken(
            idToken,
            env
          );

        const profilo =
          await recuperaUtenteFirestore(
            identita.uid,
            idToken,
            env
          );

        if (!utenteAmministratore(profilo)) {
          return rispostaJson(
            {
              success: false,
              error:
                "Solo gli amministratori possono cambiare le skill."
            },
            403,
            origin,
            env
          );
        }

        const corpo = await request
          .json()
          .catch(() => ({}));

        const richieste = Array.isArray(
          corpo.skills
        )
          ? corpo.skills
          : null;

        if (!richieste) {
          return rispostaJson(
            {
              success: false,
              error:
                "skills deve essere un elenco di identificativi."
            },
            400,
            origin,
            env
          );
        }

        const valide = new Set(
          SKILL_INSTAGRAM.map(
            (skill) => skill.id
          )
        );

        const scelte = Array.from(
          new Set(
            richieste
              .map((voce) => String(voce))
              .filter((voce) => valide.has(voce))
          )
        );

        const serviceAccount = JSON.parse(
          env.FIREBASE_SERVICE_ACCOUNT
        );

        const accessToken =
          await ottieniAccessToken(serviceAccount);

        await scriviDocumentoConServiceAccount({
          env,
          accessToken,
          percorso: "config/instagram",
          campiAggiornati: [
            "aiSkills",
            "aiSkillsUpdatedAt"
          ],
          fields: {
            aiSkills: {
              arrayValue: {
                values: scelte.map((id) => ({
                  stringValue: id
                }))
              }
            },
            aiSkillsUpdatedAt: {
              stringValue:
                new Date().toISOString()
            }
          }
        });

        return rispostaJson(
          {
            success: true,
            skills: SKILL_INSTAGRAM.map(
              (skill) => ({
                id: skill.id,
                nome: skill.nome,
                descrizione: skill.descrizione,
                istruzioni: skill.istruzioni,
                attiva: scelte.includes(skill.id)
              })
            )
          },
          200,
          origin,
          env
        );
      } catch (errore) {
        console.error(
          "Errore endpoint /instagram/ai/skills:",
          errore
        );

        return rispostaJson(
          {
            success: false,
            error:
              errore.message ||
              "Errore salvataggio skill."
          },
          500,
          origin,
          env
        );
      }
    }

    /*
     * Genera nuove bozze con l'IA (solo admin).
     */
    if (
      request.method === "POST" &&
      urlRichiesta.pathname ===
        "/instagram/ai/generate"
    ) {
      try {
        const idToken =
          leggiBearerToken(request);

        if (!idToken) {
          return rispostaJson(
            {
              success: false,
              error:
                "Token Firebase Authentication mancante."
            },
            401,
            origin,
            env
          );
        }

        const identita =
          await verificaFirebaseIdToken(
            idToken,
            env
          );

        const profilo =
          await recuperaUtenteFirestore(
            identita.uid,
            idToken,
            env
          );

        if (!utenteAmministratore(profilo)) {
          return rispostaJson(
            {
              success: false,
              error:
                "Solo gli amministratori possono generare contenuti."
            },
            403,
            origin,
            env
          );
        }

        const corpo = await request
          .json()
          .catch(() => ({}));

        const quantita = Math.min(
          MASSIMO_BOZZE_PER_RICHIESTA,
          Math.max(
            1,
            Number(corpo.quantita) || 3
          )
        );

        const serviceAccount = JSON.parse(
          env.FIREBASE_SERVICE_ACCOUNT
        );

        const accessToken =
          await ottieniAccessToken(serviceAccount);

        const risultato =
          await generaBozzeInstagram({
            env,
            accessToken,
            quantita
          });

        return rispostaJson(
          {
            success: true,
            ...risultato
          },
          200,
          origin,
          env
        );
      } catch (errore) {
        console.error(
          "Errore endpoint /instagram/ai/generate:",
          errore
        );

        return rispostaJson(
          {
            success: false,
            error:
              errore.message ||
              "Errore durante la generazione."
          },
          errore.status || 500,
          origin,
          env
        );
      }
    }

    /*
     * Approva una bozza: pubblica la card su Instagram e segna la
     * bozza come pubblicata.
     */
    if (
      request.method === "POST" &&
      urlRichiesta.pathname ===
        "/instagram/drafts/publish"
    ) {
      try {
        const idToken =
          leggiBearerToken(request);

        if (!idToken) {
          return rispostaJson(
            {
              success: false,
              error:
                "Token Firebase Authentication mancante."
            },
            401,
            origin,
            env
          );
        }

        const identita =
          await verificaFirebaseIdToken(
            idToken,
            env
          );

        const profilo =
          await recuperaUtenteFirestore(
            identita.uid,
            idToken,
            env
          );

        if (!utenteAmministratore(profilo)) {
          return rispostaJson(
            {
              success: false,
              error:
                "Solo gli amministratori possono pubblicare una bozza."
            },
            403,
            origin,
            env
          );
        }

        const corpo = await request
          .json()
          .catch(() => ({}));

        const draftId = String(
          corpo.draftId || ""
        ).trim();

        const caption = String(
          corpo.caption || ""
        ).slice(0, 2200);

        const immagineBase64 = String(
          corpo.imageBase64 || ""
        )
          .replace(/^data:[^;]+;base64,/, "")
          .replace(/\s/g, "");

        if (!draftId || !immagineBase64) {
          return rispostaJson(
            {
              success: false,
              error:
                "Bozza o immagine mancanti."
            },
            400,
            origin,
            env
          );
        }

        if (!/^[A-Za-z0-9_-]+$/.test(draftId)) {
          return rispostaJson(
            {
              success: false,
              error: "ID bozza non valido."
            },
            400,
            origin,
            env
          );
        }

        if (!immagineBase64.startsWith("/9j/")) {
          return rispostaJson(
            {
              success: false,
              error:
                "Instagram accetta solo immagini JPEG."
            },
            400,
            origin,
            env
          );
        }

        if (immagineBase64.length > 850000) {
          return rispostaJson(
            {
              success: false,
              error:
                "Immagine troppo pesante per la pubblicazione."
            },
            413,
            origin,
            env
          );
        }

        const serviceAccount = JSON.parse(
          env.FIREBASE_SERVICE_ACCOUNT
        );

        const accessToken =
          await ottieniAccessToken(serviceAccount);

        const bozza =
          await leggiDocumentoConServiceAccount(
            {
              env,
              accessToken,
              percorso:
                `instagramDrafts/${encodeURIComponent(
                  draftId
                )}`
            }
          );

        if (!bozza) {
          return rispostaJson(
            {
              success: false,
              error: "La bozza non esiste più."
            },
            404,
            origin,
            env
          );
        }

        const statoBozza = String(
          valoreFirestore(bozza.fields?.stato) ||
            ""
        );

        if (statoBozza === "pubblicata") {
          return rispostaJson(
            {
              success: true,
              giaPubblicato: true,
              mediaId:
                valoreFirestore(
                  bozza.fields?.mediaId
                ) || "",
              permalink:
                valoreFirestore(
                  bozza.fields?.permalink
                ) || ""
            },
            200,
            origin,
            env
          );
        }

        if (statoBozza === "scartata") {
          return rispostaJson(
            {
              success: false,
              error:
                "Questa bozza è stata scartata: non si può pubblicare."
            },
            409,
            origin,
            env
          );
        }

        const token = await tokenInstagram({
          env,
          accessToken
        });

        if (!token) {
          return rispostaJson(
            {
              success: false,
              error:
                "Instagram non è configurato: manca il token di accesso nel Worker."
            },
            503,
            origin,
            env
          );
        }

        await scriviDocumentoConServiceAccount({
          env,
          accessToken,
          percorso:
            `instagramMedia/${encodeURIComponent(
              draftId
            )}`,
          campiAggiornati: [
            "postId",
            "jpegBase64",
            "createdAt"
          ],
          fields: {
            postId: { stringValue: draftId },
            jpegBase64: {
              stringValue: immagineBase64
            },
            createdAt: {
              stringValue:
                new Date().toISOString()
            }
          }
        });

        const imageUrl =
          `${urlRichiesta.origin}/media/` +
          `${encodeURIComponent(draftId)}.jpg`;

        const pubblicato =
          await pubblicaImmagineSuInstagram({
            token,
            imageUrl,
            caption
          });

        const publishedAt =
          new Date().toISOString();

        await scriviDocumentoConServiceAccount({
          env,
          accessToken,
          percorso:
            `instagramDrafts/${encodeURIComponent(
              draftId
            )}`,
          campiAggiornati: [
            "stato",
            "mediaId",
            "permalink",
            "caption",
            "publishedAt"
          ],
          fields: {
            stato: { stringValue: "pubblicata" },
            mediaId: {
              stringValue: pubblicato.mediaId
            },
            permalink: {
              stringValue: pubblicato.permalink
            },
            caption: { stringValue: caption },
            publishedAt: {
              stringValue: publishedAt
            }
          }
        });

        return rispostaJson(
          {
            success: true,
            draftId,
            mediaId: pubblicato.mediaId,
            permalink: pubblicato.permalink,
            publishedAt
          },
          200,
          origin,
          env
        );
      } catch (errore) {
        console.error(
          "Errore endpoint /instagram/drafts/publish:",
          errore
        );

        return rispostaJson(
          {
            success: false,
            error:
              errore.message ||
              "Errore durante la pubblicazione della bozza."
          },
          errore.status || 500,
          origin,
          env
        );
      }
    }

    /*
     * Scarta una bozza senza pubblicare nulla.
     */
    if (
      request.method === "POST" &&
      urlRichiesta.pathname ===
        "/instagram/drafts/discard"
    ) {
      try {
        const idToken =
          leggiBearerToken(request);

        if (!idToken) {
          return rispostaJson(
            {
              success: false,
              error:
                "Token Firebase Authentication mancante."
            },
            401,
            origin,
            env
          );
        }

        const identita =
          await verificaFirebaseIdToken(
            idToken,
            env
          );

        const profilo =
          await recuperaUtenteFirestore(
            identita.uid,
            idToken,
            env
          );

        if (!utenteAmministratore(profilo)) {
          return rispostaJson(
            {
              success: false,
              error:
                "Solo gli amministratori possono scartare una bozza."
            },
            403,
            origin,
            env
          );
        }

        const corpo = await request
          .json()
          .catch(() => ({}));

        const draftId = String(
          corpo.draftId || ""
        ).trim();

        if (!/^[A-Za-z0-9_-]+$/.test(draftId)) {
          return rispostaJson(
            {
              success: false,
              error: "ID bozza non valido."
            },
            400,
            origin,
            env
          );
        }

        const serviceAccount = JSON.parse(
          env.FIREBASE_SERVICE_ACCOUNT
        );

        const accessToken =
          await ottieniAccessToken(serviceAccount);

        await scriviDocumentoConServiceAccount({
          env,
          accessToken,
          percorso:
            `instagramDrafts/${encodeURIComponent(
              draftId
            )}`,
          campiAggiornati: [
            "stato",
            "scartataIl"
          ],
          fields: {
            stato: { stringValue: "scartata" },
            scartataIl: {
              stringValue:
                new Date().toISOString()
            }
          }
        });

        return rispostaJson(
          {
            success: true,
            draftId
          },
          200,
          origin,
          env
        );
      } catch (errore) {
        console.error(
          "Errore endpoint /instagram/drafts/discard:",
          errore
        );

        return rispostaJson(
          {
            success: false,
            error:
              errore.message ||
              "Errore durante lo scarto della bozza."
          },
          500,
          origin,
          env
        );
      }
    }

    return rispostaJson(
      {
        success: false,
        error: "Endpoint non trovato."
      },
      404,
      origin,
      env
    );
  }
};

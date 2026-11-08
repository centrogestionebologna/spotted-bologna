const encoder = new TextEncoder();

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
   * Il tag fa sovrascrivere al sistema la stessa notifica invece di
   * impilarne una copia: se un invio viene ripetuto, il destinatario
   * la vede comunque una sola volta.
   */
  const notificaWeb = {
    icon: "/logo192.png",
    badge: "/logo192.png"
  };

  if (notificationId) {
    notificaWeb.tag = notificationId;
    notificaWeb.renotify = false;
  }

  const webpush = {
    notification: notificaWeb,

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

      notification: {
        title,
        body
      },

      data: {
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
  adminOnly = false
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

  const commenti =
    await contaDocumentiCreatiDopo({
      env,
      accessToken,
      collectionId: "comments",
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
        ? `Questa settimana ${spots} nuovi spotted e ${commenti} commenti.`
        : `Ieri ${spots} nuovi spotted e ${commenti} commenti.`;

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
      spots,
      commenti,
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
          notificationId
        });

      if (!notifica) continue;

      notificate += 1;

      const push = await inviaPushAUtente({
        env,
        accessToken,
        recipientUserId: profilo.uid,
        title: titolo,
        body: corpo,
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
    spots,
    commenti,
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

    if (ctx?.waitUntil) {
      ctx.waitUntil(esecuzione);
    } else {
      await esecuzione;
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
          admin.notifyPending === true
      );

    let notificheInterneCreate = 0;
    let pushInviate = 0;
    let pushFallite = 0;

    for (
      const admin
      of amministratoriAbilitati
    ) {
      await creaNotificaInterna({
        env,
        accessToken,
        userId: admin.uid,
        type: "pending",
        title:
          "📩 Nuovo spotted pending",
        body:
          "Richiede approvazione",
        postId: pendingPostId
      });

      notificheInterneCreate += 1;

      /*
       * La push immediata viene inviata soltanto
       * agli admin con frequenza "immediata".
       */
      if (
        admin.newsletter === "immediata"
      ) {
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
          admin.notifyReports === true
      );

    let notificheInterneCreate = 0;
    let pushInviate = 0;
    let pushFallite = 0;

    for (
      const admin
      of amministratoriAbilitati
    ) {
      await creaNotificaInterna({
        env,
        accessToken,
        userId: admin.uid,
        type: "report",
        title:
          "🚩 Spotted segnalato",
        body:
          "Uno spotted ha raggiunto 3 segnalazioni ed è stato rimosso dalla community.",
        postId: originalId
      });

      notificheInterneCreate += 1;

      if (
        admin.newsletter ===
        "immediata"
      ) {
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
            notificationId:
              `report_${pendingPostId}`,
            postId: originalId
          });

        pushInviate +=
          risultatoPush.sent;

        pushFallite +=
          risultatoPush.failed;
      }
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
          admin.notifyNewUsers === true &&
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

      if (
        admin.newsletter ===
        "immediata"
      ) {
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

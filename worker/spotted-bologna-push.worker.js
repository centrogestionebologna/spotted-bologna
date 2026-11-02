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
async function ottieniAccessToken(serviceAccount) {
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

  return (
    codice === "UNREGISTERED" ||
    codice === "INVALID_ARGUMENT"
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

  const urlAssoluto =
    creaUrlAssoluto(url, env);

  const messaggio = {
    message: {
      token,

      notification: {
        title,
        body
      },

      data: {
        url: urlAssoluto,
        notificationId:
          notificationId || "",
        postId:
          postId || ""
      },

      webpush: {
        fcm_options: {
          link: urlAssoluto
        },

        notification: {
          icon: "/logo192.png",
          badge: "/logo192.png"
        }
      }
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
  postId
}) {
  const serviceAccount = JSON.parse(
    env.FIREBASE_SERVICE_ACCOUNT
  );

  const accessToken =
    await ottieniAccessToken(serviceAccount);

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
  postId = null
}) {
  const endpoint =
    `https://firestore.googleapis.com/v1/projects/` +
    `${env.FIREBASE_PROJECT_ID}/databases/(default)/` +
    `documents/notifications`;

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

export default {
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
            notificationId:
              typeof corpo.notificationId ===
              "string"
                ? corpo.notificationId
                : "",
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

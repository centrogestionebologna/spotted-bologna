/*
 * Moderazione automatica della pubblicità.
 *
 * Il controllo è volutamente prudente: uno spotted che contiene un
 * riferimento commerciale non viene rifiutato, ma finisce in pending
 * anche quando la pubblicazione automatica è attiva. L'admin decide
 * poi se approvarlo.
 */

const EMAIL_RE =
  /\b[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+\b/gi;

const TELEFONO_RE =
  /(?:\+39[\s.-]?)?(?:3\d{2}[\s.-]?\d{3}[\s.-]?\d{3,4}|0\d{1,3}[\s.-]?\d{3,4}[\s.-]?\d{4}|0\d{1,3}[\s.-]?\d{6,8})\b/g;

const TLD =
  "com|it|net|org|io|me|link|shop|store|site|xyz|info|biz|app|co|eu|tv|ly|be|gg|fm|to|cc|social|online|club|pro|vip|life|live|dev|page|blog|art|space|website|tech|agency|studio|design|photo|pics|news|media|email|digital|network|solutions|services|consulting|finance|capital|money|pay|bank|market|world|today|top|uk|de|fr|es|ch|at|nl|pt|se|no|fi|dk|pl|ro|gr|tr|br|mx|ar|in|jp|cn|hk|sg|ae|il|za|nz|ie|ai|ee|bio";

const URL_RE = new RegExp(
  "(?:https?:\\/\\/|www\\.)[^\\s<>\"']+|" +
    "(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+" +
    "(?:" +
    TLD +
    ")(?:\\/[^\\s<>\"']*)?",
  "gi"
);

const HANDLE_RE =
  /(^|[\s([.,;:!?'"“”«»])@([a-z0-9][a-z0-9._]{1,29})/gi;

const PIATTAFORME = [
  {
    nome: "Instagram",
    re: /\b(instagram|insta|ig)\b/i,
    canale: false
  },
  {
    nome: "Facebook",
    re: /\b(facebook|fb)\b/i,
    canale: false
  },
  {
    nome: "Telegram",
    re: /\b(telegram|tg)\b/i,
    canale: true
  },
  {
    nome: "WhatsApp",
    re: /\b(whatsapp|wa)\b/i,
    canale: true
  },
  {
    nome: "TikTok",
    re: /\b(tiktok)\b/i,
    canale: false
  },
  {
    nome: "Twitter/X",
    re: /\b(twitter)\b/i,
    canale: false
  },
  {
    nome: "Threads",
    re: /\b(threads)\b/i,
    canale: false
  },
  {
    nome: "Snapchat",
    re: /\b(snapchat)\b/i,
    canale: false
  },
  {
    nome: "LinkedIn",
    re: /\b(linkedin)\b/i,
    canale: false
  },
  {
    nome: "YouTube",
    re: /\b(youtube)\b/i,
    canale: false
  },
  {
    nome: "Twitch",
    re: /\b(twitch)\b/i,
    canale: false
  },
  {
    nome: "Discord",
    re: /\b(discord)\b/i,
    canale: false
  },
  {
    nome: "Pinterest",
    re: /\b(pinterest)\b/i,
    canale: false
  },
  {
    nome: "OnlyFans",
    re: /\b(onlyfans)\b/i,
    canale: true
  }
];

const CONTESTO_SOCIAL_RE =
  /\b(profilo|pagina|account|canale|gruppo|seguimi|seguite|seguici|seguiteci|contattami|contattateci|contatta|scrivimi|scrivetemi|scrivici|trovami|trovateci|ci trovi|ti aspetto|siamo su|sono su|link|bio|dm|privato|messaggio|chiedi|chiedete)\b/i;

const PROFILO_RE =
  /\b(instagram|insta|ig|facebook|fb|telegram|tg|whatsapp|wa|tiktok|twitter|threads|snapchat|linkedin|youtube|twitch|discord|pinterest|onlyfans)\b\s*[:\-–—]\s*@?[a-z0-9._]{2,30}/i;

const CONTATTO_RE =
  /\b(contattami|contattateci|contatta|contattare|scrivimi|scrivetemi|scrivici|scrivete|messaggio privato|in privato|in dm|dm|chiedi il link|chiedimi il link|chiedete il link|telefonami|chiamami|chiamatemi)\b/i;

const CTA_RE =
  /\b(link in bio|in bio|link nei commenti|link in descrizione|clicca sul link|clicca qui|passa a trovarmi|ti aspetto|ci trovi|trovateci|siamo su|sono su|per info|per informazioni)\b/i;

const REGOLE_PROMO = [
  {
    etichetta: "Pubblicità esplicita",
    re: /\b(pubblicit[aà]|sponsorizzat[oaie]|sponsor|advertising)\b/i
  },
  {
    etichetta: "Linguaggio promozionale",
    re: /\b(promo|promozione|promozioni|sconto|sconti|offerta|offerte|coupon|saldi|svendita|imperdibile|approfittane|solo per voi|solo oggi|ultimi posti|iscriviti|iscrizione)\b/i
  },
  {
    etichetta: "Vendita o annuncio commerciale",
    re: /\b(vendesi|vendo|vendiamo|vendita|compro|acquista|acquistare|ordina|ordinare|prenota|prenotare|preventivo|preventivi|e-commerce|shop|store|negozio|spedizione|spediamo|consegna|pagamento|bonifico|paypal|satispay|revolut|abbonamento|abbonati|servizi)\b/i
  },
  {
    etichetta: "Annuncio di lavoro",
    re: /\b(cercasi|cerco personale|assunzione|assumiamo|offerta di lavoro|tirocinio|stage|curriculum|colloquio)\b/i
  },
  {
    etichetta: "Attività commerciale",
    re: /\b(finanziamento|prestito|mutuo|assicurazione|immobiliare|affitto|ripetizioni|personal trainer|estetista|parrucchiere|tatuatore|delivery|asporto|prenota un tavolo|menu)\b/i
  },
  {
    etichetta: "Investimenti o guadagni",
    re: /\b(crypto|criptovalute|trading|investimento|investimenti|guadagno|guadagni|entrata extra|soldi facili|lavoro da casa)\b/i
  },
  {
    etichetta: "Collaborazione commerciale",
    re: /\b(collaborazione|collab|affiliazione|sponsorizzazione)\b/i
  }
];

const PIVA_RE = /\b(?:partita\s+iva|p\.?\s?iva)\b/i;

const DOMINI_SOCIAL = [
  {
    nome: "Instagram",
    domini: ["instagram.com", "instagr.am", "ig.me"]
  },
  {
    nome: "Facebook",
    domini: [
      "facebook.com",
      "fb.com",
      "fb.me",
      "m.me",
      "messenger.com"
    ]
  },
  {
    nome: "Telegram",
    domini: ["t.me", "telegram.me", "telegram.org", "telegram.dog"]
  },
  {
    nome: "WhatsApp",
    domini: [
      "wa.me",
      "whatsapp.com",
      "api.whatsapp.com",
      "chat.whatsapp.com"
    ]
  },
  {
    nome: "TikTok",
    domini: ["tiktok.com", "vm.tiktok.com"]
  },
  {
    nome: "Twitter/X",
    domini: ["twitter.com", "x.com", "t.co"]
  },
  {
    nome: "Threads",
    domini: ["threads.net", "threads.com"]
  },
  {
    nome: "Snapchat",
    domini: ["snapchat.com"]
  },
  {
    nome: "LinkedIn",
    domini: ["linkedin.com", "lnkd.in"]
  },
  {
    nome: "YouTube",
    domini: ["youtube.com", "youtu.be"]
  },
  {
    nome: "Twitch",
    domini: ["twitch.tv"]
  },
  {
    nome: "Discord",
    domini: ["discord.gg", "discord.com"]
  },
  {
    nome: "Pinterest",
    domini: ["pinterest.com", "pin.it"]
  },
  {
    nome: "OnlyFans",
    domini: ["onlyfans.com"]
  }
];

const DOMINI_BIO = [
  "linktr.ee",
  "linkin.bio",
  "beacons.ai",
  "bio.link",
  "taplink.cc",
  "linkinprofile.com"
];

const DOMINI_SHORT = [
  "bit.ly",
  "tinyurl.com",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "cutt.ly",
  "shorturl.at",
  "buff.ly"
];

const DOMINI_MARKETPLACE = [
  "amazon.it",
  "amazon.com",
  "ebay.it",
  "ebay.com",
  "vinted.it",
  "vinted.com",
  "subito.it",
  "etsy.com",
  "aliexpress.com",
  "temu.com",
  "shein.com",
  "zalando.it"
];

const DOMINI_PAGAMENTO = [
  "paypal.com",
  "paypal.me",
  "satispay.me",
  "revolut.me",
  "patreon.com",
  "gofundme.com"
];

function pulisciLink(link) {
  return String(link || "")
    .replace(/^[<("'“«]+/, "")
    .replace(/[>"'”»)\].,;:!?]+$/, "");
}

function dominioDaLink(link) {
  return String(link || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, "");
}

function contieneDominio(dominio, elenco) {
  return elenco.some(
    (voce) =>
      dominio === voce || dominio.endsWith(`.${voce}`)
  );
}

function classificaDominio(dominio) {
  const social = DOMINI_SOCIAL.find((voce) =>
    contieneDominio(dominio, voce.domini)
  );

  if (social) {
    return {
      etichetta: `Link a ${social.nome}`,
      piattaforma: social.nome
    };
  }

  if (contieneDominio(dominio, DOMINI_BIO)) {
    return { etichetta: "Link in bio", piattaforma: null };
  }

  if (contieneDominio(dominio, DOMINI_SHORT)) {
    return { etichetta: "Link accorciato", piattaforma: null };
  }

  if (contieneDominio(dominio, DOMINI_MARKETPLACE)) {
    return { etichetta: "Link a marketplace", piattaforma: null };
  }

  if (contieneDominio(dominio, DOMINI_PAGAMENTO)) {
    return { etichetta: "Link di pagamento", piattaforma: null };
  }

  return {
    etichetta: `Link esterno (${dominio})`,
    piattaforma: null
  };
}

function normalizzaTesto(testo) {
  const base = String(testo || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\[\.\]|\(\.\)|\{\.\}/g, ".")
    .replace(/\binsta\s+gram\b/g, "instagram")
    .replace(/\bface\s+book\b/g, "facebook")
    .replace(/\btele\s+gram\b/g, "telegram")
    .replace(/\bwhats\s+app\b/g, "whatsapp")
    .replace(/\btik\s+tok\b/g, "tiktok")
    .replace(/\blink\s+tree\b/g, "linktree")
    .replace(/\s+(?:punto|dot)\s+/g, ".")
    .replace(/\s*\.\s*/g, ".")
    .replace(/\s+/g, " ")
    .trim();

  return base
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t");
}

export function analizzaPubblicita(testo) {
  const originale = String(testo || "");
  const testoSenzaEmail = originale.replace(EMAIL_RE, " ");
  const normalizzato = normalizzaTesto(originale);
  const segnali = [];
  const dominiVisti = new Set();
  const piattaformeDaLink = new Set();

  const aggiungi = (etichetta) => {
    if (etichetta && !segnali.includes(etichetta)) {
      segnali.push(etichetta);
    }
  };

  /*
   * Cerco i link sia nel testo originale sia in quello normalizzato:
   * così funzionano anche "instagram punto com" e "instagram[.]com".
   */
  for (const testoLink of [
    testoSenzaEmail,
    normalizzaTesto(testoSenzaEmail)
  ]) {
    for (const linkGrezzo of testoLink.match(URL_RE) || []) {
      const link = pulisciLink(linkGrezzo);
      const dominio = dominioDaLink(link);

      if (!dominio || dominiVisti.has(dominio)) continue;

      dominiVisti.add(dominio);

      const classificazione = classificaDominio(dominio);

      aggiungi(classificazione.etichetta);

      if (classificazione.piattaforma) {
        piattaformeDaLink.add(classificazione.piattaforma);
      }
    }
  }

  for (const handle of originale.matchAll(HANDLE_RE)) {
    const nomeHandle = handle[2].replace(/[._]+$/, "");

    if (/[a-z]/i.test(nomeHandle)) {
      aggiungi("Profilo social citato (@utente)");
      break;
    }
  }

  if (originale.match(EMAIL_RE)) {
    aggiungi("Indirizzo email");
  }

  if (originale.match(TELEFONO_RE)) {
    aggiungi("Numero di telefono");
  }

  if (CONTATTO_RE.test(normalizzato)) {
    aggiungi("Invito al contatto privato");
  }

  if (CTA_RE.test(normalizzato)) {
    aggiungi("Invito a cliccare o scrivere");
  }

  for (const regola of REGOLE_PROMO) {
    if (regola.re.test(normalizzato)) {
      aggiungi(regola.etichetta);
    }
  }

  if (PIVA_RE.test(normalizzato)) {
    aggiungi("Dati commerciali (P. IVA)");
  }

  const contestoSocial = CONTESTO_SOCIAL_RE.test(normalizzato);
  const profiloConDuePunti = PROFILO_RE.test(normalizzato);

  for (const piattaforma of PIATTAFORME) {
    if (!piattaforma.re.test(normalizzato)) continue;
    if (piattaformeDaLink.has(piattaforma.nome)) continue;

    if (piattaforma.canale) {
      aggiungi(`Canale di contatto: ${piattaforma.nome}`);
    } else if (contestoSocial || profiloConDuePunti) {
      aggiungi(`Profilo social: ${piattaforma.nome}`);
    }
  }

  const segnaliFinali = segnali.slice(0, 8);

  return {
    rilevata: segnaliFinali.length > 0,
    segnali: segnaliFinali,
    flagReason:
      segnaliFinali.length > 0
        ? `Pubblicità rilevata: ${segnaliFinali
            .slice(0, 3)
            .join(" · ")}`
        : null
  };
}

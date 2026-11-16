import { analizzaPubblicita } from "./moderazione";

describe("analizzaPubblicita", () => {
  test.each([
    "Seguimi su Instagram @negozio.bologna",
    "https://t.me/gruppo_bologna",
    "https://www.facebook.com/evento",
    "Vendo biglietti, scrivimi in DM",
    "Sconto 20% solo per voi",
    "Info e preventivi: 333 123 4567",
    "www.example.com",
    "Cerco personale per il locale",
    "instagram punto com/negozio",
    "1nstagram: mario",
    "Il mio profilo Instagram è @mario",
    "Scrivimi su WhatsApp",
    "Seguici sulla pagina Facebook",
    "Offro ripetizioni di matematica",
    "info@example.com"
  ])("manda in moderazione: %s", (testo) => {
    const risultato = analizzaPubblicita(testo);

    expect(risultato.rilevata).toBe(true);
    expect(risultato.flagReason).toContain(
      "Pubblicità rilevata"
    );
  });

  test.each([
    "Ciao Bologna, cerco consigli su un buon libro",
    "Ieri sera ho visto una partita incredibile",
    "Instagram ha cambiato algoritmo",
    "Ho letto un articolo su Facebook",
    "La mia email è privata",
    "Dott.ssa Rossi",
    "Ciao, come stai?"
  ])("lascia passare: %s", (testo) => {
    const risultato = analizzaPubblicita(testo);

    expect(risultato.rilevata).toBe(false);
    expect(risultato.flagReason).toBeNull();
  });

  test("riconosce un link Instagram", () => {
    const risultato = analizzaPubblicita(
      "https://www.instagram.com/negozio"
    );

    expect(risultato.segnali).toContain("Link a Instagram");
  });

  test("riconosce Telegram come canale di contatto", () => {
    const risultato = analizzaPubblicita(
      "Scrivimi su Telegram"
    );

    expect(risultato.segnali).toContain(
      "Canale di contatto: Telegram"
    );
  });

  test("riconosce un profilo citato", () => {
    const risultato = analizzaPubblicita(
      "Il mio profilo Instagram è @mario"
    );

    expect(risultato.segnali).toContain(
      "Profilo social citato (@utente)"
    );
  });
});

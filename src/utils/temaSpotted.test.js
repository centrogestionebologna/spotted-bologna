import { scegliTemaSpotted } from "./temaSpotted";

describe("scegliTemaSpotted", () => {
  test.each([
    [
      "Mi piacerebbe fare amicizia, sono di Imola e vado in palestra Buenavida",
      "gym",
      "Imola"
    ],
    ["Pizza e aperitivo in centro a Bologna", "food", "Bologna"],
    ["Serata in discoteca fino a tardi", "nightlife", "Bologna"],
    ["Esame all'università, non dormo da giorni", "university", "Bologna"],
    ["Partita allo stadio con la squadra", "sport", "Bologna"],
    ["Tramonto in montagna durante un'escursione", "nature", "Bologna"],
    ["Concerto live con la band", "music", "Bologna"],
    ["Adozione di un cucciolo al canile", "animals", "Bologna"],
    ["Colloquio di lavoro in ufficio", "work", "Bologna"],
    ["Il mio fidanzato mi ha sorpreso", "love", "Bologna"],
    ["Weekend a Firenze", "travel", "Firenze"],
    ["Ciao Bologna, come va?", "bologna", "Bologna"]
  ])(
    "riconosce il tema di: %s",
    (testo, chiaveAttesa, localitaAttesa) => {
      const tema = scegliTemaSpotted(testo);

      expect(tema.chiave).toBe(chiaveAttesa);
      expect(tema.localita).toBe(localitaAttesa);
      expect(tema.file).toBeTruthy();
      expect(tema.files.length).toBeGreaterThanOrEqual(3);
      expect(tema.files).toContain(tema.file);
      expect(tema.tags).toContain(localitaAttesa);
    }
  );

  test("usa Bologna come località predefinita", () => {
    const tema = scegliTemaSpotted("Ciao a tutti!");

    expect(tema.localita).toBe("Bologna");
    expect(tema.chiave).toBe("bologna");
  });

  test("non scambia Bolognina per Bologna", () => {
    const tema = scegliTemaSpotted("Abito in Bolognina");

    expect(tema.localita).toBe("Bolognina");
  });

  test("alterna più sfondi per lo stesso tema", () => {
    const sfondi = new Set(
      Array.from({ length: 18 }, (_, indice) =>
        scegliTemaSpotted(
          "Pizza e aperitivo in centro",
          `post-${indice}`
        ).file
      )
    );

    expect(sfondi.size).toBeGreaterThan(1);
  });
});

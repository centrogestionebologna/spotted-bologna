import {
  MODELLI_VERTICALE,
  azzeraModelliVerticale,
  scegliModelloVerticale
} from "./modelliSpottedVerticale";

describe("scegliModelloVerticale", () => {
  beforeEach(() => {
    azzeraModelliVerticale();
  });

  test("alterna i cinque modelli e poi ricomincia dal primo", () => {
    const chiavi = Array.from(
      { length: MODELLI_VERTICALE.length },
      () => scegliModelloVerticale().chiave
    );

    expect(chiavi).toEqual(
      MODELLI_VERTICALE.map((modello) => modello.chiave)
    );
    expect(scegliModelloVerticale().chiave).toBe(
      MODELLI_VERTICALE[0].chiave
    );
  });

  test("ogni modello ha uno sfondo con almeno tre colori", () => {
    MODELLI_VERTICALE.forEach((modello) => {
      expect(modello.chiave).toBeTruthy();
      expect(modello.sfondo.stop.length).toBeGreaterThanOrEqual(3);

      modello.sfondo.stop.forEach(([posizione, colore]) => {
        expect(posizione).toBeGreaterThanOrEqual(0);
        expect(posizione).toBeLessThanOrEqual(1);
        expect(colore).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });
  });
});

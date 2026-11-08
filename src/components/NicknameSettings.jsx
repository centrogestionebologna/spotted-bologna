import { useState } from "react";

/*
 * Pannello aperto toccando il nickname nell'intestazione: mostra il
 * nickname attuale e permette di chiederne il cambio. La richiesta
 * resta in attesa finche' un admin non la approva.
 */
function NicknameSettings({
  nickname,
  richiestaNickname,
  richiediCambioNickname,
  richiestaNicknameInCorso
}) {
  const [nuovoNickname, setNuovoNickname] = useState(nickname);
  const [messaggio, setMessaggio] = useState("");

  const inviaRichiesta = async () => {
    setMessaggio("");

    const risultato = await richiediCambioNickname(
      nuovoNickname
    );

    if (risultato?.error) {
      setMessaggio(`❌ ${risultato.error}`);
      return;
    }

    setMessaggio(
      "✅ Richiesta inviata: un admin la approverà a breve."
    );
  };

  const richiestaValida =
    nuovoNickname.trim().length >= 3 &&
    nuovoNickname.trim() !== nickname;

  return (
    <div className="impostazioni-nickname">

      <p className="impostazioni-riga">
        <span>Nickname attuale</span>
        <strong>{nickname}</strong>
      </p>

      {richiestaNickname ? (
        <p className="nickname-request-pending">
          ⏳ Richiesta in attesa:{" "}
          <strong>
            {richiestaNickname.newNickname}
          </strong>
          . Serve l'approvazione di un admin.
        </p>
      ) : (
        <div className="nickname-edit-box">

          <label
            className="impostazioni-etichetta"
            htmlFor="nuovo-nickname"
          >
            Nuovo nickname
          </label>

          <input
            id="nuovo-nickname"
            type="text"
            value={nuovoNickname}
            maxLength={30}
            placeholder="Nuovo nickname"
            onChange={(evento) =>
              setNuovoNickname(evento.target.value)
            }
            onKeyDown={(evento) => {
              if (evento.key === "Enter" && richiestaValida) {
                inviaRichiesta();
              }
            }}
            disabled={richiestaNicknameInCorso}
          />

          <button
            type="button"
            onClick={inviaRichiesta}
            disabled={
              richiestaNicknameInCorso || !richiestaValida
            }
          >
            {richiestaNicknameInCorso
              ? "Invio..."
              : "Invia richiesta"}
          </button>

          <p className="impostazioni-nota">
            Il nuovo nickname deve essere approvato da un
            admin: fino ad allora resta quello attuale.
          </p>

        </div>
      )}

      {messaggio && (
        <p className="nickname-request-message">
          {messaggio}
        </p>
      )}

    </div>
  );
}

export default NicknameSettings;

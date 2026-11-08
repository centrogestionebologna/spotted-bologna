import { useState } from "react";

import {
  attivaNotifichePush,
  infoSupportoPush
} from "../services/pushNotifications";

function ProfileCard({
  nickname,
  iscritti,

  newsletter,
  setNewsletter,

  notifyComments,
  setNotifyComments,

  notifyLikes,
  setNotifyLikes,

  notifyPending,
  setNotifyPending,
  notifyReports,
  setNotifyReports,
  notifyNewUsers,
  setNotifyNewUsers,
  notifyNewPosts,
  setNotifyNewPosts,
  notifyAllComments,
  setNotifyAllComments,
  notifyAllLikes,
  setNotifyAllLikes,

  salvaNewsletter,

  notifications,
  nonLette,

  markAllNotificationsRead,

  isAdmin,

  apriSpotted,
  richiestaNickname,
  richiediCambioNickname,
  richiestaNicknameInCorso
}) {

const [attivazionePush, setAttivazionePush] =
  useState(false);

/*
 * Cambio nickname: la casella di inserimento resta chiusa finche'
 * l'utente non tocca “modifica”.
 */
const [mostraCambioNickname, setMostraCambioNickname] =
  useState(false);

const [nuovoNickname, setNuovoNickname] =
  useState("");

const [messaggioCambioNickname, setMessaggioCambioNickname] =
  useState("");

const inviaRichiestaCambio = async () => {
  setMessaggioCambioNickname("");

  const risultato =
    await richiediCambioNickname(
      nuovoNickname
    );

  if (risultato?.error) {
    setMessaggioCambioNickname(
      `❌ ${risultato.error}`
    );
    return;
  }

  setMessaggioCambioNickname("");
  setMostraCambioNickname(false);
};

/*
 * Si vedono sempre le tre notifiche piu' recenti; “Mostra altre
 * notifiche” apre le successive, che sono le piu' vecchie.
 */
const LIMITE_NOTIFICHE_INIZIALE = 3;
const PASSO_NOTIFICHE = 5;

const [
  notificheVisibiliNumero,
  setNotificheVisibiliNumero
] = useState(LIMITE_NOTIFICHE_INIZIALE);

const notificheVisibili = notifications.slice(
  0,
  notificheVisibiliNumero
);

const notificheNascoste =
  notifications.length -
  notificheVisibili.length;

const supportoPush = infoSupportoPush();

const notificheGiaAttive =
  typeof Notification !== "undefined" &&
  Notification.permission === "granted";

const [messaggioPush, setMessaggioPush] =
  useState("");

const gestisciAttivazionePush = async () => {
  try {
    setAttivazionePush(true);
    setMessaggioPush("");

    await attivaNotifichePush();

    setMessaggioPush(
      "✅ Notifiche push attivate su questo dispositivo."
    );
  } catch (errore) {
    console.error(
      "Errore durante l'attivazione delle notifiche push:",
      errore
    );

    setMessaggioPush(
      `❌ ${errore.message}`
    );
  } finally {
    setAttivazionePush(false);
  }
};

  return (
    <div className="section-card">

      <h2>PROFILO</h2>

      <p className="profile-nickname-row">
        <span>
          <strong>Nickname:</strong> {nickname}
        </span>

        <span className="profile-iscritti">
          {iscritti} iscritti
        </span>

        {!mostraCambioNickname &&
          !richiestaNickname && (
            <button
              type="button"
              className="nickname-edit-btn"
              onClick={() => {
                setNuovoNickname(nickname);
                setMessaggioCambioNickname("");
                setMostraCambioNickname(true);
              }}
            >
              modifica
            </button>
          )}
      </p>

      {richiestaNickname && (
        <p className="nickname-request-pending">
          ⏳ Richiesta in attesa:{" "}
          <strong>
            {richiestaNickname.newNickname}
          </strong>
          . Serve l'approvazione di un admin.
        </p>
      )}

      {mostraCambioNickname &&
        !richiestaNickname && (
          <div className="nickname-edit-box">
            <input
              type="text"
              value={nuovoNickname}
              maxLength={30}
              placeholder="Nuovo nickname"
              onChange={(e) =>
                setNuovoNickname(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  inviaRichiestaCambio();
                }
              }}
            />

            <button
              type="button"
              onClick={inviaRichiestaCambio}
              disabled={
                richiestaNicknameInCorso
              }
            >
              {richiestaNicknameInCorso
                ? "Invio..."
                : "Invia richiesta"}
            </button>

            <button
              type="button"
              onClick={() =>
                setMostraCambioNickname(
                  false
                )
              }
            >
              Annulla
            </button>

            <p
              style={{
                fontSize: "12px",
                color: "#999",
                marginTop: "6px"
              }}
            >
              Il nuovo nickname deve
              essere approvato da un
              admin: fino ad allora resta
              quello attuale.
            </p>
          </div>
        )}

      {messaggioCambioNickname && (
        <p className="nickname-request-message">
          {messaggioCambioNickname}
        </p>
      )}

      <details className="notification-dropdown">

        <summary>
          🔔 Notifiche ({nonLette})
        </summary>

<div className="push-notifications-box">
  <p>
    Ricevi le notifiche di Spotted Bologna anche quando il
    sito non è aperto.
  </p>

  <button
    type="button"
    onClick={gestisciAttivazionePush}
    disabled={attivazionePush}
  >
    {attivazionePush
      ? "Attivazione..."
      : "Attiva notifiche push"}
  </button>

  {supportoPush.iOS &&
    !supportoPush.standalone && (
      <p className="push-notifications-message">
        📱 Su iPhone le notifiche
        funzionano solo dall'app
        installata: tocca Condividi,
        scegli “Aggiungi alla
        schermata Home” e riapri
        Spotted Bologna dall'icona.
      </p>
    )}

  {notificheGiaAttive &&
    !(supportoPush.iOS &&
      !supportoPush.standalone) && (
      <p className="push-notifications-message">
        🔔 Notifiche attive su questo
        dispositivo.
      </p>
    )}

  {messaggioPush && (
    <p className="push-notifications-message">
      {messaggioPush}
    </p>
  )}
</div>

        <div className="notifications-layout">

          {/* COLONNA SINISTRA */}

          <div className="notifications-left">

            <h3>Newsletter</h3>

            <label className="newsletter-option">
              <input
                type="radio"
                name="newsletter"
                checked={newsletter === "mai"}
                onChange={() => setNewsletter("mai")}
              />
              <span>Mai</span>
            </label>

            <label className="newsletter-option">
              <input
                type="radio"
                name="newsletter"
                checked={newsletter === "giornaliera"}
                onChange={() =>
                  setNewsletter("giornaliera")
                }
              />
              <span>
                Giornaliera — riepilogo alle 14
              </span>
            </label>

            <label className="newsletter-option">
              <input
                type="radio"
                name="newsletter"
                checked={newsletter === "settimanale"}
                onChange={() =>
                  setNewsletter("settimanale")
                }
              />
              <span>
                Settimanale — riepilogo
                domenica alle 14
              </span>
            </label>

            {isAdmin && (
              
              <label className="newsletter-option">
                <input
                  type="radio"
                  name="newsletter"
                  checked={
                    newsletter === "immediata"
                  }
                  onChange={() =>
                    setNewsletter("immediata")
                  }
                />
                <span>Immediata</span>
              </label>
            )}

            <hr />

            <h3>Attività sugli spotted seguiti</h3>

            <div className="notification-row">
              <span>Commenti</span>

              <input
                type="checkbox"
                checked={notifyComments}
                onChange={() =>
                  setNotifyComments(
                    !notifyComments
                  )
                }
              />
            </div>

            <div className="notification-row">
              <span>Like</span>

              <input
                type="checkbox"
                checked={notifyLikes}
                onChange={() =>
                  setNotifyLikes(
                    !notifyLikes
                  )
                }
              />
            </div>

            {isAdmin && (
              <>
                <hr />
                <h3>Notifiche amministratore</h3>
                <div className="notification-row">
                  <span>Nuovi iscritti</span>
                  <input
                    type="checkbox"
                    checked={notifyNewUsers}
                    onChange={() => setNotifyNewUsers(!notifyNewUsers)}
                  />
                </div>
                <div className="notification-row">
                  <span>Nuovi post pubblicati</span>
                  <input
                    type="checkbox"
                    checked={notifyNewPosts}
                    onChange={() => setNotifyNewPosts(!notifyNewPosts)}
                  />
                </div>
                <div className="notification-row">
                  <span>Nuovi contenuti pending</span>
                  <input
                    type="checkbox"
                    checked={notifyPending}
                    onChange={() => setNotifyPending(!notifyPending)}
                  />
                </div>
                <div className="notification-row">
                  <span>Post segnalati</span>
                  <input
                    type="checkbox"
                    checked={notifyReports}
                    onChange={() => setNotifyReports(!notifyReports)}
                  />
                </div>
                <div className="notification-row">
                  <span>Tutti i commenti</span>
                  <input
                    type="checkbox"
                    checked={notifyAllComments}
                    onChange={() => setNotifyAllComments(!notifyAllComments)}
                  />
                </div>
                <div className="notification-row">
                  <span>Tutti i like</span>
                  <input
                    type="checkbox"
                    checked={notifyAllLikes}
                    onChange={() => setNotifyAllLikes(!notifyAllLikes)}
                  />
                </div>
              </>
            )}

            <button
              className="save-notification-btn"
              onClick={salvaNewsletter}
            >
              Salva preferenze
            </button>

          </div>

          {/* COLONNA DESTRA */}

          <div className="notifications-right">

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                marginBottom: "15px"
              }}
            >

              <h3>
                🔔 Notifiche ({nonLette})
              </h3>

              <button
                onClick={
                  markAllNotificationsRead
                }
              >
                ✅ Segna tutte lette
              </button>

            </div>

            {notifications.length === 0 && (
              <p>Nessuna notifica</p>
            )}

            {notificheVisibili.map(
              (notifica) => (
                <div
                  key={notifica.id}
                  className={`notification-card ${
                    !notifica.read
                      ? "notification-unread"
                      : ""
                  } ${
                    notifica.postId
                      ? "notification-clickable"
                      : ""
                  }`}
                  onClick={() => {
                    if (
                      notifica.postId &&
                      typeof apriSpotted ===
                        "function"
                    ) {
                      apriSpotted(
                        notifica.postId
                      );
                    }
                  }}
                  title={
                    notifica.postId
                      ? "Vai allo spotted"
                      : undefined
                  }
                >

                  <strong>
                    {notifica.title}
                  </strong>

                  <p>
                    {notifica.body}
                  </p>

                  <small>
                    {new Date(
                      notifica.createdAt
                    ).toLocaleString(
                      "it-IT"
                    )}

                    {notifica.postId && (
                      <span className="notification-open-hint">
                        {" "}
                        · ➜ vedi spotted
                      </span>
                    )}
                  </small>

                </div>
              )
            )}

            {notificheNascoste > 0 && (
              <button
                type="button"
                className="notifications-show-more"
                onClick={() =>
                  setNotificheVisibiliNumero(
                    (correnti) =>
                      correnti + PASSO_NOTIFICHE
                  )
                }
              >
                Mostra altre notifiche (
                {notificheNascoste})
              </button>
            )}

          </div>

        </div>

      </details>

    </div>
  );
}

export default ProfileCard;
import { useState } from "react";

import {
  attivaNotifichePush,
  verificaNotifichePush,
  infoSupportoPush
} from "../services/pushNotifications";

/*
 * Pannello aperto dalla campanella: push, riepiloghi, preferenze sulle
 * attivita' e elenco delle notifiche, con lo stesso comportamento che
 * aveva la card profilo.
 */
function NotificationSettings({
  newsletter,
  setNewsletter,

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

  apriSpotted
}) {
  const [attivazionePush, setAttivazionePush] =
    useState(false);

  const [messaggioPush, setMessaggioPush] =
    useState("");

  const [verificaPush, setVerificaPush] =
    useState(false);

  const [messaggioVerificaPush, setMessaggioVerificaPush] =
    useState("");

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
    notifications.length - notificheVisibili.length;

  const supportoPush = infoSupportoPush();

  const notificheGiaAttive =
    typeof Notification !== "undefined" &&
    Notification.permission === "granted";

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

      setMessaggioPush(`❌ ${errore.message}`);
    } finally {
      setAttivazionePush(false);
    }
  };

  const gestisciVerificaPush = async () => {
    try {
      setVerificaPush(true);
      setMessaggioVerificaPush("");

      const risultato =
        await verificaNotifichePush();

      const totale =
        risultato.totalDevices ||
        risultato.sent;

      setMessaggioVerificaPush(
        `✅ Notifica di prova inviata${
          totale > 1
            ? ` (${risultato.sent} su ${totale} dispositivi)`
            : ""
        }. Controlla la notifica sul dispositivo.`
      );
    } catch (errore) {
      console.error(
        "Errore durante la verifica delle notifiche push:",
        errore
      );

      setMessaggioVerificaPush(
        `❌ ${errore.message}`
      );
    } finally {
      setVerificaPush(false);
    }
  };

  return (
    <div className="impostazioni-notifiche">

      <div className="push-notifications-box">
        <p>
          Ricevi le notifiche di Spotted Bologna anche
          quando il sito non è aperto.
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

        <button
          type="button"
          onClick={gestisciVerificaPush}
          disabled={verificaPush || attivazionePush}
        >
          {verificaPush
            ? "Invio della prova..."
            : "📨 Invia notifica di prova"}
        </button>

        {supportoPush.iOS && !supportoPush.standalone && (
          <p className="push-notifications-message">
            📱 Su iPhone le notifiche funzionano solo
            dall'app installata: tocca Condividi, scegli
            “Aggiungi alla schermata Home” e riapri
            Spotted Bologna dall'icona.
          </p>
        )}

        {notificheGiaAttive &&
          !(supportoPush.iOS && !supportoPush.standalone) && (
            <p className="push-notifications-message">
              🔔 Notifiche attive su questo dispositivo.
            </p>
          )}

        {messaggioPush && (
          <p className="push-notifications-message">
            {messaggioPush}
          </p>
        )}

        {messaggioVerificaPush && (
          <p className="push-notifications-message">
            {messaggioVerificaPush}
          </p>
        )}
      </div>

      <div className="notifications-layout">

        <div className="notifications-left">

          <h3>Riepilogo</h3>

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
              onChange={() => setNewsletter("giornaliera")}
            />
            <span>Giornaliera — riepilogo alle 14</span>
          </label>

          <label className="newsletter-option">
            <input
              type="radio"
              name="newsletter"
              checked={newsletter === "settimanale"}
              onChange={() => setNewsletter("settimanale")}
            />
            <span>
              Settimanale — riepilogo domenica alle 14
            </span>
          </label>

          {isAdmin && (
            <label className="newsletter-option">
              <input
                type="radio"
                name="newsletter"
                checked={newsletter === "immediata"}
                onChange={() => setNewsletter("immediata")}
              />
              <span>Immediata — push a ogni nuovo spotted</span>
            </label>
          )}

          {isAdmin && (
            <>
              <hr />
              <h3>Notifiche amministratore</h3>

              <div className="notification-row">
                <span>Nuovi iscritti</span>
                <input
                  type="checkbox"
                  checked={notifyNewUsers}
                  onChange={() =>
                    setNotifyNewUsers(!notifyNewUsers)
                  }
                />
              </div>

              <div className="notification-row">
                <span>Nuovi post pubblicati</span>
                <input
                  type="checkbox"
                  checked={notifyNewPosts}
                  onChange={() =>
                    setNotifyNewPosts(!notifyNewPosts)
                  }
                />
              </div>

              <div className="notification-row">
                <span>Nuovi contenuti pending</span>
                <input
                  type="checkbox"
                  checked={notifyPending}
                  onChange={() =>
                    setNotifyPending(!notifyPending)
                  }
                />
              </div>

              <div className="notification-row">
                <span>Post segnalati</span>
                <input
                  type="checkbox"
                  checked={notifyReports}
                  onChange={() =>
                    setNotifyReports(!notifyReports)
                  }
                />
              </div>

              <div className="notification-row">
                <span>Tutti i commenti</span>
                <input
                  type="checkbox"
                  checked={notifyAllComments}
                  onChange={() =>
                    setNotifyAllComments(!notifyAllComments)
                  }
                />
              </div>

              <div className="notification-row">
                <span>Tutti i like</span>
                <input
                  type="checkbox"
                  checked={notifyAllLikes}
                  onChange={() =>
                    setNotifyAllLikes(!notifyAllLikes)
                  }
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

        <div className="notifications-right">

          <div className="notifications-head">
            <h3>🔔 Le tue notifiche ({nonLette})</h3>

            <button
              type="button"
              onClick={markAllNotificationsRead}
            >
              ✅ Segna tutte lette
            </button>
          </div>

          {notifications.length === 0 && (
            <p>Nessuna notifica</p>
          )}

          {notificheVisibili.map((notifica) => (
            <div
              key={notifica.id}
              className={`notification-card ${
                !notifica.read ? "notification-unread" : ""
              } ${
                notifica.postId
                  ? "notification-clickable"
                  : ""
              }`}
              onClick={() => {
                if (
                  notifica.postId &&
                  typeof apriSpotted === "function"
                ) {
                  apriSpotted(notifica.postId);
                }
              }}
              title={
                notifica.postId
                  ? "Vai allo spotted"
                  : undefined
              }
            >
              <strong>{notifica.title}</strong>

              <p>{notifica.body}</p>

              <small>
                {new Date(
                  notifica.createdAt
                ).toLocaleString("it-IT")}

                {notifica.postId && (
                  <span className="notification-open-hint">
                    {" "}
                    · ➜ vedi spotted
                  </span>
                )}
              </small>
            </div>
          ))}

          {notificheNascoste > 0 && (
            <button
              type="button"
              className="notifications-show-more"
              onClick={() =>
                setNotificheVisibiliNumero(
                  (correnti) => correnti + PASSO_NOTIFICHE
                )
              }
            >
              Mostra altre notifiche ({notificheNascoste})
            </button>
          )}

        </div>

      </div>

    </div>
  );
}

export default NotificationSettings;

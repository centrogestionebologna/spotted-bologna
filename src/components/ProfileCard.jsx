import "./ProfileCard.jsx";
import { useState } from "react";

import {
  attivaNotifichePush
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

  salvaNewsletter,

  notifications,
  nonLette,

  markAllNotificationsRead,

  isAdmin
}) {

const [attivazionePush, setAttivazionePush] =
  useState(false);

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

      <p>
        <strong>Nickname:</strong> {nickname}
      </p>

      <p>
        <strong>Iscritti:</strong> {iscritti}
      </p>

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
              <span>Giornaliera</span>
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
              <span>Settimanale</span>
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

            {notifications.map(
              (notifica) => (
                <div
                  key={notifica.id}
                  className={`notification-card ${
                    !notifica.read
                      ? "notification-unread"
                      : ""
                  }`}
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
                  </small>

                </div>
              )
            )}

          </div>

        </div>

      </details>

    </div>
  );
}

export default ProfileCard;
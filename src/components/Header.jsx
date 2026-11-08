import Logo from "./Logo";

function Header({
  nickname,
  logout,
  unreadNotifications,
  onNotificationsClick
}) {
  return (
    <div className="header">

      <div className="header-left">
        <h1
          className="header-logo"
          aria-label="Spotted Bologna Official"
        >
          <Logo variant="header" />
        </h1>
      </div>

      {nickname && (
        <div className="header-right">

          <div
            className="nickname-badge"
            title={nickname}
          >
            {nickname}
          </div>

          <button
            type="button"
            className="notification-btn"
            aria-label="Apri notifiche"
            onClick={onNotificationsClick}
          >
            🔔
            {unreadNotifications > 0 && (
              <span className="notification-badge">
                {unreadNotifications}
              </span>
            )}
          </button>

          <button
            type="button"
            className="logout-btn"
            onClick={logout}
          >
            Esci
          </button>

        </div>
      )}

    </div>
  );
}

export default Header;

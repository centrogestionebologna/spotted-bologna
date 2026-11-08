import Logo from "./Logo";

function Header({
  nickname,
  logout,
  unreadNotifications,
  onNicknameClick,
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

          <button
            type="button"
            className="nickname-badge"
            title="Impostazioni nickname"
            aria-label="Apri le impostazioni del nickname"
            onClick={onNicknameClick}
          >
            {nickname}
          </button>

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

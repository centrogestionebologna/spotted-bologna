function Header({
  nickname,
  logout,
  unreadNotifications,
  onNotificationsClick
}) {
  return (
    <div className="header">

      <div className="header-left">
        <h1>
          SPOTTED BOLOGNA OFFICIAL
        </h1>
      </div>

<div className="header-right">

  {nickname && (
    <>
      <div className="nickname-badge">
        {nickname}
      </div>

<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: "15px"
  }}
>

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
        className="logout-btn"
        onClick={logout}
      >
        Esci
      </button>

</div>

    </>
  )}

</div>

    </div>

  );
}

export default Header;
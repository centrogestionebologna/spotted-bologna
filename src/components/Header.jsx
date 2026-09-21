function Header({
  nickname,
  logout
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

      <button
        className="logout-btn"
        onClick={logout}
      >
        Esci
      </button>
    </>
  )}

</div>

    </div>
  );
}

export default Header;
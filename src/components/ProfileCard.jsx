function ProfileCard() {
  return (
    <div className="section-card">

      <h2>Profilo</h2>

      <p>
        <strong>Nickname:</strong> Boss
      </p>

      <p>
        <strong>Iscritti:</strong> 157
      </p>

      <h3>Newsletter</h3>

      <label>
        <input
          type="radio"
          name="newsletter"
        />
        Immediata
      </label>

      <br />

      <label>
        <input
          type="radio"
          name="newsletter"
        />
        Giornaliera
      </label>

      <br />

      <label>
        <input
          type="radio"
          name="newsletter"
        />
        Settimanale
      </label>

      <br />
      <br />

      <button>
        Salva preferenze
      </button>

    </div>
  );
}

export default ProfileCard;
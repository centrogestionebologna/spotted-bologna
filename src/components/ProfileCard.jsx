import { useState } from "react";
function ProfileCard({
  nickname,
  iscritti,
  newsletter,
  setNewsletter,
  salvaNewsletter
}) {
return (
    <div className="section-card">

      <h2>Profilo</h2>

      <p>
        <strong>Nickname:</strong> {nickname}
      </p>

      <p>
        <strong>Iscritti:</strong> {iscritti}
      </p>

      <h3>Newsletter</h3>

<div className="newsletter-options">

  <label className="newsletter-option">
  <input
    type="radio"
    name="newsletter"
    checked={newsletter === "immediata"}
    onChange={() =>
      setNewsletter("immediata")
    }
  />
  <span>Immediata</span>
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

</div>

      <br />
      <br />

      <button onClick={salvaNewsletter}>
  Salva preferenze
</button>

    </div>
  );
}

export default ProfileCard;
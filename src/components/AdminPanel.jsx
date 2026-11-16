const linkValido = (link) =>
  /^https?:\/\//i.test(link || "");

const pubblicitaRilevata = (post) =>
  /^Pubblicità rilevata:/i.test(
    String(post.flagReason || "")
  );

const dettaglioPubblicita = (post) =>
  String(post.flagReason || "")
    .replace(/^Pubblicità rilevata:\s*/i, "")
    .trim();

function AdminPanel({
  pendingPosts,
  approvaPost,
  rifiutaPost
}) {
  return (
    <>
      {pendingPosts.map((post) => {
        const isPubblicita = pubblicitaRilevata(post);
        const dettaglio = dettaglioPubblicita(post);

        return (
          <article
            key={post.id}
            className={`admin-pending-card${
              isPubblicita ? " is-advertising" : ""
            }`}
          >
            <div className="admin-pending-head">
              <h3>
                {post.type === "groupProposal"
                  ? "📚 Proposta Gruppo"
                  : "📝 Spotted Normale"}
              </h3>

              {isPubblicita && (
                <span className="admin-pending-ad-badge">
                  🛡️ Pubblicità
                </span>
              )}
            </div>

            {isPubblicita && (
              <div className="admin-pending-ad-alert">
                <strong>
                  Pubblicità rilevata automaticamente
                </strong>

                <p>{dettaglio}</p>

                <p className="admin-pending-ad-help">
                  Controlla link, profili, contatti e linguaggio
                  promozionale prima di approvare.
                </p>
              </div>
            )}

            <p className="admin-pending-text">
              {post.text || "Testo non disponibile."}
            </p>

            {post.type === "groupProposal" && (
              <>
                <p className="admin-pending-meta">
                  <strong>🔗 Link gruppo:</strong>
                  <br />
                  {linkValido(post.groupLink) ? (
                    <a
                      className="admin-pending-link"
                      href={post.groupLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {post.groupLink}
                    </a>
                  ) : (
                    <span className="admin-pending-invalid-link">
                      Link non valido: {post.groupLink}
                    </span>
                  )}
                </p>

                <p className="admin-pending-meta">
                  <strong>❤️ Like richiesti:</strong>{" "}
                  {post.requiredLikes}
                </p>
              </>
            )}

            {post.reports > 0 && (
              <p className="admin-pending-meta">
                🚩 Segnalazioni: {post.reports}
              </p>
            )}

            {post.flagReason && !isPubblicita && (
              <p className="admin-pending-meta">
                🚩 Motivo: {post.flagReason}
              </p>
            )}

            <div className="admin-pending-actions">
              <button onClick={() => approvaPost(post)}>
                ✅ Approva
              </button>

              <button onClick={() => rifiutaPost(post.id)}>
                ❌ Rifiuta
              </button>
            </div>
          </article>
        );
      })}
    </>
  );
}

export default AdminPanel;

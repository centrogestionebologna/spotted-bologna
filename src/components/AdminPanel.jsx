const linkValido = (link) =>
  /^https?:\/\//i.test(link || "");

function AdminPanel({
  pendingPosts,
  approvaPost,
  rifiutaPost
}) {
  return (
    <>
      {pendingPosts.map((post) => (
        <div
          key={post.id}
          style={{
            border: "2px solid orange",
            padding: "15px",
            marginBottom: "15px",
            borderRadius: "10px"
          }}
        >
          <h3>
            {post.type === "groupProposal"
              ? "📚 Proposta Gruppo"
              : "📝 Spotted Normale"}
          </h3>

          <p>{post.text}</p>

          {post.type === "groupProposal" && (
            <>
              <p>
                <strong>🔗 Link gruppo:</strong>
                <br />
                {linkValido(post.groupLink) ? (
                  <a
                    href={post.groupLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {post.groupLink}
                  </a>
                ) : (
                  <span style={{ color: "#ff5252" }}>
                    Link non valido: {post.groupLink}
                  </span>
                )}
              </p>

              <p>
                <strong>❤️ Like richiesti:</strong>{" "}
                {post.requiredLikes}
              </p>
            </>
          )}

          {post.reports > 0 && (
            <p
              style={{
                color: "#ff9800",
                fontWeight: "bold"
              }}
            >
              🚩 Segnalazioni: {post.reports}
            </p>
          )}

          {post.flagReason && (
            <p style={{ color: "#ff9800" }}>
              🚩 Motivo: {post.flagReason}
            </p>
          )}

          <div style={{ marginTop: "15px" }}>
            <button onClick={() => approvaPost(post)}>
              ✅ Approva
            </button>

            <button
              onClick={() => rifiutaPost(post.id)}
              style={{ marginLeft: "10px" }}
            >
              ❌ Rifiuta
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

export default AdminPanel;
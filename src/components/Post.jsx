import { useState } from "react";
import CommentSection from "./CommentSection";

const linkValido = (link) => /^https?:\/\//i.test(link || "");

function Post({
  post,
  comments,
  user,
  commentInputs,
  setCommentInputs,
  inviaCommento,
  likes,
  toggleLike,
  segnalaPost,
  isAdmin,
  caricaCommenti,
  eliminaPost
}) {
  const [showLikes, setShowLikes] = useState(false);

  const isGroupProposal = post.type === "groupProposal";

  const postLikes = likes.filter((like) => like.postId === post.id);
  const likesCount = postLikes.length;
  const commentsCount = comments.filter((c) => c.postId === post.id).length;

  const requiredLikes = post.requiredLikes ?? 10;
  const likesMancanti = Math.max(requiredLikes - likesCount, 0);
  const gruppoSbloccato = likesCount >= requiredLikes;

  const ora = Date.now();
  const setteGiorni = 7 * 24 * 60 * 60 * 1000;

  const creatoIl = post.createdAt ? new Date(post.createdAt).getTime() : null;
  const sbloccatoIl = post.unlockedAt
    ? new Date(post.unlockedAt).getTime()
    : null;

  const scadutoSenzaTarget =
    !gruppoSbloccato && creatoIl !== null && ora > creatoIl + setteGiorni;

  const scadutoDopoSblocco =
    gruppoSbloccato && sbloccatoIl !== null && ora > sbloccatoIl + setteGiorni;

  const giaSegnalato =
    !!user && !!post.reportedBy && post.reportedBy.includes(user.uid);

  const haMessoLike =
    !!user && postLikes.some((like) => like.userId === user.uid);

  const condividi = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          text: post.text,
          url: window.location.origin
        });
      } else {
        await navigator.clipboard.writeText(
          `${post.text}\n\n${window.location.origin}`
        );
        alert("Link copiato!");
      }
    } catch (error) {
      // L'utente ha chiuso la finestra di condivisione: nessun problema
      console.error(error);
    }
  };

  // La conferma è già in App.js (eliminaPost): qui non la ripeto
  const confermaElimina = () => eliminaPost(post.id);

  return (
    <div className="post-card">
      {isGroupProposal && (
        <h3 style={{ color: "#f5c542", marginBottom: "15px" }}>
          📚 PROPOSTA GRUPPO
        </h3>
      )}

      <p>{post.text}</p>

      {post.createdAt && (
        <p style={{ fontSize: "12px", color: "#999", marginTop: "8px" }}>
          {new Date(post.createdAt).toLocaleDateString("it-IT")}
        </p>
      )}

      {/* Sezione proposta gruppo */}
      {isGroupProposal && (
        <div style={{ marginTop: "15px" }}>
          <p style={{ fontWeight: user ? "bold" : "normal" }}>
            {user ? `❤️ ${likesCount} / ${requiredLikes}` : likesCount} like
          </p>

          {!user && (
            <p style={{ color: "#ffcc00", fontWeight: "bold" }}>
              🔒 Accedi per visualizzare il link
            </p>
          )}

          {user && (
            <>
              {scadutoSenzaTarget && (
                <>
                  <p style={{ color: "#ff5252", fontWeight: "bold" }}>
                    ⏰ Scaduto
                  </p>
                  <p style={{ color: "#999" }}>
                    Obiettivo non raggiunto entro 7 giorni.
                  </p>
                </>
              )}

              {!gruppoSbloccato && !scadutoSenzaTarget && (
                <>
                  <p style={{ color: "#ffcc00" }}>🔒 Link nascosto</p>
                  <p style={{ color: "#999" }}>
                    Servono ancora {likesMancanti} like per sbloccare il gruppo.
                  </p>
                </>
              )}

              {gruppoSbloccato && !scadutoDopoSblocco && (
                <>
                  <p style={{ color: "#4caf50", fontWeight: "bold" }}>
                    ✅ Gruppo sbloccato
                  </p>
                  {linkValido(post.groupLink) && (
                    <a
                      href={post.groupLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      🔗 Apri gruppo
                    </a>
                  )}
                </>
              )}

              {scadutoDopoSblocco && (
                <>
                  <p style={{ color: "#ff5252", fontWeight: "bold" }}>
                    ⏰ Scaduto
                  </p>
                  <p style={{ color: "#999" }}>
                    Il periodo di accesso al gruppo è terminato.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Azioni utente: solo per le proposte gruppo.
          Negli spotted normali i tasti stanno in fondo, in CommentSection. */}
      {user && isGroupProposal && (
        <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
          <button onClick={() => toggleLike(post.id)}>
            {haMessoLike ? "❤️" : "🤍"}
          </button>

          <button
            onClick={() => segnalaPost(post.id)}
            style={{
              backgroundColor: giaSegnalato ? "#d32f2f" : "white",
              color: giaSegnalato ? "white" : "black",
              fontSize: "18px"
            }}
          >
            🚩
          </button>

          <button onClick={condividi}>🔗</button>
        </div>
      )}

      {/* Azioni admin */}
      {isAdmin && (
        <div style={{ textAlign: "right", marginBottom: "10px" }}>
          <button onClick={confermaElimina}>🗑 Elimina spotted</button>
        </div>
      )}

      {/* Contatori (solo post normali) */}
      {!isGroupProposal && user && (
        <div className="interaction-bar">
          <div className="interaction-left"></div>
          <div
            className="interaction-right"
            onClick={() => setShowLikes(!showLikes)}
          >
            {likesCount} like - {commentsCount} commenti
          </div>
        </div>
      )}

      {!isGroupProposal && !user && (
        <p style={{ color: "#cfcfcf", marginTop: "15px" }}>
          {likesCount} like - {commentsCount} commenti
        </p>
      )}

      {/* Lista di chi ha messo like */}
      {user && showLikes && !isGroupProposal && (
        <div className="like-panel" style={{ marginBottom: "20px" }}>
          <strong>Hanno messo like:</strong>
          {postLikes.map((like) => (
            <div key={like.id}>{like.nickname}</div>
          ))}
        </div>
      )}

      {/* Commenti */}
      {user && !isGroupProposal && (
        <CommentSection
          post={post}
          comments={comments}
          user={user}
          commentInputs={commentInputs}
          setCommentInputs={setCommentInputs}
          inviaCommento={inviaCommento}
          isAdmin={isAdmin}
          caricaCommenti={caricaCommenti}
          likes={likes}
          toggleLike={toggleLike}
          segnalaPost={segnalaPost}
        />
      )}
    </div>
  );
}

export default Post;
import { useState } from "react";
import CommentSection from "./CommentSection";

const disegnaTestoACapo = (context, testo, x, y, maxWidth, lineHeight) => {
  const righe = [];
  String(testo || "").split("\n").forEach((paragrafo) => {
    let riga = "";
    paragrafo.split(/\s+/).forEach((parola) => {
      const candidata = riga ? `${riga} ${parola}` : parola;
      if (riga && context.measureText(candidata).width > maxWidth) {
        righe.push(riga);
        riga = parola;
      } else {
        riga = candidata;
      }
    });
    righe.push(riga);
  });

  righe.forEach((riga, indice) => {
    context.fillText(riga, x, y + indice * lineHeight);
  });
  return righe.length;
};

const scaricaImmaginePost = async (post, likesCount, commentsCount) => {
  const width = 900;
  const height = 2000;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas non disponibile");

  const sfondo = context.createLinearGradient(0, 0, width, height);
  sfondo.addColorStop(0, "#101010");
  sfondo.addColorStop(0.58, "#171417");
  sfondo.addColorStop(1, "#29152d");
  context.fillStyle = sfondo;
  context.fillRect(0, 0, width, height);

  context.textAlign = "center";
  context.fillStyle = "#ed3345";
  context.font = "bold 54px Arial, sans-serif";
  context.fillText("♥", width / 2, 84);
  context.fillStyle = "#f5f5f7";
  context.font = "900 48px Arial, sans-serif";
  context.fillText("SPOTTED", width / 2, 137);
  context.fillText("BOLOGNA", width / 2, 184);
  context.font = "300 19px Arial, sans-serif";
  context.letterSpacing = "4px";
  context.fillText("OFFICIAL", width / 2, 219);
  context.letterSpacing = "0px";

  context.textAlign = "left";
  context.fillStyle = "rgba(255,255,255,0.075)";
  context.font = "900 190px Arial, sans-serif";
  context.fillText("SPOTTED", 42, 458);
  context.fillText("BOLOGNA", 42, 660);
  context.font = "900 105px Arial, sans-serif";
  context.fillText("OFFICIAL", 56, 780);

  const cardX = 92;
  const cardY = 408;
  const cardWidth = 716;
  const padding = 49;
  const textX = cardX + padding;
  const maxTextWidth = cardWidth - padding * 2;
  let fontSize = 57;
  let lineHeight = 70;
  let lineCount = 0;
  let cardHeight = 0;

  do {
    context.font = `${fontSize}px Arial, sans-serif`;
    const righe = String(post.text || "").split("\n").reduce((totale, paragrafo) => {
      let riga = "";
      let numeroRighe = 0;
      paragrafo.split(/\s+/).forEach((parola) => {
        const candidata = riga ? `${riga} ${parola}` : parola;
        if (riga && context.measureText(candidata).width > maxTextWidth) {
          numeroRighe += 1;
          riga = parola;
        } else {
          riga = candidata;
        }
      });
      return totale + numeroRighe + 1;
    }, 0);
    lineCount = Math.max(righe, 1);
    lineHeight = Math.round(fontSize * 1.25);
    cardHeight = Math.max(
      1320,
      padding * 2 + lineCount * lineHeight + 205
    );
    if (cardHeight <= 1100 || fontSize <= 22) break;
    fontSize -= 3;
  } while (fontSize >= 22);

  const cardBottom = cardY + cardHeight;
  const cardGradient = context.createLinearGradient(cardX, cardY, cardX + cardWidth, cardBottom);
  cardGradient.addColorStop(0, "rgba(18,16,19,0.96)");
  cardGradient.addColorStop(1, "rgba(43,32,47,0.96)");
  context.fillStyle = cardGradient;
  context.strokeStyle = "rgba(190,174,202,0.62)";
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(cardX, cardY, cardWidth, cardHeight, 40);
  context.fill();
  context.stroke();

  context.textAlign = "left";
  context.fillStyle = "#f7f6f8";
  context.font = `${fontSize}px Arial, sans-serif`;
  const textTop = cardY + padding + fontSize;
  disegnaTestoACapo(context, post.text, textX, textTop, maxTextWidth, lineHeight);

  const data = post.createdAt
    ? new Date(post.createdAt).toLocaleDateString("it-IT")
    : "";
  const metaY = Math.max(
    textTop + lineCount * lineHeight + 90,
    cardY + cardHeight - 180
  );
  context.fillStyle = "#aaa7ad";
  context.font = "40px Arial, sans-serif";
  context.fillText(data, textX, metaY);
  context.fillText(`${likesCount} like - ${commentsCount} commenti`, textX, metaY + 78);

  context.textAlign = "right";
  context.fillStyle = "rgba(220,215,225,0.72)";
  context.font = "22px Arial, sans-serif";
  context.fillText("@spotted.bologna.official", width - 42, height - 42);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((immagine) => {
      if (immagine) resolve(immagine);
      else reject(new Error("Creazione immagine non riuscita"));
    }, "image/png");
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `spotted-bologna-${post.id || "post"}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

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
  eliminaPost,
  postFollowers,
  toggleFollowPost,
  followRequestInProgress,
  showDownloadImage = false,
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

const seguePost =
  user &&
  postFollowers.some(
    (f) =>
      f.postId === post.id &&
      f.userId === user.uid
  );

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

  const scaricaImmagine = async () => {
    try {
      await scaricaImmaginePost(post, likesCount, commentsCount);
    } catch (error) {
      console.error("Errore durante la creazione dell'immagine dello spotted:", error);
      alert("Non è stato possibile creare l'immagine dello spotted.");
    }
  };

  return (

<div
  id={`post-${post.id}`}
  className="post-card"
>


{user && (
  <div className="post-follow-control">
    <button
      type="button"
      className={`post-follow-btn ${seguePost ? "is-following" : ""}`}
      aria-label={seguePost ? "Smetti di seguire gli aggiornamenti" : "Segui gli aggiornamenti"}
      aria-pressed={Boolean(seguePost)}
      disabled={Boolean(followRequestInProgress?.[post.id])}
      onClick={() => toggleFollowPost(post.id)}
    >
      🔔
    </button>
  </div>
)}

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

      {showDownloadImage && (
        <div className="post-admin-tools">
          <button type="button" className="post-download-btn" onClick={scaricaImmagine}>
            ⬇️ Scarica immagine
          </button>
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
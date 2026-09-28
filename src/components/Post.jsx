import { useState } from "react";
import CommentSection from "./CommentSection";
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

  const [showLikes, setShowLikes] =
    useState(false);

const isGroupProposal =
  post.type === "groupProposal";

  const likesCount =
  likes.filter(
    (like) =>
      like.postId === post.id
  ).length;

const likesMancanti =
  Math.max(
    post.requiredLikes - likesCount,
    0
  );

const gruppoSbloccato =
  likesCount >= post.requiredLikes;

const ora = Date.now();

const setteGiorni =
  7 * 24 * 60 * 60 * 1000;

const creatoIl = post.createdAt
  ? new Date(post.createdAt).getTime()
  : 0;

const sbloccatoIl = post.unlockedAt
  ? new Date(post.unlockedAt).getTime()
  : null;

const scadutoSenzaTarget =
  !gruppoSbloccato &&
  ora > creatoIl + setteGiorni;

const scadutoDopoSblocco =
  gruppoSbloccato &&
  sbloccatoIl &&
  ora > sbloccatoIl + setteGiorni;

  return (
    <div className="post-card">
{isGroupProposal && (
  <h3
    style={{
      color: "#f5c542",
      marginBottom: "15px"
    }}
  >
    📚 PROPOSTA GRUPPO
  </h3>
)}

<p>{post.text}</p>
{post.createdAt && (
  <p
    style={{
      fontSize: "12px",
      color: "#999",
      marginTop: "8px"
    }}
  >
    {new Date(post.createdAt)
      .toLocaleDateString("it-IT")}
  </p>
)} {isGroupProposal && (

<div
  style={{
    marginTop: "15px"
  }}
>

  <p
    style={{
      fontWeight: "bold"
    }}
  >
    ❤️ {likesCount} / {post.requiredLikes} like
  </p>

  {scadutoSenzaTarget ? (

<>
  <p
    style={{
      color: "#ff5252",
      fontWeight: "bold"
    }}
  >
    ⏰ Scaduto
  </p>

  <p
    style={{
      color: "#999"
    }}
  >
    Obiettivo non raggiunto entro 7 giorni.
  </p>
</>

) : !gruppoSbloccato && (

<>
  <p
    style={{
      color: "#ffcc00"
    }}
  >
    🔒 Link nascosto
  </p>

  <p
    style={{
      color: "#999"
    }}
  >
    Servono ancora {likesMancanti} like per sbloccare il gruppo.
  </p>
</>

)}

{gruppoSbloccato && !scadutoDopoSblocco && (
    <>
      <p
        style={{
          color: "#4caf50",
          fontWeight: "bold"
        }}
      >
        ✅ Gruppo sbloccato
      </p>

      <a
  href={post.groupLink}
  target="_blank"
  rel="noopener noreferrer"
  style={{
    color: "#4caf50",
    fontWeight: "bold"
  }}
>
  🔗 Apri gruppo
</a>
    </>

  )}

{scadutoDopoSblocco && (

<>
  <p
    style={{
      color: "#ff5252",
      fontWeight: "bold"
    }}
  >
    ⏰ Scaduto
  </p>

  <p
    style={{
      color: "#999"
    }}
  >
    Il periodo di accesso al gruppo è terminato.
  </p>
</>

)}

<div
  style={{
    display: "flex",
    gap: "12px",
    marginTop: "20px"
  }}
>

  <button
    onClick={() =>
      toggleLike(post.id)
    }
  >
    {likes.some(
      (like) =>
        like.postId === post.id &&
        like.userId === user?.uid
    )
      ? "❤️"
      : "🤍"}
  </button>

  <button
    onClick={() =>
      segnalaPost(post.id)
    }
  >
    🚩
  </button>

  <button
    onClick={() => {
      if (navigator.share) {
        navigator.share({
          text: post.text
        });
      } else {
        navigator.clipboard.writeText(
          window.location.href
        );
        alert("Link copiato");
      }
    }}
  >
    🔗
  </button>

</div>


</div>

)}

      {isAdmin && (
  <div
    style={{
      textAlign: "right",
      marginBottom: "10px"
    }}
  >
    <button
  onClick={() => {

    const conferma =
      window.confirm(
        "Vuoi davvero eliminare questo spotted?"
      );

    if (conferma) {
      eliminaPost(post.id);
    }

  }}
>
  🗑 Elimina spotted
</button>
  </div>
)}

{user && !isGroupProposal && (

<div className="interaction-bar">

  <div className="interaction-left">
  </div>

  <div
    className="interaction-right"
    onClick={() =>
      setShowLikes(!showLikes)
    }
  >

    {likes.filter(
      (like) =>
        like.postId === post.id
    ).length}

    {" like - "}

    {
      comments.filter(
        (c) =>
          c.postId === post.id
      ).length
    }

    {" commenti"}

  </div>

</div>

)}


{!user && !isGroupProposal && (

<p
  style={{
    color: "#cfcfcf",
    marginTop: "15px"
  }}
>
  {likes.filter(
    (like) =>
      like.postId === post.id
  ).length}

  {" like - "}

  {
    comments.filter(
      (c) =>
        c.postId === post.id
    ).length
  }

  {" commenti"}

</p>

)}

{user && showLikes && !isGroupProposal && (
    <div
    className="like-panel"
    style={{
      marginBottom: "20px"
    }}
  >
    <strong>
      Hanno messo like:
    </strong>

{likes
  .filter(
    (like) =>
      like.postId === post.id
  )
  .map((like) => (
    <div key={like.id}>
      {like.nickname}
    </div>
))}

  </div>
)}

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
import LikeButton from "./LikeButton";
import { useState } from "react";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
function CommentSection({
  post,
  comments,
  user,
  commentInputs,
  setCommentInputs,
  inviaCommento,
  isAdmin,
  caricaCommenti,
  likes,
  toggleLike,
  segnalaPost
}) {

const eliminaCommento = async (id) => {

  await deleteDoc(
    doc(db, "comments", id)
  );

  caricaCommenti();
};

const [commentiVisibili, setCommentiVisibili] =
  useState(3);

  return (
    <>
      <h4>Commenti</h4>

      {comments
        .filter(
          (commento) =>
            commento.postId === post.id
        )
        .slice(0, commentiVisibili)
        .map((commento) => (
          <div className="comment-card">
            
           <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  }}
>

  <div>
    <strong>
      {commento.nickname}:
    </strong>{" "}
    {commento.text}
  </div>

  {user &&
  (
    commento.userId === user.uid ||
    isAdmin
  ) && (
<button
  onClick={() => {

    const conferma =
      window.confirm(
        "Vuoi davvero eliminare questo commento?"
      );

    if (conferma) {
      eliminaCommento(commento.id);
    }

  }}
  style={{
    marginLeft: "auto"
  }}
>
  🗑
</button>
  )}

</div>
          </div>
        ))}
{comments.filter(
  (commento) =>
    commento.postId === post.id
).length > 3 && (

  <button
    onClick={() =>
      setCommentiVisibili(
        commentiVisibili === 3
          ? 999
          : 3
      )
    }
  >
    {commentiVisibili === 3
      ? "Mostra altri commenti"
      : "Mostra meno"}
  </button>

)}
      {user && (

<div>

  <input
    type="text"
    placeholder="Scrivi un commento"
    value={
      commentInputs[post.id] || ""
    }
    onChange={(e) =>
      setCommentInputs({
        ...commentInputs,
        [post.id]: e.target.value
      })
    }
  />

  <div
  style={{
    display: "flex",
    gap: "10px",
    marginTop: "8px",
    alignItems: "center"
  }}
>

    <LikeButton
      liked={
        likes.some(
          (like) =>
            like.postId === post.id &&
            like.userId === user.uid
        )
      }
      onToggleLike={() =>
        toggleLike(post.id)
      }
    />

<button
  onClick={() =>
    segnalaPost(post.id)
  }
  style={{
    backgroundColor:
      post.reportedBy?.includes(user.uid)
        ? "#d32f2f"
        : "white",

    color:
      post.reportedBy?.includes(user.uid)
        ? "white"
        : "black"
  }}
>
  🚩
</button>

    <button
      onClick={() => {

        navigator.clipboard.writeText(
          window.location.href
        );

        alert("Link copiato!");

      }}
    >
      🔗
    </button>

    <button
  style={{
    marginLeft: "auto"
  }}
  onClick={() =>
    inviaCommento(post.id)
  }
>
  Invia
</button>

  </div>

</div>
      )}
    </>
  );
}

export default CommentSection;
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
  caricaCommenti
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

          <button
            onClick={() =>
              inviaCommento(post.id)
            }
          >
            Invia
          </button>
        </div>
      )}
    </>
  );
}

export default CommentSection;
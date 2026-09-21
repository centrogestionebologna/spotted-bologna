import { useState } from "react";
import LikeButton from "./LikeButton";
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
  isAdmin,
  caricaCommenti, 
  eliminaPost
}) {

  const [showLikes, setShowLikes] =
    useState(false);

  return (
    <div className="post-card">
      <p>{post.text}</p>
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

{user && (
    <div className="interaction-bar">

  <div className="interaction-left">

    <LikeButton
      liked={
        likes.some(
          (like) =>
            like.postId === post.id &&
            user &&
            like.userId === user.uid
        )
      }
      onToggleLike={() =>
        toggleLike(post.id)
      }
    />

    <button
  className="share-btn"
  onClick={() => {

    navigator.clipboard.writeText(
      window.location.href
    );

    alert("Link copiato!");

  }}
>
  ↗
</button>


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

{!user && (

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

      {showLikes && (
        <div className="like-panel">
          <strong>
            Hanno messo like:
          </strong>

          {likes
            .filter(
              (like) =>
                like.postId === post.id
            )
            .map((like) => (
              <div
  key={like.id}
  className="like-user"
>
  {like.nickname}
</div>
            ))}
        </div>
      )}

{user && (
      <CommentSection
  post={post}
  comments={comments}
  user={user}
  commentInputs={commentInputs}
  setCommentInputs={setCommentInputs}
  inviaCommento={inviaCommento}
  isAdmin={isAdmin}
  caricaCommenti={caricaCommenti}
/>
)}
    </div>
  );
}

export default Post;
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

  return (
    <div className="post-card">
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

{user && (
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

{user && showLikes && (
  <div
    className="like-panel"
    style={{
      marginBottom: "20px"
    }}
  >
    <strong>
      Hanno messo like:
    </strong>

    ...
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
  likes={likes}
  toggleLike={toggleLike}
  segnalaPost={segnalaPost}
/>
)}
    </div>
  );
}

export default Post;
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
  toggleLike
}) {

  const [showLikes, setShowLikes] =
    useState(false);

  return (
    <div className="post-card">
      <p>{post.text}</p>

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
      onClick={() =>
        navigator.clipboard.writeText(
          window.location.href
        )
      }
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

      <CommentSection
  post={post}
  comments={comments}
  user={user}
  commentInputs={commentInputs}
  setCommentInputs={setCommentInputs}
  inviaCommento={inviaCommento}
/>
    </div>
  );
}

export default Post;
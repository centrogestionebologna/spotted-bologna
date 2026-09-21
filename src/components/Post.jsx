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
    <div
      style={{
        border: "1px solid gray",
        padding: "10px",
        marginBottom: "20px"
      }}
    >
      <p>{post.text}</p>

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
        onClick={() =>
          setShowLikes(!showLikes)
        }
        style={{
          marginLeft: "10px"
        }}
      >
        Visualizza chi ha messo like
      </button>

      {showLikes && (
        <div
          style={{
            backgroundColor: "#eeeeee",
            padding: "10px",
            marginTop: "10px",
            marginBottom: "10px"
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

      <p>
        ❤️ {
          likes.filter(
            (like) =>
              like.postId === post.id
          ).length
        }
        {" | "}
        💬 {
          comments.filter(
            (c) =>
              c.postId === post.id
          ).length
        }
      </p>

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
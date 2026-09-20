import LikeButton from "./LikeButton";
import CommentSection from "./CommentSection";
function Post({
  post,
  comments,
  user,
  commentText,
  setCommentText,
  inviaCommento,
  likes,
  toggleLike
}) {
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
            (c) => c.postId === post.id
          ).length
        }
      </p>

      <CommentSection
        post={post}
        comments={comments}
        user={user}
        commentText={commentText}
        setCommentText={setCommentText}
        inviaCommento={inviaCommento}
      />
    </div>
  );
}

export default Post;
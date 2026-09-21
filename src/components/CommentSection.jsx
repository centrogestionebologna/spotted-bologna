function CommentSection({
  post,
  comments,
  user,
  commentInputs,
  setCommentInputs,
  inviaCommento
}) {
  return (
    <>
      <h4>Commenti</h4>

      {comments
        .filter(
          (commento) =>
            commento.postId === post.id
        )
        .map((commento) => (
          <div className="comment-card">
            <strong>
  {commento.nickname}:
</strong>{" "}
{commento.text}
          </div>
        ))}

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
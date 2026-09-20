function CommentSection({
  post,
  comments,
  user,
  commentText,
  setCommentText,
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
          <div
            key={commento.id}
            style={{
              backgroundColor: "#f2f2f2",
              padding: "5px",
              marginBottom: "5px"
            }}
          >
            <strong>
              {commento.nickname}
            </strong>

            <br />

            {commento.text}
          </div>
        ))}

      {user && (
        <div>
          <input
            type="text"
            placeholder="Scrivi un commento"
            value={commentText}
            onChange={(e) =>
              setCommentText(
                e.target.value
              )
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
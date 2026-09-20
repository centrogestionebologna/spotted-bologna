function LikeButton({
  liked,
  onToggleLike
}) {
  return (
    <button onClick={onToggleLike}>
      {liked ? "❤️ Like" : "🤍 Like"}
    </button>
  );
}

export default LikeButton;
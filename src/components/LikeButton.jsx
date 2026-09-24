function LikeButton({
  liked,
  onToggleLike
}) {
  return (
    <button onClick={onToggleLike}>
      {liked ? "❤️" : "🤍"}
    </button>
  );
}

export default LikeButton;
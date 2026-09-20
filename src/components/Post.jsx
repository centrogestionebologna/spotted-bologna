function Post({ post }) {
  return (
    <div
      style={{
        border: "1px solid gray",
        padding: "10px",
        marginBottom: "20px"
      }}
    >
      <p>{post.text}</p>
    </div>
  );
}

export default Post;
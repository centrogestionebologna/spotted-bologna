function AdminPanel({
  pendingPosts,
  approvaPost,
  rifiutaPost
}) {
  return (
    <div>
      <hr />

      <h2>Pannello Admin</h2>

      {pendingPosts.map((post) => (
        <div
          key={post.id}
          style={{
            border: "2px solid orange",
            padding: "10px",
            marginBottom: "10px"
          }}
        >
          <p>{post.text}</p>

          <button
            onClick={() => approvaPost(post)}
          >
            ✅ Approva
          </button>

          <button
            onClick={() => rifiutaPost(post.id)}
            style={{ marginLeft: "10px" }}
          >
            ❌ Rifiuta
          </button>
        </div>
      ))}
    </div>
  );
}

export default AdminPanel;
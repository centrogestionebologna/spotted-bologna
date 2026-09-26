function AdminPanel({
  pendingPosts,
  approvaPost,
  rifiutaPost
}) {
return (
  <details>
    <summary
      style={{
        cursor: "pointer",
        fontSize: "22px",
        fontWeight: "bold",
        marginTop: "20px",
        marginBottom: "15px"
      }}
    >
      📋 Pannello Admin ({pendingPosts.length})
    </summary>

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

{post.reports > 0 && (
  <p
    style={{
      color: "#ff9800",
      fontWeight: "bold"
    }}
  >
    🚩 Segnalazioni: {post.reports}
  </p>
)}

{post.flagReason && (
  <p
    style={{
      color: "#ff9800"
    }}
  >
    🚩 {post.flagReason}
  </p>
)}

        <button
          onClick={() => approvaPost(post)}
        >
          ✅ Approva
        </button>

        <button
          onClick={() =>
            rifiutaPost(post.id)
          }
          style={{
            marginLeft: "10px"
          }}
        >
          ❌ Rifiuta
        </button>
      </div>
    ))}
  </details>
);
}

export default AdminPanel;
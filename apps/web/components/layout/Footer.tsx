export function Footer() {
  return (
    <footer style={{
      borderTop: "1px solid var(--border-subtle)",
      padding: "20px 32px",
      display: "flex",
      gap: "20px",
      alignItems: "center",
      flexWrap: "wrap",
      fontSize: "11px",
      color: "var(--text-muted)",
      background: "var(--bg-surface)",
    }}>
      <span className="game-label" style={{ fontSize: "10px" }}>
        <span style={{ color: "var(--ore-500)" }}>ORE</span>
        <span style={{ color: "var(--wars-500)" }}>WARS</span>
        <span style={{ color: "var(--text-muted)" }}>.FUN</span>
      </span>
      <span style={{ color: "var(--border-default)" }}>|</span>
      <span>BASE CHAIN</span>
      <span style={{ color: "var(--border-default)" }}>|</span>
      <a
        href="https://x.com/orewarsdotfun"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "var(--text-muted)" }}
      >
        TWITTER
      </a>
      <span style={{ color: "var(--border-default)" }}>|</span>
      <a href="/skill.md">/SKILL.MD</a>
    </footer>
  );
}

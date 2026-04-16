export function Footer({ contractAddress = "0x..." }: { contractAddress?: string }) {
  return (
    <footer style={{
      borderTop: "1px solid var(--border-subtle)",
      padding: "20px 32px",
      display: "flex",
      gap: "24px",
      alignItems: "center",
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
        href={`https://basescan.org/address/${contractAddress}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "var(--eth-500)" }}
      >
        CONTRACT: {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
      </a>
      <span style={{ color: "var(--border-default)" }}>|</span>
      <a href="https://github.com/orewars/ore-wars" target="_blank" rel="noopener noreferrer">
        GITHUB
      </a>
      <span style={{ color: "var(--border-default)" }}>|</span>
      <a href="/skill.md">/SKILL.MD</a>
    </footer>
  );
}

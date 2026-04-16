import Link from "next/link";

export function Header() {
  return (
    <header style={{
      borderBottom: "1px solid var(--border-subtle)",
      background: "var(--bg-surface)",
      padding: "0 32px",
      height: "56px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "sticky",
      top: 0,
      zIndex: 200,
    }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: "2px" }}>
        <span className="game-label" style={{ fontSize: "14px", color: "var(--ore-500)" }}>ORE</span>
        <span className="game-label" style={{ fontSize: "14px", color: "var(--wars-500)" }}>WARS</span>
      </Link>
      <nav style={{ display: "flex", gap: "32px", alignItems: "center" }}>
        <Link href="/game" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>GAME</Link>
        <Link href="/leaderboard" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>LEADERBOARD</Link>
        <Link href="/skill.md" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>/SKILL.MD</Link>
        <Link href="/deploy" className="pixel-btn" style={{ fontSize: "9px", padding: "8px 16px" }}>
          DEPLOY AGENT
        </Link>
      </nav>
    </header>
  );
}

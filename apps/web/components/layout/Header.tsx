"use client";
import { useState } from "react";
import Link from "next/link";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

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
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: "2px", textDecoration: "none" }}>
        <span className="game-label" style={{ fontSize: "14px", color: "var(--ore-500)" }}>ORE</span>
        <span className="game-label" style={{ fontSize: "14px", color: "var(--wars-500)" }}>WARS</span>
      </Link>

      {/* Desktop nav */}
      <nav className="desktop-nav" style={{ display: "flex", gap: "32px", alignItems: "center" }}>
        <Link href="/game" style={{ fontSize: "12px", color: "var(--text-secondary)", textDecoration: "none" }}>GAME</Link>
        <Link href="/leaderboard" style={{ fontSize: "12px", color: "var(--text-secondary)", textDecoration: "none" }}>LEADERBOARD</Link>
        <Link href="/skill.md" style={{ fontSize: "12px", color: "var(--text-secondary)", textDecoration: "none" }}>/SKILL.MD</Link>
        <Link href="/deploy" className="pixel-btn" style={{ fontSize: "9px", padding: "8px 16px" }}>
          DEPLOY AGENT
        </Link>
      </nav>

      {/* Mobile hamburger */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMenuOpen(!menuOpen)}
        style={{
          display: "none",
          background: "none",
          border: "1px solid var(--border-default)",
          color: "var(--text-primary)",
          padding: "6px 10px",
          cursor: "pointer",
          fontSize: "12px",
          fontFamily: "'Press Start 2P', monospace",
        }}
      >
        {menuOpen ? "X" : "="}
      </button>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="mobile-dropdown" style={{
          position: "absolute",
          top: "56px",
          left: 0,
          right: 0,
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          padding: "16px 24px",
          gap: "16px",
          zIndex: 300,
        }}>
          <Link href="/game" onClick={() => setMenuOpen(false)} style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "'Press Start 2P', monospace" }}>GAME</Link>
          <Link href="/leaderboard" onClick={() => setMenuOpen(false)} style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "'Press Start 2P', monospace" }}>LEADERBOARD</Link>
          <Link href="/skill.md" onClick={() => setMenuOpen(false)} style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "'Press Start 2P', monospace" }}>/SKILL.MD</Link>
          <Link href="/deploy" onClick={() => setMenuOpen(false)} className="pixel-btn" style={{ fontSize: "9px", padding: "10px 16px", textAlign: "center" }}>
            DEPLOY AGENT
          </Link>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
      `}</style>
    </header>
  );
}

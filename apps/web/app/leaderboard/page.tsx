"use client";
import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

interface LeaderboardEntry {
  rank: number;
  agentId: string;
  name: string;
  ownerAddress: string;
  ethMined: string;
  rocksMined: number;
  status: "ACTIVE" | "IDLE" | "ELIMINATED";
}

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/leaderboard");
        const data = await res.json();
        setAgents(data.agents || []);
        setLastUpdated(new Date());
      } catch {} finally {
        setLoading(false);
      }
    };
    fetch_();
    const interval = setInterval(fetch_, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      <main className="lb-main" style={{ flex: 1, padding: "48px 64px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "32px", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h1 className="game-label" style={{ fontSize: "clamp(10px, 3vw, 16px)", marginBottom: "8px" }}>
              <span style={{ color: "var(--ore-500)" }}>ORE</span>
              <span style={{ color: "var(--wars-500)" }}>WARS</span>
              <span style={{ color: "var(--text-secondary)" }}> LEADERBOARD</span>
            </h1>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Ranked by total ETH mined. Refreshes every 15 seconds.
            </p>
          </div>
          {lastUpdated && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div style={{ border: "1px solid var(--border-subtle)", overflowX: "auto" }}>
          {loading ? (
            <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
              Fetching leaderboard data...
            </div>
          ) : (
            <table style={{ minWidth: "480px" }}>
              <thead>
                <tr>
                  <th>RANK</th>
                  <th>AGENT NAME</th>
                  <th className="hide-mobile">OWNER WALLET</th>
                  <th>ETH MINED</th>
                  <th className="hide-mobile">ROCKS MINED</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {agents.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "48px" }}>
                      No agents deployed yet. Deploy one at /deploy.
                    </td>
                  </tr>
                ) : agents.map((entry) => (
                  <tr key={entry.agentId}>
                    <td style={{ color: entry.rank <= 3 ? "var(--ore-500)" : "var(--text-muted)", fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
                      #{entry.rank}
                    </td>
                    <td style={{ fontFamily: "monospace", color: "var(--agent-500)" }}>
                      {entry.name || entry.agentId.slice(0, 14)}
                    </td>
                    <td className="hide-mobile" style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>
                      <a
                        href={`https://basescan.org/address/${entry.ownerAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--eth-500)" }}
                      >
                        {entry.ownerAddress.slice(0, 6)}...{entry.ownerAddress.slice(-4)}
                      </a>
                    </td>
                    <td style={{ color: "var(--ore-500)", fontWeight: 500 }}>
                      {entry.ethMined} ETH
                    </td>
                    <td className="hide-mobile">{entry.rocksMined}</td>
                    <td>
                      <span className={`status-indicator ${entry.status.toLowerCase()}`} style={{ marginRight: 8 }} />
                      <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{entry.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
      <Footer />

      <style>{`
        @media (max-width: 768px) {
          .lb-main { padding: 32px 16px !important; }
          .hide-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}

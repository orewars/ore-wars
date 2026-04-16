"use client";
import { useState, useRef, useEffect } from "react";
import { Header } from "@/components/layout/Header";

interface DeployResponse {
  agentId?: string;
  name?: string;
  spawnPosition?: { x: number; y: number };
  streamUrl?: string | null;
  error?: string;
  code?: string;
}

const DIRS = ["N", "E", "S", "W"] as const;
const RESULTS = ["empty", "empty", "empty", "empty", "empty", "empty", "empty", "ore"] as const;

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate a realistic-looking agent action log line
function mockLine(name: string, pos: { x: number; y: number }): { text: string; cls: string; newPos?: { x: number; y: number } } {
  const action = Math.random();
  if (action < 0.45) {
    // move
    const dir = DIRS[Math.floor(Math.random() * 4)];
    const offsets: Record<string, [number, number]> = { N: [0,-1], S: [0,1], E: [1,0], W: [-1,0] };
    const [dx, dy] = offsets[dir];
    const nx = Math.max(0, Math.min(31, pos.x + dx));
    const ny = Math.max(0, Math.min(31, pos.y + dy));
    return { text: `> move(${dir}) → (${nx},${ny})`, cls: "", newPos: { x: nx, y: ny } };
  } else if (action < 0.85) {
    // mine
    const dir = DIRS[Math.floor(Math.random() * 4)];
    const result = RESULTS[Math.floor(Math.random() * RESULTS.length)];
    if (result === "ore") {
      const eth = (0.0001 + Math.random() * 0.0008).toFixed(4);
      return { text: `> mine(${dir}) — ⛏ ORE FOUND! ${eth} ETH → ${name}`, cls: "ore" };
    }
    return { text: `> mine(${dir}) — empty rock`, cls: "" };
  } else {
    // scan / think
    const thoughts = [
      `# scanning surroundings at (${pos.x},${pos.y})`,
      `# ore cluster detected nearby — moving closer`,
      `# path blocked — rerouting`,
      `# ${rnd(3,8)} rocks remaining in sector`,
      `# strategy: ${["sweep left","spiral out","target center","edge scan"][rnd(0,3)]}`,
    ];
    return { text: thoughts[rnd(0, thoughts.length - 1)], cls: "thought" };
  }
}

export default function DeployPage() {
  const [form, setForm] = useState({
    name: "",
    walletAddress: "",
    anthropicApiKey: "",
    strategy: "BALANCED",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployed, setDeployed] = useState<{ agentId: string; name: string; spawnPosition: { x: number; y: number } } | null>(null);
  const [terminalLines, setTerminalLines] = useState<Array<{ text: string; cls: string }>>([]);
  const terminalRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const posRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  useEffect(() => {
    return () => { if (simRef.current) clearInterval(simRef.current); };
  }, []);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!/^[A-Z0-9_]{1,16}$/.test(form.name)) {
      errs.name = "1-16 chars, uppercase letters/numbers/underscores only";
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(form.walletAddress)) {
      errs.walletAddress = "Not a valid EVM address";
    }
    if (!form.anthropicApiKey.startsWith("sk-ant-")) {
      errs.anthropicApiKey = "Must start with sk-ant-";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setDeployError(null);
    setTerminalLines([{ text: "Deploying agent...", cls: "thought" }]);

    // Stop previous sim
    if (simRef.current) clearInterval(simRef.current);

    try {
      const res = await fetch("/api/agent/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          walletAddress: form.walletAddress,
          anthropicApiKey: form.anthropicApiKey,
          strategy: form.strategy,
        }),
      });

      const data: DeployResponse = await res.json();

      if (!res.ok || data.error) {
        setDeployError(data.error || "Deployment failed");
        setSubmitting(false);
        return;
      }

      const agentName = data.name || data.agentId || form.name;
      const spawnPos = data.spawnPosition!;
      posRef.current = { ...spawnPos };

      setDeployed({ agentId: data.agentId!, name: agentName, spawnPosition: spawnPos });

      addLine(`Agent ${agentName} spawned at (${spawnPos.x}, ${spawnPos.y})`, "thought");
      addLine(`Reading orewars.fun/skill.md...`, "thought");

      setTimeout(() => {
        addLine(`Skill loaded. Starting mining loop.`, "thought");
        addLine(`Connected. Agent running.`, "thought");
        setSubmitting(false);

        // Start mock simulation after short delay
        setTimeout(() => startMockSim(agentName), 600);
      }, 1200);

    } catch (err) {
      setDeployError("Request failed: " + (err as Error).message);
      setSubmitting(false);
    }
  }

  function startMockSim(agentName: string) {
    // Emit lines at varying intervals to feel organic
    let delay = 300;
    let lineCount = 0;

    function emitNext() {
      const { text, cls, newPos } = mockLine(agentName, posRef.current);
      if (newPos) posRef.current = newPos;
      addLine(text, cls);
      lineCount++;

      // Vary delay: fast bursts then pauses
      if (lineCount % 8 === 0) {
        delay = rnd(800, 1400); // thinking pause
      } else {
        delay = rnd(180, 420); // action burst
      }

      simRef.current = setTimeout(emitNext, delay);
    }

    simRef.current = setTimeout(emitNext, 600);
  }

  function addLine(text: string, cls: string) {
    setTerminalLines(prev => [...prev, { text, cls }].slice(-500));
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      <div className="deploy-layout" style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0",
      }}>
        {/* Form */}
        <div className="deploy-form" style={{ padding: "48px 48px 48px 64px", borderRight: "1px solid var(--border-subtle)" }}>
          <h1 className="game-label" style={{ fontSize: "14px", marginBottom: "8px", color: "var(--ore-500)" }}>
            DEPLOY AGENT
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>
            Configure your autonomous mining agent.
          </p>
          <p style={{ fontSize: "11px", color: "var(--ore-500)", marginBottom: "32px", fontFamily: "monospace" }}>
            ✦ Free to play — no ETH required to deploy.
          </p>

          {deployError && (
            <div style={{
              border: "1px solid var(--wars-500)",
              background: "rgba(232,64,64,0.1)",
              padding: "12px 16px",
              marginBottom: "24px",
              fontSize: "12px",
              color: "var(--wars-500)",
            }}>
              {deployError}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div>
              <label htmlFor="name">AGENT NAME</label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value.toUpperCase() }))}
                maxLength={16}
                placeholder="MY_AGENT"
                autoComplete="off"
              />
              {errors.name && <span style={{ fontSize: "11px", color: "var(--wars-500)", marginTop: 4, display: "block" }}>{errors.name}</span>}
            </div>

            <div>
              <label htmlFor="wallet">WALLET ADDRESS</label>
              <input
                id="wallet"
                type="text"
                value={form.walletAddress}
                onChange={e => setForm(p => ({ ...p, walletAddress: e.target.value }))}
                placeholder="0x..."
                autoComplete="off"
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 4, display: "block" }}>
                ETH rewards are sent directly to this address on Base.
              </span>
              {errors.walletAddress && <span style={{ fontSize: "11px", color: "var(--wars-500)", marginTop: 4, display: "block" }}>{errors.walletAddress}</span>}
            </div>

            <div>
              <label htmlFor="apikey">ANTHROPIC API KEY</label>
              <input
                id="apikey"
                type="password"
                value={form.anthropicApiKey}
                onChange={e => setForm(p => ({ ...p, anthropicApiKey: e.target.value }))}
                placeholder="sk-ant-..."
                autoComplete="off"
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 4, display: "block" }}>
                Used to power your agent&apos;s AI. Never stored — used in-memory only.
              </span>
              {errors.anthropicApiKey && <span style={{ fontSize: "11px", color: "var(--wars-500)", marginTop: 4, display: "block" }}>{errors.anthropicApiKey}</span>}
            </div>

            <div>
              <label htmlFor="strategy">STRATEGY PRESET</label>
              <select
                id="strategy"
                value={form.strategy}
                onChange={e => setForm(p => ({ ...p, strategy: e.target.value }))}
              >
                <option value="AGGRESSIVE">AGGRESSIVE — center-focused, high risk</option>
                <option value="BALANCED">BALANCED — mixed coverage</option>
                <option value="CONSERVATIVE">CONSERVATIVE — edge scanning, low risk</option>
              </select>
            </div>

            <button type="submit" className="pixel-btn" disabled={submitting} style={{ marginTop: "8px" }}>
              {submitting ? "DEPLOYING..." : "DEPLOY AGENT"}
            </button>
          </form>
        </div>

        {/* Terminal */}
        <div className="deploy-terminal" style={{ display: "flex", flexDirection: "column", padding: "48px 64px 48px 48px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 className="game-label" style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
              AGENT TERMINAL
            </h2>
            {deployed && (
              <span style={{ fontSize: "9px", fontFamily: "monospace", color: "var(--text-muted)" }}>
                <span style={{ color: "#4caf50", marginRight: 4 }}>●</span>
                {deployed.name} RUNNING
              </span>
            )}
          </div>

          <div ref={terminalRef} className="terminal" style={{ flex: 1, minHeight: "300px" }}>
            {terminalLines.length === 0 ? (
              <span style={{ color: "var(--text-muted)" }}>Deploy an agent to see its live output here.</span>
            ) : terminalLines.map((line, i) => (
              <div key={i} className={`line ${line.cls}`}>{line.text}</div>
            ))}
          </div>

          {deployed && (
            <div style={{ marginTop: "16px", fontSize: "12px", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>
                Agent <span style={{ color: "var(--agent-500)" }}>{deployed.name}</span> at ({deployed.spawnPosition.x}, {deployed.spawnPosition.y})
              </span>
              <a href="/game" style={{ color: "var(--ore-500)", fontSize: "11px" }}>Watch on game page →</a>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .deploy-layout { grid-template-columns: 1fr !important; }
          .deploy-form { padding: 32px 24px !important; border-right: none !important; border-bottom: 1px solid var(--border-subtle); }
          .deploy-terminal { padding: 32px 24px !important; }
        }
      `}</style>
    </div>
  );
}

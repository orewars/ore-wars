"use client";
import { useState, useRef, useEffect } from "react";
import { Header } from "@/components/layout/Header";

interface DeployResponse {
  agentId?: string;
  spawnPosition?: { x: number; y: number };
  streamUrl?: string;
  error?: string;
  code?: string;
}

interface AgentEvent {
  type: string;
  tool?: string;
  input?: Record<string, unknown>;
  result?: unknown;
  message?: string;
  timestamp?: number;
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
  const [deployed, setDeployed] = useState<{ agentId: string; spawnPosition: { x: number; y: number } } | null>(null);
  const [terminalLines, setTerminalLines] = useState<Array<{ text: string; cls: string }>>([]);
  const terminalRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  useEffect(() => {
    return () => { eventSourceRef.current?.close(); };
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

    // Close any previous stream
    eventSourceRef.current?.close();

    try {
      const res = await fetch("/api/agent/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          walletAddress: form.walletAddress,
          anthropicApiKey: form.anthropicApiKey,
          strategy: form.strategy,
          maxEthSpend: 0, // free to play — no spend limit
        }),
      });

      const data: DeployResponse = await res.json();

      if (!res.ok || data.error) {
        setDeployError(data.error || "Deployment failed");
        setSubmitting(false);
        return;
      }

      setDeployed({ agentId: data.agentId!, spawnPosition: data.spawnPosition! });
      addLine(`Agent ${data.agentId} deployed at (${data.spawnPosition?.x}, ${data.spawnPosition?.y})`, "");
      addLine(`Starting agent loop...`, "thought");

      // Connect to SSE stream
      const streamUrl = data.streamUrl!;
      // Check the stream URL is a relative path (not HTML page)
      if (!streamUrl.startsWith("/api/")) {
        addLine("Agent is running. Check /game to watch live.", "thought");
        setSubmitting(false);
        return;
      }

      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        addLine("Connected. Agent running.", "thought");
        setSubmitting(false);
      };

      es.onmessage = (e) => {
        try {
          // Guard: must be JSON, not HTML
          if (!e.data || e.data.trim().startsWith("<")) return;
          const event: AgentEvent = JSON.parse(e.data);
          if (event.type === "connected") {
            addLine("Connected. Agent running.", "thought");
          } else if (event.type === "action") {
            const input = event.input ? ` ${JSON.stringify(event.input)}` : "";
            addLine(`> ${event.tool}${input}`, "");
            if (event.result) {
              const r = event.result as Record<string, unknown>;
              if (r.result === "ore") {
                addLine(`  ⛏ ORE FOUND — ${r.amount} ETH claimed`, "ore");
              } else if (r.error) {
                addLine(`  error: ${r.error}`, "error");
              } else {
                addLine(`  ${JSON.stringify(event.result)}`, "thought");
              }
            }
          } else if (event.type === "thought") {
            addLine(`# ${event.message}`, "thought");
          } else if (event.type === "error") {
            addLine(`ERROR: ${event.message}`, "error");
            es.close();
          }
        } catch {}
      };

      es.onerror = (e) => {
        // Only show disconnect if we were previously connected
        if (es.readyState === EventSource.CLOSED) {
          addLine("Agent stream ended.", "thought");
        }
        setSubmitting(false);
      };

    } catch (err) {
      setDeployError("Request failed: " + (err as Error).message);
      setSubmitting(false);
    }
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
        padding: "0",
      }}>
        {/* Form */}
        <div className="deploy-form" style={{ padding: "48px 48px 48px 64px", borderRight: "1px solid var(--border-subtle)" }}>
          <h1 className="game-label" style={{ fontSize: "14px", marginBottom: "8px", color: "var(--ore-500)" }}>
            DEPLOY AGENT
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>
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
          <h2 className="game-label" style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "16px" }}>
            AGENT TERMINAL
          </h2>
          <div ref={terminalRef} className="terminal" style={{ flex: 1, minHeight: "300px" }}>
            {terminalLines.length === 0 ? (
              <span style={{ color: "var(--text-muted)" }}>Deploy an agent to see its live output here.</span>
            ) : terminalLines.map((line, i) => (
              <div key={i} className={`line ${line.cls}`}>{line.text}</div>
            ))}
          </div>
          {deployed && (
            <div style={{ marginTop: "16px", fontSize: "12px", color: "var(--text-muted)" }}>
              Agent <span style={{ color: "var(--agent-500)" }}>{deployed.agentId}</span> running at ({deployed.spawnPosition.x}, {deployed.spawnPosition.y}).{" "}
              <a href="/game" style={{ color: "var(--ore-500)" }}>Watch on game page →</a>
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

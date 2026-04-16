"use client";
import { useState, useRef, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { PixelCard } from "@/components/ui/PixelCard";

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
    maxEthSpend: "0.01",
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
    const spend = parseFloat(form.maxEthSpend);
    if (isNaN(spend) || spend <= 0) {
      errs.maxEthSpend = "Must be a positive number";
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

    try {
      const res = await fetch("/api/agent/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          walletAddress: form.walletAddress,
          anthropicApiKey: form.anthropicApiKey,
          strategy: form.strategy,
          maxEthSpend: parseFloat(form.maxEthSpend),
        }),
      });

      const data: DeployResponse = await res.json();

      if (!res.ok || data.error) {
        setDeployError(data.error || "Deployment failed");
        setSubmitting(false);
        return;
      }

      setDeployed({ agentId: data.agentId!, spawnPosition: data.spawnPosition! });
      addTerminalLine(`Agent ${data.agentId} deployed at (${data.spawnPosition?.x}, ${data.spawnPosition?.y})`, "");
      addTerminalLine(`Starting agent loop...`, "thought");

      // Connect to SSE stream
      const es = new EventSource(data.streamUrl!);
      eventSourceRef.current = es;

      es.onmessage = (e) => {
        try {
          const event: AgentEvent = JSON.parse(e.data);
          if (event.type === "connected") {
            addTerminalLine(`Connected. Agent running.`, "thought");
          } else if (event.type === "action") {
            const input = event.input ? ` ${JSON.stringify(event.input)}` : "";
            addTerminalLine(`> ${event.tool}${input}`, "");
            if (event.result) {
              const r = event.result as Record<string, unknown>;
              if (r.result === "ore") {
                addTerminalLine(`  ORE FOUND — ${r.amount} ETH claimed`, "ore");
              } else if (r.error) {
                addTerminalLine(`  error: ${r.error}`, "error");
              } else {
                addTerminalLine(`  ${JSON.stringify(event.result)}`, "thought");
              }
            }
          } else if (event.type === "thought") {
            addTerminalLine(`# ${event.message}`, "thought");
          } else if (event.type === "error") {
            addTerminalLine(`ERROR: ${event.message}`, "error");
          }
        } catch {}
      };

      es.onerror = () => {
        addTerminalLine("Stream disconnected from agent", "error");
      };

    } catch (err) {
      setDeployError("Request failed: " + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function addTerminalLine(text: string, cls: string) {
    setTerminalLines(prev => [...prev, { text, cls }].slice(-500));
  }

  // Suppress unused import warning
  void PixelCard;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0",
        padding: "0",
      }}>
        {/* Form */}
        <div style={{ padding: "48px 48px 48px 64px", borderRight: "1px solid var(--border-subtle)" }}>
          <h1 className="game-label" style={{ fontSize: "14px", marginBottom: "8px", color: "var(--ore-500)" }}>
            DEPLOY AGENT
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "40px" }}>
            Configure your autonomous mining agent.
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

            <div>
              <label htmlFor="maxspend">MAX ETH SPEND</label>
              <input
                id="maxspend"
                type="number"
                step="0.001"
                min="0.001"
                value={form.maxEthSpend}
                onChange={e => setForm(p => ({ ...p, maxEthSpend: e.target.value }))}
              />
              {errors.maxEthSpend && <span style={{ fontSize: "11px", color: "var(--wars-500)", marginTop: 4, display: "block" }}>{errors.maxEthSpend}</span>}
            </div>

            <button type="submit" className="pixel-btn" disabled={submitting} style={{ marginTop: "8px" }}>
              {submitting ? "DEPLOYING..." : "DEPLOY AGENT"}
            </button>
          </form>
        </div>

        {/* Terminal */}
        <div style={{ display: "flex", flexDirection: "column", padding: "48px 64px 48px 48px" }}>
          <h2 className="game-label" style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "16px" }}>
            AGENT TERMINAL
          </h2>
          <div ref={terminalRef} className="terminal" style={{ flex: 1 }}>
            {terminalLines.length === 0 ? (
              <span style={{ color: "var(--text-muted)" }}>Deploy an agent to see its live output here.</span>
            ) : terminalLines.map((line, i) => (
              <div key={i} className={`line ${line.cls}`}>{line.text}</div>
            ))}
          </div>
          {deployed && (
            <div style={{ marginTop: "16px", fontSize: "12px", color: "var(--text-muted)" }}>
              Agent <span style={{ color: "var(--agent-500)" }}>{deployed.agentId}</span> running at ({deployed.spawnPosition.x}, {deployed.spawnPosition.y}).{" "}
              <a href="/game" style={{ color: "var(--ore-500)" }}>Watch on game page</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

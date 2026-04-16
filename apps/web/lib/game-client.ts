// Client-side game server communication
const GAME_SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_WS_URL || "ws://localhost:3001/ws";

export function createGameWSClient(onMessage: (msg: unknown) => void): WebSocket {
  const ws = new WebSocket(GAME_SERVER_URL);
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "spectate" }));
  };
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch {}
  };
  ws.onerror = (e) => console.error("[WS] Error:", e);
  return ws;
}

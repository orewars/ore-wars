import React from "react";

export function CornerBrackets({
  children,
  color = "var(--ore-500)",
  style,
}: {
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ position: "relative", ...style }}>
      <div style={{
        position: "absolute", top: -1, left: -1,
        width: 10, height: 10,
        borderTop: `2px solid ${color}`,
        borderLeft: `2px solid ${color}`,
      }} />
      <div style={{
        position: "absolute", bottom: -1, right: -1,
        width: 10, height: 10,
        borderBottom: `2px solid ${color}`,
        borderRight: `2px solid ${color}`,
      }} />
      {children}
    </div>
  );
}

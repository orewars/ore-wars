import React from "react";

interface PixelCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function PixelCard({ children, className = "", style }: PixelCardProps) {
  return (
    <div className={`pixel-card ${className}`} style={style}>
      {children}
    </div>
  );
}

import React from "react";

interface PixelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  as?: "button" | "a";
  href?: string;
}

export function PixelButton({
  variant = "primary",
  size = "md",
  children,
  className = "",
  as: Component = "button",
  href,
  ...props
}: PixelButtonProps) {
  const variantClass = variant === "ghost" ? "ghost" : variant === "danger" ? "danger" : "";
  const sizeStyle = size === "sm" ? { fontSize: "8px", padding: "8px 14px" }
    : size === "lg" ? { fontSize: "12px", padding: "16px 28px" }
    : { fontSize: "10px", padding: "12px 20px" };

  if (Component === "a" && href) {
    return (
      <a href={href} className={`pixel-btn ${variantClass} ${className}`} style={sizeStyle}>
        {children}
      </a>
    );
  }

  return (
    <button className={`pixel-btn ${variantClass} ${className}`} style={sizeStyle} {...props}>
      {children}
    </button>
  );
}

import type { CSSProperties } from "react";

interface LogoWordmarkProps {
  size?: "sm" | "md" | "lg";
}

const CONFIG = {
  sm: { wordSize: "18px", dotSize: "5px", dotTop: "-5px", aiSize: "11px", aiTop: "-1px" },
  md: { wordSize: "22px", dotSize: "6px", dotTop: "-6px", aiSize: "13px", aiTop: "-1px" },
  lg: { wordSize: "28px", dotSize: "7px", dotTop: "-8px", aiSize: "17px", aiTop: "-1px" },
};

export function LogoWordmark({ size = "md" }: LogoWordmarkProps) {
  const c = CONFIG[size];

  const wrapStyle: CSSProperties = {
    fontFamily: "var(--font-sora), 'Sora', sans-serif",
    fontWeight: 600,
    fontSize: c.wordSize,
    letterSpacing: "-0.02em",
    display: "inline-flex",
    alignItems: "baseline",
    whiteSpace: "nowrap",
  };

  const dotStyle: CSSProperties = {
    display: "inline-block",
    width: c.dotSize,
    height: c.dotSize,
    background: "#2563EB",
    borderRadius: "50%",
    marginLeft: "2px",
    position: "relative",
    top: c.dotTop,
    flexShrink: 0,
  };

  const aiStyle: CSSProperties = {
    fontWeight: 300,
    fontSize: c.aiSize,
    letterSpacing: "0.05em",
    opacity: 0.45,
    marginLeft: "3px",
    position: "relative",
    top: c.aiTop,
  };

  return (
    <span style={wrapStyle} className="text-[#111827] dark:text-[#E8ECF4]">
      <span>Skolnieks</span>
      <span style={dotStyle} />
      <span style={aiStyle}>AI</span>
    </span>
  );
}

"use client";

import React, { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/themeContext";

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const emptySubscribe = () => () => {};

export function ThemeToggle({ showLabel = false, className = "", style }: ThemeToggleProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn ${className}`}
      aria-label={!mounted ? "Cambiar tema" : isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={!mounted ? "Tema" : isDark ? "Activar modo claro (Sol)" : "Activar modo oscuro (Luna)"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "8px 12px",
        borderRadius: "9999px",
        border: "1px solid var(--border)",
        backgroundColor: "var(--surface)",
        color: "var(--foreground)",
        cursor: "pointer",
        fontSize: "0.82rem",
        fontWeight: 600,
        transition: "all 0.2s ease",
        boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        ...style,
      }}
    >
      <div
        style={{
          width: "20px",
          height: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: !mounted ? "var(--text-light)" : isDark ? "#fbbf24" : "#6366f1",
          transition: "transform 0.3s ease, color 0.2s ease",
          transform: !mounted ? "rotate(0deg)" : isDark ? "rotate(180deg)" : "rotate(0deg)",
        }}
      >
        {!mounted ? (
          <div style={{ width: "18px", height: "18px" }} />
        ) : isDark ? (
          <Sun size={18} />
        ) : (
          <Moon size={18} />
        )}
      </div>
      {showLabel && (
        <span style={{ fontSize: "0.8rem", color: "var(--text-light)" }}>
          {!mounted ? "Tema" : isDark ? "Modo Oscuro" : "Modo Claro"}
        </span>
      )}
    </button>
  );
}

export default ThemeToggle;

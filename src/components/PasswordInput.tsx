"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function PasswordInput({
  label,
  error,
  helperText,
  className = "",
  style,
  id,
  placeholder = "••••••••",
  value,
  onChange,
  disabled,
  required,
  ...rest
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || (label ? `pwd-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

  const toggleVisibility = () => {
    if (!disabled) {
      setShowPassword((prev) => !prev);
    }
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            display: "block",
            fontSize: "0.85rem",
            fontWeight: 600,
            marginBottom: "6px",
            color: "var(--foreground)",
          }}
        >
          {label} {required && <span style={{ color: "var(--danger)" }}>*</span>}
        </label>
      )}

      <div style={{ position: "relative", width: "100%" }}>
        <input
          {...rest}
          id={inputId}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          className={`input-field ${className}`}
          style={{
            width: "100%",
            paddingRight: "44px", // Espacio reservado para el botón del ojo
            boxSizing: "border-box",
            ...style,
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />

        <button
          type="button"
          onClick={toggleVisibility}
          disabled={disabled}
          tabIndex={-1}
          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "transparent",
            border: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: showPassword ? "var(--primary)" : "var(--text-light)",
            borderRadius: "6px",
            transition: "color 0.2s, background-color 0.2s",
          }}
        >
          {showPassword ? (
            <EyeOff size={18} aria-hidden="true" />
          ) : (
            <Eye size={18} aria-hidden="true" />
          )}
        </button>
      </div>

      {error && (
        <span
          id={`${inputId}-error`}
          style={{
            fontSize: "0.78rem",
            color: "var(--danger)",
            marginTop: "4px",
            display: "block",
          }}
        >
          {error}
        </span>
      )}

      {helperText && !error && (
        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--text-light)",
            marginTop: "4px",
            display: "block",
          }}
        >
          {helperText}
        </span>
      )}
    </div>
  );
}

export default PasswordInput;

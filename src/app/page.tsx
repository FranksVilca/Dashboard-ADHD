"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Brain, UserCheck, HeartHandshake, ArrowRight, AlertCircle, Lock } from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { UserRole } from "@/lib/types";
import { PasswordInput } from "@/components/PasswordInput";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState("admin@cognitrain.edu");
  const [role, setRole] = useState<UserRole>("admin");
  const [password, setPassword] = useState("Admin2026!");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const ok = await login(identifier, password, role);
      if (ok) {
        if (role === "admin") {
          router.push("/dashboard/admin");
        } else if (role === "tutor") {
          router.push("/dashboard/tutor");
        } else {
          router.push("/dashboard");
        }
      } else {
        setErrorMessage("Credenciales o contraseña incorrectas para este perfil. Verifica los datos ingresados.");
      }
    } catch {
      setErrorMessage("Error de autenticación. Verifica tus credenciales.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickRoleSelect = (selectedRole: UserRole, defaultId: string, defaultPass: string) => {
    setRole(selectedRole);
    setIdentifier(defaultId);
    setPassword(defaultPass);
    setErrorMessage(null);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--background)",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient background glow (Linear/Stripe aesthetic) */}
      <div
        style={{
          position: "absolute",
          top: "-15%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "800px",
          height: "450px",
          background: "radial-gradient(ellipse at center, var(--primary-light) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
          opacity: 0.8,
        }}
        aria-hidden="true"
      />

      {/* Floating Theme Toggle */}
      <div style={{ position: "absolute", top: "20px", right: "24px", zIndex: 10 }}>
        <ThemeToggle showLabel />
      </div>

      {/* Main Login Card */}
      <div
        className="card"
        style={{
          maxWidth: "460px",
          width: "100%",
          padding: "36px 32px",
          position: "relative",
          zIndex: 1,
          boxShadow: "var(--shadow-xl)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Brand Icon & Heading */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "14px",
              backgroundColor: "var(--primary)",
              color: "#ffffff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "14px",
              boxShadow: "0 8px 16px -4px rgba(79, 70, 229, 0.4)",
            }}
          >
            <Brain size={28} />
          </div>

          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--foreground)",
              marginBottom: "6px",
            }}
          >
            CogniTrain Dashboard
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--text-light)", lineHeight: 1.4 }}>
            Plataforma Clínica de Seguimiento y Telemetría Cognitiva
          </p>
        </div>

        {/* Selector de Perfil / Rol (RBAC) */}
        <div style={{ marginBottom: "22px" }}>
          <label
            style={{
              display: "block",
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-light)",
              marginBottom: "8px",
            }}
          >
            Selecciona tu perfil de acceso:
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            <button
              type="button"
              onClick={() => handleQuickRoleSelect("admin", "admin@cognitrain.edu", "Admin2026!")}
              style={{
                padding: "10px 8px",
                borderRadius: "var(--radius-md)",
                border: role === "admin" ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                backgroundColor: role === "admin" ? "var(--primary-light)" : "var(--surface)",
                color: role === "admin" ? "var(--primary)" : "var(--foreground)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "5px",
                cursor: "pointer",
                transition: "all var(--transition-fast)",
                boxShadow: role === "admin" ? "0 0 0 2px var(--primary-border)" : "none",
              }}
            >
              <Shield size={18} color={role === "admin" ? "var(--primary)" : "var(--text-light)"} />
              <span style={{ fontSize: "0.75rem", fontWeight: role === "admin" ? 700 : 500 }}>Admin</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickRoleSelect("psychologist", "smartinez", "Sofia2026!")}
              style={{
                padding: "10px 8px",
                borderRadius: "var(--radius-md)",
                border: role === "psychologist" ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                backgroundColor: role === "psychologist" ? "var(--primary-light)" : "var(--surface)",
                color: role === "psychologist" ? "var(--primary)" : "var(--foreground)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "5px",
                cursor: "pointer",
                transition: "all var(--transition-fast)",
                boxShadow: role === "psychologist" ? "0 0 0 2px var(--primary-border)" : "none",
              }}
            >
              <UserCheck size={18} color={role === "psychologist" ? "var(--primary)" : "var(--text-light)"} />
              <span style={{ fontSize: "0.75rem", fontWeight: role === "psychologist" ? 700 : 500 }}>Psicólogo</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickRoleSelect("tutor", "maria.gomez@familia.pe", "Tutor2026!")}
              style={{
                padding: "10px 8px",
                borderRadius: "var(--radius-md)",
                border: role === "tutor" ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                backgroundColor: role === "tutor" ? "var(--primary-light)" : "var(--surface)",
                color: role === "tutor" ? "var(--primary)" : "var(--foreground)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "5px",
                cursor: "pointer",
                transition: "all var(--transition-fast)",
                boxShadow: role === "tutor" ? "0 0 0 2px var(--primary-border)" : "none",
              }}
            >
              <HeartHandshake size={18} color={role === "tutor" ? "var(--primary)" : "var(--text-light)"} />
              <span style={{ fontSize: "0.75rem", fontWeight: role === "tutor" ? 700 : 500 }}>Tutor</span>
            </button>
          </div>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div
            style={{
              padding: "10px 14px",
              marginBottom: "18px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--danger-light)",
              border: "1px solid var(--danger-border)",
              color: "var(--danger)",
              fontSize: "0.82rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "var(--foreground)",
              }}
            >
              Usuario o Correo Institucional
            </label>
            <input
              type="text"
              className="input-field"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="ej. smartinez o admin@cognitrain.edu"
              required
            />
          </div>

          <div>
            <PasswordInput
              label="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña"
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{
              width: "100%",
              marginTop: "6px",
              padding: "11px 18px",
              fontSize: "0.9rem",
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <span className="spin" style={{ display: "inline-block", width: "16px", height: "16px", border: "2px solid #ffffff", borderTopColor: "transparent", borderRadius: "50%" }} />
                Validando credenciales...
              </span>
            ) : (
              <>
                Ingresar a la Plataforma
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Security Footer Notice */}
        <div
          style={{
            marginTop: "24px",
            paddingTop: "16px",
            borderTop: "1px solid var(--border)",
            fontSize: "0.74rem",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <Lock size={13} />
          <span>Acceso seguro con cifrado PBKDF2-SHA256 y RBAC Multi-rol</span>
        </div>
      </div>
    </div>
  );
}

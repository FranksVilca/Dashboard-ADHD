"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Brain, UserCheck, HeartHandshake, ArrowRight, AlertCircle, Lock, UserPlus, X, CheckCircle } from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { UserRole } from "@/lib/types";
import { PasswordInput } from "@/components/PasswordInput";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DashboardAuthService } from "@/lib/authService";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState("admin@cognitrain.edu");
  const [role, setRole] = useState<UserRole>("admin");
  const [password, setPassword] = useState("Admin2026!");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal de registro de nuevo psicólogo
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    name: "",
    username: "",
    password: "",
    email: "",
    licenseNumber: "",
    phone: "",
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    setRegisterError(null);
    setRegisterSuccess(null);

    try {
      await DashboardAuthService.registerPsychologist(registerForm);
      setRegisterSuccess("¡Cuenta de psicólogo creada con éxito! Iniciando sesión...");
      
      // Inicio de sesión automático tras el registro
      setTimeout(async () => {
        const ok = await login(registerForm.username, registerForm.password, "psychologist");
        if (ok) {
          router.push("/dashboard");
        } else {
          setShowRegisterModal(false);
          setRole("psychologist");
          setIdentifier(registerForm.username);
          setPassword(registerForm.password);
        }
      }, 1200);
    } catch (err: unknown) {
      setRegisterError(err instanceof Error ? err.message : "Error al registrar la cuenta.");
      setIsRegistering(false);
    }
  };

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

        {/* Enlace para registrar nuevo psicólogo */}
        <div style={{ marginTop: "16px", textAlign: "center" }}>
          <button
            type="button"
            onClick={() => {
              setRegisterError(null);
              setRegisterSuccess(null);
              setShowRegisterModal(true);
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--primary)",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 8px",
              borderRadius: "var(--radius-sm)",
              transition: "all var(--transition-fast)",
            }}
            className="hover-link"
          >
            <UserPlus size={15} />
            <span>¿Eres nuevo psicólogo? Crea tu cuenta aquí</span>
          </button>
        </div>

        {/* Security Footer Notice */}
        <div
          style={{
            marginTop: "20px",
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

      {/* Modal de Registro de Nuevo Psicólogo */}
      {showRegisterModal && (
        <div className="modal-overlay" onClick={() => !isRegistering && setShowRegisterModal(false)}>
          <div className="modal-card" style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Registro de Psicólogo</h3>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-light)", margin: "2px 0 0" }}>
                    Crea tu cuenta profesional para supervisar expedientes clínicos.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isRegistering && setShowRegisterModal(false)}
                className="btn-ghost"
                style={{ padding: "4px", borderRadius: "var(--radius-sm)" }}
              >
                <X size={18} />
              </button>
            </div>

            {registerError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "var(--danger)",
                  fontSize: "0.82rem",
                  marginBottom: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{registerError}</span>
              </div>
            )}

            {registerSuccess && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(34, 197, 94, 0.12)",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                  color: "var(--success)",
                  fontSize: "0.82rem",
                  marginBottom: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <CheckCircle size={16} style={{ flexShrink: 0 }} />
                <span>{registerSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
                  Nombres y Apellidos <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej. Dr. Andrés Valdivia"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
                    Nombre de Usuario <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="ej. avaldivia"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                    required
                  />
                  <span style={{ fontSize: "0.7rem", color: "var(--text-light)", marginTop: "2px", display: "block" }}>
                    Mín. 3 car., sin espacios
                  </span>
                </div>

                <div>
                  <PasswordInput
                    label="Contraseña"
                    placeholder="Mín. 6 caracteres"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    required
                    helperText="Mín. 6 caracteres"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
                  Correo Electrónico Institucional <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="andres.valdivia@cognitrain.edu"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
                    Colegiatura / Matrícula
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej. CPP-29401"
                    value={registerForm.licenseNumber}
                    onChange={(e) => setRegisterForm({ ...registerForm, licenseNumber: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    className="input-field"
                    placeholder="+51 987 654 321"
                    value={registerForm.phone}
                    onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="btn-secondary"
                  disabled={isRegistering}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isRegistering}
                >
                  {isRegistering ? "Creando cuenta..." : "Crear Cuenta de Psicólogo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

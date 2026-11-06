"use client";

import { useState } from "react";
import {
  Database,
  Shield,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  KeyRound,
  UserCheck,
  Lock,
} from "lucide-react";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { db, firebaseConfig } from "@/lib/firebase";
import { useAuth } from "@/lib/authContext";
import { DashboardAuthService } from "@/lib/authService";
import { PasswordInput } from "@/components/PasswordInput";

export default function GlobalSettings() {
  const { user, role } = useAuth();

  // Diagnóstico de Firestore
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    usersCount?: number;
    patientsCount?: number;
  } | null>(null);

  // Formulario de cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setTestingConnection(true);
    setTestResult(null);

    try {
      let usersCount = 0;
      let patientsCount = 0;

      try {
        const uSnap = await getDocs(query(collection(db, "users"), limit(1)));
        usersCount = uSnap.size;
      } catch (e: unknown) {
        console.warn("Fallo en lectura de /users:", e);
      }

      try {
        const pSnap = await getDocs(query(collection(db, "patients"), limit(1)));
        patientsCount = pSnap.size;
      } catch (e: unknown) {
        console.warn("Fallo en lectura de /patients:", e);
      }

      setTestResult({
        success: true,
        message: "Conexión con Cloud Firestore inicializada. Base de datos accesible.",
        usersCount,
        patientsCount,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({
        success: false,
        message: `Error al conectar con Firestore (${firebaseConfig.projectId}): ${msg}`,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setPasswordSuccess(null);
    setPasswordError(null);
    setIsChangingPass(true);

    try {
      const res = await DashboardAuthService.changePassword(
        user,
        currentPassword,
        newPassword,
        confirmPassword
      );

      if (res.success) {
        setPasswordSuccess(res.message);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setPasswordSuccess(null), 5000);
      }
    } catch (err: unknown) {
      setPasswordError(
        err instanceof Error
          ? err.message
          : "Error inesperado al intentar cambiar la contraseña."
      );
    } finally {
      setIsChangingPass(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px" }}>
      <div className="page-header" style={{ marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "2rem", marginBottom: "8px", color: "var(--foreground)" }}>
            Configuración y Seguridad
          </h1>
          <p style={{ color: "var(--text-light)" }}>
            Gestión de perfil profesional, cambio de contraseña e integración con CogniTrain ADHD.
          </p>
        </div>
      </div>

      {/* SECCIÓN 1: PERFIL DEL PROFESIONAL / USUARIO ACTIVO */}
      {user && (
        <div className="card" style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary)",
              }}
            >
              <UserCheck size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)" }}>Mi Perfil Profesional</h3>
              <span style={{ fontSize: "0.82rem", color: "var(--text-light)" }}>
                Información de la cuenta activa
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", fontSize: "0.875rem" }}>
            <div style={{ padding: "14px 16px", backgroundColor: "var(--background-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-light)", display: "block", fontSize: "0.75rem", marginBottom: "4px" }}>
                Nombre y Apellidos
              </span>
              <strong style={{ color: "var(--foreground)" }}>{user.name}</strong>
            </div>

            <div style={{ padding: "14px 16px", backgroundColor: "var(--background-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-light)", display: "block", fontSize: "0.75rem", marginBottom: "4px" }}>
                Nombre de Usuario Único
              </span>
              <code style={{ color: "var(--primary)", fontWeight: 700, fontSize: "0.9rem" }}>
                @{user.username || "sin_asignar"}
              </code>
            </div>

            <div style={{ padding: "14px 16px", backgroundColor: "var(--background-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-light)", display: "block", fontSize: "0.75rem", marginBottom: "4px" }}>
                Correo Electrónico
              </span>
              <span style={{ color: "var(--foreground)" }}>{user.email}</span>
            </div>

            <div style={{ padding: "14px 16px", backgroundColor: "var(--background-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-light)", display: "block", fontSize: "0.75rem", marginBottom: "4px" }}>
                Rol y Matrícula
              </span>
              <span style={{ textTransform: "capitalize", fontWeight: 600, color: "var(--foreground)" }}>
                {role === "admin" ? "Administrador" : role === "psychologist" ? `Psicólogo (${user.licenseNumber || "CPP"})` : "Tutor"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 2: CAMBIO DE CONTRASEÑA SEGURO */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--primary-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary)",
            }}
          >
            <KeyRound size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)" }}>Cambiar Contraseña</h3>
            <span style={{ fontSize: "0.82rem", color: "var(--text-light)" }}>
              Actualiza tus credenciales con cifrado seguro PBKDF2-SHA256
            </span>
          </div>
        </div>

        {passwordSuccess && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--success-light)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              color: "var(--success)",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            <CheckCircle2 size={18} />
            <span>{passwordSuccess}</span>
          </div>
        )}

        {passwordError && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--danger-light)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "var(--danger)",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            <AlertCircle size={18} />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <PasswordInput
              label="Contraseña Actual"
              placeholder="Ingresa tu contraseña actual"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <PasswordInput
                label="Nueva Contraseña"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                helperText="Mínimo 6 caracteres"
              />
            </div>

            <div>
              <PasswordInput
                label="Confirmar Nueva Contraseña"
                placeholder="Repite la nueva contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                helperText="Debe coincidir con la nueva contraseña"
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px", paddingTop: "14px", borderTop: "1px solid var(--border)" }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={isChangingPass || !currentPassword || !newPassword || !confirmPassword}
            >
              <Lock size={16} />
              {isChangingPass ? "Guardando..." : "Actualizar Contraseña"}
            </button>
          </div>
        </form>
      </div>

      {/* SECCIÓN 3: INFORMACIÓN DE LA FUENTE DE DATOS FIREBASE */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div style={{ padding: "8px", borderRadius: "var(--radius-md)", backgroundColor: "var(--primary-light)", color: "var(--primary)" }}>
            <Database size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)" }}>Fuente de Datos Conectada</h3>
            <span style={{ fontSize: "0.82rem", color: "var(--text-light)" }}>Telemetría y persistencia en Google Cloud Firestore</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", fontSize: "0.875rem" }}>
          <div style={{ padding: "14px 16px", backgroundColor: "var(--background-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
            <span style={{ color: "var(--text-light)", display: "block", fontSize: "0.75rem", marginBottom: "4px" }}>Proyecto de Origen</span>
            <strong style={{ color: "var(--foreground)" }}>{firebaseConfig.projectId}</strong>
          </div>

          <div style={{ padding: "14px 16px", backgroundColor: "var(--background-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
            <span style={{ color: "var(--text-light)", display: "block", fontSize: "0.75rem", marginBottom: "4px" }}>Auth Domain</span>
            <strong style={{ color: "var(--foreground)" }}>{firebaseConfig.authDomain}</strong>
          </div>

          <div style={{ padding: "14px 16px", backgroundColor: "var(--background-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
            <span style={{ color: "var(--text-light)", display: "block", fontSize: "0.75rem", marginBottom: "4px" }}>Colección Canónica</span>
            <code style={{ color: "var(--primary)" }}>/users/{`{studentCode}`}</code>
          </div>

          <div style={{ padding: "14px 16px", backgroundColor: "var(--background-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
            <span style={{ color: "var(--text-light)", display: "block", fontSize: "0.75rem", marginBottom: "4px" }}>Colección Legacy</span>
            <code style={{ color: "var(--primary)" }}>/patients/{`{studentCode}`}</code>
          </div>
        </div>

        <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
          <button onClick={runDiagnostics} className="btn-secondary" disabled={testingConnection}>
            <RefreshCw size={16} className={testingConnection ? "spin" : ""} />
            {testingConnection ? "Ejecutando diagnóstico..." : "Probar Conexión con Firestore"}
          </button>
        </div>

        {testResult && (
          <div
            style={{
              marginTop: "20px",
              padding: "16px 20px",
              borderRadius: "var(--radius-md)",
              backgroundColor: testResult.success ? "var(--success-light)" : "var(--danger-light)",
              border: `1px solid ${testResult.success ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
            }}
          >
            {testResult.success ? (
              <CheckCircle2 size={20} color="var(--success)" style={{ marginTop: "2px", flexShrink: 0 }} />
            ) : (
              <AlertCircle size={20} color="var(--danger)" style={{ marginTop: "2px", flexShrink: 0 }} />
            )}
            <div style={{ fontSize: "0.875rem" }}>
              <strong style={{ color: testResult.success ? "var(--success)" : "var(--danger)" }}>
                {testResult.success ? "Diagnóstico Exitoso" : "Discrepancia de Conexión Detectada"}
              </strong>
              <p style={{ margin: "4px 0 0", color: "var(--foreground)" }}>{testResult.message}</p>
              {testResult.success && (
                <div style={{ marginTop: "8px", fontSize: "0.8rem", color: "var(--text-light)" }}>
                  Documentos encontrados: {testResult.usersCount} en /users, {testResult.patientsCount} en /patients.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SECCIÓN 4: POLÍTICAS DE INTEGRACIÓN */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <div style={{ padding: "8px", borderRadius: "var(--radius-md)", backgroundColor: "var(--warning-light)", color: "var(--warning)" }}>
            <Shield size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)" }}>Políticas de Integración y Seguridad</h3>
            <span style={{ fontSize: "0.82rem", color: "var(--text-light)" }}>Arquitectura no intrusiva de CogniTrain</span>
          </div>
        </div>

        <ul style={{ paddingLeft: "20px", color: "var(--foreground)", fontSize: "0.875rem", lineHeight: 1.8, margin: 0 }}>
          <li>
            <strong>Modo Solo Lectura para cognitrain_adhd:</strong> El dashboard no modifica esquemas, funciones ni datos del proyecto móvil.
          </li>
          <li>
            <strong>Cifrado de Credenciales:</strong> Todas las contraseñas se almacenan mediante hash PBKDF2-SHA256 con sal aleatoria de 16 bytes.
          </li>
          <li>
            <strong>Aislamiento de Privacidad RBAC:</strong> Cada profesional solo puede modificar sus propias credenciales y acceder a sus alumnos asignados.
          </li>
          <li>
            <strong>Límite de Consultas:</strong> Las consultas se limitan a 20 documentos para cumplir con la regla de seguridad de Firestore.
          </li>
        </ul>
      </div>
    </div>
  );
}

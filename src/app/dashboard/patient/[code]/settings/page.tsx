"use client";

import { useState, useEffect, use } from "react";
import { Save, Settings2, Info, Zap, Sliders, ShieldCheck } from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/authContext";
import { DashboardAuthService } from "@/lib/authService";

export default function PatientSettings({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const { code } = resolvedParams;
  const { isConsulting } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const [config, setConfig] = useState({
    distractionGracePeriod: 3,
    sessionDurationMinutes: 10,
    difficultyLevel: 1,
    autoScalingDifficulty: true,
    attentionThreshold: 0.6, // Sensibilidad mínima del clasificador (0.0 - 1.0)
  });

  useEffect(() => {
    async function loadConfig() {
      try {
        let docRef = doc(db, `users/${code}/config`, "remote_config");
        let docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          docRef = doc(db, `patients/${code}/config`, "remote_config");
          docSnap = await getDoc(docRef);
        }
        if (docSnap.exists()) {
          const data = docSnap.data();
          setConfig((prev) => ({
            ...prev,
            distractionGracePeriod: data.distractionGracePeriod ?? data.distractionGracePeriodSeconds ?? prev.distractionGracePeriod,
            sessionDurationMinutes: data.sessionDurationMinutes ?? data.defaultSessionDurationMinutes ?? prev.sessionDurationMinutes,
            difficultyLevel: data.difficultyLevel ?? prev.difficultyLevel,
            autoScalingDifficulty: data.autoScalingDifficulty ?? prev.autoScalingDifficulty,
            attentionThreshold: data.attentionThreshold ?? prev.attentionThreshold,
          }));
        }
      } catch (e) {
        console.error("Fallo al consultar remote_config de Firestore:", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, [code]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    DashboardAuthService.assertWriteAllowed("Guardar parámetros de entrenamiento remoto");
    setIsSaving(true);
    setSaveStatus(null);
    try {
      // Estructura dual compatible tanto con RemoteConfigModel como con ConfigurationModel de cognitrain_adhd
      const payload = {
        distractionGracePeriod: config.distractionGracePeriod,
        distractionGracePeriodSeconds: config.distractionGracePeriod, // Requerido por ConfigurationModel
        sessionDurationMinutes: config.sessionDurationMinutes,
        defaultSessionDurationMinutes: config.sessionDurationMinutes, // Requerido por ConfigurationModel
        difficultyLevel: config.difficultyLevel,
        autoScalingDifficulty: config.autoScalingDifficulty,
        attentionThreshold: config.attentionThreshold, // Requerido por ConfigurationModel
        lastUpdated: new Date().toISOString(),
        patientId: code,
      };

      // 1. Guardar en ruta canónica
      const userDocRef = doc(db, `users/${code}/config`, "remote_config");
      await setDoc(userDocRef, payload, { merge: true });

      // 2. Guardar en ruta legacy para compatibilidad retroactiva
      const patientDocRef = doc(db, `patients/${code}/config`, "remote_config");
      await setDoc(patientDocRef, payload, { merge: true });

      setSaveStatus("success");
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (e) {
      console.error("Error al persistir configuración remota:", e);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Cargando ajustes clínicos...</div>;
  }

  return (
    <div className="card" style={{ maxWidth: "760px", padding: "28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ backgroundColor: "var(--primary-light)", padding: "10px", borderRadius: "var(--radius-md)", color: "var(--primary)" }}>
          <Settings2 size={24} />
        </div>
        <div>
          <h2 style={{ fontSize: "1.25rem", margin: "0 0 4px", fontWeight: 700, color: "var(--foreground)" }}>Parámetros de Entrenamiento Remoto</h2>
          <p style={{ color: "var(--text-light)", fontSize: "0.85rem", margin: 0 }}>
            Los parámetros guardados son leídos por la app móvil antes de iniciar cada sesión diaria.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Escalado Automático DDA */}
        <div style={{ border: "1px solid var(--border)", padding: "18px 20px", borderRadius: "var(--radius-md)", backgroundColor: "var(--background-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "var(--foreground)", fontSize: "0.95rem" }}>
                <Zap size={18} color="var(--success)" />
                Ajuste Dinámico de Dificultad (DDA por IA)
              </label>
              <p style={{ fontSize: "0.82rem", color: "var(--text-light)", margin: "4px 0 0", lineHeight: 1.5 }}>
                Permite al algoritmo de la app móvil adaptar la velocidad y cantidad de distractores según el Focus Score de las últimas sesiones.
              </p>
            </div>
            <div style={{ position: "relative", display: "inline-block", width: "48px", height: "26px", flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={config.autoScalingDifficulty}
                onChange={(e) => setConfig({ ...config, autoScalingDifficulty: e.target.checked })}
                style={{ opacity: 0, width: "100%", height: "100%", position: "absolute", zIndex: 10, cursor: "pointer" }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: config.autoScalingDifficulty ? "var(--primary)" : "var(--border)",
                  borderRadius: "24px",
                  transition: "background-color var(--transition-fast)",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: config.autoScalingDifficulty ? "24px" : "3px",
                    top: "3px",
                    width: "20px",
                    height: "20px",
                    backgroundColor: "#ffffff",
                    borderRadius: "50%",
                    boxShadow: "var(--shadow-xs)",
                    transition: "left var(--transition-fast)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tolerancia de Distracción */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground)" }}>
              Tolerancia de Distracción / Período de Gracia
            </label>
            <span style={{ fontWeight: 700, fontSize: "0.85rem", padding: "3px 10px", backgroundColor: "var(--background-subtle)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--primary)" }}>
              {config.distractionGracePeriod}s
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={config.distractionGracePeriod}
              onChange={(e) => setConfig({ ...config, distractionGracePeriod: Number(e.target.value) })}
              style={{ flex: 1, accentColor: "var(--primary)", height: "6px" }}
            />
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-light)", marginTop: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Info size={14} /> Tiempo que el niño puede desviar la mirada antes de registrar un evento de distracción.
          </p>
        </div>

        {/* Umbral Mínimo de Atención */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground)" }}>
              Umbral de Atención Requerida (Sensibilidad Clínica)
            </label>
            <span style={{ fontWeight: 700, fontSize: "0.85rem", padding: "3px 10px", backgroundColor: "var(--background-subtle)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--primary)" }}>
              {Math.round(config.attentionThreshold * 100)}%
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <input
              type="range"
              min="0.3"
              max="0.9"
              step="0.05"
              value={config.attentionThreshold}
              onChange={(e) => setConfig({ ...config, attentionThreshold: Number(e.target.value) })}
              style={{ flex: 1, accentColor: "var(--primary)", height: "6px" }}
            />
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-light)", marginTop: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Sliders size={14} /> Sensibilidad clínica del clasificador de mirada de CogniTrain (campo <code>attentionThreshold</code>).
          </p>
        </div>

        {/* Duración de Sesión */}
        <div>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground)" }}>
            Duración Recomendada de Sesión Diaria (minutos)
          </label>
          <input
            type="number"
            min="3"
            max="30"
            className="input-field"
            value={config.sessionDurationMinutes}
            onChange={(e) => setConfig({ ...config, sessionDurationMinutes: Number(e.target.value) })}
            style={{ maxWidth: "200px" }}
          />
        </div>

        {/* Dificultad Base Manual */}
        <div style={{ opacity: config.autoScalingDifficulty ? 0.45 : 1, transition: "opacity var(--transition-fast)", pointerEvents: config.autoScalingDifficulty ? "none" : "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--foreground)" }}>
              Dificultad Manual Base (1 = Explorador, 2 = Guardián, 3 = Maestro)
            </label>
            <span style={{ fontWeight: 700, fontSize: "0.85rem", padding: "3px 10px", backgroundColor: "var(--background-subtle)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--warning)" }}>
              Nv. {config.difficultyLevel}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <input
              type="range"
              min="1"
              max="3"
              step="1"
              value={config.difficultyLevel}
              onChange={(e) => setConfig({ ...config, difficultyLevel: Number(e.target.value) })}
              style={{ flex: 1, accentColor: "var(--warning)", height: "6px" }}
              disabled={config.autoScalingDifficulty}
            />
          </div>
        </div>

        <div style={{ marginTop: "12px", paddingTop: "16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <button type="submit" className="btn-primary" disabled={isSaving || isConsulting}>
            <Save size={18} />
            {isSaving ? "Sincronizando..." : "Guardar Cambios"}
          </button>
          {isConsulting && (
            <span style={{ color: "var(--warning)", fontWeight: 500, fontSize: "0.85rem" }}>
              Modo de solo consulta: Modificación de parámetros bloqueada.
            </span>
          )}

          {saveStatus === "success" && (
            <span style={{ color: "var(--success)", fontWeight: 500, fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "6px" }}>
              <ShieldCheck size={16} /> ¡Ajustes sincronizados con éxito con CogniTrain ADHD!
            </span>
          )}
          {saveStatus === "error" && (
            <span style={{ color: "var(--danger)", fontWeight: 500, fontSize: "0.875rem" }}>
              Error al guardar en Firestore. Verifica los permisos de conexión.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

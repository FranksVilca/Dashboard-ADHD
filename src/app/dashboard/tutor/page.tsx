"use client";

import { useEffect, useState, useCallback } from "react";
import {
  HeartHandshake,
  Brain,
  Sparkles,
  Award,
  Clock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  FileText,
  RefreshCw,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/lib/authContext";
import { DashboardLinkingService } from "@/lib/linkingService";
import { DashboardObservationService } from "@/lib/observationService";
import { SpecialistDataService } from "@/lib/specialistDataService";
import {
  SpecialistSummary,
  Session,
  ProfessionalObservation,
  formatDisplayDate,
  formatAdhdSubtype,
} from "@/lib/types";

export default function TutorDashboard() {
  const { user, refreshUser, consultedUser, isConsulting } = useAuth();

  const [linkedStudents, setLinkedStudents] = useState<SpecialistSummary[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<SpecialistSummary | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [observations, setObservations] = useState<ProfessionalObservation[]>([]);

  const [linkingCodeInput, setLinkingCodeInput] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [linkingMessage, setLinkingMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStudentDetails = useCallback(async (studentId: string) => {
    try {
      const studentSessions = await SpecialistDataService.getPatientSessions(studentId, 15);
      setSessions(studentSessions);

      const target = isConsulting && consultedUser ? consultedUser : user;
      if (target) {
        // Observaciones estrictamente filtradas con visibilidad para el tutor
        const obs = DashboardObservationService.getObservationsForStudent(studentId, target);
        setObservations(obs);
      }
    } catch (e) {
      console.warn("Error cargando detalles del alumno vinculado:", e);
    }
  }, [user, isConsulting, consultedUser]);

  const loadTutorData = useCallback(async () => {
    try {
      const allSummaries = await SpecialistDataService.getAllPatientSummaries();
      const target = isConsulting && consultedUser ? consultedUser : user;
      const myLinkedIds = target?.linkedStudentIds || [];

      // Filtrar únicamente los alumnos vinculados al tutor actual (o tutor consultado)
      const myStudents = allSummaries.filter((s) => myLinkedIds.includes(s.profile.id));
      setLinkedStudents(myStudents);

      if (myStudents.length > 0) {
        const first = myStudents[0];
        setSelectedStudent(first);
        await loadStudentDetails(first.profile.id);
      } else {
        setSelectedStudent(null);
        setSessions([]);
        setObservations([]);
      }
    } catch (e) {
      console.error("Error al cargar datos del tutor:", e);
    } finally {
      setIsLoading(false);
    }
  }, [user, isConsulting, consultedUser, loadStudentDetails]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (mounted) {
        await loadTutorData();
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loadTutorData]);

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isConsulting) {
      setLinkingMessage({ type: "error", text: "No se permite canjear códigos en modo de solo consulta." });
      return;
    }
    if (!user || !linkingCodeInput.trim()) return;

    setIsLinking(true);
    setLinkingMessage(null);

    try {
      const res = await DashboardLinkingService.redeemLinkingCode(user, linkingCodeInput);
      if (res.success) {
        setLinkingMessage({ type: "success", text: res.message });
        setLinkingCodeInput("");
        refreshUser();
        setTimeout(() => setLinkingMessage(null), 5000);
      } else {
        setLinkingMessage({ type: "error", text: res.message });
      }
    } catch {
      setLinkingMessage({ type: "error", text: "Error de conexión al validar código." });
    } finally {
      setIsLinking(false);
    }
  };

  // Preparar datos para el gráfico comprensible de progreso familiar
  const chartData = sessions
    .slice()
    .reverse()
    .map((s, idx) => ({
      sessionName: `Sesión ${idx + 1}`,
      date: formatDisplayDate(s.date),
      focusScore: s.focusScore ?? Math.round((s.effectiveAttentionTime / (s.totalDurationSeconds || 300)) * 100),
      durationMin: Math.round(s.totalDurationSeconds / 60),
    }));

  return (
    <div style={{ maxWidth: "1100px" }}>
      {/* Cabecera para Padres y Tutores */}
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span className="status-badge" style={{ backgroundColor: "rgba(245, 158, 11, 0.15)", color: "var(--warning)" }}>
              <HeartHandshake size={14} style={{ marginRight: "4px" }} /> Portal de Familia y Tutores
            </span>
          </div>
          <h1 style={{ fontSize: "1.85rem", marginBottom: "4px" }}>Seguimiento de tu Alumno/a</h1>
          <p style={{ color: "#64748b" }}>
            Visualiza el progreso de entrenamiento cognitivo y las recomendaciones de su psicólogo.
          </p>
        </div>

        <button
          onClick={() => {
            SpecialistDataService.clearCache();
            loadTutorData();
          }}
          className="btn-secondary"
        >
          <RefreshCw size={16} className={isLoading ? "spin" : ""} />
          Actualizar
        </button>
      </div>

      {/* Formulario de Vinculación de Alumno mediante Código */}
      <div className="card" style={{ marginBottom: "24px", border: "1px solid rgba(79, 70, 229, 0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <div style={{ padding: "8px", borderRadius: "var(--radius-md)", backgroundColor: "var(--primary-light)", color: "var(--primary)" }}>
            <KeyRound size={18} />
          </div>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Vincular a tu Hijo/a con Código</h3>
        </div>
        <p style={{ color: "var(--text-light)", fontSize: "0.85rem", marginBottom: "16px" }}>
          Ingresa el código de vinculación provisto por el colegio o la app móvil CogniTrain ADHD para asociarlo a tu cuenta.
        </p>

        {isConsulting ? (
          <div style={{ padding: "12px 16px", backgroundColor: "var(--warning-light)", borderRadius: "var(--radius-md)", color: "var(--warning)", fontSize: "0.85rem", fontWeight: 500, border: "1px solid rgba(245, 158, 11, 0.3)" }}>
            Modo de solo consulta activo: La vinculación de alumnos está deshabilitada durante la inspección administrativa.
          </div>
        ) : (
          <form onSubmit={handleRedeemCode} style={{ display: "flex", gap: "12px", maxWidth: "500px", flexWrap: "wrap" }}>
            <input
              type="text"
              className="input-field"
              placeholder="Ej. CT-8K92F o código de app"
              value={linkingCodeInput}
              onChange={(e) => setLinkingCodeInput(e.target.value)}
              style={{ textTransform: "uppercase", fontWeight: 600, letterSpacing: "1px", flex: 1, minWidth: "220px" }}
              required
            />
            <button type="submit" className="btn-primary" disabled={isLinking} style={{ flexShrink: 0 }}>
              {isLinking ? "Validando..." : "Vincular Alumno"}
            </button>
          </form>
        )}

        {linkingMessage && (
          <div
            style={{
              marginTop: "14px",
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: linkingMessage.type === "success" ? "var(--success-light)" : "var(--danger-light)",
              border: `1px solid ${linkingMessage.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
              color: linkingMessage.type === "success" ? "var(--success)" : "var(--danger)",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {linkingMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {linkingMessage.text}
          </div>
        )}
      </div>

      {/* Si no tiene ningún alumno vinculado */}
      {linkedStudents.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-light)" }}>
          <Brain size={48} style={{ color: "var(--text-light)", opacity: 0.5, marginBottom: "16px" }} />
          <h3 style={{ color: "var(--foreground)", marginBottom: "8px", fontWeight: 700 }}>Aún no tienes alumnos vinculados</h3>
          <p style={{ maxWidth: "460px", margin: "0 auto", fontSize: "0.9rem" }}>
            Utiliza el formulario superior para ingresar el código de vinculación. Una vez asociado, podrás seguir la evolución de su atención y las pautas profesionales.
          </p>
        </div>
      ) : (
        <div>
          {/* Selector de alumno si tiene más de uno */}
          {linkedStudents.length > 1 && (
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
              {linkedStudents.map((s) => (
                <button
                  key={s.profile.id}
                  onClick={() => {
                    setSelectedStudent(s);
                    loadStudentDetails(s.profile.id);
                  }}
                  className={selectedStudent?.profile.id === s.profile.id ? "btn-primary" : "btn-secondary"}
                  style={{ fontSize: "0.85rem" }}
                >
                  {s.profile.heroName}
                </button>
              ))}
            </div>
          )}

          {/* Tarjeta de Progreso del Alumno */}
          {selectedStudent && (
            <div>
              <div className="card" style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "var(--radius-lg)",
                      backgroundColor: "var(--success-light)",
                      color: "var(--success)",
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid rgba(16, 185, 129, 0.25)",
                    }}
                  >
                    {selectedStudent.profile.heroName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <h2 style={{ fontSize: "1.35rem", margin: 0, fontWeight: 700 }}>
                        Héroe: {selectedStudent.profile.heroName}
                      </h2>
                      {selectedStudent.profile.adhdSubtype && (
                        <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "9999px", backgroundColor: "rgba(79, 70, 229, 0.12)", color: "var(--primary)", fontWeight: 600 }}>
                          TDAH: {formatAdhdSubtype(selectedStudent.profile.adhdSubtype)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-light)", marginTop: "4px" }}>
                      Última sesión: <strong>{formatDisplayDate(selectedStudent.profile.lastSessionAt, "Sin sesiones aún")}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                  <div style={{ textAlign: "center", padding: "8px 16px", backgroundColor: "var(--background-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                      <Award size={16} /> Nv. {selectedStudent.profile.level}
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-light)" }}>Nivel</span>
                  </div>

                  <div style={{ textAlign: "center", padding: "8px 16px", backgroundColor: "var(--background-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                      <Sparkles size={16} /> {selectedStudent.focusScore}%
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-light)" }}>Puntaje Foco</span>
                  </div>

                  <div style={{ textAlign: "center", padding: "8px 16px", backgroundColor: "var(--background-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--warning)", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                      <Clock size={16} /> {selectedStudent.totalSessions}
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-light)" }}>Sesiones</span>
                  </div>
                </div>
              </div>

              {/* Gráfico de Evolución de Foco para Familias */}
              <div className="card" style={{ marginBottom: "24px" }}>
                <h3 style={{ marginBottom: "16px", fontSize: "1.1rem", fontWeight: 700 }}>Evolución de Atención a lo Largo del Tiempo</h3>
                {chartData.length === 0 ? (
                  <p style={{ color: "var(--text-light)", fontSize: "0.875rem", margin: 0 }}>
                    El alumno aún no registra sesiones completadas en CogniTrain ADHD.
                  </p>
                ) : (
                  <div style={{ height: "260px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="sessionName" stroke="var(--text-light)" fontSize={12} tickMargin={10} />
                        <YAxis stroke="var(--text-light)" fontSize={12} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--foreground)" }}
                          formatter={(val) => [`${val}%`, "Nivel de Atención"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="focusScore"
                          stroke="var(--primary)"
                          strokeWidth={3}
                          dot={{ r: 4, fill: "var(--primary)" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Observaciones y Recomendaciones del Psicólogo (Solo las Autorizadas para Tutores) */}
              <div className="card">
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <div style={{ padding: "8px", borderRadius: "var(--radius-md)", backgroundColor: "var(--primary-light)", color: "var(--primary)" }}>
                    <FileText size={18} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Recomendaciones del Especialista</h3>
                </div>

                {observations.length === 0 ? (
                  <p style={{ color: "var(--text-light)", fontSize: "0.875rem", margin: 0 }}>
                    No hay observaciones o recomendaciones registradas por el psicólogo para este período.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {observations.map((obs) => (
                      <div
                        key={obs.id}
                        style={{
                          padding: "16px 20px",
                          borderRadius: "var(--radius-md)",
                          backgroundColor: "var(--background-subtle)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                          <strong style={{ fontSize: "0.95rem", color: "var(--foreground)" }}>{obs.title}</strong>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>
                            {new Date(obs.date).toLocaleDateString("es-ES")} • {obs.psychologistName}
                          </span>
                        </div>
                        <p style={{ fontSize: "0.875rem", color: "var(--foreground)", margin: 0, lineHeight: 1.6 }}>
                          {obs.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { use, useEffect, useState, useMemo } from "react";
import {
  Target,
  AlertTriangle,
  Flame,
  Award,
  Clock,
  Sparkles,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Zap,
  Coffee,
  Timer,
  BatteryMedium,
  ShieldAlert,
  CheckCircle2,
  Gamepad2,
  Star,
  Trophy,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
} from "recharts";
import { SpecialistDataService } from "@/lib/specialistDataService";
import { StudentTrackingEngine } from "@/lib/studentTracking";
import { DashboardExportUtils } from "@/lib/exportUtils";
import { calculateAttentionalBreakPoint } from "@/lib/metricsCalculator";
import ExecutiveFunctionsRadar from "@/components/ExecutiveFunctionsRadar";
import {
  UserProfile,
  Session,
  LevelAttempt,
  AttentionDataPoint,
  formatDisplayDate,
  formatAdhdSubtype,
  getMinigameInfo,
} from "@/lib/types";

export default function PatientProfile({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const { code } = resolvedParams;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [latestSession, setLatestSession] = useState<Session | null>(null);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [attempts, setAttempts] = useState<LevelAttempt[]>([]);
  const [timelineData, setTimelineData] = useState<AttentionDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [livePulsing, setLivePulsing] = useState(false);

  useEffect(() => {
    let isSubscribed = true;

    async function loadInitialData() {
      try {
        const [userProf, sessions, atts] = await Promise.all([
          SpecialistDataService.getPatientProfile(code),
          SpecialistDataService.getPatientSessions(code, 10),
          SpecialistDataService.getAllLevelAttempts(code),
        ]);

        if (!isSubscribed) return;

        setProfile(userProf);
        setRecentSessions(sessions);
        setAttempts(atts);

        if (sessions.length > 0) {
          const latest = sessions[0];
          setLatestSession(latest);

          const rawTimeline = await SpecialistDataService.getSessionMetricsTimeline(code, latest.id);
          if (!isSubscribed) return;

          if (rawTimeline.length > 0) {
            setTimelineData(rawTimeline);
          } else if (Array.isArray(latest.timeline) && latest.timeline.length > 0) {
            setTimelineData(latest.timeline);
          } else if (Array.isArray(latest.reactionTimes) && latest.reactionTimes.length > 0) {
            const reconstructed: AttentionDataPoint[] = latest.reactionTimes.map((rtMs, idx) => {
              const sec = idx * 15;
              const mm = Math.floor(sec / 60);
              const ss = (sec % 60).toString().padStart(2, "0");
              const focusScore = Math.max(20, Math.min(100, Math.round(100 - (rtMs - 400) / 10)));
              const fatigue = Math.min(95, Math.round(20 + idx * 3));
              return {
                time: `${mm}:${ss}`,
                focus: focusScore,
                fatigue,
              };
            });
            setTimelineData(reconstructed);
          } else {
            setTimelineData([]);
          }
        }
      } catch (e) {
        console.error("Error al cargar detalles del paciente:", e);
      } finally {
        if (isSubscribed) setIsLoading(false);
      }
    }

    loadInitialData();

    // Sincronización en tiempo real vía onSnapshot de Firestore
    const unsubscribe = SpecialistDataService.subscribeToPatientSessions(code, async (newSessions) => {
      if (!isSubscribed) return;
      setRecentSessions(newSessions);
      setLivePulsing(true);
      setTimeout(() => setLivePulsing(false), 2000);

      if (newSessions.length > 0) {
        const latest = newSessions[0];
        setLatestSession(latest);

        if (Array.isArray(latest.timeline) && latest.timeline.length > 0) {
          setTimelineData(latest.timeline);
        } else {
          const rawTimeline = await SpecialistDataService.getSessionMetricsTimeline(code, latest.id);
          if (isSubscribed && rawTimeline.length > 0) {
            setTimelineData(rawTimeline);
          }
        }
      }
    });

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [code]);

  const totalFocus = latestSession?.totalFocusSeconds ?? latestSession?.effectiveAttentionTime ?? 0;
  const sessionDuration = latestSession?.totalDurationSeconds || (totalFocus > 0 ? totalFocus : 300);
  const distractions =
    latestSession?.distractionsPerMinute ??
    (latestSession?.distractionTime ? +(latestSession.distractionTime / 10).toFixed(1) : 0);
  const focusPercentage = sessionDuration > 0 ? Math.round((totalFocus / sessionDuration) * 100) : 0;
  const trend = StudentTrackingEngine.calculateTrend(recentSessions);

  // Estado operativo explícito del alumno (Sin iniciar, Con actividad, En progreso, Completado, Inactivo)
  const activityStatus = useMemo(() => {
    if (!profile) return { status: "not_started" as const, label: "Sin Iniciar", badgeClass: "status-warning", description: "" };
    return StudentTrackingEngine.determineActivityStatus({
      profile,
      latestSession,
      totalSessions: recentSessions.length,
    });
  }, [profile, latestSession, recentSessions.length]);

  // Análisis de Curva de Fatiga Atencional y Punto de Quiebre
  const breakPointAnalysis = useMemo(() => {
    return calculateAttentionalBreakPoint(timelineData, sessionDuration);
  }, [timelineData, sessionDuration]);

  if (isLoading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Cargando expediente clínico...</div>;
  }

  return (
    <div>
      {/* Tarjeta de Resumen del Paciente */}
      <div
        className="card"
        style={{
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          padding: "20px 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              fontSize: "1.25rem",
              fontWeight: 700,
              backgroundColor: "var(--primary-light)",
              color: "var(--primary)",
              borderRadius: "var(--radius-lg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(79, 70, 229, 0.2)",
            }}
          >
            {(profile?.heroName || code).substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "1.35rem", margin: 0, fontWeight: 700 }}>
                {profile?.heroName || `Paciente ${code}`}
              </h2>

              {/* Estado de Actividad Explícito (5 estados solicitados) */}
              <span
                className={`status-badge ${activityStatus.badgeClass}`}
                title={activityStatus.description}
                style={{ fontSize: "0.75rem", padding: "3px 10px" }}
              >
                {activityStatus.label}
              </span>

              {/* Subtipo de TDAH asignado en Firestore */}
              {profile?.adhdSubtype && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "3px 10px",
                    borderRadius: "9999px",
                    backgroundColor: "rgba(79, 70, 229, 0.12)",
                    color: "var(--primary)",
                    fontWeight: 600,
                    border: "1px solid rgba(79, 70, 229, 0.25)",
                  }}
                >
                  TDAH: {formatAdhdSubtype(profile.adhdSubtype)}
                </span>
              )}

              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "3px 10px",
                  borderRadius: "9999px",
                  backgroundColor:
                    trend.trend === "improving"
                      ? "var(--success-light)"
                      : trend.trend === "declining"
                      ? "var(--danger-light)"
                      : "var(--background-subtle)",
                  color:
                    trend.trend === "improving"
                      ? "var(--success)"
                      : trend.trend === "declining"
                      ? "var(--danger)"
                      : "var(--text-light)",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  border: "1px solid var(--border)",
                }}
              >
                {trend.trend === "improving" ? (
                  <TrendingUp size={12} />
                ) : trend.trend === "declining" ? (
                  <TrendingDown size={12} />
                ) : (
                  <Minus size={12} />
                )}
                {trend.label} {trend.percentageDelta !== 0 && `(${trend.percentageDelta > 0 ? "+" : ""}${trend.percentageDelta}%)`}
              </span>

              {/* Indicador de Sincronización en Tiempo Real */}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "3px 10px",
                  borderRadius: "9999px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  backgroundColor: livePulsing ? "rgba(16, 185, 129, 0.2)" : "var(--success-light)",
                  color: "var(--success)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  transition: "background-color 0.3s ease",
                }}
                title="Sincronización continua de Firestore activa"
              >
                <span className="pulse-beacon" /> En Vivo
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.82rem", color: "var(--text-light)", marginTop: "4px", flexWrap: "wrap" }}>
              <span>ID: <code style={{ backgroundColor: "var(--background-subtle)", padding: "2px 6px", borderRadius: "4px" }}>{code}</code></span>
              {profile?.linkCode && <span>Código Tutor: <strong>{profile.linkCode}</strong></span>}
              {profile?.age && <span>Edad: <strong>{profile.age} años</strong></span>}
              <span>Grupo: <strong>{profile?.ageGroup || "General"}</strong></span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ textAlign: "center", padding: "6px 14px", backgroundColor: "var(--background-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", color: "var(--primary)", fontWeight: 700, fontSize: "1rem" }}>
              <Award size={16} />
              Nv. {profile?.level ?? 1}
            </div>
            <span style={{ fontSize: "0.72rem", color: "var(--text-light)" }}>Nivel</span>
          </div>

          <div style={{ textAlign: "center", padding: "6px 14px", backgroundColor: "var(--background-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", color: "var(--warning)", fontWeight: 700, fontSize: "1rem" }}>
              <Flame size={16} />
              {profile?.currentStreak ?? 0} d
            </div>
            <span style={{ fontSize: "0.72rem", color: "var(--text-light)" }}>Racha</span>
          </div>

          <div style={{ textAlign: "center", padding: "6px 14px", backgroundColor: "var(--background-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", color: "var(--success)", fontWeight: 700, fontSize: "1rem" }}>
              <Sparkles size={16} />
              {profile?.coins ?? 0}
            </div>
            <span style={{ fontSize: "0.72rem", color: "var(--text-light)" }}>Monedas</span>
          </div>

          <div style={{ textAlign: "center", padding: "6px 14px", backgroundColor: "var(--background-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", color: "var(--foreground)", fontWeight: 700, fontSize: "1rem" }}>
              <Trophy size={16} color="var(--warning)" />
              {profile?.totalScore ?? 0}
            </div>
            <span style={{ fontSize: "0.72rem", color: "var(--text-light)" }}>Puntaje Total</span>
          </div>

          <button
            onClick={() => DashboardExportUtils.exportSessionsToCSV(recentSessions, profile?.heroName || code)}
            className="btn-secondary"
            title="Exportar sesiones a CSV"
          >
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      {/* Métricas de la Sesión Más Reciente */}
      <div className="stat-grid" style={{ marginBottom: "24px" }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Atención Efectiva</span>
            <div className="stat-icon" style={{ backgroundColor: "var(--primary-light)", color: "var(--primary)" }}>
              <Target size={18} />
            </div>
          </div>
          <div className="stat-value">
            {totalFocus}s{" "}
            <span style={{ fontSize: "0.9rem", color: "var(--text-light)", fontWeight: 400 }}>
              ({focusPercentage}%)
            </span>
          </div>
          <div className="stat-meta">De {sessionDuration}s totales de sesión</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Distracciones / Minuto</span>
            <div className="stat-icon" style={{ backgroundColor: "var(--warning-light)", color: "var(--warning)" }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="stat-value" style={{ color: "var(--warning)" }}>
            {typeof distractions === "number" ? distractions.toFixed(1) : distractions}
          </div>
          <div className="stat-meta">Desviaciones de mirada registradas</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Última Sesión</span>
            <div className="stat-icon" style={{ backgroundColor: "var(--success-light)", color: "var(--success)" }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: "1.2rem" }}>
            {latestSession ? formatDisplayDate(latestSession.date) : "Sin sesiones"}
          </div>
          <div className="stat-meta">Registrada en app CogniTrain</div>
        </div>
      </div>

      {/* 1. GRÁFICO DE RADAR POR FUNCIÓN EJECUTIVA (Memoria, Inhibición, Sostenida, Flexibilidad, Reacción) */}
      {profile && (
        <ExecutiveFunctionsRadar
          profile={profile}
          sessions={recentSessions}
          attempts={attempts}
        />
      )}

      {/* 2. PROGRESO DETALLADO POR MINIJUEGOS (Datos Reales de Firestore: gameProgress) */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ padding: "8px", borderRadius: "8px", backgroundColor: "var(--primary-light)", color: "var(--primary)" }}>
              <Gamepad2 size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Progreso del Alumno por Minijuegos</h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text-light)" }}>
                Registro dinámico de niveles superados, mejores puntuaciones y estrellas acumuladas en el entrenamiento
              </p>
            </div>
          </div>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-light)" }}>
            {profile?.gameProgress ? `${Object.keys(profile.gameProgress).length} Minijuegos Registrados` : "0 Minijuegos"}
          </span>
        </div>

        {profile?.gameProgress && Object.keys(profile.gameProgress).length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            {Object.entries(profile.gameProgress).map(([gameId, prog]) => {
              const meta = getMinigameInfo(gameId);
              const completedCount = Array.isArray(prog.completedLevels) ? prog.completedLevels.length : 0;
              const highestScore = Object.values(prog.bestScoreByLevel || {}).reduce((max, s) => Math.max(max, Number(s) || 0), 0);
              const totalStars = Object.values(prog.starsByLevel || {}).reduce((acc, st) => acc + (Number(st) || 0), 0);
              const lastPlayed = formatDisplayDate(prog.lastPlayedAt, "Reciente");

              return (
                <div
                  key={gameId}
                  style={{
                    padding: "16px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--surface-hover)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--foreground)" }}>
                        {meta.name}
                      </h4>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          backgroundColor: "var(--background-subtle)",
                          color: "var(--text-light)",
                          border: "1px solid var(--border)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {meta.subtype}
                      </span>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--text-light)", lineHeight: 1.4 }}>
                      {meta.domain}
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", textAlign: "center" }}>
                    <div style={{ padding: "8px 4px", borderRadius: "6px", backgroundColor: "var(--background-subtle)", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--primary)" }}>
                        Nv. {prog.highestUnlockedLevel}
                      </div>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-light)" }}>Desbloqueado</span>
                    </div>

                    <div style={{ padding: "8px 4px", borderRadius: "6px", backgroundColor: "var(--background-subtle)", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--foreground)" }}>
                        {completedCount}
                      </div>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-light)" }}>Superados</span>
                    </div>

                    <div style={{ padding: "8px 4px", borderRadius: "6px", backgroundColor: "var(--background-subtle)", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--warning)", display: "flex", alignItems: "center", justifyContent: "center", gap: "2px" }}>
                        <Star size={13} fill="var(--warning)" /> {totalStars}
                      </div>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-light)" }}>Estrellas</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "var(--text-light)", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
                    <span>Mejor puntaje: <strong>{highestScore} pts</strong></span>
                    <span>Última vez: {lastPlayed}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-light)" }}>
            <Gamepad2 size={36} style={{ color: "var(--text-muted)", marginBottom: "8px", opacity: 0.6 }} />
            <p style={{ margin: 0, fontSize: "0.85rem" }}>
              El alumno está registrado pero aún no ha completado actividades en los minijuegos de CogniTrain ADHD.
            </p>
          </div>
        )}
      </div>

      {/* 3. ANÁLISIS DE LA CURVA DE FATIGA ATENCIONAL & RECOMENDACIONES DE PAUSA ACTIVA */}
      {timelineData.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }}>
          {/* Panel Clínico de Quiebre Atencional */}
          <div
            className="card"
            style={{
              backgroundColor: "var(--surface)",
              border: `1px solid ${
                breakPointAnalysis.fatigueRiskLevel === "high"
                  ? "rgba(239, 68, 68, 0.4)"
                  : breakPointAnalysis.fatigueRiskLevel === "moderate"
                  ? "rgba(245, 158, 11, 0.4)"
                  : "rgba(16, 185, 129, 0.4)"
              }`,
              padding: "20px 24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    backgroundColor:
                      breakPointAnalysis.fatigueRiskLevel === "high"
                        ? "rgba(239, 68, 68, 0.15)"
                        : breakPointAnalysis.fatigueRiskLevel === "moderate"
                        ? "rgba(245, 158, 11, 0.15)"
                        : "rgba(16, 185, 129, 0.15)",
                    color:
                      breakPointAnalysis.fatigueRiskLevel === "high"
                        ? "var(--danger)"
                        : breakPointAnalysis.fatigueRiskLevel === "moderate"
                        ? "var(--warning)"
                        : "var(--success)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <BatteryMedium size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.15rem", margin: 0 }}>
                    Análisis de la Curva de Fatiga Atencional & Descansos
                  </h3>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-light)" }}>
                    Telemetría computada punto a punto durante el juego para optimizar la duración de sesión.
                  </span>
                </div>
              </div>

              {/* Badge de Riesgo */}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 12px",
                  borderRadius: "16px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  backgroundColor:
                    breakPointAnalysis.fatigueRiskLevel === "high"
                      ? "rgba(239, 68, 68, 0.15)"
                      : breakPointAnalysis.fatigueRiskLevel === "moderate"
                      ? "rgba(245, 158, 11, 0.15)"
                      : "rgba(16, 185, 129, 0.15)",
                  color:
                    breakPointAnalysis.fatigueRiskLevel === "high"
                      ? "var(--danger)"
                      : breakPointAnalysis.fatigueRiskLevel === "moderate"
                      ? "var(--warning)"
                      : "var(--success)",
                }}
              >
                {breakPointAnalysis.fatigueRiskLevel === "high" ? (
                  <ShieldAlert size={14} />
                ) : breakPointAnalysis.fatigueRiskLevel === "moderate" ? (
                  <AlertTriangle size={14} />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                Riesgo de Fatiga:{" "}
                {breakPointAnalysis.fatigueRiskLevel === "high"
                  ? "Crítico"
                  : breakPointAnalysis.fatigueRiskLevel === "moderate"
                  ? "Moderado"
                  : "Bajo"}
              </span>
            </div>

            {/* Cuadrícula de Indicadores de Quiebre */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "16px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  backgroundColor: "var(--surface-hover)",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--danger)", fontSize: "0.75rem", fontWeight: 600, marginBottom: "4px" }}>
                  <Timer size={14} /> Punto de Quiebre
                </div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--foreground)" }}>
                  Min {breakPointAnalysis.breakPointTime}
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>
                  Comienzo de distracción
                </span>
              </div>

              <div
                style={{
                  backgroundColor: "var(--surface-hover)",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--primary)", fontSize: "0.75rem", fontWeight: 600, marginBottom: "4px" }}>
                  <Zap size={14} /> Duración Recomendada
                </div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--foreground)" }}>
                  {breakPointAnalysis.recommendedSessionDurationMin} min
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>
                  Máximo tiempo productivo
                </span>
              </div>

              <div
                style={{
                  backgroundColor: "var(--surface-hover)",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--success)", fontSize: "0.75rem", fontWeight: 600, marginBottom: "4px" }}>
                  <Coffee size={14} /> Pausa Activa Sugerida
                </div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--foreground)" }}>
                  {breakPointAnalysis.recommendedBreakIntervalMin} min
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>
                  Descanso neuromotor
                </span>
              </div>

              <div
                style={{
                  backgroundColor: "var(--surface-hover)",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#64748b", fontSize: "0.75rem", fontWeight: 600, marginBottom: "4px" }}>
                  <TrendingDown size={14} /> Tasa de Decaimiento
                </div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--foreground)" }}>
                  {breakPointAnalysis.averageDecayRatePerMinute}%{" "}
                  <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "var(--text-light)" }}>/min</span>
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>
                  Pérdida promedio de foco
                </span>
              </div>
            </div>

            {/* Recomendación Clínica Redactada */}
            <div
              style={{
                backgroundColor: "var(--surface-hover)",
                padding: "12px 16px",
                borderRadius: "10px",
                borderLeft: "4px solid var(--primary)",
                fontSize: "0.85rem",
                color: "var(--foreground)",
                lineHeight: 1.5,
              }}
            >
              <strong>Recomendación Clínica para Sesiones:</strong> {breakPointAnalysis.clinicalRecommendation}
            </div>
          </div>

          {/* Gráfico 1: Curva de Atención con Línea de Referencia de Quiebre */}
          <div className="card">
            <div style={{ display: "flex", borderBottom: "1px solid var(--border)", paddingBottom: "12px", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Curva de Atención en Tiempo Real con Umbral de Quiebre</h3>
              <span style={{ fontSize: "0.8rem", color: "var(--danger)", fontWeight: 600 }}>
                Quiebre Atencional: {breakPointAnalysis.breakPointTime}
              </span>
            </div>
            <div style={{ height: "300px", width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorFocus" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickMargin={10} />
                  <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  {/* Línea vertical indicando el minuto de quiebre atencional */}
                  {breakPointAnalysis.breakPointTime && (
                    <ReferenceLine
                      x={breakPointAnalysis.breakPointTime}
                      stroke="var(--danger)"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      label={{
                        value: `Quiebre: ${breakPointAnalysis.breakPointTime}`,
                        fill: "var(--danger)",
                        fontSize: 11,
                        position: "top",
                      }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="focus"
                    name="Nivel de Foco (%)"
                    stroke="var(--primary)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorFocus)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico 2: Picos de Fatiga */}
          <div className="card">
            <h3 style={{ marginBottom: "20px", fontSize: "1.1rem" }}>Picos de Fatiga / Parpadeo Ocular (EAR)</h3>
            <div style={{ height: "250px", width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickMargin={10} />
                  <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="fatigue"
                    name="Nivel de Fatiga (%)"
                    stroke="var(--danger)"
                    strokeWidth={3}
                    dot={{ r: 0 }}
                    activeDot={{ r: 6, fill: "var(--danger)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: "40px 24px", textAlign: "center", color: "#64748b" }}>
          <Info size={36} style={{ color: "#94a3b8", marginBottom: "12px" }} />
          <h4 style={{ color: "var(--text-dark)", marginBottom: "8px" }}>
            {recentSessions.length === 0
              ? "Sin sesiones registradas para este paciente"
              : "Telemetría granular de sesión en proceso"}
          </h4>
          <p style={{ maxWidth: "500px", margin: "0 auto", fontSize: "0.875rem" }}>
            {recentSessions.length === 0
              ? "Cuando el niño complete su primer entrenamiento en CogniTrain ADHD, los gráficos de atención continua y fatiga ocular se proyectarán aquí automáticamente."
              : "La sesión reciente fue registrada a nivel de resumen. Para ver la curva continua segundo a segundo, la app móvil debe completar la sincronización de la subcolección de métricas."}
          </p>
        </div>
      )}

      {/* Historial de Sesiones Recientes */}
      <div className="card" style={{ marginTop: "24px", padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Historial de Sesiones Registradas ({recentSessions.length})</h3>
        </div>
        {recentSessions.length === 0 ? (
          <p style={{ color: "var(--text-light)", fontSize: "0.875rem", padding: "24px", margin: 0 }}>
            No hay sesiones en la base de datos para este paciente.
          </p>
        ) : (
          <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ padding: "12px 20px" }}>Fecha</th>
                  <th style={{ padding: "12px 20px" }}>Estado</th>
                  <th style={{ padding: "12px 20px" }}>Duración</th>
                  <th style={{ padding: "12px 20px" }}>Atención Efectiva</th>
                  <th style={{ padding: "12px 20px" }}>Distracciones</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((s) => (
                  <tr key={s.id}>
                    <td style={{ padding: "14px 20px" }}>{formatDisplayDate(s.date)}</td>
                    <td style={{ padding: "14px 20px" }}>
                      <span className="status-badge status-success" style={{ textTransform: "capitalize" }}>
                        {s.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px" }}>{s.totalDurationSeconds}s</td>
                    <td style={{ padding: "14px 20px", fontWeight: 600, color: "var(--primary)" }}>{s.effectiveAttentionTime}s</td>
                    <td style={{ padding: "14px 20px", color: "var(--text-light)" }}>
                      {typeof s.distractionsPerMinute === "number" ? s.distractionsPerMinute.toFixed(1) : "—"} / min
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

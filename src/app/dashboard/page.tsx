"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Activity,
  Brain,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  UserCheck,
  Search,
  Filter,
  Download,
  KeyRound,
  CheckCircle2,
  Clock,
  Zap,
  X,
  Eye,
  ChevronRight,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { SpecialistDataService } from "@/lib/specialistDataService";
import { DashboardLinkingService } from "@/lib/linkingService";
import { StudentTrackingEngine } from "@/lib/studentTracking";
import { DashboardExportUtils } from "@/lib/exportUtils";
import {
  SpecialistSummary,
  formatDisplayDate,
  parseFirestoreDate,
  LiveSyncNotification,
  formatAdhdSubtype,
} from "@/lib/types";

export default function PsychologistDashboard() {
  const { user, role, refreshUser, consultedUser, isConsulting } = useAuth();

  const [allSummaries, setAllSummaries] = useState<SpecialistSummary[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Notificaciones y Sincronización en Tiempo Real
  const [notifications, setNotifications] = useState<LiveSyncNotification[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string>("Iniciando...");
  const [livePulsing, setLivePulsing] = useState<boolean>(false);
  const knownSessionCountsRef = useRef<Map<string, number>>(new Map());
  const isInitializedRef = useRef<boolean>(false);

  // Filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "score" | "sessions" | "date">("date");

  // Modal de Vinculación
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkingCode, setLinkingCode] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [linkingResult, setLinkingResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadData = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    setErrorMessage(null);
    try {
      const summaries = await SpecialistDataService.getAllPatientSummaries();
      setAllSummaries(summaries);
      setLastSyncTime(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (err: unknown) {
      console.error("Error al cargar alumnos:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("PERMISSION_DENIED") || msg.includes("permission-denied")) {
        setErrorMessage(
          "Permiso de Cloud Firestore: Verifica que la base de datos esté activa en la consola de Firebase."
        );
      } else {
        setErrorMessage(`Error de conexión con el origen: ${msg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const summaries = await SpecialistDataService.getAllPatientSummaries();
        if (isMounted) {
          summaries.forEach((s) => {
            knownSessionCountsRef.current.set(s.profile.id, s.totalSessions);
          });
          isInitializedRef.current = true;
          setAllSummaries(summaries);
          setCurrentTime(Date.now());
          setLastSyncTime(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(`Error de conexión con el origen: ${msg}`);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    init();

    // Sincronización en tiempo real vía onSnapshot de Firestore
    const unsubscribe = SpecialistDataService.subscribeToAllPatients(async () => {
      if (!isMounted) return;
      try {
        const freshSummaries = await SpecialistDataService.getAllPatientSummaries();
        if (!isMounted) return;

        const newNotifications: LiveSyncNotification[] = [];

        // Solo disparar notificación de nueva sesión si el alumno ya existía y su conteo de sesiones aumentó
        if (isInitializedRef.current) {
          freshSummaries.forEach((fresh) => {
            const previousCount = knownSessionCountsRef.current.get(fresh.profile.id);
            if (typeof previousCount === "number" && fresh.totalSessions > previousCount) {
              const uniqueSuffix = Math.random().toString(36).substring(2, 9);
              newNotifications.push({
                id: `${fresh.profile.id}_${Date.now()}_${uniqueSuffix}`,
                studentId: fresh.profile.id,
                studentName: fresh.profile.heroName,
                type: "session_completed",
                message: `Nueva sesión completada en su tablet/móvil. Foco: ${fresh.focusScore}%.`,
                timestamp: "Hace un momento",
              });
            }
          });
        }

        // Registrar las cuentas de sesión actualizadas
        freshSummaries.forEach((s) => {
          knownSessionCountsRef.current.set(s.profile.id, s.totalSessions);
        });
        isInitializedRef.current = true;

        setAllSummaries(freshSummaries);

        if (newNotifications.length > 0) {
          setNotifications((prevN) => {
            const seen = new Set<string>();
            const merged = [...newNotifications, ...prevN];
            return merged.filter((item) => {
              if (seen.has(item.id)) return false;
              seen.add(item.id);
              return true;
            }).slice(0, 4);
          });
        }

        setLastSyncTime(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        setLivePulsing(true);
        setTimeout(() => {
          if (isMounted) setLivePulsing(false);
        }, 1500);
      } catch (e) {
        console.warn("Error en actualización reactiva:", e);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Auto-descartar notificaciones después de 8 segundos
  useEffect(() => {
    if (notifications.length > 0) {
      const timer = setTimeout(() => {
        setNotifications((prev) => prev.slice(0, -1));
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [notifications]);

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // SEGMENTACIÓN ESTRICTA RBAC:
  // - En Modo de Solo Consulta: El Administrador visualiza los datos del especialista consultado sin impersonarlo.
  // - Psicólogo normal: solo ve sus alumnos asignados (user.assignedStudentIds).
  // - Administrador normal: ve la totalidad de alumnos.
  const authorizedSummaries = useMemo(() => {
    if (isConsulting && consultedUser) {
      const targetIds = consultedUser.assignedStudentIds || [];
      return allSummaries.filter((s) => targetIds.includes(s.profile.id));
    }
    if (role === "admin") return allSummaries;
    const myIds = user?.assignedStudentIds || [];
    return allSummaries.filter((s) => myIds.includes(s.profile.id));
  }, [allSummaries, role, user, isConsulting, consultedUser]);

  // KPIs del psicólogo
  const now = currentTime > 0 ? currentTime : 0;
  const assignedCount = authorizedSummaries.length;

  const recentActiveCount = authorizedSummaries.filter((s) => {
    const d = parseFirestoreDate(s.profile.lastSessionAt);
    if (!d) return false;
    return (now - d.getTime()) <= 7 * 24 * 3600 * 1000;
  }).length;

  const inactiveCount = assignedCount - recentActiveCount;
  const totalSessionsInPeriod = authorizedSummaries.reduce((acc, s) => acc + s.totalSessions, 0);

  // Alertas operativas calculadas
  const alerts = useMemo(() => {
    const targetUser = isConsulting && consultedUser ? consultedUser : user;
    const targetRole = isConsulting && consultedUser ? consultedUser.role : role;
    return StudentTrackingEngine.generateAlerts(
      authorizedSummaries,
      targetRole === "psychologist" ? targetUser?.assignedStudentIds : undefined
    );
  }, [authorizedSummaries, role, user, isConsulting, consultedUser]);

  // Alumnos filtrados y ordenados
  const filteredStudents = useMemo(() => {
    const list = authorizedSummaries.filter((s) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        s.profile.heroName.toLowerCase().includes(q) ||
        s.profile.id.toLowerCase().includes(q) ||
        (s.profile.linkCode && s.profile.linkCode.toLowerCase().includes(q));

      if (!matchSearch) return false;
      if (statusFilter === "all") return true;
      if (statusFilter === "in_progress") {
        const act = StudentTrackingEngine.determineActivityStatus({ profile: s.profile, totalSessions: s.totalSessions });
        return act.status === "in_progress" || act.status === "with_activity" || act.status === "completed";
      }
      if (statusFilter === "not_started") {
        const act = StudentTrackingEngine.determineActivityStatus({ profile: s.profile, totalSessions: s.totalSessions });
        return act.status === "not_started";
      }
      if (statusFilter === "active") {
        const d = parseFirestoreDate(s.profile.lastSessionAt);
        return d && (now - d.getTime()) <= 7 * 24 * 3600 * 1000;
      }
      if (statusFilter === "inactive") {
        const act = StudentTrackingEngine.determineActivityStatus({ profile: s.profile, totalSessions: s.totalSessions });
        return act.status === "inactive";
      }
      if (statusFilter === "review") {
        return s.status === "warning" || s.status === "danger";
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === "name") {
        return a.profile.heroName.localeCompare(b.profile.heroName);
      }
      if (sortBy === "score") {
        return b.focusScore - a.focusScore;
      }
      if (sortBy === "sessions") {
        return b.totalSessions - a.totalSessions;
      }
      // "date"
      const dateA = parseFirestoreDate(a.profile.lastSessionAt)?.getTime() || 0;
      const dateB = parseFirestoreDate(b.profile.lastSessionAt)?.getTime() || 0;
      return dateB - dateA;
    });
  }, [authorizedSummaries, searchQuery, statusFilter, sortBy, now]);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !linkingCode.trim()) return;

    setIsLinking(true);
    setLinkingResult(null);

    try {
      const res = await DashboardLinkingService.redeemLinkingCode(user, linkingCode);
      setLinkingResult(res);
      if (res.success) {
        setLinkingCode("");
        refreshUser();
        loadData(false);
      }
    } catch {
      setLinkingResult({ success: false, message: "Error al procesar el código de vinculación." });
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div>
      {/* Cabecera del Psicólogo */}
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
            {isConsulting && consultedUser ? (
              <span className="status-badge warning">
                <Eye size={13} /> Modo Consulta: {consultedUser.name} ({consultedUser.role === "psychologist" ? "Psicólogo" : "Tutor"})
              </span>
            ) : (
              <span className="status-badge success">
                <UserCheck size={13} /> {role === "admin" ? "Vista Administrador" : `Psicólogo Clínico: ${user?.name}`}
              </span>
            )}

            {user?.licenseNumber && (
              <span style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>({user.licenseNumber})</span>
            )}

            <span
              className="status-badge"
              style={{
                backgroundColor: livePulsing ? "var(--success-light)" : "var(--background-subtle)",
                color: "var(--success)",
                border: "1px solid var(--border)",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
              title="Sincronización en vivo vía onSnapshot de Firestore activa"
            >
              <span className="pulse-beacon" />
              <span>En Vivo ({lastSyncTime})</span>
            </span>
          </div>

          <h1 className="page-title">Panel de Seguimiento Cognitivo</h1>
          <p className="page-description">
            Supervisión longitudinal, evaluación de tendencias y telemetría de tus alumnos asignados.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={() => {
              SpecialistDataService.clearCache();
              loadData(true);
            }}
            className="btn-secondary"
            title="Recargar datos desde Firestore"
          >
            <RefreshCw size={15} className={isLoading ? "spin" : ""} />
            <span>Actualizar</span>
          </button>

          {!isConsulting && (
            <button onClick={() => setShowLinkModal(true)} className="btn-primary">
              <KeyRound size={15} />
              <span>Vincular Alumno</span>
            </button>
          )}

          <button
            onClick={() => DashboardExportUtils.exportStudentsToCSV(authorizedSummaries, "mis_alumnos_cognitrain.csv")}
            className="btn-secondary"
            title="Exportar alumnos asignados a CSV"
          >
            <Download size={15} />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          style={{
            marginBottom: "24px",
            padding: "12px 16px",
            backgroundColor: "var(--danger-light)",
            border: "1px solid var(--danger-border)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "var(--danger)",
            fontSize: "0.85rem",
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tarjetas de Métricas de Seguimiento (SaaS Linear Style) */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Alumnos Asignados</span>
            <div className="stat-icon" style={{ backgroundColor: "var(--primary-light)", color: "var(--primary)" }}>
              <Users size={18} />
            </div>
          </div>
          <div className="stat-value">{assignedCount}</div>
          <div className="stat-meta">
            <span>Bajo supervisión profesional</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Activos en 7 días</span>
            <div className="stat-icon" style={{ backgroundColor: "var(--success-light)", color: "var(--success)" }}>
              <Activity size={18} />
            </div>
          </div>
          <div className="stat-value" style={{ color: "var(--success)" }}>{recentActiveCount}</div>
          <div className="stat-meta">
            <span>Entrenamiento regular activo</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Sin Sesión Reciente</span>
            <div className="stat-icon" style={{ backgroundColor: "var(--warning-light)", color: "var(--warning)" }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="stat-value" style={{ color: inactiveCount > 0 ? "var(--warning)" : "var(--foreground)" }}>
            {inactiveCount}
          </div>
          <div className="stat-meta">
            <span>&gt; 7 días sin entrenar</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Sesiones Totales</span>
            <div className="stat-icon" style={{ backgroundColor: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6" }}>
              <Brain size={18} />
            </div>
          </div>
          <div className="stat-value">{totalSessionsInPeriod}</div>
          <div className="stat-meta">
            <span>Telemetría en la nube</span>
          </div>
        </div>
      </div>

      {/* Alertas de Seguimiento */}
      {alerts.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: "24px",
            padding: "18px 20px",
            borderLeft: "4px solid var(--warning)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <AlertTriangle size={18} color="var(--warning)" />
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>
              Alertas Clínicas y de Inactividad ({alerts.length})
            </h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {alerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: alert.severity === "critical" ? "var(--danger-light)" : "var(--warning-light)",
                  border: `1px solid ${alert.severity === "critical" ? "var(--danger-border)" : "var(--warning-border)"}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.82rem",
                  gap: "12px",
                }}
              >
                <div>
                  <strong style={{ color: "var(--foreground)" }}>{alert.studentName}:</strong>{" "}
                  <span style={{ color: "var(--text-light)" }}>{alert.message}</span>
                </div>
                <Link
                  href={`/dashboard/patient/${alert.studentId}`}
                  className="btn-secondary"
                  style={{ fontSize: "0.75rem", padding: "4px 10px", flexShrink: 0 }}
                >
                  Ver Ficha
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barra de Búsqueda, Filtros y Ordenación */}
      <div
        className="card"
        style={{
          marginBottom: "20px",
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "14px 18px",
        }}
      >
        <div style={{ flex: 1, minWidth: "220px", position: "relative" }}>
          <Search
            size={16}
            style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
          />
          <input
            type="text"
            className="input-field"
            placeholder="Buscar por nombre, ID o código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: "36px" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Filter size={15} color="var(--text-light)" />
          <select
            className="input-field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ fontSize: "0.85rem", width: "auto" }}
          >
            <option value="all">Todos los estados</option>
            <option value="in_progress">En Progreso / Con Actividad</option>
            <option value="active">Activos (&lt; 7d)</option>
            <option value="inactive">Inactivos (&gt; 7d)</option>
            <option value="not_started">Sin Iniciar</option>
            <option value="review">Requieren Revisión</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-light)", fontWeight: 500 }}>Ordenar:</span>
          <select
            className="input-field"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "name" | "score" | "sessions" | "date")}
            style={{ fontSize: "0.85rem", width: "auto" }}
          >
            <option value="date">Última Sesión</option>
            <option value="score">Score de Foco</option>
            <option value="sessions">Total Sesiones</option>
            <option value="name">Nombre</option>
          </select>
        </div>
      </div>

      {/* Tabla de Alumnos del Psicólogo */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>
              Alumnos Asignados ({filteredStudents.length})
            </h3>
            <span style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>
              Privacidad garantizada: Solo accedes a tus alumnos autorizados
            </span>
          </div>
        </div>

        <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Estado de Seguimiento</th>
                <th>Última Sesión</th>
                <th>Sesiones</th>
                <th>Score de Foco</th>
                <th style={{ textAlign: "right" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-light)" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                      <RefreshCw size={18} className="spin" />
                      <span>Cargando expedientes autorizados...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-light)" }}>
                    <UserCheck size={36} style={{ color: "var(--text-muted)", marginBottom: "12px", display: "inline-block" }} />
                    <h4 style={{ color: "var(--foreground)", marginBottom: "4px" }}>No hay alumnos asignados a tu cuenta</h4>
                    <p style={{ fontSize: "0.85rem", margin: "6px auto 16px", maxWidth: "440px" }}>
                      Puedes hacer clic en <strong>&quot;Vincular Alumno&quot;</strong> e introducir el código temporal del niño o solicitar su asignación al administrador.
                    </p>
                    {!isConsulting && (
                      <button onClick={() => setShowLinkModal(true)} className="btn-primary" style={{ margin: "0 auto" }}>
                        <KeyRound size={15} /> <span>Vincular Alumno Ahora</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((patient) => {
                  const activity = StudentTrackingEngine.determineActivityStatus({
                    profile: patient.profile,
                    totalSessions: patient.totalSessions,
                  });

                  return (
                    <tr key={patient.profile.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div className="avatar">
                            {patient.profile.heroName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{patient.profile.heroName}</span>
                              {patient.profile.adhdSubtype && (
                                <span style={{ fontSize: "0.68rem", padding: "1px 6px", borderRadius: "4px", backgroundColor: "rgba(79, 70, 229, 0.12)", color: "var(--primary)", fontWeight: 600 }}>
                                  {formatAdhdSubtype(patient.profile.adhdSubtype)}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-light)", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                              <span>Nv. {patient.profile.level}</span>
                              <span>•</span>
                              <span>ID: {patient.profile.id}</span>
                              {patient.profile.linkCode && (
                                <code style={{ backgroundColor: "var(--background-subtle)", padding: "1px 4px", borderRadius: "3px", fontSize: "0.7rem", color: "var(--primary)" }}>
                                  {patient.profile.linkCode}
                                </code>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className={`status-badge ${activity.badgeClass}`} title={activity.description}>
                          {activity.label}
                        </span>
                      </td>

                      <td style={{ color: "var(--text-light)", fontSize: "0.82rem" }}>
                        {formatDisplayDate(patient.profile.lastSessionAt, "Sin sesiones aún")}
                      </td>

                      <td style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                        {patient.totalSessions}
                      </td>

                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "120px" }}>
                          <div style={{ flex: 1, height: "6px", backgroundColor: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${patient.focusScore}%`,
                                backgroundColor:
                                  patient.status === "success"
                                    ? "var(--success)"
                                    : patient.status === "warning"
                                    ? "var(--warning)"
                                    : "var(--danger)",
                                borderRadius: "3px",
                              }}
                            />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" }}>
                            {patient.focusScore}%
                          </span>
                        </div>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <Link
                          href={`/dashboard/patient/${patient.profile.id}`}
                          className="btn-secondary"
                          style={{ fontSize: "0.78rem", padding: "5px 10px" }}
                        >
                          <span>Ficha Clínica</span>
                          <ChevronRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE VINCULACIÓN DE ALUMNO MEDIANTE CÓDIGO */}
      {showLinkModal && (
        <div className="modal-overlay" onClick={() => setShowLinkModal(false)}>
          <div className="modal-card" style={{ maxWidth: "460px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    backgroundColor: "var(--primary-light)",
                    color: "var(--primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.05rem" }}>Vincular Alumno</h3>
                  <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-light)" }}>Asociación clínica segura</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                style={{ padding: "4px", borderRadius: "6px", color: "var(--text-light)" }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: "var(--text-light)", fontSize: "0.85rem", marginBottom: "18px", lineHeight: 1.45 }}>
              Ingresa el código seguro generado por el administrador o el código de vinculación provisto por la app móvil del alumno.
            </p>

            <form onSubmit={handleRedeem} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "6px", color: "var(--foreground)" }}>
                  Código de Vinculación
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej. CT-9K42X o linkCode"
                  value={linkingCode}
                  onChange={(e) => setLinkingCode(e.target.value)}
                  style={{ textTransform: "uppercase", fontWeight: 700, letterSpacing: "1px", fontSize: "0.95rem" }}
                  required
                />
              </div>

              {linkingResult && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: linkingResult.success ? "var(--success-light)" : "var(--danger-light)",
                    border: `1px solid ${linkingResult.success ? "var(--success-border)" : "var(--danger-border)"}`,
                    color: linkingResult.success ? "var(--success)" : "var(--danger)",
                    fontSize: "0.82rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {linkingResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{linkingResult.message}</span>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowLinkModal(false);
                    setLinkingResult(null);
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={isLinking}>
                  {isLinking ? "Verificando..." : "Vincular Alumno"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notificaciones Flotantes de Sincronización en Vivo */}
      {notifications.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            maxWidth: "380px",
            width: "100%",
          }}
        >
          {notifications.map((notif, idx) => (
            <div
              key={`${notif.id}_${idx}`}
              className="card"
              style={{
                padding: "14px 16px",
                boxShadow: "var(--shadow-xl)",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                border: "1px solid var(--border-strong)",
                animation: "scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  backgroundColor: "var(--success-light)",
                  color: "var(--success)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Zap size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--foreground)" }}>
                    {notif.studentName}
                  </span>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    {notif.timestamp}
                  </span>
                </div>
                <p style={{ margin: "4px 0 8px 0", fontSize: "0.8rem", color: "var(--text-light)", lineHeight: 1.3 }}>
                  {notif.message}
                </p>
                <Link
                  href={`/dashboard/patient/${notif.studentId}`}
                  className="btn-secondary"
                  style={{ fontSize: "0.75rem", padding: "3px 8px" }}
                >
                  Ver Expediente en Vivo
                </Link>
              </div>
              <button
                onClick={() => dismissNotification(notif.id)}
                style={{ color: "var(--text-light)", padding: "2px" }}
                title="Descartar notificación"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

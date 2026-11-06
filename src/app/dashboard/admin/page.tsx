"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  Users,
  UserCheck,
  HeartHandshake,
  Activity,
  Plus,
  RefreshCw,
  Download,
  KeyRound,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  Trash2,
  Pencil,
  Eye,
  Clock,
  Brain,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { DashboardAuthService } from "@/lib/authService";
import { DashboardLinkingService } from "@/lib/linkingService";
import { SpecialistDataService } from "@/lib/specialistDataService";
import { StudentTrackingEngine } from "@/lib/studentTracking";
import { DashboardExportUtils } from "@/lib/exportUtils";
import { PasswordInput } from "@/components/PasswordInput";
import {
  DashboardUser,
  SpecialistSummary,
  LinkingCode,
  LinkingAuditRecord,
  formatDisplayDate,
  parseFirestoreDate,
  formatAdhdSubtype,
} from "@/lib/types";

export default function AdminGlobalDashboard() {
  const router = useRouter();
  const { user, role, isLoading: authLoading, startConsultation } = useAuth();

  const [psychologists, setPsychologists] = useState<DashboardUser[]>([]);
  const [tutors, setTutors] = useState<DashboardUser[]>([]);
  const [students, setStudents] = useState<SpecialistSummary[]>([]);
  const [linkingCodes, setLinkingCodes] = useState<LinkingCode[]>([]);
  const [auditLogs, setAuditLogs] = useState<LinkingAuditRecord[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "psychologists" | "tutors" | "students" | "codes" | "audit">("overview");

  // Modales
  const [showCreatePsyModal, setShowCreatePsyModal] = useState(false);
  const [showEditPsyModal, setShowEditPsyModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [showGenerateCodeModal, setShowGenerateCodeModal] = useState(false);

  // Objetos en edición
  const [editingPsy, setEditingPsy] = useState<DashboardUser | null>(null);
  const [editingStudent, setEditingStudent] = useState<SpecialistSummary | null>(null);

  // Formularios
  const [newPsyForm, setNewPsyForm] = useState({
    name: "",
    username: "",
    password: "",
    email: "",
    licenseNumber: "",
    phone: "",
  });

  const [editPsyForm, setEditPsyForm] = useState({
    name: "",
    username: "",
    password: "",
    email: "",
    licenseNumber: "",
    phone: "",
    status: "active" as "active" | "inactive",
  });

  const [editStudentForm, setEditStudentForm] = useState({
    heroName: "",
    ageGroup: "sixToSeven",
    level: 1,
    assignedPsychologistId: "",
    status: "success" as "success" | "warning" | "danger",
    institution: "",
    grade: "",
  });

  const [assignForm, setAssignForm] = useState({ studentId: "", psychologistId: "" });
  const [codeForm, setCodeForm] = useState({ studentId: "", targetRole: "any" as "psychologist" | "tutor" | "any", hours: 48 });
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);

  const loadAllAdminData = useCallback(async () => {
    setActionError(null);
    try {
      DashboardAuthService.initSystemAccounts();
      const psys = DashboardAuthService.getAllPsychologists();
      const tuts = DashboardAuthService.getAllTutors();
      const stus = await SpecialistDataService.getAllPatientSummaries();
      const codes = DashboardLinkingService.getLinkingCodes();
      const logs = DashboardAuthService.getAuditLogs();

      setPsychologists(psys);
      setTutors(tuts);
      setStudents(stus);
      setLinkingCodes(codes);
      setAuditLogs(logs);
      setCurrentTime(Date.now());
    } catch (e: unknown) {
      console.error("Error al cargar datos de administración:", e);
      setActionError("Error al sincronizar datos.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (active) {
        await loadAllAdminData();
      }
    })();
    return () => {
      active = false;
    };
  }, [loadAllAdminData]);

  // Métricas agregadas reales
  const activePsychologistsCount = psychologists.filter((p) => p.status === "active").length;
  const totalStudentsCount = students.length;

  const recentActiveStudentsCount = students.filter((s) => {
    const d = parseFirestoreDate(s.profile.lastSessionAt);
    if (!d) return false;
    const ref = currentTime > 0 ? currentTime : 0;
    return (ref - d.getTime()) <= 7 * 24 * 3600 * 1000;
  }).length;

  const inactiveStudentsCount = totalStudentsCount - recentActiveStudentsCount;
  const totalSessionsCount = students.reduce((acc, s) => acc + s.totalSessions, 0);

  // Manejo de creación de psicólogo
  const handleCreatePsychologist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setActionError(null);
    try {
      await DashboardAuthService.createPsychologist(user, newPsyForm);
      setNewPsyForm({ name: "", username: "", password: "", email: "", licenseNumber: "", phone: "" });
      setShowCreatePsyModal(false);
      setActionSuccess("¡Psicólogo registrado exitosamente con credenciales de acceso seguras!");
      setTimeout(() => setActionSuccess(null), 3500);
      await loadAllAdminData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error al registrar psicólogo.");
    }
  };

  // Manejo de asignación de alumno
  const handleAssignStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !assignForm.studentId || !assignForm.psychologistId) return;
    try {
      const studentMatch = students.find((s) => s.profile.id === assignForm.studentId);
      DashboardAuthService.assignStudentToPsychologist(
        user,
        assignForm.psychologistId,
        assignForm.studentId,
        studentMatch?.profile.heroName
      );
      setShowAssignModal(false);
      setActionSuccess("¡Alumno asignado exitosamente al psicólogo!");
      setTimeout(() => setActionSuccess(null), 3000);
      loadAllAdminData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error al asignar alumno.");
    }
  };

  // Manejo de generación de código
  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !codeForm.studentId) return;
    try {
      const studentMatch = students.find((s) => s.profile.id === codeForm.studentId);
      await DashboardLinkingService.createLinkingCode({
        actor: user,
        studentId: codeForm.studentId,
        studentHeroName: studentMatch?.profile.heroName || codeForm.studentId,
        targetRole: codeForm.targetRole,
        expirationHours: codeForm.hours,
      });
      setShowGenerateCodeModal(false);
      setActionSuccess("¡Código de vinculación generado con éxito!");
      setTimeout(() => setActionSuccess(null), 3000);
      loadAllAdminData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error al generar código.");
    }
  };

  // Apertura y envío de edición de psicólogo o usuario
  const handleOpenEditPsy = (targetUser: DashboardUser) => {
    setEditingPsy(targetUser);
    setEditPsyForm({
      name: targetUser.name,
      username: targetUser.username || "",
      password: "", // En blanco por defecto para conservar la actual si no se desea modificar
      email: targetUser.email,
      licenseNumber: targetUser.licenseNumber || "",
      phone: targetUser.phone || "",
      status: targetUser.status,
    });
    setActionError(null);
    setShowEditPsyModal(true);
  };

  const handleUpdatePsychologist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingPsy) return;
    setActionError(null);
    try {
      await DashboardAuthService.updateUser(user, editingPsy.id, {
        name: editPsyForm.name,
        username: editPsyForm.username,
        password: editPsyForm.password.trim() ? editPsyForm.password.trim() : undefined,
        email: editPsyForm.email,
        licenseNumber: editPsyForm.licenseNumber,
        phone: editPsyForm.phone,
        status: editPsyForm.status,
      });
      setShowEditPsyModal(false);
      setEditingPsy(null);
      const pwdNotice = editPsyForm.password.trim() ? " y nueva contraseña establecida" : "";
      setActionSuccess(`¡Datos y credenciales de ${editPsyForm.name} actualizados exitosamente${pwdNotice}!`);
      setTimeout(() => setActionSuccess(null), 3500);
      await loadAllAdminData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error al actualizar usuario.");
    }
  };

  // Apertura y envío de edición de alumno
  const handleOpenEditStudent = (st: SpecialistSummary) => {
    setEditingStudent(st);
    const currentAssignedPsy = psychologists.find((p) => p.assignedStudentIds.includes(st.profile.id));
    const override = SpecialistDataService.getOverrideForStudent(st.profile.id);
    setEditStudentForm({
      heroName: st.profile.heroName,
      ageGroup: st.profile.ageGroup || "sixToSeven",
      level: st.profile.level || 1,
      assignedPsychologistId: currentAssignedPsy?.id || "",
      status: (st.profile.status as "success" | "warning" | "danger") || "success",
      institution: override?.institution || "",
      grade: override?.grade || "",
    });
    setActionError(null);
    setShowEditStudentModal(true);
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingStudent) return;
    setActionError(null);
    try {
      const studentId = editingStudent.profile.id;
      const studentName = editStudentForm.heroName.trim();

      // 1. Actualizar metadatos en la capa del dashboard (sin tocar la BD de origen cognitrain_adhd)
      await SpecialistDataService.updateStudentProfile(user, studentId, {
        heroName: studentName,
        ageGroup: editStudentForm.ageGroup,
        level: Number(editStudentForm.level),
        status: editStudentForm.status,
        institution: editStudentForm.institution,
        grade: editStudentForm.grade,
      });

      // 2. Gestionar la asignación / reasignación / desasignación de psicólogo
      const previousAssignedPsy = psychologists.find((p) => p.assignedStudentIds.includes(studentId));
      const previousPsyId = previousAssignedPsy?.id || "";
      const newPsyId = editStudentForm.assignedPsychologistId;

      if (previousPsyId !== newPsyId) {
        if (!newPsyId && previousPsyId) {
          DashboardAuthService.unassignStudent(user, studentId, studentName);
        } else if (newPsyId && !previousPsyId) {
          DashboardAuthService.assignStudentToPsychologist(user, newPsyId, studentId, studentName);
        } else if (newPsyId && previousPsyId) {
          DashboardAuthService.reassignStudent(user, studentId, previousPsyId, newPsyId, studentName);
        }
      }

      setShowEditStudentModal(false);
      setEditingStudent(null);
      setActionSuccess(`¡Expediente de ${studentName} actualizado correctamente!`);
      setTimeout(() => setActionSuccess(null), 3500);
      SpecialistDataService.clearCache();
      await loadAllAdminData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error al actualizar alumno.");
    }
  };

  if (!authLoading && role !== "admin") {
    return (
      <div className="card" style={{ padding: "48px 24px", textAlign: "center", maxWidth: "600px", margin: "40px auto" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--danger)",
            }}
          >
            <Shield size={36} />
          </div>
        </div>
        <h2 style={{ fontSize: "1.4rem", marginBottom: "8px", color: "var(--foreground)" }}>
          Acceso Restringido: Panel Exclusivo de Administrador
        </h2>
        <p style={{ color: "var(--text-light)", fontSize: "0.92rem", marginBottom: "24px", lineHeight: 1.5 }}>
          Solamente el usuario administrador tiene autorización para consultar y gestionar la información de los demás usuarios (psicólogos, tutores y auditoría global).
        </p>
        <Link href="/dashboard" className="btn-primary">
          Volver a Mi Panel de Alumnos
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Cabecera */}
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span className="status-badge" style={{ backgroundColor: "rgba(91, 141, 239, 0.15)", color: "var(--primary)" }}>
              <Shield size={14} style={{ marginRight: "4px" }} /> Rol: Administrador General
            </span>
          </div>
          <h1 style={{ fontSize: "1.85rem", marginBottom: "6px" }}>Panel de Control Global</h1>
          <p style={{ color: "#64748b" }}>
            Gestión integral de psicólogos, asignación de alumnos, códigos de vinculación y auditoría.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={() => {
              SpecialistDataService.clearCache();
              loadAllAdminData();
            }}
            className="btn-secondary"
            title="Sincronizar datos"
          >
            <RefreshCw size={16} className={isLoading ? "spin" : ""} />
            Sincronizar
          </button>

          <button onClick={() => setShowCreatePsyModal(true)} className="btn-primary">
            <Plus size={16} />
            Nuevo Psicólogo
          </button>

          <button
            onClick={() => DashboardExportUtils.exportStudentsToCSV(students)}
            className="btn-secondary"
            title="Exportar base consolidada de alumnos a CSV"
          >
            <Download size={16} />
            Exportar Alumnos CSV
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div style={{ padding: "12px 16px", marginBottom: "20px", borderRadius: "10px", backgroundColor: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#065f46", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "8px" }}>
          <CheckCircle2 size={18} /> {actionSuccess}
        </div>
      )}

      {actionError && (
        <div style={{ padding: "12px 16px", marginBottom: "20px", borderRadius: "10px", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#991b1b", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "8px" }}>
          <XCircle size={18} /> {actionError}
        </div>
      )}

      {/* Tarjetas de Indicadores Principales */}
      <div className="stat-grid" style={{ marginBottom: "28px" }}>
        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: "rgba(91, 141, 239, 0.12)", color: "var(--primary)" }}>
            <UserCheck size={24} />
          </div>
          <div className="stat-info">
            <p>Psicólogos Activos</p>
            <h3>{activePsychologistsCount} <span style={{ fontSize: "0.85rem", color: "#64748b" }}>/ {psychologists.length}</span></h3>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: "rgba(16, 185, 129, 0.12)", color: "var(--success)" }}>
            <Users size={24} />
          </div>
          <div className="stat-info">
            <p>Alumnos Registrados</p>
            <h3>{totalStudentsCount}</h3>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: "rgba(245, 158, 11, 0.12)", color: "var(--warning)" }}>
            <Activity size={24} />
          </div>
          <div className="stat-info">
            <p>Con Actividad Reciente (&lt; 7d)</p>
            <h3>{recentActiveStudentsCount}</h3>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6" }}>
            <HeartHandshake size={24} />
          </div>
          <div className="stat-info">
            <p>Tutores Vinculados</p>
            <h3>{tutors.length}</h3>
          </div>
        </div>
      </div>

      {/* Pestañas de Gestión Administrativa (Linear Segmented Control) */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          padding: "4px",
          backgroundColor: "var(--background-subtle)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
          marginBottom: "24px",
          overflowX: "auto",
        }}
      >
        <button
          onClick={() => setActiveTab("overview")}
          style={{
            padding: "8px 14px",
            borderRadius: "var(--radius-md)",
            backgroundColor: activeTab === "overview" ? "var(--surface)" : "transparent",
            color: activeTab === "overview" ? "var(--foreground)" : "var(--text-light)",
            fontWeight: activeTab === "overview" ? 600 : 500,
            fontSize: "0.85rem",
            boxShadow: activeTab === "overview" ? "var(--shadow-xs)" : "none",
            border: activeTab === "overview" ? "1px solid var(--border)" : "1px solid transparent",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            transition: "all var(--transition-fast)",
          }}
        >
          Resumen Global
        </button>

        <button
          onClick={() => setActiveTab("psychologists")}
          style={{
            padding: "8px 14px",
            borderRadius: "var(--radius-md)",
            backgroundColor: activeTab === "psychologists" ? "var(--surface)" : "transparent",
            color: activeTab === "psychologists" ? "var(--foreground)" : "var(--text-light)",
            fontWeight: activeTab === "psychologists" ? 600 : 500,
            fontSize: "0.85rem",
            boxShadow: activeTab === "psychologists" ? "var(--shadow-xs)" : "none",
            border: activeTab === "psychologists" ? "1px solid var(--border)" : "1px solid transparent",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            transition: "all var(--transition-fast)",
          }}
        >
          <span>Psicólogos</span>
          <span style={{ fontSize: "0.72rem", padding: "1px 6px", borderRadius: "9999px", backgroundColor: "var(--primary-light)", color: "var(--primary)", fontWeight: 700 }}>
            {psychologists.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("tutors")}
          style={{
            padding: "8px 14px",
            borderRadius: "var(--radius-md)",
            backgroundColor: activeTab === "tutors" ? "var(--surface)" : "transparent",
            color: activeTab === "tutors" ? "var(--foreground)" : "var(--text-light)",
            fontWeight: activeTab === "tutors" ? 600 : 500,
            fontSize: "0.85rem",
            boxShadow: activeTab === "tutors" ? "var(--shadow-xs)" : "none",
            border: activeTab === "tutors" ? "1px solid var(--border)" : "1px solid transparent",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            transition: "all var(--transition-fast)",
          }}
        >
          <span>Tutores</span>
          <span style={{ fontSize: "0.72rem", padding: "1px 6px", borderRadius: "9999px", backgroundColor: "var(--primary-light)", color: "var(--primary)", fontWeight: 700 }}>
            {tutors.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("students")}
          style={{
            padding: "8px 14px",
            borderRadius: "var(--radius-md)",
            backgroundColor: activeTab === "students" ? "var(--surface)" : "transparent",
            color: activeTab === "students" ? "var(--foreground)" : "var(--text-light)",
            fontWeight: activeTab === "students" ? 600 : 500,
            fontSize: "0.85rem",
            boxShadow: activeTab === "students" ? "var(--shadow-xs)" : "none",
            border: activeTab === "students" ? "1px solid var(--border)" : "1px solid transparent",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            transition: "all var(--transition-fast)",
          }}
        >
          <span>Alumnos</span>
          <span style={{ fontSize: "0.72rem", padding: "1px 6px", borderRadius: "9999px", backgroundColor: "var(--primary-light)", color: "var(--primary)", fontWeight: 700 }}>
            {students.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("codes")}
          style={{
            padding: "8px 14px",
            borderRadius: "var(--radius-md)",
            backgroundColor: activeTab === "codes" ? "var(--surface)" : "transparent",
            color: activeTab === "codes" ? "var(--foreground)" : "var(--text-light)",
            fontWeight: activeTab === "codes" ? 600 : 500,
            fontSize: "0.85rem",
            boxShadow: activeTab === "codes" ? "var(--shadow-xs)" : "none",
            border: activeTab === "codes" ? "1px solid var(--border)" : "1px solid transparent",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            transition: "all var(--transition-fast)",
          }}
        >
          <span>Códigos</span>
          <span style={{ fontSize: "0.72rem", padding: "1px 6px", borderRadius: "9999px", backgroundColor: "var(--primary-light)", color: "var(--primary)", fontWeight: 700 }}>
            {linkingCodes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          style={{
            padding: "8px 14px",
            borderRadius: "var(--radius-md)",
            backgroundColor: activeTab === "audit" ? "var(--surface)" : "transparent",
            color: activeTab === "audit" ? "var(--foreground)" : "var(--text-light)",
            fontWeight: activeTab === "audit" ? 600 : 500,
            fontSize: "0.85rem",
            boxShadow: activeTab === "audit" ? "var(--shadow-xs)" : "none",
            border: activeTab === "audit" ? "1px solid var(--border)" : "1px solid transparent",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            transition: "all var(--transition-fast)",
          }}
        >
          <span>Auditoría</span>
          <span style={{ fontSize: "0.72rem", padding: "1px 6px", borderRadius: "9999px", backgroundColor: "var(--primary-light)", color: "var(--primary)", fontWeight: 700 }}>
            {auditLogs.length}
          </span>
        </button>
      </div>

      {/* CONTENIDO DE PESTAÑAS */}

      {/* 1. RESUMEN GLOBAL */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="stat-grid" style={{ marginBottom: 0 }}>
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Alumnos Activos</span>
                <div className="stat-icon" style={{ backgroundColor: "var(--success-light)", color: "var(--success)" }}>
                  <Activity size={18} />
                </div>
              </div>
              <div className="stat-value" style={{ color: "var(--success)" }}>{recentActiveStudentsCount}</div>
              <div className="stat-meta">Sesión registrada en los últimos 7 días</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Sin Actividad Reciente</span>
                <div className="stat-icon" style={{ backgroundColor: "var(--warning-light)", color: "var(--warning)" }}>
                  <Clock size={18} />
                </div>
              </div>
              <div className="stat-value" style={{ color: inactiveStudentsCount > 0 ? "var(--warning)" : "var(--foreground)" }}>
                {inactiveStudentsCount}
              </div>
              <div className="stat-meta">Más de 7 días sin entrenar</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Total Sesiones en Nube</span>
                <div className="stat-icon" style={{ backgroundColor: "var(--primary-light)", color: "var(--primary)" }}>
                  <Brain size={18} />
                </div>
              </div>
              <div className="stat-value">{totalSessionsCount}</div>
              <div className="stat-meta">Sincronizadas desde app CogniTrain</div>
            </div>
          </div>

          {/* Alertas Administrativas */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0 }}>Alertas de Seguimiento del Sistema</h3>
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Basadas en reglas objetivas de actividad</span>
            </div>

            {students.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                Sin alertas activas. La base de datos no tiene alumnos que requieran intervención inmediata.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {StudentTrackingEngine.generateAlerts(students).map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      padding: "12px 16px",
                      borderRadius: "8px",
                      backgroundColor:
                        alert.severity === "critical"
                          ? "rgba(239, 68, 68, 0.08)"
                          : alert.severity === "warning"
                          ? "rgba(245, 158, 11, 0.08)"
                          : "rgba(91, 141, 239, 0.08)",
                      borderLeft: `4px solid ${
                        alert.severity === "critical" ? "var(--danger)" : alert.severity === "warning" ? "var(--warning)" : "var(--primary)"
                      }`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "0.875rem" }}>{alert.title} — {alert.studentName}</strong>
                      <p style={{ fontSize: "0.8rem", color: "#475569", margin: "2px 0 0" }}>{alert.message}</p>
                    </div>
                    <Link href={`/dashboard/patient/${alert.studentId}`} className="btn-secondary" style={{ fontSize: "0.75rem" }}>
                      Revisar
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. GESTIÓN DE PSICÓLOGOS */}
      {activeTab === "psychologists" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Psicólogos Registrados</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-light)", margin: "4px 0 0" }}>
                Control de cuentas profesionales y alumnos bajo su responsabilidad clínica.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => DashboardExportUtils.exportPsychologistsToCSV(psychologists)} className="btn-secondary">
                <Download size={14} /> Exportar CSV
              </button>
              <button onClick={() => setShowCreatePsyModal(true)} className="btn-primary">
                <Plus size={16} /> Agregar Psicólogo
              </button>
            </div>
          </div>

          <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ padding: "12px 20px" }}>Profesional</th>
                  <th style={{ padding: "12px 20px" }}>Colegiatura</th>
                  <th style={{ padding: "12px 20px" }}>Estado</th>
                  <th style={{ padding: "12px 20px" }}>Alumnos Asignados</th>
                  <th style={{ padding: "12px 20px" }}>Último Acceso</th>
                  <th style={{ padding: "12px 20px", textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {psychologists.map((psy) => (
                  <tr key={psy.id}>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{psy.name}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-light)", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                        <span>{psy.email}</span>
                        {psy.username && (
                          <code style={{ backgroundColor: "var(--primary-light)", padding: "1px 6px", borderRadius: "4px", fontSize: "0.75rem", color: "var(--primary)" }}>
                            @{psy.username}
                          </code>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px", color: "var(--text-light)" }}>{psy.licenseNumber || "—"}</td>
                    <td style={{ padding: "14px 20px" }}>
                      <span className={`status-badge ${psy.status === "active" ? "status-success" : "status-danger"}`}>
                        {psy.status === "active" ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{ fontWeight: 600, color: "var(--primary)" }}>{psy.assignedStudentIds.length}</span> alumnos
                    </td>
                    <td style={{ padding: "14px 20px", color: "var(--text-light)", fontSize: "0.82rem" }}>
                      {psy.lastLoginAt ? new Date(psy.lastLoginAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "Sin acceso aún"}
                    </td>
                    <td style={{ padding: "14px 20px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                        <button
                          onClick={() => {
                            startConsultation(psy.id);
                            router.push("/dashboard");
                          }}
                          className="btn-secondary"
                          style={{ fontSize: "0.75rem", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          title="Consultar datos de este psicólogo en modo solo lectura"
                        >
                          <Eye size={13} />
                          Consultar
                        </button>
                        <button
                          onClick={() => handleOpenEditPsy(psy)}
                          className="btn-secondary"
                          style={{ fontSize: "0.75rem", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          title="Editar datos del profesional"
                        >
                          <Pencil size={13} />
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            if (!user) return;
                            const next = psy.status === "active" ? "inactive" : "active";
                            DashboardAuthService.setPsychologistStatus(user, psy.id, next);
                            loadAllAdminData();
                          }}
                          className="btn-secondary"
                          style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                        >
                          {psy.status === "active" ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2.5 GESTIÓN DE TUTORES */}
      {activeTab === "tutors" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Tutores Registrados</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-light)", margin: "4px 0 0" }}>
                Gestión de cuentas familiares, credenciales de acceso institucional y alumnos vinculados.
              </p>
            </div>
          </div>

          <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ padding: "12px 20px" }}>Tutor Familiar</th>
                  <th style={{ padding: "12px 20px" }}>Teléfono</th>
                  <th style={{ padding: "12px 20px" }}>Estado</th>
                  <th style={{ padding: "12px 20px" }}>Alumnos Vinculados</th>
                  <th style={{ padding: "12px 20px" }}>Último Acceso</th>
                  <th style={{ padding: "12px 20px", textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tutors.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "36px", color: "var(--text-light)" }}>
                      No hay tutores registrados actualmente.
                    </td>
                  </tr>
                ) : (
                  tutors.map((tut) => (
                    <tr key={tut.id}>
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{tut.name}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-light)", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                          <span>{tut.email}</span>
                          {tut.username && (
                            <code style={{ backgroundColor: "var(--primary-light)", padding: "1px 6px", borderRadius: "4px", fontSize: "0.75rem", color: "var(--primary)" }}>
                              @{tut.username}
                            </code>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "14px 20px", color: "var(--text-light)" }}>{tut.phone || "—"}</td>
                      <td style={{ padding: "14px 20px" }}>
                        <span className={`status-badge ${tut.status === "active" ? "status-success" : "status-danger"}`}>
                          {tut.status === "active" ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <span style={{ fontWeight: 600, color: "var(--primary)" }}>{tut.linkedStudentIds?.length || 0}</span> alumnos
                      </td>
                      <td style={{ padding: "14px 20px", color: "var(--text-light)", fontSize: "0.82rem" }}>
                        {tut.lastLoginAt ? new Date(tut.lastLoginAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "Sin acceso aún"}
                      </td>
                      <td style={{ padding: "14px 20px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                          <button
                            onClick={() => {
                              startConsultation(tut.id);
                              router.push("/dashboard/tutor");
                            }}
                            className="btn-secondary"
                            style={{ fontSize: "0.75rem", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                            title="Consultar datos de este tutor en modo solo lectura"
                          >
                            <Eye size={13} />
                            Consultar
                          </button>
                          <button
                            onClick={() => handleOpenEditPsy(tut)}
                            className="btn-secondary"
                            style={{ fontSize: "0.75rem", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                            title="Editar datos, usuario y contraseña del tutor"
                          >
                            <Pencil size={13} />
                            Editar
                          </button>
                          <button
                            onClick={() => {
                              if (!user) return;
                              const next = tut.status === "active" ? "inactive" : "active";
                              DashboardAuthService.setUserStatus(user, tut.id, next);
                              loadAllAdminData();
                            }}
                            className="btn-secondary"
                            style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                          >
                            {tut.status === "active" ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. ASIGNACIÓN DE ALUMNOS */}
      {activeTab === "students" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Directorio de Alumnos y Asignación</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-light)", margin: "4px 0 0" }}>
                Vincula y reasigna alumnos entre los psicólogos autorizados de la plataforma.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setShowGenerateCodeModal(true)} className="btn-secondary">
                <KeyRound size={16} /> Generar Código
              </button>
              <button onClick={() => setShowAssignModal(true)} className="btn-primary">
                <ArrowRightLeft size={16} /> Asignar Alumno
              </button>
            </div>
          </div>

          <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ padding: "12px 20px" }}>Alumno</th>
                  <th style={{ padding: "12px 20px" }}>Psicólogo Responsable</th>
                  <th style={{ padding: "12px 20px" }}>Focus Score</th>
                  <th style={{ padding: "12px 20px" }}>Última Sesión</th>
                  <th style={{ padding: "12px 20px", textAlign: "right" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "36px", color: "var(--text-light)" }}>
                      No hay alumnos registrados en las colecciones del origen.
                    </td>
                  </tr>
                ) : (
                  students.map((st) => {
                    const assignedPsy = psychologists.find((p) => p.assignedStudentIds.includes(st.profile.id));
                    return (
                      <tr key={st.profile.id}>
                        <td style={{ padding: "14px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{st.profile.heroName}</span>
                            {st.profile.adhdSubtype && (
                              <span style={{ fontSize: "0.7rem", padding: "1px 6px", borderRadius: "4px", backgroundColor: "rgba(79, 70, 229, 0.12)", color: "var(--primary)", fontWeight: 600 }}>
                                {formatAdhdSubtype(st.profile.adhdSubtype)}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "var(--text-light)", marginTop: "2px" }}>
                            Nv. {st.profile.level} • ID: {st.profile.id}
                          </div>
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          {assignedPsy ? (
                            <span style={{ fontWeight: 600, color: "var(--primary)" }}>{assignedPsy.name}</span>
                          ) : (
                            <span className="status-badge status-warning">Sin Asignar</span>
                          )}
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          <span style={{ fontWeight: 600 }}>{st.focusScore}%</span>{" "}
                          <span className={`status-badge status-${st.status}`} style={{ marginLeft: "6px" }}>{st.status}</span>
                        </td>
                        <td style={{ padding: "14px 20px", color: "var(--text-light)", fontSize: "0.82rem" }}>
                          {formatDisplayDate(st.profile.lastSessionAt, "Sin sesiones")}
                        </td>
                        <td style={{ padding: "14px 20px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                            <button
                              onClick={() => handleOpenEditStudent(st)}
                              className="btn-secondary"
                              style={{ fontSize: "0.8rem", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                              title="Editar datos y asignación del alumno"
                            >
                              <Pencil size={13} />
                              Editar
                            </button>
                            <Link href={`/dashboard/patient/${st.profile.id}`} className="btn-secondary" style={{ fontSize: "0.8rem", padding: "6px 12px" }}>
                              Ver Expediente
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. CÓDIGOS DE VINCULACIÓN */}
      {activeTab === "codes" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Códigos de Vinculación Activos</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-light)", margin: "4px 0 0" }}>
                Códigos aleatorios y temporales para permitir a psicólogos y tutores vincular alumnos de forma segura.
              </p>
            </div>
            <button onClick={() => setShowGenerateCodeModal(true)} className="btn-primary">
              <Plus size={16} /> Generar Código
            </button>
          </div>

          <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ padding: "12px 20px" }}>Código</th>
                  <th style={{ padding: "12px 20px" }}>Alumno Asociado</th>
                  <th style={{ padding: "12px 20px" }}>Rol Destino</th>
                  <th style={{ padding: "12px 20px" }}>Vence</th>
                  <th style={{ padding: "12px 20px" }}>Estado</th>
                  <th style={{ padding: "12px 20px", textAlign: "right" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {linkingCodes.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "36px", color: "var(--text-light)" }}>
                      No hay códigos generados actualmente. Haz clic en &quot;Generar Código&quot; para crear uno.
                    </td>
                  </tr>
                ) : (
                  linkingCodes.map((c) => {
                    const isExpired = currentTime > 0 ? new Date(c.expiresAt).getTime() < currentTime : false;
                    return (
                      <tr key={c.code}>
                        <td style={{ padding: "14px 20px" }}>
                          <code style={{ fontSize: "0.95rem", fontWeight: 700, backgroundColor: "var(--background-subtle)", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border)" }}>
                            {c.code}
                          </code>
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          <strong style={{ color: "var(--foreground)" }}>{c.studentHeroName}</strong>{" "}
                          <span style={{ fontSize: "0.8rem", color: "var(--text-light)" }}>({c.studentId})</span>
                        </td>
                        <td style={{ padding: "14px 20px", textTransform: "capitalize", color: "var(--foreground)" }}>{c.targetRole}</td>
                        <td style={{ padding: "14px 20px", color: "var(--text-light)", fontSize: "0.82rem" }}>
                          {new Date(c.expiresAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          {c.revoked ? (
                            <span className="status-badge status-danger">Revocado</span>
                          ) : isExpired ? (
                            <span className="status-badge status-warning">Expirado</span>
                          ) : c.currentUses >= c.maxUses ? (
                            <span className="status-badge status-success">Canjeado</span>
                          ) : (
                            <span className="status-badge status-success">Vigente</span>
                          )}
                        </td>
                        <td style={{ padding: "14px 20px", textAlign: "right" }}>
                          {!c.revoked && !isExpired && (
                            <button
                              onClick={() => {
                                if (!user) return;
                                DashboardLinkingService.revokeCode(user, c.code);
                                loadAllAdminData();
                              }}
                              className="btn-secondary"
                              style={{ color: "var(--danger)", fontSize: "0.75rem" }}
                              title="Revocar código inmediatamente"
                            >
                              <Trash2 size={14} /> Revocar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. HISTORIAL DE AUDITORÍA */}
      {activeTab === "audit" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Historial de Auditoría Administrativa</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-light)", margin: "4px 0 0" }}>
                Registro inmutable de vinculaciones, cambios de roles, asignaciones y eventos de seguridad.
              </p>
            </div>
          </div>

          <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ padding: "12px 20px" }}>Fecha / Hora</th>
                  <th style={{ padding: "12px 20px" }}>Actor</th>
                  <th style={{ padding: "12px 20px" }}>Acción</th>
                  <th style={{ padding: "12px 20px" }}>Detalle de la Operación</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "36px", color: "var(--text-light)" }}>
                      No hay registros de auditoría aún.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ padding: "14px 20px", color: "var(--text-light)", fontSize: "0.82rem" }}>
                        {new Date(log.timestamp).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "medium" })}
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <strong style={{ color: "var(--foreground)" }}>{log.actorName}</strong>{" "}
                        <span style={{ fontSize: "0.8rem", color: "var(--text-light)" }}>({log.actorRole})</span>
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: "0.75rem", padding: "3px 8px", borderRadius: "6px", backgroundColor: "var(--background-subtle)", border: "1px solid var(--border)", fontWeight: 600, color: "var(--foreground)" }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: "14px 20px", color: "var(--foreground)", fontSize: "0.85rem" }}>{log.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ALTA DE PSICÓLOGO CON GESTIÓN DE CREDENCIALES */}
      {showCreatePsyModal && (
        <div className="modal-overlay" onClick={() => { setShowCreatePsyModal(false); setActionError(null); }}>
          <div className="modal-card" style={{ maxWidth: "540px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Registrar Nuevo Psicólogo</h3>
                <p style={{ fontSize: "0.82rem", color: "var(--text-light)", margin: "4px 0 0" }}>
                  Define las credenciales institucionales. La contraseña se almacenará con hash PBKDF2-SHA256.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowCreatePsyModal(false); setActionError(null); }}
                className="btn-ghost"
                style={{ padding: "4px", borderRadius: "var(--radius-sm)" }}
              >
                <X size={18} />
              </button>
            </div>

            {actionError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "var(--danger)",
                  fontSize: "0.85rem",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <XCircle size={16} /> {actionError}
              </div>
            )}

            <form onSubmit={handleCreatePsychologist} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                  Nombres y Apellidos <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej. Dr. Andrés Valdivia"
                  value={newPsyForm.name}
                  onChange={(e) => setNewPsyForm({ ...newPsyForm, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                    Nombre de Usuario <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="ej. avaldivia"
                    value={newPsyForm.username}
                    onChange={(e) => setNewPsyForm({ ...newPsyForm, username: e.target.value })}
                    required
                  />
                  <span style={{ fontSize: "0.72rem", color: "var(--text-light)", marginTop: "3px", display: "block" }}>
                    Único, min 3 caracteres
                  </span>
                </div>

                <div>
                  <PasswordInput
                    label="Contraseña Inicial"
                    placeholder="Mín. 6 caracteres"
                    value={newPsyForm.password}
                    onChange={(e) => setNewPsyForm({ ...newPsyForm, password: e.target.value })}
                    required
                    helperText="Mín. 6 caracteres"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                  Correo Electrónico Institucional <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="andres.valdivia@cognitrain.edu"
                  value={newPsyForm.email}
                  onChange={(e) => setNewPsyForm({ ...newPsyForm, email: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                    Colegiatura / Matrícula
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej. CPP-29401"
                    value={newPsyForm.licenseNumber}
                    onChange={(e) => setNewPsyForm({ ...newPsyForm, licenseNumber: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    className="input-field"
                    placeholder="+51 987 654 321"
                    value={newPsyForm.phone}
                    onChange={(e) => setNewPsyForm({ ...newPsyForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreatePsyModal(false);
                    setActionError(null);
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Registrar y Crear Credenciales
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ASIGNACIÓN DE ALUMNO */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-card" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Asignar Alumno a Psicólogo</h3>
                <p style={{ fontSize: "0.82rem", color: "var(--text-light)", margin: "4px 0 0" }}>
                  Vincula un alumno existente con su especialista clínico responsable.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="btn-ghost"
                style={{ padding: "4px", borderRadius: "var(--radius-sm)" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignStudent} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>Selecciona Alumno</label>
                <select
                  className="input-field"
                  value={assignForm.studentId}
                  onChange={(e) => setAssignForm({ ...assignForm, studentId: e.target.value })}
                  required
                >
                  <option value="">-- Seleccionar Alumno --</option>
                  {students.map((s) => (
                    <option key={s.profile.id} value={s.profile.id}>
                      {s.profile.heroName} ({s.profile.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>Psicólogo Responsable</label>
                <select
                  className="input-field"
                  value={assignForm.psychologistId}
                  onChange={(e) => setAssignForm({ ...assignForm, psychologistId: e.target.value })}
                  required
                >
                  <option value="">-- Seleccionar Profesional --</option>
                  {psychologists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.assignedStudentIds.length} alumnos asignados)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                <button type="button" onClick={() => setShowAssignModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Confirmar Asignación</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: GENERAR CÓDIGO */}
      {showGenerateCodeModal && (
        <div className="modal-overlay" onClick={() => setShowGenerateCodeModal(false)}>
          <div className="modal-card" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Generar Código de Vinculación Seguro</h3>
                <p style={{ fontSize: "0.82rem", color: "var(--text-light)", margin: "4px 0 0" }}>
                  Código efímero y seguro para que un especialista o tutor vincule al alumno.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateCodeModal(false)}
                className="btn-ghost"
                style={{ padding: "4px", borderRadius: "var(--radius-sm)" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGenerateCode} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>Alumno</label>
                <select
                  className="input-field"
                  value={codeForm.studentId}
                  onChange={(e) => setCodeForm({ ...codeForm, studentId: e.target.value })}
                  required
                >
                  <option value="">-- Seleccionar Alumno --</option>
                  {students.map((s) => (
                    <option key={s.profile.id} value={s.profile.id}>
                      {s.profile.heroName} ({s.profile.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>Rol Destino</label>
                <select
                  className="input-field"
                  value={codeForm.targetRole}
                  onChange={(e) => setCodeForm({ ...codeForm, targetRole: e.target.value as "psychologist" | "tutor" | "any" })}
                >
                  <option value="any">Cualquiera (Psicólogo o Tutor)</option>
                  <option value="tutor">Solo Tutor Familiar</option>
                  <option value="psychologist">Solo Psicólogo</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>Vigencia del Código (Horas)</label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  className="input-field"
                  value={codeForm.hours}
                  onChange={(e) => setCodeForm({ ...codeForm, hours: Number(e.target.value) })}
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                <button type="button" onClick={() => setShowGenerateCodeModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Generar Código</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: EDICIÓN DE PSICÓLOGO / USUARIO */}
      {showEditPsyModal && editingPsy && (
        <div className="modal-overlay" onClick={() => { setShowEditPsyModal(false); setEditingPsy(null); setActionError(null); }}>
          <div className="modal-card" style={{ maxWidth: "540px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
                    Editar ({editingPsy.role === "psychologist" ? "Psicólogo" : editingPsy.role === "tutor" ? "Tutor" : "Usuario"})
                  </h3>
                  <span className="status-badge" style={{ backgroundColor: "var(--primary-light)", color: "var(--primary)" }}>
                    ID: {editingPsy.id}
                  </span>
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--text-light)", margin: "4px 0 0" }}>
                  Modifica datos, usuario único o restablece credenciales de acceso.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowEditPsyModal(false); setEditingPsy(null); setActionError(null); }}
                className="btn-ghost"
                style={{ padding: "4px", borderRadius: "var(--radius-sm)" }}
              >
                <X size={18} />
              </button>
            </div>

            {actionError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "var(--danger)",
                  fontSize: "0.85rem",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <XCircle size={16} /> {actionError}
              </div>
            )}

            <form onSubmit={handleUpdatePsychologist} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                  Nombres y Apellidos <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej. Dr. Andrés Valdivia"
                  value={editPsyForm.name}
                  onChange={(e) => setEditPsyForm({ ...editPsyForm, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                    Nombre de Usuario <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="ej. avaldivia"
                    value={editPsyForm.username}
                    onChange={(e) => setEditPsyForm({ ...editPsyForm, username: e.target.value })}
                    required
                  />
                  <span style={{ fontSize: "0.72rem", color: "var(--text-light)", marginTop: "3px", display: "block" }}>
                    Único en la plataforma
                  </span>
                </div>

                <div>
                  <PasswordInput
                    label="Nueva Contraseña (Opcional)"
                    placeholder="Conservar actual si vacío"
                    value={editPsyForm.password}
                    onChange={(e) => setEditPsyForm({ ...editPsyForm, password: e.target.value })}
                    helperText="Mín. 6 caracteres si se modifica"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                    Correo Electrónico <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="andres.valdivia@cognitrain.edu"
                    value={editPsyForm.email}
                    onChange={(e) => setEditPsyForm({ ...editPsyForm, email: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                    Estado de la Cuenta
                  </label>
                  <select
                    className="input-field"
                    value={editPsyForm.status}
                    onChange={(e) => setEditPsyForm({ ...editPsyForm, status: e.target.value as "active" | "inactive" })}
                  >
                    <option value="active">Activo (Habilitado)</option>
                    <option value="inactive">Inactivo (Suspendido)</option>
                  </select>
                </div>
              </div>

              {editingPsy.role === "psychologist" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                      Colegiatura / Matrícula
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Ej. CPP-29401"
                      value={editPsyForm.licenseNumber}
                      onChange={(e) => setEditPsyForm({ ...editPsyForm, licenseNumber: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      className="input-field"
                      placeholder="+51 987 654 321"
                      value={editPsyForm.phone}
                      onChange={(e) => setEditPsyForm({ ...editPsyForm, phone: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    className="input-field"
                    placeholder="+51 987 654 321"
                    value={editPsyForm.phone}
                    onChange={(e) => setEditPsyForm({ ...editPsyForm, phone: e.target.value })}
                  />
                </div>
              )}

              <div style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", backgroundColor: "var(--primary-light)", fontSize: "0.78rem", color: "var(--foreground)" }}>
                <strong>Gestión de Credenciales (Administrador):</strong> Puedes modificar el usuario y definir una nueva contraseña. Si dejas el campo vacío, se preservará la contraseña actual.
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditPsyModal(false);
                    setEditingPsy(null);
                    setActionError(null);
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: EDICIÓN DE ALUMNO */}
      {showEditStudentModal && editingStudent && (
        <div className="modal-overlay" onClick={() => { setShowEditStudentModal(false); setEditingStudent(null); setActionError(null); }}>
          <div className="modal-card" style={{ maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Editar Alumno</h3>
                  <span className="status-badge" style={{ backgroundColor: "var(--primary-light)", color: "var(--primary)" }}>
                    ID: {editingStudent.profile.id}
                  </span>
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--text-light)", margin: "4px 0 0" }}>
                  Actualiza información y asignación clínica sin alterar métricas históricas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowEditStudentModal(false); setEditingStudent(null); setActionError(null); }}
                className="btn-ghost"
                style={{ padding: "4px", borderRadius: "var(--radius-sm)" }}
              >
                <X size={18} />
              </button>
            </div>

            {actionError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "var(--danger)",
                  fontSize: "0.85rem",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <XCircle size={16} /> {actionError}
              </div>
            )}

            <form onSubmit={handleUpdateStudent} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                  Nombre / Alias del Alumno <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej. Mateo Valdivia"
                  value={editStudentForm.heroName}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, heroName: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                    Grupo de Edad
                  </label>
                  <select
                    className="input-field"
                    value={editStudentForm.ageGroup}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, ageGroup: e.target.value })}
                  >
                    <option value="fourToFive">4 a 5 años (Pre-escolar)</option>
                    <option value="sixToSeven">6 a 7 años (Infantil Inicial)</option>
                    <option value="eightToNine">8 a 9 años (Primaria Intermedia)</option>
                    <option value="tenToTwelve">10 a 12 años (Primaria Superior)</option>
                    <option value="thirteenToFifteen">13 a 15 años (Secundaria Inicial)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                    Nivel Cognitivo
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    className="input-field"
                    value={editStudentForm.level}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, level: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                  Psicólogo Responsable Asignado
                </label>
                <select
                  className="input-field"
                  value={editStudentForm.assignedPsychologistId}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, assignedPsychologistId: e.target.value })}
                >
                  <option value="">-- Sin Asignar (Desasignar) --</option>
                  {psychologists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.assignedStudentIds.length} alumnos asignados)
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: "0.72rem", color: "var(--text-light)", marginTop: "3px", display: "block" }}>
                  Al cambiar de psicólogo se reasignan las observaciones y se preserva todo el historial clínico.
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                    Institución Educativa
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej. Colegio San Agustín"
                    value={editStudentForm.institution}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, institution: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                    Grado / Sección
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej. 3ro Primaria - A"
                    value={editStudentForm.grade}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, grade: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                  Condición Clínica / Estado
                </label>
                <select
                  className="input-field"
                  value={editStudentForm.status}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, status: e.target.value as "success" | "warning" | "danger" })}
                >
                  <option value="success">Óptimo / En regla (Verde)</option>
                  <option value="warning">En observación / Alerta leve (Amarillo)</option>
                  <option value="danger">Requiere intervención inmediata (Rojo)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditStudentModal(false);
                    setEditingStudent(null);
                    setActionError(null);
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

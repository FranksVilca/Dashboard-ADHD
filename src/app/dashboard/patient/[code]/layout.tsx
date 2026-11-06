"use client";

import { use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, UserCircle, Settings, FileText, ClipboardList, Shield } from "lucide-react";
import { useAuth } from "@/lib/authContext";

export default function PatientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  const resolvedParams = use(params);
  const { code } = resolvedParams;
  const pathname = usePathname();
  const { user, role, isLoading, isConsulting, consultedUser } = useAuth();

  const backUrl = isConsulting
    ? consultedUser?.role === "tutor"
      ? "/dashboard/tutor"
      : "/dashboard"
    : role === "admin"
    ? "/dashboard/admin"
    : role === "tutor"
    ? "/dashboard/tutor"
    : "/dashboard";

  // Verificación estricta de autorización RBAC:
  // - Admin: puede consultar todos los expedientes de la plataforma
  // - Psicólogo: ÚNICAMENTE puede consultar expedientes asignados a su cuenta (user.assignedStudentIds)
  // - Tutor: solo puede ver su alumno vinculado (linkedStudentId o linkedTutorIds)
  const isAuthorized =
    role === "admin" ||
    (role === "psychologist" && user?.assignedStudentIds?.includes(code)) ||
    (role === "tutor" && (user?.linkedStudentIds?.includes(code) || user?.assignedStudentIds?.includes(code)));

  if (!isLoading && !isAuthorized) {
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
          Acceso Restringido al Expediente
        </h2>
        <p style={{ color: "var(--text-light)", fontSize: "0.92rem", marginBottom: "24px", lineHeight: 1.5 }}>
          Este expediente clínico (<code>{code}</code>) no está asignado a tu cuenta profesional. Solamente el Administrador o el psicólogo responsable pueden consultar esta información.
        </p>
        <Link href={backUrl} className="btn-primary">
          Volver a Mi Panel de Alumnos
        </Link>
      </div>
    );
  }

  const tabs = [
    { name: "Resumen y Sesiones", path: `/dashboard/patient/${code}`, icon: UserCircle },
    { name: "Observaciones Clínicas", path: `/dashboard/patient/${code}/notes`, icon: ClipboardList },
    { name: "Reportes Comparativos", path: `/dashboard/patient/${code}/reports`, icon: FileText },
  ];

  // Solo administradores y psicólogos autorizados acceden a los ajustes de IA y umbrales DDA
  if (role !== "tutor") {
    tabs.push({ name: "Ajustes de IA", path: `/dashboard/patient/${code}/settings`, icon: Settings });
  }

  return (
    <div className="patient-layout">
      {/* Breadcrumb & Navigation Header */}
      <div className="no-print" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", color: "var(--text-light)", marginBottom: "12px" }}>
          <Link href={backUrl} style={{ color: "var(--text-light)", textDecoration: "none" }} className="hover-link">
            {role === "admin" ? "Panel Admin" : role === "tutor" ? "Panel Tutor" : "Directorio de Alumnos"}
          </Link>
          <span>/</span>
          <span style={{ color: "var(--foreground)", fontWeight: 600 }}>Expediente {code}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link
              href={backUrl}
              className="btn-secondary"
              style={{ padding: "8px 12px", borderRadius: "var(--radius-md)" }}
              title="Volver al panel"
            >
              <ArrowLeft size={16} />
              <span>Volver</span>
            </Link>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h1 style={{ fontSize: "1.5rem", margin: 0, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  Expediente Clínico
                </h1>
                <span className="status-badge" style={{ backgroundColor: "var(--primary-light)", color: "var(--primary)", fontFamily: "monospace", fontSize: "0.8rem", fontWeight: 700 }}>
                  {code}
                </span>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--text-light)" }}>
                Seguimiento continuo de funciones ejecutivas, curva de atención y telemetría de sesiones.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pestañas de Navegación del Paciente (Linear Sub-nav) */}
      <div
        className="no-print"
        style={{
          display: "flex",
          gap: "4px",
          borderBottom: "1px solid var(--border)",
          marginBottom: "24px",
          overflowX: "auto",
        }}
      >
        {tabs.map((tab) => {
          const isActive = pathname === tab.path;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.path}
              href={tab.path}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                borderBottom: isActive ? "2px solid var(--primary)" : "2px solid transparent",
                marginBottom: "-1px",
                color: isActive ? "var(--primary)" : "var(--text-light)",
                fontWeight: isActive ? 600 : 500,
                fontSize: "0.875rem",
                textDecoration: "none",
                whiteSpace: "nowrap",
                transition: "all var(--transition-fast)",
              }}
            >
              <Icon size={16} />
              {tab.name}
            </Link>
          );
        })}
      </div>

      {/* Contenido de la Pestaña */}
      <div className="patient-content">{children}</div>
    </div>
  );
}

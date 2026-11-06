"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  LayoutDashboard,
  Settings,
  LogOut,
  Shield,
  UserCheck,
  HeartHandshake,
  Brain,
  ChevronDown,
  Eye,
  XCircle,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { DashboardAuthService } from "@/lib/authService";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, logout, consultedUser, isConsulting, startConsultation, exitConsultation } = useAuth();
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Close mobile drawer on route change
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const allUsers = typeof window !== "undefined" && role === "admin" ? DashboardAuthService.getAllUsers() : [];

  // Elementos de navegación basados en el rol (RBAC)
  const navItems = [];

  if (role === "admin") {
    navItems.push(
      { name: "Panel Administrador", path: "/dashboard/admin", icon: LayoutDashboard },
      { name: "Directorio Alumnos", path: "/dashboard/patients", icon: Users },
      { name: "Configuración Sistema", path: "/dashboard/settings", icon: Settings }
    );

    // Enlace contextual adicional si el Administrador está en Modo de Solo Consulta
    if (isConsulting && consultedUser) {
      if (consultedUser.role === "tutor") {
        navItems.push({
          name: `Vista Tutor (${consultedUser.name})`,
          path: "/dashboard/tutor",
          icon: HeartHandshake,
        });
      } else {
        navItems.push({
          name: `Seguimiento (${consultedUser.name})`,
          path: "/dashboard",
          icon: Brain,
        });
      }
    }
  } else if (role === "tutor") {
    navItems.push(
      { name: "Mi Alumno / Progreso", path: "/dashboard/tutor", icon: HeartHandshake }
    );
  } else {
    // Psicólogo (por defecto): Únicamente ve sus alumnos asignados y su propia configuración
    navItems.push(
      { name: "Panel de Seguimiento", path: "/dashboard", icon: LayoutDashboard },
      { name: "Mis Alumnos Asignados", path: "/dashboard/patients", icon: Users },
      { name: "Mi Configuración", path: "/dashboard/settings", icon: Settings }
    );
  }

  return (
    <div className="layout-container">
      {/* Mobile Topbar */}
      <header className="mobile-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú de navegación"
            style={{
              padding: "8px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Menu size={20} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "7px",
                backgroundColor: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
              }}
            >
              <Brain size={16} />
            </div>
            <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>CogniTrain</span>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {/* Backdrop for mobile drawer */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        {/* Brand Header */}
        <div
          style={{
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: "16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 2px 8px rgba(79, 70, 229, 0.35)",
              }}
            >
              <Brain size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <h2 style={{ fontSize: "1.05rem", lineHeight: 1.2, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
                  CogniTrain
                </h2>
                <span
                  style={{
                    fontSize: "0.65rem",
                    padding: "1px 5px",
                    borderRadius: "4px",
                    backgroundColor: "var(--primary-light)",
                    color: "var(--primary)",
                    fontWeight: 700,
                  }}
                >
                  v2.0
                </span>
              </div>
              <span style={{ fontSize: "0.72rem", color: "var(--text-light)" }}>Dashboard Clínico</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <ThemeToggle />
            {mobileOpen && (
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar menú"
                style={{
                  padding: "6px",
                  borderRadius: "6px",
                  color: "var(--text-light)",
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Tarjeta del Usuario Actual & Selector de Consulta (Solo Administrador) */}
        <div
          style={{
            marginBottom: "20px",
            padding: "10px 12px",
            backgroundColor: "var(--background-subtle)",
            borderRadius: "var(--radius-md)",
            border: isConsulting ? "1px solid var(--warning)" : "1px solid var(--border)",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: role === "admin" ? "pointer" : "default",
            }}
            onClick={() => {
              if (role === "admin") setShowRoleSwitcher(!showRoleSwitcher);
            }}
            title={role === "admin" ? "Consultar datos de usuarios (Solo Administrador)" : `Sesión iniciada: ${user?.name}`}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  backgroundColor:
                    role === "admin"
                      ? "var(--primary-light)"
                      : role === "psychologist"
                      ? "var(--success-light)"
                      : "var(--warning-light)",
                  color:
                    role === "admin"
                      ? "var(--primary)"
                      : role === "psychologist"
                      ? "var(--success)"
                      : "var(--warning)",
                  border: `1px solid ${
                    role === "admin"
                      ? "var(--primary-border)"
                      : role === "psychologist"
                      ? "var(--success-border)"
                      : "var(--warning-border)"
                  }`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {role === "admin" ? <Shield size={16} /> : role === "tutor" ? <HeartHandshake size={16} /> : <UserCheck size={16} />}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "var(--foreground)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user?.name || "Usuario"}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-light)", textTransform: "capitalize" }}>
                  {role === "admin" ? "Administrador" : role === "tutor" ? "Tutor Familiar" : "Psicólogo Clínico"}
                </div>
              </div>
            </div>
            {role === "admin" && <ChevronDown size={14} color="var(--text-light)" />}
          </div>

          {/* Indicador de modo de consulta en la tarjeta */}
          {isConsulting && consultedUser && (
            <div
              style={{
                marginTop: "8px",
                padding: "6px 8px",
                backgroundColor: "var(--warning-light)",
                borderRadius: "6px",
                border: "1px solid var(--warning-border)",
                fontSize: "0.72rem",
                color: "var(--warning-hover)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "4px",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <Eye size={12} /> Viendo: {consultedUser.name}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  exitConsultation();
                  router.push("/dashboard/admin");
                }}
                title="Salir del modo consulta"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--warning)",
                  padding: "0 2px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <XCircle size={14} />
              </button>
            </div>
          )}

          {/* Menú desplegable para consultar datos de usuarios (ESTRICTAMENTE EXCLUSIVO PARA ADMINISTRADOR) */}
          {role === "admin" && showRoleSwitcher && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: "6px",
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-lg)",
                zIndex: 60,
                padding: "8px",
              }}
            >
              <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", padding: "4px 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Consultar Datos (Solo Lectura)
              </div>

              {isConsulting && (
                <button
                  onClick={() => {
                    exitConsultation();
                    setShowRoleSwitcher(false);
                    router.push("/dashboard/admin");
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    backgroundColor: "var(--warning-light)",
                    color: "var(--warning)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: "4px",
                  }}
                >
                  <XCircle size={14} />
                  Restablecer a Administrador Normal
                </button>
              )}

              {allUsers.map((u) => {
                const isSelected = isConsulting ? consultedUser?.id === u.id : user?.id === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      if (u.role === "admin") {
                        exitConsultation();
                        setShowRoleSwitcher(false);
                        router.push("/dashboard/admin");
                      } else {
                        startConsultation(u.id);
                        setShowRoleSwitcher(false);
                        if (u.role === "tutor") router.push("/dashboard/tutor");
                        else router.push("/dashboard");
                      }
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      backgroundColor: isSelected ? "var(--primary-light)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: isSelected ? 600 : 500, color: isSelected ? "var(--primary)" : "var(--foreground)" }}>
                        {u.name}
                      </div>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-light)" }}>
                        {u.role === "admin" ? "Administrador (Tú)" : u.role === "tutor" ? "Tutor" : "Psicólogo"}
                      </span>
                    </div>
                    {isSelected && (
                      <span style={{ fontSize: "0.68rem", color: "var(--primary)", fontWeight: 700 }}>
                        {isConsulting ? "Consultando" : "Activo"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sección de Navegación */}
        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 8px 8px 8px" }}>
          Navegación
        </div>
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "9px 12px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: isActive ? "var(--primary-light)" : "transparent",
                  color: isActive ? "var(--primary)" : "var(--text-light)",
                  fontWeight: isActive ? 600 : 500,
                  fontSize: "0.85rem",
                  transition: "all var(--transition-fast)",
                  border: isActive ? "1px solid var(--primary-border)" : "1px solid transparent",
                }}
              >
                <Icon size={17} color={isActive ? "var(--primary)" : "var(--text-light)"} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Cerrar Sesión */}
        <div style={{ paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "9px 12px",
              color: "var(--text-light)",
              fontWeight: 500,
              fontSize: "0.85rem",
              width: "100%",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--surface-hover)";
              e.currentTarget.style.color = "var(--danger)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--text-light)";
            }}
          >
            <LogOut size={16} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Banner visible de Modo de Solo Consulta */}
        {isConsulting && consultedUser && (
          <div
            style={{
              backgroundColor: "var(--warning-light)",
              border: "1px solid var(--warning-border)",
              borderRadius: "var(--radius-lg)",
              padding: "14px 18px",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "14px",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(245, 158, 11, 0.15)",
                  border: "1px solid var(--warning-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--warning)",
                  flexShrink: 0,
                }}
              >
                <Eye size={18} />
              </div>
              <div>
                <strong style={{ color: "var(--foreground)", fontSize: "0.92rem", display: "block" }}>
                  Modo de solo lectura: estás viendo los datos de {consultedUser.name} ({consultedUser.role === "psychologist" ? "Psicólogo" : "Tutor"})
                </strong>
                <p style={{ margin: "2px 0 0", color: "var(--text-light)", fontSize: "0.8rem" }}>
                  Mantienes tu sesión como Administrador ({user?.name}). Las modificaciones, creaciones o acciones en nombre de este usuario están bloqueadas.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                exitConsultation();
                router.push("/dashboard/admin");
              }}
              style={{
                backgroundColor: "var(--warning)",
                color: "#ffffff",
                border: "none",
                padding: "8px 14px",
                borderRadius: "var(--radius-md)",
                fontWeight: 600,
                fontSize: "0.82rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "var(--shadow-xs)",
              }}
            >
              <XCircle size={15} /> Salir del modo consulta
            </button>
          </div>
        )}

        {children}
      </main>
    </div>
  );
}

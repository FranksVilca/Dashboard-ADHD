"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  RefreshCw,
  UserCheck,
  Download,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Building,
  User,
  Sparkles,
} from "lucide-react";
import { SpecialistDataService } from "@/lib/specialistDataService";
import { DashboardAuthService } from "@/lib/authService";
import { useAuth } from "@/lib/authContext";
import { DashboardExportUtils } from "@/lib/exportUtils";
import { StudentTrackingEngine } from "@/lib/studentTracking";
import { SpecialistSummary, formatDisplayDate, DashboardUser, formatAdhdSubtype } from "@/lib/types";

export default function PatientsDirectory() {
  const { user, role, consultedUser, isConsulting } = useAuth();
  const [patients, setPatients] = useState<SpecialistSummary[]>([]);
  const [psychologists, setPsychologists] = useState<DashboardUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "warning" | "danger">("all");
  const [adhdFilter, setAdhdFilter] = useState<string>("all");
  const [ageGroupFilter, setAgeGroupFilter] = useState<string>("all");
  const [psychologistFilter, setPsychologistFilter] = useState<string>("all");
  const [institutionFilter, setInstitutionFilter] = useState<string>("all");

  // Paginación
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(5);

  const loadPatients = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const data = await SpecialistDataService.getAllPatientSummaries();
      setPatients(data);
      if (role === "admin") {
        const psyList = DashboardAuthService.getAllPsychologists();
        setPsychologists(psyList);
      }
    } catch (e) {
      console.error("Error al cargar directorio de pacientes:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const data = await SpecialistDataService.getAllPatientSummaries();
        if (isMounted) {
          setPatients(data);
          if (role === "admin") {
            setPsychologists(DashboardAuthService.getAllPsychologists());
          }
        }
      } catch (e) {
        console.error("Error al cargar directorio de pacientes:", e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [role]);

  // SEGMENTACIÓN ESTRICTA RBAC:
  // - Modo de Solo Consulta: Filtra a los alumnos del especialista consultado.
  // - Admin: consulta la totalidad de los alumnos de la plataforma.
  // - Psicólogo: ÚNICAMENTE puede consultar los alumnos asignados a su cuenta (user.assignedStudentIds).
  const authorizedPatients = useMemo(() => {
    if (isConsulting && consultedUser) {
      const targetIds = consultedUser.assignedStudentIds || [];
      return patients.filter((p) => targetIds.includes(p.profile.id));
    }
    if (role === "admin") return patients;
    const myIds = user?.assignedStudentIds || [];
    return patients.filter((p) => myIds.includes(p.profile.id));
  }, [patients, role, user, isConsulting, consultedUser]);

  // Lista de instituciones registradas para el filtro
  const distinctInstitutions = useMemo(() => {
    const set = new Set<string>();
    authorizedPatients.forEach((p) => {
      const ov = SpecialistDataService.getOverrideForStudent(p.profile.id);
      if (ov?.institution && ov.institution.trim()) {
        set.add(ov.institution.trim());
      }
    });
    return Array.from(set).sort();
  }, [authorizedPatients]);

  // Filtrado reactivo multidimensional
  const filteredPatients = useMemo(() => {
    return authorizedPatients.filter((p) => {
      // 1. Búsqueda por texto (Nombre de héroe, ID, código de vinculación)
      const queryLower = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !queryLower ||
        p.profile.heroName.toLowerCase().includes(queryLower) ||
        p.profile.id.toLowerCase().includes(queryLower) ||
        (p.profile.linkCode && p.profile.linkCode.toLowerCase().includes(queryLower));

      // 2. Filtro por Estado Clínico
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;

      // 3. Filtro por Grupo Etario
      const matchesAgeGroup =
        ageGroupFilter === "all" ||
        p.profile.ageGroup === ageGroupFilter ||
        (ageGroupFilter === "fourToFive" && p.profile.ageGroup?.includes("4")) ||
        (ageGroupFilter === "sixToSeven" && p.profile.ageGroup?.includes("6")) ||
        (ageGroupFilter === "eightToNine" && p.profile.ageGroup?.includes("8")) ||
        (ageGroupFilter === "tenToTwelve" && p.profile.ageGroup?.includes("10")) ||
        (ageGroupFilter === "thirteenToFifteen" && p.profile.ageGroup?.includes("13"));

      // 4. Filtro por Psicólogo Responsable (solo disponible para el Administrador)
      let matchesPsychologist = true;
      if (role === "admin" && psychologistFilter !== "all") {
        const psy = psychologists.find((u) => u.id === psychologistFilter);
        matchesPsychologist = !!(psy && psy.assignedStudentIds?.includes(p.profile.id));
      }

      // 5. Filtro por Institución Educativa
      let matchesInstitution = true;
      if (institutionFilter !== "all") {
        const ov = SpecialistDataService.getOverrideForStudent(p.profile.id);
        matchesInstitution = ov?.institution === institutionFilter;
      }

      // 6. Filtro por Subtipo de TDAH
      let matchesAdhd = true;
      if (adhdFilter !== "all") {
        const subtype = (p.profile.adhdSubtype || "").toLowerCase();
        if (adhdFilter === "hyperactive") {
          matchesAdhd = subtype.includes("hyperactive") || subtype.includes("hiperactiv");
        } else if (adhdFilter === "inattentive") {
          matchesAdhd = subtype.includes("inattentive") || subtype.includes("inatent");
        } else if (adhdFilter === "combined") {
          matchesAdhd = subtype.includes("combined") || subtype.includes("combinad");
        }
      }

      return matchesSearch && matchesStatus && matchesAgeGroup && matchesPsychologist && matchesInstitution && matchesAdhd;
    });
  }, [
    authorizedPatients,
    searchQuery,
    statusFilter,
    adhdFilter,
    ageGroupFilter,
    psychologistFilter,
    institutionFilter,
    psychologists,
    role,
  ]);

  // Cálculos de Paginación
  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / itemsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedPatients = useMemo(() => {
    const start = (safePage - 1) * itemsPerPage;
    return filteredPatients.slice(start, start + itemsPerPage);
  }, [filteredPatients, safePage, itemsPerPage]);

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setAdhdFilter("all");
    setAgeGroupFilter("all");
    setPsychologistFilter("all");
    setInstitutionFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery !== "" ||
    statusFilter !== "all" ||
    adhdFilter !== "all" ||
    ageGroupFilter !== "all" ||
    psychologistFilter !== "all" ||
    institutionFilter !== "all";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: "2rem", marginBottom: "8px" }}>
            {role === "admin" ? "Directorio General de Alumnos" : "Mis Alumnos Asignados"}
          </h1>
          <p style={{ color: "var(--text-light)" }}>
            {role === "admin"
              ? "Supervisión consolidada de todos los alumnos registrados en el sistema con telemetría neurocognitiva."
              : "Listado de niños y niñas bajo tu supervisión clínica directa con telemetría integrada en tiempo real."}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={() => {
              SpecialistDataService.clearCache();
              loadPatients(true);
            }}
            className="btn-secondary"
          >
            <RefreshCw size={16} className={isLoading ? "spin" : ""} />
            Actualizar
          </button>
          <button
            onClick={() => DashboardExportUtils.exportStudentsToCSV(filteredPatients)}
            className="btn-primary"
          >
            <Download size={16} /> Exportar CSV ({filteredPatients.length})
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros Avanzados */}
      <div className="card" style={{ marginBottom: "24px" }}>
        {/* Fila 1: Búsqueda y Reset */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: "16px",
          }}
        >
          <div style={{ flex: 1, minWidth: "260px", position: "relative" }}>
            <Search
              size={18}
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
              }}
            />
            <input
              type="text"
              className="input-field"
              placeholder="Buscar por nombre de héroe, ID o código de tutor..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{ paddingLeft: "42px" }}
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="btn-secondary"
              style={{ color: "var(--danger)", borderColor: "rgba(239, 68, 68, 0.3)" }}
              title="Restablecer todos los filtros"
            >
              <RotateCcw size={14} /> Limpiar Filtros
            </button>
          )}
        </div>

        {/* Fila 2: Selectores de Filtro Avanzado */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px",
            alignItems: "center",
            paddingTop: "12px",
            borderTop: "1px solid var(--border)",
          }}
        >
          {/* Filtro: Estado Clínico */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--text-light)",
                marginBottom: "4px",
              }}
            >
              Estado Clínico
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Filter size={16} color="#64748b" />
              <select
                className="input-field"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as "all" | "success" | "warning" | "danger");
                  setCurrentPage(1);
                }}
              >
                <option value="all">Todos los estados</option>
                <option value="success">Óptimo (&gt; 75%)</option>
                <option value="warning">En Observación (50-75%)</option>
                <option value="danger">Crítico (&lt; 50%)</option>
              </select>
            </div>
          </div>

          {/* Filtro: Subtipo de TDAH */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--text-light)",
                marginBottom: "4px",
              }}
            >
              Subtipo de TDAH
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Filter size={16} color="#64748b" />
              <select
                className="input-field"
                value={adhdFilter}
                onChange={(e) => {
                  setAdhdFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">Todos los subtipos</option>
                <option value="hyperactive">Hiperactivo / Impulsivo</option>
                <option value="inattentive">Inatento</option>
                <option value="combined">Combinado</option>
              </select>
            </div>
          </div>

          {/* Filtro: Rango de Edad */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--text-light)",
                marginBottom: "4px",
              }}
            >
              Rango de Edad
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={16} color="#64748b" />
              <select
                className="input-field"
                value={ageGroupFilter}
                onChange={(e) => {
                  setAgeGroupFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">Todos los grupos</option>
                <option value="fourToFive">4 - 5 años (Preescolar)</option>
                <option value="sixToSeven">6 - 7 años (Inicial Primaria)</option>
                <option value="eightToNine">8 - 9 años (Primaria Media)</option>
                <option value="tenToTwelve">10 - 12 años (Primaria Alta)</option>
                <option value="thirteenToFifteen">13 - 15 años (Secundaria)</option>
              </select>
            </div>
          </div>

          {/* Filtro: Psicólogo Responsable (Exclusivo para el Administrador) */}
          {role === "admin" && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--text-light)",
                  marginBottom: "4px",
                }}
              >
                Psicólogo Asignado
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <User size={16} color="#64748b" />
                <select
                  className="input-field"
                  value={psychologistFilter}
                  onChange={(e) => {
                    setPsychologistFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="all">Todos los especialistas</option>
                  {psychologists.map((psy) => (
                    <option key={psy.id} value={psy.id}>
                      {psy.name} ({psy.assignedStudentIds?.length || 0} alumnos)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Filtro: Institución Educativa */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--text-light)",
                marginBottom: "4px",
              }}
            >
              Institución Educativa
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Building size={16} color="#64748b" />
              <select
                className="input-field"
                value={institutionFilter}
                onChange={(e) => {
                  setInstitutionFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">Todas las instituciones</option>
                {distinctInstitutions.map((inst) => (
                  <option key={inst} value={inst}>
                    {inst}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Resultados */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Grupo Etario</th>
                <th>Estado</th>
                <th>Última Sesión</th>
                <th>Focus Score</th>
                <th style={{ textAlign: "right" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-light)" }}>
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}>
                      <RefreshCw size={18} className="spin" />
                      <span>Cargando directorio desde la base de datos...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-light)" }}>
                    <UserCheck size={36} style={{ color: "var(--text-muted)", marginBottom: "12px", display: "inline-block" }} />
                    <h4 style={{ color: "var(--foreground)", marginBottom: "4px" }}>No se encontraron alumnos</h4>
                    <p style={{ fontSize: "0.85rem", margin: "6px auto 16px", maxWidth: "440px" }}>
                      {patients.length === 0
                        ? "Aún no hay perfiles registrados en las colecciones del origen."
                        : "Ningún alumno coincide con los filtros aplicados."}
                    </p>
                    {hasActiveFilters && (
                      <button onClick={resetFilters} className="btn-secondary" style={{ margin: "0 auto" }}>
                        <RotateCcw size={14} /> Quitar Filtros
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((patient) => {
                  const override = SpecialistDataService.getOverrideForStudent(patient.profile.id);
                  const act = StudentTrackingEngine.determineActivityStatus({
                    profile: patient.profile,
                    totalSessions: patient.totalSessions,
                  });
                  return (
                    <tr key={patient.profile.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div className="avatar">
                            {patient.profile.heroName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{patient.profile.heroName}</span>
                              {patient.profile.adhdSubtype && (
                                <span
                                  style={{
                                    backgroundColor: "rgba(79, 70, 229, 0.12)",
                                    color: "var(--primary)",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    fontSize: "0.7rem",
                                    fontWeight: 600,
                                  }}
                                >
                                  {formatAdhdSubtype(patient.profile.adhdSubtype)}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-light)", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                              <span>Nv. {patient.profile.level}</span>
                              <span>•</span>
                              <span>ID: {patient.profile.id}</span>
                              {patient.profile.linkCode && (
                                <code
                                  style={{
                                    backgroundColor: "var(--background-subtle)",
                                    padding: "1px 5px",
                                    borderRadius: "3px",
                                    border: "1px solid var(--border)",
                                    fontSize: "0.7rem",
                                    color: "var(--primary)",
                                  }}
                                >
                                  {patient.profile.linkCode}
                                </code>
                              )}
                              {override?.institution && (
                                <span
                                  style={{
                                    backgroundColor: "var(--primary-light)",
                                    color: "var(--primary)",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    fontSize: "0.72rem",
                                    fontWeight: 500,
                                  }}
                                >
                                  {override.institution}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-light)", fontSize: "0.85rem" }}>
                        {patient.profile.ageGroup || "6-7 años"}
                      </td>
                      <td>
                        <span className={`status-badge ${act.badgeClass}`} title={act.description}>
                          {act.label}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-light)", fontSize: "0.82rem" }}>
                        {formatDisplayDate(patient.profile.lastSessionAt, "Sin sesiones")}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "120px" }}>
                          <div
                            style={{
                              flex: 1,
                              height: "6px",
                              backgroundColor: "var(--border)",
                              borderRadius: "3px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.min(100, Math.max(0, patient.focusScore))}%`,
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
                          <span>Ver Expediente</span>
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

        {/* Controles de Paginación Reactiva */}
        {!isLoading && filteredPatients.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
              padding: "16px 20px",
              borderTop: "1px solid var(--border)",
            }}
          >
            {/* Resumen de conteo */}
            <div style={{ fontSize: "0.85rem", color: "var(--text-light)" }}>
              Mostrando{" "}
              <strong>
                {Math.min(filteredPatients.length, (safePage - 1) * itemsPerPage + 1)} -{" "}
                {Math.min(filteredPatients.length, safePage * itemsPerPage)}
              </strong>{" "}
              de <strong>{filteredPatients.length}</strong> alumnos
            </div>

            {/* Selector de ítems por página y Botones de Página */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", color: "var(--text-light)" }}>
                <span>Por página:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="input-field"
                  style={{ width: "70px", padding: "4px 8px", fontSize: "0.85rem" }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </div>

              {/* Controles de avance */}
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="btn-secondary"
                  style={{
                    padding: "6px 10px",
                    opacity: safePage === 1 ? 0.4 : 1,
                    cursor: safePage === 1 ? "not-allowed" : "pointer",
                  }}
                  title="Página anterior"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  // Mostrar solo las páginas cercanas si hay muchas
                  if (totalPages > 7 && Math.abs(pNum - safePage) > 2 && pNum !== 1 && pNum !== totalPages) {
                    if (pNum === safePage - 3 || pNum === safePage + 3) {
                      return (
                        <span key={pNum} style={{ padding: "0 4px", color: "var(--text-light)" }}>
                          ...
                        </span>
                      );
                    }
                    return null;
                  }
                  return (
                    <button
                      key={pNum}
                      onClick={() => setCurrentPage(pNum)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        backgroundColor:
                          safePage === pNum ? "var(--primary)" : "var(--surface-hover)",
                        color: safePage === pNum ? "#ffffff" : "var(--foreground)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="btn-secondary"
                  style={{
                    padding: "6px 10px",
                    opacity: safePage === totalPages ? 0.4 : 1,
                    cursor: safePage === totalPages ? "not-allowed" : "pointer",
                  }}
                  title="Página siguiente"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

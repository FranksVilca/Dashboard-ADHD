import { SpecialistSummary, Session, DashboardUser, formatDisplayDate } from "./types";

/**
 * Descarga un archivo en el navegador del usuario.
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export class DashboardExportUtils {
  /**
   * Exporta la lista de alumnos y sus métricas consolidadas a CSV con BOM UTF-8.
   */
  static exportStudentsToCSV(students: SpecialistSummary[], filename = "alumnos_cognitrain.csv"): void {
    const headers = [
      "ID Alumno",
      "Nombre de Héroe",
      "Grupo Etario",
      "Nivel",
      "Monedas",
      "Score de Foco (%)",
      "Estado Clínico",
      "Total Sesiones",
      "Tiempo Total (s)",
      "Última Sesión",
    ];

    const rows = students.map((s) => [
      s.profile.id,
      `"${s.profile.heroName.replace(/"/g, '""')}"`,
      s.profile.ageGroup,
      s.profile.level,
      s.profile.coins,
      s.focusScore,
      s.status,
      s.totalSessions,
      s.totalPlayTimeSeconds,
      formatDisplayDate(s.profile.lastSessionAt, "Sin sesiones"),
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadFile(csvContent, filename, "text/csv;charset=utf-8;");
  }

  /**
   * Exporta las sesiones de un alumno a formato CSV.
   */
  static exportSessionsToCSV(sessions: Session[], studentName: string): void {
    const headers = [
      "ID Sesión",
      "Fecha",
      "Estado",
      "Duración (s)",
      "Atención Efectiva (s)",
      "Distracciones/min",
      "Score de Foco (%)",
      "Completitud (%)",
    ];

    const rows = sessions.map((s) => [
      s.id,
      formatDisplayDate(s.date),
      s.status,
      s.totalDurationSeconds,
      s.effectiveAttentionTime,
      typeof s.distractionsPerMinute === "number" ? s.distractionsPerMinute.toFixed(1) : 0,
      s.focusScore ?? "N/A",
      Math.round(s.completionPercentage * 100),
    ]);

    const safeName = studentName.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadFile(csvContent, `sesiones_${safeName}.csv`, "text/csv;charset=utf-8;");
  }

  /**
   * Exporta el listado de psicólogos del panel de administración a CSV.
   */
  static exportPsychologistsToCSV(psychologists: DashboardUser[]): void {
    const headers = [
      "ID",
      "Nombre",
      "Email",
      "Colegiatura",
      "Estado",
      "Alumnos Asignados",
      "Último Acceso",
      "Fecha Registro",
    ];

    const rows = psychologists.map((p) => [
      p.id,
      `"${p.name.replace(/"/g, '""')}"`,
      p.email,
      p.licenseNumber || "N/A",
      p.status,
      p.assignedStudentIds.length,
      p.lastLoginAt ? new Date(p.lastLoginAt).toLocaleDateString() : "Sin acceso aún",
      new Date(p.createdAt).toLocaleDateString(),
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadFile(csvContent, "directorio_psicologos.csv", "text/csv;charset=utf-8;");
  }
}

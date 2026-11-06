"use client";

import { use, useState, useEffect, useCallback } from "react";
import { Download, CalendarDays, TrendingUp, TrendingDown, Minus, RefreshCw, FileSpreadsheet } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { SpecialistDataService } from "@/lib/specialistDataService";
import { DashboardObservationService } from "@/lib/observationService";
import { useAuth } from "@/lib/authContext";
import { ProfessionalObservation } from "@/lib/types";

interface ComparisonItem {
  metric: string;
  periodA: number;
  periodB: number;
  unit: string;
}

export default function PatientReports({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const { code } = resolvedParams;
  const { user } = useAuth();

  // Fechas por defecto: Período A (hace 14 a 7 días), Período B (últimos 7 días)
  const today = new Date();
  const d7 = new Date(today);
  d7.setDate(d7.getDate() - 7);
  const d14 = new Date(today);
  d14.setDate(d14.getDate() - 14);

  const [dateAStart, setDateAStart] = useState(d14.toISOString().split("T")[0]);
  const [dateAEnd, setDateAEnd] = useState(d7.toISOString().split("T")[0]);
  const [dateBStart, setDateBStart] = useState(d7.toISOString().split("T")[0]);
  const [dateBEnd, setDateBEnd] = useState(today.toISOString().split("T")[0]);

  const [comparisonData, setComparisonData] = useState<ComparisonItem[]>([]);
  const [observations, setObservations] = useState<ProfessionalObservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const applyPreset = (days: number) => {
    const t = new Date();
    const mid = new Date(t);
    mid.setDate(mid.getDate() - days);
    const start = new Date(t);
    start.setDate(start.getDate() - days * 2);

    setDateAStart(start.toISOString().split("T")[0]);
    setDateAEnd(mid.toISOString().split("T")[0]);
    setDateBStart(mid.toISOString().split("T")[0]);
    setDateBEnd(t.toISOString().split("T")[0]);
  };

  const fetchComparison = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await SpecialistDataService.getPeriodComparison(
        code,
        new Date(dateAStart),
        new Date(dateAEnd),
        new Date(dateBStart),
        new Date(dateBEnd)
      );
      setComparisonData(data);

      if (user) {
        const obs = DashboardObservationService.getObservationsForStudent(code, user);
        setObservations(obs);
      }
    } catch (e) {
      console.error("Error al calcular comparación de períodos:", e);
    } finally {
      setIsLoading(false);
    }
  }, [code, dateAStart, dateAEnd, dateBStart, dateBEnd, user]);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const data = await SpecialistDataService.getPeriodComparison(
          code,
          new Date(dateAStart),
          new Date(dateAEnd),
          new Date(dateBStart),
          new Date(dateBEnd)
        );
        if (isMounted) setComparisonData(data);

        if (user && isMounted) {
          const obs = DashboardObservationService.getObservationsForStudent(code, user);
          setObservations(obs);
        }
      } catch (e) {
        console.error("Error al calcular comparación de períodos:", e);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [code, dateAStart, dateAEnd, dateBStart, dateBEnd, user]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ["Métrica", `Período A (${dateAStart} - ${dateAEnd})`, `Período B (${dateBStart} - ${dateBEnd})`, "Unidad", "Variación Absoluta", "Variación (%)"];
    const rows = comparisonData.map((item) => {
      const delta = calculateDelta(item.periodA, item.periodB);
      return [
        `"${item.metric}"`,
        item.periodA,
        item.periodB,
        item.unit,
        delta.value,
        delta.percent + "%",
      ];
    });

    const csv = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_comparativo_${code}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const calculateDelta = (a: number, b: number) => {
    if (a === 0 && b === 0) return { value: 0, percent: "0.0" };
    if (a === 0) return { value: b, percent: "+100.0" };
    const diff = +(b - a).toFixed(2);
    const percent = (diff / a) * 100;
    return {
      value: diff,
      percent: (diff > 0 ? "+" : "") + percent.toFixed(1),
    };
  };

  return (
    <div>
      <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "4px" }}>Reportes Comparativos Clínicos</h2>
          <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
            Contrasta dos rangos temporales para cuantificar la evolución del foco y la reducción de fatiga.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn-secondary" onClick={handleExportCSV}>
            <FileSpreadsheet size={16} /> Exportar CSV
          </button>
          <button className="btn-primary" onClick={handlePrint}>
            <Download size={16} /> Exportar a PDF
          </button>
        </div>
      </div>

      {/* Selectores Rápidos de Rango */}
      <div className="no-print" style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        <button onClick={() => applyPreset(7)} className="btn-secondary" style={{ fontSize: "0.8rem", padding: "6px 12px" }}>
          Últimos 7 días vs 7 prev.
        </button>
        <button onClick={() => applyPreset(30)} className="btn-secondary" style={{ fontSize: "0.8rem", padding: "6px 12px" }}>
          Últimos 30 días vs 30 prev.
        </button>
        <button onClick={() => applyPreset(90)} className="btn-secondary" style={{ fontSize: "0.8rem", padding: "6px 12px" }}>
          Últimos 90 días vs 90 prev.
        </button>
      </div>

      {/* Controles de Selección de Rango */}
      <div className="no-print card" style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap", padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ padding: "8px", borderRadius: "var(--radius-md)", backgroundColor: "var(--primary-light)", color: "var(--primary)" }}>
            <CalendarDays size={18} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-light)", marginBottom: "4px" }}>
              Período A (Inicio - Fin)
            </label>
            <div style={{ display: "flex", gap: "6px" }}>
              <input
                type="date"
                className="input-field"
                value={dateAStart}
                onChange={(e) => setDateAStart(e.target.value)}
                style={{ padding: "6px 10px", fontSize: "0.85rem" }}
              />
              <input
                type="date"
                className="input-field"
                value={dateAEnd}
                onChange={(e) => setDateAEnd(e.target.value)}
                style={{ padding: "6px 10px", fontSize: "0.85rem" }}
              />
            </div>
          </div>
        </div>

        <div style={{ fontWeight: 700, color: "var(--text-light)", fontSize: "0.8rem", padding: "4px 8px", backgroundColor: "var(--background-subtle)", borderRadius: "var(--radius-sm)" }}>VS</div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ padding: "8px", borderRadius: "var(--radius-md)", backgroundColor: "var(--success-light)", color: "var(--success)" }}>
            <CalendarDays size={18} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-light)", marginBottom: "4px" }}>
              Período B (Inicio - Fin)
            </label>
            <div style={{ display: "flex", gap: "6px" }}>
              <input
                type="date"
                className="input-field"
                value={dateBStart}
                onChange={(e) => setDateBStart(e.target.value)}
                style={{ padding: "6px 10px", fontSize: "0.85rem" }}
              />
              <input
                type="date"
                className="input-field"
                value={dateBEnd}
                onChange={(e) => setDateBEnd(e.target.value)}
                style={{ padding: "6px 10px", fontSize: "0.85rem" }}
              />
            </div>
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={() => fetchComparison()}
          disabled={isLoading}
          style={{ alignSelf: "flex-end" }}
        >
          <RefreshCw size={16} className={isLoading ? "spin" : ""} />
          {isLoading ? "Calculando..." : "Actualizar"}
        </button>
      </div>

      {/* Contenedor Imprimible */}
      <div className="print-container">
        <div style={{ display: "none" }} className="print-header">
          <h1 style={{ fontSize: "1.8rem", marginBottom: "6px", color: "var(--primary)" }}>Reporte Clínico CogniTrain ADHD</h1>
          <p><strong>Alumno ID:</strong> {code} | <strong>Generado por:</strong> {user?.name || "Especialista Clínico"}</p>
          <p><strong>Comparativa:</strong> [{dateAStart} a {dateAEnd}] vs [{dateBStart} a {dateBEnd}]</p>
          <hr style={{ margin: "20px 0", borderColor: "var(--border)" }} />
        </div>

        {/* Gráfico Comparativo de Barras */}
        <div className="card" style={{ marginBottom: "24px" }}>
          <h3 style={{ marginBottom: "20px", fontSize: "1.1rem", fontWeight: 700 }}>Comparativa de Desempeño Clínico</h3>
          <div style={{ height: "280px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="metric" stroke="var(--text-light)" fontSize={12} tickMargin={10} />
                <YAxis stroke="var(--text-light)" fontSize={12} />
                <Tooltip
                  cursor={{ fill: "rgba(91, 141, 239, 0.05)" }}
                  contentStyle={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--foreground)" }}
                />
                <Legend wrapperStyle={{ paddingTop: "14px" }} />
                <Bar dataKey="periodA" name={`Período A (${dateAStart} ~ ${dateAEnd})`} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="periodB" name={`Período B (${dateBStart} ~ ${dateBEnd})`} fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tarjetas de Variación Porcentual */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          {comparisonData.map((item, idx) => {
            const delta = calculateDelta(item.periodA, item.periodB);
            const isImprovement =
              (item.metric.includes("Foco") && delta.value > 0) ||
              (!item.metric.includes("Foco") && delta.value < 0);

            const isNeutral = delta.value === 0;

            return (
              <div key={idx} className="card stat-card" style={{ padding: "18px 20px" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: "var(--text-light)", fontSize: "0.85rem", marginBottom: "6px" }}>{item.metric}</p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                    <h3 style={{ fontSize: "1.6rem", margin: 0, fontWeight: 700, color: "var(--foreground)" }}>
                      {item.periodB} {item.unit}
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-light)" }}>
                      vs {item.periodA} {item.unit}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    color: isNeutral ? "var(--text-light)" : isImprovement ? "var(--success)" : "var(--danger)",
                    backgroundColor: isNeutral
                      ? "var(--background-subtle)"
                      : isImprovement
                      ? "var(--success-light)"
                      : "var(--danger-light)",
                    border: `1px solid ${isNeutral ? "var(--border)" : isImprovement ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
                    padding: "4px 10px",
                    borderRadius: "9999px",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                  }}
                >
                  {isNeutral ? <Minus size={14} /> : isImprovement ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {delta.percent}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Observaciones Profesionales asociadas en el reporte impreso */}
        {observations.length > 0 && (
          <div className="card">
            <h3 style={{ marginBottom: "14px", fontSize: "1.1rem", fontWeight: 700 }}>Notas y Observaciones de Seguimiento</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {observations.slice(0, 3).map((obs) => (
                <div key={obs.id} style={{ padding: "14px", backgroundColor: "var(--background-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--foreground)" }}>{obs.title}</div>
                  <p style={{ margin: "6px 0", fontSize: "0.85rem", color: "var(--foreground)" }}>{obs.content}</p>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>
                    {obs.psychologistName} • {new Date(obs.date).toLocaleDateString("es-ES")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

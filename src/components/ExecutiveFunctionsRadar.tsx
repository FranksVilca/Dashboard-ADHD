"use client";

import React, { useMemo } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import {
  Brain,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Gamepad2,
  TrendingUp,
} from "lucide-react";
import type {
  UserProfile,
  Session,
  LevelAttempt,
  ExecutiveFunctionMetric,
} from "@/lib/types";
import { calculateExecutiveFunctions } from "@/lib/metricsCalculator";

interface ExecutiveFunctionsRadarProps {
  profile: UserProfile;
  sessions: Session[];
  attempts?: LevelAttempt[];
}

export default function ExecutiveFunctionsRadar({
  profile,
  sessions,
  attempts = [],
}: ExecutiveFunctionsRadarProps) {
  const cognitiveProfile = useMemo(() => {
    return calculateExecutiveFunctions(profile, sessions, attempts);
  }, [profile, sessions, attempts]);

  const radarData = useMemo(() => {
    return cognitiveProfile.functions.map((fn) => ({
      domain: fn.domainName,
      miniGame: fn.miniGame,
      score: fn.score,
      benchmark: fn.benchmark,
      fullMark: 100,
    }));
  }, [cognitiveProfile]);

  const getStatusBadge = (status: ExecutiveFunctionMetric["status"]) => {
    switch (status) {
      case "optimal":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 8px",
              borderRadius: "12px",
              fontSize: "0.75rem",
              fontWeight: 600,
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              color: "var(--success)",
            }}
          >
            <CheckCircle2 size={12} /> Óptimo
          </span>
        );
      case "warning":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 8px",
              borderRadius: "12px",
              fontSize: "0.75rem",
              fontWeight: 600,
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              color: "var(--warning)",
            }}
          >
            <AlertCircle size={12} /> En Observación
          </span>
        );
      case "critical":
      default:
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 8px",
              borderRadius: "12px",
              fontSize: "0.75rem",
              fontWeight: 600,
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              color: "var(--danger)",
            }}
          >
            <ShieldAlert size={12} /> Refuerzo Urgente
          </span>
        );
    }
  };

  return (
    <div className="card" style={{ marginBottom: "24px" }}>
      {/* Encabezado del Perfil Cognitivo */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "20px",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: "var(--primary-light)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Brain size={22} />
            </div>
            <h3 style={{ fontSize: "1.25rem", margin: 0 }}>
              Perfil de Funciones Ejecutivas por Minijuego
            </h3>
          </div>
          <p
            style={{
              color: "var(--text-light)",
              fontSize: "0.85rem",
              margin: "6px 0 0 0",
              maxWidth: "680px",
            }}
          >
            Mapeo neuropsicológico según los minijuegos de la app móvil
            (Memoria de Trabajo, Control Inhibitorio, Atención Sostenida,
            Flexibilidad Cognitiva y Velocidad de Procesamiento) comparado contra el
            baremo normativo de su grupo etario.
          </p>
        </div>

        {/* Índice Neurocognitivo Global */}
        <div
          style={{
            backgroundColor: "var(--surface-hover)",
            padding: "10px 16px",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            textAlign: "right",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "var(--text-light)", fontWeight: 500 }}>
            Índice Neurocognitivo Global
          </div>
          <div
            style={{
              fontSize: "1.6rem",
              fontWeight: 800,
              color:
                cognitiveProfile.overallCognitiveIndex >= 70
                  ? "var(--success)"
                  : cognitiveProfile.overallCognitiveIndex >= 50
                  ? "var(--warning)"
                  : "var(--danger)",
              lineHeight: 1.2,
            }}
          >
            {cognitiveProfile.overallCognitiveIndex}
            <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--text-light)" }}>
              {" "}/ 100
            </span>
          </div>
        </div>
      </div>

      {/* Gráfico Radar y Resumen de Fortalezas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "24px",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        {/* Contenedor del Radar Chart */}
        <div style={{ height: "340px", width: "100%", position: "relative" }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis
                dataKey="domain"
                tick={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 500 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: "var(--text-light)", fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--border)",
                  borderRadius: "10px",
                  fontSize: "0.85rem",
                  color: "var(--foreground)",
                }}
                formatter={(value: unknown, name: unknown) => [
                  `${value}%`,
                  name === "score"
                    ? "Rendimiento del Alumno"
                    : "Baremo Normativo Esperado",
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: "0.8rem", paddingTop: "8px" }}
                formatter={(value) =>
                  value === "score"
                    ? "Rendimiento Alumno"
                    : "Baremo Normativo (Grupo Etario)"
                }
              />
              <Radar
                name="benchmark"
                dataKey="benchmark"
                stroke="#94a3b8"
                fill="#94a3b8"
                fillOpacity={0.15}
                strokeDasharray="3 3"
              />
              <Radar
                name="score"
                dataKey="score"
                stroke="var(--primary)"
                fill="var(--primary)"
                fillOpacity={0.4}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Resumen Clínico: Fortalezas y Vulnerabilidades */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              backgroundColor: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "var(--success)",
                fontWeight: 700,
                fontSize: "0.9rem",
                marginBottom: "8px",
              }}
            >
              <TrendingUp size={16} /> Fortalezas Neurocognitivas
            </div>
            {cognitiveProfile.strengths.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {cognitiveProfile.strengths.map((str) => (
                  <span
                    key={str}
                    style={{
                      fontSize: "0.8rem",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      backgroundColor: "var(--surface)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      color: "var(--foreground)",
                      fontWeight: 500,
                    }}
                  >
                    ✓ {str}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "0.85rem", color: "var(--text-light)", margin: 0 }}>
                Todas las funciones evaluadas se encuentran actualmente en fase de
                refuerzo o por debajo de la norma esperada.
              </p>
            )}
          </div>

          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "var(--danger)",
                fontWeight: 700,
                fontSize: "0.9rem",
                marginBottom: "8px",
              }}
            >
              <ShieldAlert size={16} /> Áreas de Refuerzo Prioritario
            </div>
            {cognitiveProfile.vulnerabilities.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {cognitiveProfile.vulnerabilities.map((vul) => (
                  <span
                    key={vul}
                    style={{
                      fontSize: "0.8rem",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      backgroundColor: "var(--surface)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      color: "var(--foreground)",
                      fontWeight: 500,
                    }}
                  >
                    ⚠ {vul}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "0.85rem", color: "var(--text-light)", margin: 0 }}>
                Excelente balance. Todas las funciones ejecutivas superan el baremo de
                su grupo de edad.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tarjetas de Desglose Clínico por Función Ejecutiva */}
      <h4 style={{ fontSize: "1rem", marginBottom: "14px", color: "var(--foreground)" }}>
        Desglose Clínico y Recomendaciones por Minijuego
      </h4>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        {cognitiveProfile.functions.map((fn) => (
          <div
            key={fn.domainKey}
            style={{
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "14px",
              backgroundColor: "var(--surface)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                  {fn.domainName}
                </div>
                {getStatusBadge(fn.status)}
              </div>

              {/* Minijuego correspondiente */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "0.75rem",
                  color: "var(--primary)",
                  backgroundColor: "var(--primary-light)",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  fontWeight: 600,
                  marginBottom: "10px",
                }}
              >
                <Gamepad2 size={12} /> {fn.miniGame}
              </div>

              {/* Barra comparativa de Puntuación vs Baremo */}
              <div style={{ marginBottom: "10px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.8rem",
                    marginBottom: "4px",
                  }}
                >
                  <span style={{ color: "var(--text-light)" }}>Rendimiento:</span>
                  <span style={{ fontWeight: 700 }}>
                    {fn.score}%{" "}
                    <span style={{ fontSize: "0.75rem", color: "var(--text-light)", fontWeight: 400 }}>
                      (Norma: {fn.benchmark}%)
                    </span>
                  </span>
                </div>
                <div
                  style={{
                    height: "8px",
                    width: "100%",
                    backgroundColor: "var(--surface-hover)",
                    borderRadius: "4px",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  {/* Marcador de baremo normativo */}
                  <div
                    style={{
                      position: "absolute",
                      left: `${fn.benchmark}%`,
                      top: 0,
                      bottom: 0,
                      width: "2px",
                      backgroundColor: "#94a3b8",
                      zIndex: 2,
                    }}
                    title={`Baremo normativo: ${fn.benchmark}%`}
                  />
                  {/* Barra de puntuación del alumno */}
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, Math.max(0, fn.score))}%`,
                      backgroundColor:
                        fn.status === "optimal"
                          ? "var(--success)"
                          : fn.status === "warning"
                          ? "var(--warning)"
                          : "var(--danger)",
                      borderRadius: "4px",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>

              {/* Descripción breve */}
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-light)",
                  margin: "0 0 10px 0",
                  lineHeight: 1.4,
                }}
              >
                {fn.description}
              </p>
            </div>

            {/* Recomendación Clínica */}
            <div
              style={{
                marginTop: "8px",
                padding: "8px 10px",
                backgroundColor: "var(--surface-hover)",
                borderRadius: "8px",
                borderLeft: `3px solid ${
                  fn.status === "optimal"
                    ? "var(--success)"
                    : fn.status === "warning"
                    ? "var(--warning)"
                    : "var(--danger)"
                }`,
                display: "flex",
                gap: "8px",
                alignItems: "flex-start",
              }}
            >
              <Lightbulb
                size={14}
                style={{
                  color: "var(--primary)",
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              />
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--foreground)",
                  lineHeight: 1.35,
                }}
              >
                <strong>Estrategia:</strong> {fn.recommendation}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

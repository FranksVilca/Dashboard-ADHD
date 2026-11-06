"use client";

import { use, useEffect, useState } from "react";
import {
  ClipboardList,
  Plus,
  Eye,
  Trash2,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { DashboardObservationService } from "@/lib/observationService";
import {
  ProfessionalObservation,
  ObservationCategory,
  ObservationVisibility,
} from "@/lib/types";

export default function PatientObservationsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const resolvedParams = use(params);
  const { code } = resolvedParams;
  const { user, role, isConsulting } = useAuth();

  const [observations, setObservations] = useState<ProfessionalObservation[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<ObservationCategory>("focus");
  const [newVisibility, setNewVisibility] = useState<ObservationVisibility>("tutor_visible");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadObservations = () => {
    if (!user) return;
    const list = DashboardObservationService.getObservationsForStudent(code, user);
    setObservations(list);
  };

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      const list = DashboardObservationService.getObservationsForStudent(code, user);
      setObservations(list);
    }, 0);
    return () => clearTimeout(timer);
  }, [code, user]);

  const handleAddObservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim() || !newContent.trim()) return;

    try {
      DashboardObservationService.addObservation(user, {
        studentId: code,
        title: newTitle,
        content: newContent,
        category: newCategory,
        visibility: newVisibility,
      });

      setNewTitle("");
      setNewContent("");
      setShowAddForm(false);
      setSuccessMessage("¡Observación clínica guardada con éxito!");
      setTimeout(() => setSuccessMessage(null), 3000);
      loadObservations();
    } catch (e: unknown) {
      console.error(e);
    }
  };

  const handleDelete = (id: string) => {
    if (!user || isConsulting) return;
    if (confirm("¿Estás seguro de eliminar esta observación clínica?")) {
      DashboardObservationService.deleteObservation(user, id);
      loadObservations();
    }
  };

  const isTutor = role === "tutor";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", margin: 0 }}>
            {isTutor ? "Pautas y Recomendaciones del Especialista" : "Observaciones y Notas Clínicas"}
          </h2>
          <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "4px 0 0" }}>
            {isTutor
              ? "Recomendaciones autorizadas por el psicólogo para apoyar al niño/a en casa."
              : "Bitácora confidencial y pautas para el seguimiento del alumno."}
          </p>
        </div>

        {!isTutor && !isConsulting && (
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary">
            <Plus size={16} />
            {showAddForm ? "Cancelar" : "Nueva Observación"}
          </button>
        )}
      </div>

      {successMessage && (
        <div style={{ padding: "12px 16px", marginBottom: "16px", borderRadius: "var(--radius-md)", backgroundColor: "var(--success-light)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "var(--success)", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "8px" }}>
          <CheckCircle2 size={16} /> {successMessage}
        </div>
      )}

      {/* Formulario de Alta de Observación para Psicólogos / Admin */}
      {showAddForm && !isTutor && (
        <div className="card" style={{ marginBottom: "24px", border: "1px solid var(--primary)", boxShadow: "var(--shadow-md)" }}>
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Redactar Nota Profesional</h3>
            <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--text-light)" }}>
              Esta observación quedará registrada en el historial clínico del paciente.
            </p>
          </div>
          <form onSubmit={handleAddObservation} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                Título de la Observación <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. Evaluación de tolerancia a distractores y tiempos de respuesta"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                  Categoría
                </label>
                <select
                  className="input-field"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as ObservationCategory)}
                >
                  <option value="focus">Foco y Atención</option>
                  <option value="behavior">Comportamiento y Tolerancia</option>
                  <option value="fatigue">Fatiga y Pausas</option>
                  <option value="recommendation">Pauta para Casa / Tutor</option>
                  <option value="general">General / Diagnóstico</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                  Nivel de Confidencialidad
                </label>
                <select
                  className="input-field"
                  value={newVisibility}
                  onChange={(e) => setNewVisibility(e.target.value as ObservationVisibility)}
                >
                  <option value="tutor_visible">Visible para Tutor Familiar</option>
                  <option value="psychologist_only">Confidencial (Solo Psicólogo y Admin)</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                Contenido Clínico y Recomendaciones <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <textarea
                className="input-field"
                rows={4}
                placeholder="Escribe aquí los hallazgos observados durante las sesiones, estrategias de intervención y recomendaciones..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                required
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
              <button type="button" onClick={() => setShowAddForm(false)} className="btn-secondary">
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                Guardar Observación
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Observaciones */}
      {observations.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-light)" }}>
          <ClipboardList size={36} style={{ color: "var(--text-light)", marginBottom: "12px", opacity: 0.6 }} />
          <h4 style={{ color: "var(--foreground)", margin: "0 0 6px" }}>No hay observaciones registradas para este alumno</h4>
          <p style={{ fontSize: "0.85rem", margin: 0 }}>
            {isTutor
              ? "El psicólogo clínico aún no ha compartido pautas para este alumno."
              : "Utiliza el botón 'Nueva Observación' para redactar la primera nota de seguimiento."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {observations.map((obs) => {
            const isTutorVis = obs.visibility === "tutor_visible";
            return (
              <div key={obs.id} className="card" style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--foreground)" }}>{obs.title}</h3>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        backgroundColor: "var(--background-subtle)",
                        color: "var(--text-light)",
                        border: "1px solid var(--border)",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {obs.category}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {!isTutor && (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          color: isTutorVis ? "var(--success)" : "var(--text-light)",
                          fontWeight: 500,
                        }}
                      >
                        {isTutorVis ? <Eye size={14} /> : <Lock size={14} />}
                        {isTutorVis ? "Visible para tutor" : "Confidencial"}
                      </span>
                    )}

                    {!isTutor && !isConsulting && (user?.role === "admin" || obs.psychologistId === user?.id) && (
                      <button
                        onClick={() => handleDelete(obs.id)}
                        className="btn-ghost"
                        style={{ padding: "4px", color: "var(--danger)" }}
                        title="Eliminar observación"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: "0.9rem", color: "var(--foreground)", lineHeight: 1.6, margin: "12px 0" }}>
                  {obs.content}
                </p>

                <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.78rem", color: "var(--text-light)", borderTop: "1px solid var(--border)", paddingTop: "12px", marginTop: "12px" }}>
                  <span>Especialista: <strong style={{ color: "var(--foreground)" }}>{obs.psychologistName}</strong></span>
                  <span>•</span>
                  <span>Fecha: {new Date(obs.date).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

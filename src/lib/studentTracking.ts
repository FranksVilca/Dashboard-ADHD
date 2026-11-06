import type {
  StudentTrackingStatus,
  StudentTrend,
  TrackingAlert,
  UserProfile,
  Session,
  SpecialistSummary,
} from "./types.ts";
import { parseFirestoreDate } from "./types.ts";

export class StudentTrackingEngine {
  /**
   * Determina los 5 estados explícitos de actividad del alumno solicitados:
   * 1. Sin iniciar: Registrado, 0 sesiones y 0 actividades de minijuegos
   * 2. Con actividad: Ha completado al menos una sesión o actividad
   * 3. En progreso: Tiene actividades o niveles pendientes por completar
   * 4. Progreso completado: Ha completado todos los niveles o actividades establecidas
   * 5. Inactivo: Sin actividad en los últimos 7 días
   */
  static determineActivityStatus(params: {
    profile: UserProfile;
    latestSession?: Session | null;
    totalSessions: number;
  }): {
    status: "not_started" | "with_activity" | "in_progress" | "completed" | "inactive";
    label: string;
    badgeClass: string;
    description: string;
  } {
    const { profile, latestSession, totalSessions } = params;
    const hasGameProgress = Boolean(profile.gameProgress && Object.keys(profile.gameProgress).length > 0);
    const hasActivity = totalSessions > 0 || hasGameProgress || (profile.totalScore !== undefined && profile.totalScore > 0) || (profile.level > 1);

    if (!hasActivity) {
      return {
        status: "not_started",
        label: "Sin Iniciar",
        badgeClass: "status-warning",
        description: "Alumno registrado en la plataforma, aún no ha iniciado sesiones ni minijuegos.",
      };
    }

    const lastDate = parseFirestoreDate(profile.lastSessionAt || latestSession?.date);
    if (lastDate) {
      const days = (Date.now() - lastDate.getTime()) / (1000 * 3600 * 24);
      if (days > 7) {
        return {
          status: "inactive",
          label: "Inactivo (>7d)",
          badgeClass: "status-warning",
          description: `Sin entrenar durante ${Math.floor(days)} días. Se recomienda coordinar con el tutor.`,
        };
      }
    }

    if (profile.level >= 10) {
      return {
        status: "completed",
        label: "Progreso Completado",
        badgeClass: "status-success",
        description: "Ha superado todos los niveles o actividades cognitivas del programa.",
      };
    }

    if (profile.level > 1 || totalSessions > 1 || (profile.gameProgress && Object.keys(profile.gameProgress).length > 1)) {
      return {
        status: "in_progress",
        label: "En Progreso",
        badgeClass: "status-success",
        description: `Entrenando activamente en el Nivel ${profile.level}. Avance cognitivo continuo.`,
      };
    }

    return {
      status: "with_activity",
      label: "Con Actividad",
      badgeClass: "status-success",
      description: "Ha completado sus primeras sesiones y actividades en los minijuegos.",
    };
  }

  /**
   * Determina el estado de seguimiento operativo según fechas y métricas reales.
   */
  static determineTrackingStatus(params: {
    profile: UserProfile;
    latestSession?: Session | null;
    totalSessions: number;
    isAssignedToPsychologist: boolean;
  }): { status: StudentTrackingStatus; label: string; badgeClass: string } {
    const { profile, latestSession, totalSessions, isAssignedToPsychologist } = params;
    const hasGameProgress = Boolean(profile.gameProgress && Object.keys(profile.gameProgress).length > 0);
    const hasActivity = totalSessions > 0 || hasGameProgress || (profile.totalScore !== undefined && profile.totalScore > 0) || (profile.level > 1);

    if (!isAssignedToPsychologist) {
      return {
        status: "pending_linking",
        label: "Sin Psicólogo Asignado",
        badgeClass: "status-warning",
      };
    }

    if (!hasActivity) {
      return {
        status: "pending_first_session",
        label: "Sin Iniciar",
        badgeClass: "status-warning",
      };
    }

    if (latestSession) {
      const focus = latestSession.focusScore ?? (latestSession.effectiveAttentionTime > 0 ? 70 : 30);
      const distractions = latestSession.distractionsPerMinute ?? 0;
      if (focus < 50 || distractions >= 4.0) {
        return {
          status: "requires_review",
          label: "Requiere Revisión",
          badgeClass: "status-danger",
        };
      }
    }

    const lastDate = parseFirestoreDate(profile.lastSessionAt || latestSession?.date);
    if (!lastDate) {
      return {
        status: "pending_first_session",
        label: "Sin Iniciar",
        badgeClass: "status-warning",
      };
    }

    const daysSinceLastSession = (Date.now() - lastDate.getTime()) / (1000 * 3600 * 24);
    if (daysSinceLastSession > 7) {
      return {
        status: "no_recent_activity",
        label: "Inactivo (>7d)",
        badgeClass: "status-warning",
      };
    }

    return {
      status: "active",
      label: "Activo / En Entrenamiento",
      badgeClass: "status-success",
    };
  }

  /**
   * Calcula la tendencia de rendimiento cognitivo comparando las sesiones más recientes
   * frente a las sesiones anteriores.
   */
  static calculateTrend(sessions: Session[]): {
    trend: StudentTrend;
    label: string;
    percentageDelta: number;
  } {
    if (sessions.length < 2) {
      return {
        trend: "insufficient_data",
        label: "Datos Insuficientes",
        percentageDelta: 0,
      };
    }

    // Tomar las últimas 3 sesiones vs las anteriores 3 (o mitades)
    const mid = Math.floor(sessions.length / 2);
    const recentGroup = sessions.slice(0, Math.min(3, mid));
    const previousGroup = sessions.slice(recentGroup.length, recentGroup.length + recentGroup.length);

    if (previousGroup.length === 0) {
      return {
        trend: "insufficient_data",
        label: "Datos Insuficientes",
        percentageDelta: 0,
      };
    }

    const avgRecent =
      recentGroup.reduce((acc, s) => acc + (s.focusScore || 60), 0) / recentGroup.length;
    const avgPrev =
      previousGroup.reduce((acc, s) => acc + (s.focusScore || 60), 0) / previousGroup.length;

    const delta = avgRecent - avgPrev;
    const percentChange = avgPrev > 0 ? (delta / avgPrev) * 100 : 0;

    if (percentChange > 5) {
      return {
        trend: "improving",
        label: "En Progresión / Mejora",
        percentageDelta: +percentChange.toFixed(1),
      };
    } else if (percentChange < -5) {
      return {
        trend: "declining",
        label: "Descenso de Foco",
        percentageDelta: +percentChange.toFixed(1),
      };
    } else {
      return {
        trend: "stable",
        label: "Rendimiento Estable",
        percentageDelta: +percentChange.toFixed(1),
      };
    }
  }

  /**
   * Genera alertas operativas de seguimiento basadas en reglas transparentes.
   */
  static generateAlerts(
    summaries: SpecialistSummary[],
    assignedStudentIds?: string[]
  ): TrackingAlert[] {
    const alerts: TrackingAlert[] = [];

    summaries.forEach((s) => {
      // Si se filtra por psicólogo, considerar solo sus alumnos
      if (assignedStudentIds && !assignedStudentIds.includes(s.profile.id)) {
        return;
      }

      const p = s.profile;
      const lastDate = parseFirestoreDate(p.lastSessionAt);

      // Alerta 1: Desempeño Crítico (Focus Score < 50%)
      if (s.focusScore < 50 && s.totalSessions > 0) {
        alerts.push({
          id: `crit_${p.id}`,
          studentId: p.id,
          studentName: p.heroName,
          severity: "critical",
          title: "Score de Foco Crítico",
          message: `El alumno '${p.heroName}' registra un promedio de foco de ${s.focusScore}%, por debajo del umbral mínimo de seguridad.`,
          timestamp: new Date().toISOString(),
        });
      }

      const hasGameProgress = Boolean(p.gameProgress && Object.keys(p.gameProgress).length > 0);
      const hasActivity = s.totalSessions > 0 || hasGameProgress || (p.totalScore !== undefined && p.totalScore > 0) || (p.level > 1);

      // Alerta 2: Inactividad prolongada (> 7 días)
      if (lastDate && hasActivity) {
        const days = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 3600 * 24));
        if (days > 7) {
          alerts.push({
            id: `inact_${p.id}`,
            studentId: p.id,
            studentName: p.heroName,
            severity: days > 14 ? "critical" : "warning",
            title: "Interrupción de Entrenamiento",
            message: `El alumno no ha registrado sesiones en los últimos ${days} días. Se recomienda contactar al tutor.`,
            timestamp: new Date().toISOString(),
          });
        }
      } else if (!hasActivity) {
        alerts.push({
          id: `pend_${p.id}`,
          studentId: p.id,
          studentName: p.heroName,
          severity: "info",
          title: "Sesión Inicial Pendiente",
          message: `El alumno '${p.heroName}' está registrado pero aún no ha realizado su primera sesión en CogniTrain ADHD.`,
          timestamp: new Date().toISOString(),
        });
      }
    });

    return alerts;
  }
}

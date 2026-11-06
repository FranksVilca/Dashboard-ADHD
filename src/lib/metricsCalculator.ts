import type {
  SpecialistSummary,
  DashboardGlobalStats,
  UserProfile,
  Session,
  LevelAttempt,
  AttentionDataPoint,
  StudentCognitiveProfile,
  ExecutiveFunctionMetric,
  AttentionalBreakPointAnalysis,
} from "./types.ts";
import { parseFirestoreDate } from "./types.ts";

/**
 * Determina el estado clínico del paciente según su focusScore.
 * Coherente con las reglas de negocio de cognitrain_adhd:
 * - > 75: 'success' (Óptimo)
 * - 50..75: 'warning' (Atención Requerida)
 * - < 50: 'danger' (Crítico)
 */
export function classifyPatientStatus(focusScore: number): "success" | "warning" | "danger" {
  if (focusScore < 50) return "danger";
  if (focusScore <= 75) return "warning";
  return "success";
}

/**
 * Calcula el Focus Score ponderado (0 - 100) según telemetría o perfil.
 */
export function calculateFocusScore(params: {
  totalAttention: number;
  totalDistraction: number;
  sessionScores?: number[];
  profileFocusScore?: number;
  skillRating?: number;
}): number {
  const { totalAttention, totalDistraction, sessionScores, profileFocusScore, skillRating } = params;

  if (sessionScores && sessionScores.length > 0) {
    const sum = sessionScores.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / sessionScores.length);
  }

  if (totalAttention + totalDistraction > 0) {
    return Math.min(100, Math.round((totalAttention / (totalAttention + totalDistraction)) * 100));
  }

  if (typeof profileFocusScore === "number") {
    return profileFocusScore;
  }

  if (typeof skillRating === "number" && skillRating > 0) {
    return Math.min(100, Math.round(skillRating * 60));
  }

  return 0;
}

/**
 * Calcula las estadísticas globales agregadas de los pacientes supervisados.
 */
export function calculateGlobalStats(
  summaries: SpecialistSummary[],
  referenceDate = new Date()
): DashboardGlobalStats {
  if (summaries.length === 0) {
    return {
      todaySessionsCount: 0,
      averageFocusScore: 0,
      fatigueAlertsCount: 0,
      totalPatientsCount: 0,
    };
  }

  const todayStr = referenceDate.toDateString();
  let todaySessions = 0;
  let focusScoreSum = 0;
  let fatigueAlerts = 0;

  summaries.forEach((s) => {
    focusScoreSum += s.focusScore;
    if (s.status === "warning" || s.status === "danger") {
      fatigueAlerts++;
    }
    const lastDate = parseFirestoreDate(s.profile.lastSessionAt);
    if (lastDate && lastDate.toDateString() === todayStr) {
      todaySessions++;
    }
  });

  return {
    todaySessionsCount: todaySessions,
    averageFocusScore: Math.round(focusScoreSum / summaries.length),
    fatigueAlertsCount: fatigueAlerts,
    totalPatientsCount: summaries.length,
  };
}

/**
 * Calcula la variación y porcentaje delta entre dos valores métricos.
 */
export function calculateMetricDelta(periodA: number, periodB: number) {
  if (periodA === 0 && periodB === 0) return { value: 0, percent: "0.0" };
  if (periodA === 0) return { value: periodB, percent: "+100.0" };
  const diff = +(periodB - periodA).toFixed(2);
  const percent = (diff / periodA) * 100;
  return {
    value: diff,
    percent: (diff > 0 ? "+" : "") + percent.toFixed(1),
  };
}

// ---------------------------------------------------------------------------
// Indicador E: Cálculo de Usabilidad del Sistema (System Usability Scale - SUS)
// ---------------------------------------------------------------------------

export function calculateSusScore(itemScores: Record<string, number>): {
  score: number | null;
  isValid: boolean;
  adjectiveRating: string;
} {
  const keys = Object.keys(itemScores);
  if (keys.length !== 10) {
    return { score: null, isValid: false, adjectiveRating: "Datos Incompletos" };
  }

  let totalContribution = 0;
  for (let i = 1; i <= 10; i++) {
    const val = itemScores[`item${i}`];
    if (typeof val !== "number" || val < 1 || val > 5) {
      return { score: null, isValid: false, adjectiveRating: "Respuestas Inválidas" };
    }

    if (i % 2 === 1) {
      // Ítems impares (1, 3, 5, 7, 9): escala positiva -> puntuación = respuesta - 1
      totalContribution += val - 1;
    } else {
      // Ítems pares (2, 4, 6, 8, 10): escala negativa -> puntuación = 5 - respuesta
      totalContribution += 5 - val;
    }
  }

  const finalScore = +(totalContribution * 2.5).toFixed(1);

  let adjectiveRating = "Pobre";
  if (finalScore >= 85) adjectiveRating = "Excelente";
  else if (finalScore >= 70) adjectiveRating = "Bueno";
  else if (finalScore >= 50) adjectiveRating = "Aceptable";

  return { score: finalScore, isValid: true, adjectiveRating };
}

// ---------------------------------------------------------------------------
// Indicador F: Tiempo Promedio de Atención Continua
// ---------------------------------------------------------------------------

export function calculateContinuousAttention(
  intervals: { durationSeconds: number }[]
): {
  averageSeconds: number;
  count: number;
  maxStreakSeconds: number;
} {
  if (!intervals || intervals.length === 0) {
    return { averageSeconds: 0, count: 0, maxStreakSeconds: 0 };
  }

  const sum = intervals.reduce((acc, curr) => acc + curr.durationSeconds, 0);
  const max = intervals.reduce((acc, curr) => Math.max(acc, curr.durationSeconds), 0);
  const avg = +(sum / intervals.length).toFixed(1);

  return {
    averageSeconds: avg,
    count: intervals.length,
    maxStreakSeconds: max,
  };
}

// ---------------------------------------------------------------------------
// Indicador I: Análisis de Permanencia en Tarea (Time on Task %)
// ---------------------------------------------------------------------------

export function calculateTimeOnTask(
  effectiveActiveSeconds: number,
  totalElapsedSeconds: number
): {
  permanencePercentage: number;
  onTaskRatio: number;
} {
  if (totalElapsedSeconds <= 0) {
    return { permanencePercentage: 0, onTaskRatio: 0 };
  }

  const effective = Math.min(effectiveActiveSeconds, totalElapsedSeconds);
  const percentage = +((effective / totalElapsedSeconds) * 100).toFixed(1);
  const ratio = +(effective / totalElapsedSeconds).toFixed(3);

  return {
    permanencePercentage: percentage,
    onTaskRatio: ratio,
  };
}

// ---------------------------------------------------------------------------
// Indicador B: Precisión de Detección y Matriz de Confusión
// ---------------------------------------------------------------------------

export function calculateDetectionAccuracy(
  events: { comparisonResult?: string; groundTruthLabel?: string }[]
): {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  accuracy: number | null;
  hasGroundTruth: boolean;
  statusMessage: string;
} {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  let groundTruthCount = 0;

  for (const ev of events) {
    if (ev.groundTruthLabel && ev.comparisonResult) {
      groundTruthCount++;
      if (ev.comparisonResult === "TP") tp++;
      else if (ev.comparisonResult === "FP") fp++;
      else if (ev.comparisonResult === "TN") tn++;
      else if (ev.comparisonResult === "FN") fn++;
    }
  }

  if (groundTruthCount === 0) {
    return {
      tp: 0,
      fp: 0,
      tn: 0,
      fn: 0,
      accuracy: null,
      hasGroundTruth: false,
      statusMessage: "Sin referencia independiente (Ground Truth): precisión algorítmica no determinable matemáticamente.",
    };
  }

  const total = tp + fp + tn + fn;
  const acc = total > 0 ? +((tp + tn) / total).toFixed(3) : null;

  return {
    tp,
    fp,
    tn,
    fn,
    accuracy: acc,
    hasGroundTruth: true,
    statusMessage: "Calculado contra referencia observacional independiente.",
  };
}

/**
 * Obtiene el benchmark normativo de desempeño cognitivo según grupo de edad.
 */
export function getNormativeBenchmarkForAgeGroup(ageGroup?: string): number {
  switch (ageGroup) {
    case "fourToFive":
      return 60;
    case "sixToSeven":
      return 68;
    case "eightToNine":
      return 75;
    case "tenToTwelve":
      return 80;
    case "thirteenToFifteen":
      return 85;
    default:
      return 70;
  }
}

/**
 * Calcula el perfil de Funciones Ejecutivas del alumno evaluando los 5 dominios
 * neurocognitivos clave para TDAH mapeados desde los minijuegos de cognitrain_adhd.
 */
export function calculateExecutiveFunctions(
  profile: UserProfile,
  sessions: Session[],
  attempts: LevelAttempt[] = []
): StudentCognitiveProfile {
  const benchmark = getNormativeBenchmarkForAgeGroup(profile.ageGroup);

  // 1. Base Focus y métricas derivadas
  const baseFocus = profile.focusScore ?? (sessions.length > 0
    ? Math.round(sessions.reduce((acc, s) => acc + (s.focusScore ?? s.effectiveAttentionTime > 0 ? 70 : 50), 0) / sessions.length)
    : 70);

  // Distracciones promedio por minuto
  let avgDistractions = 2.0;
  if (sessions.length > 0) {
    const valid = sessions.filter((s) => typeof s.distractionsPerMinute === "number" || s.distractionTime > 0);
    if (valid.length > 0) {
      const sum = valid.reduce((acc, s) => acc + (s.distractionsPerMinute ?? +(s.distractionTime / 10).toFixed(1)), 0);
      avgDistractions = +(sum / valid.length).toFixed(1);
    }
  }

  // Tiempos de reacción (ms)
  const allReactionTimes = sessions.flatMap((s) => s.reactionTimes || []);
  const avgReactionMs = allReactionTimes.length > 0
    ? Math.round(allReactionTimes.reduce((acc, rt) => acc + rt, 0) / allReactionTimes.length)
    : 480;

  // Evaluar intentos específicos de minijuegos si existen (soporta los 15 juegos oficiales de TDAH + 5 clásicos)
  const getAttemptScore = (...gameTypes: string[]): number | null => {
    const matched = attempts.filter((a) => {
      const g = (a.miniGameType || "").toLowerCase().replace(/\s+/g, "_");
      const l = (a.levelId || "").toLowerCase().replace(/\s+/g, "_");
      return gameTypes.some((t) => {
        const normTarget = t.toLowerCase().replace(/\s+/g, "_");
        return g === normTarget || g.includes(normTarget) || normTarget.includes(g) || l.includes(normTarget);
      });
    });
    if (matched.length === 0) return null;
    const avgScore = matched.reduce((acc, a) => {
      const raw = a.score || 0;
      // Normalizar a escala 0-100 si el score de juego supera 100
      const normalized = raw > 100 ? Math.min(100, Math.round((raw / 150) * 100)) : raw;
      return acc + normalized;
    }, 0) / matched.length;
    return Math.round(avgScore);
  };

  // 1. Memoria de Trabajo (Space Memo, Secuencia Galáctica, Pistas Encadenadas, Movimientos Contados)
  const spaceMemoScore = getAttemptScore("space_memo", "galactic_sequence", "chained_clues", "counted_moves") ??
    Math.min(100, Math.max(25, Math.round(baseFocus * 0.92 + (profile.level * 2))));

  // 2. Control Inhibitorio (Speed Shield, Luz Roja Luz Verde, Escudo de Amenazas, Disparo con Carga, Espejo Loco)
  const speedShieldScore = getAttemptScore("speed_shield", "red_light_green_light", "threat_shield", "charged_shot", "crazy_mirror") ??
    Math.min(100, Math.max(20, Math.round(100 - (avgDistractions * 12.5))));

  // 3. Atención Sostenida (Focus Lens, Detective de Anomalías, Laberinto con Niebla, Clasificador por Lotes)
  const focusLensScore = getAttemptScore("focus_lens", "anomaly_detective", "fog_maze", "batch_classifier") ??
    Math.min(100, Math.max(20, Math.round(baseFocus)));

  // 4. Flexibilidad Cognitiva (Color Match, Camaleón Cambia-Reglas, Defensor de Doble Frente)
  const colorMatchScore = getAttemptScore("color_match", "chameleon_rules", "dual_front_defense") ??
    Math.min(100, Math.max(25, Math.round(baseFocus * 0.85 + Math.min(profile.level, 8) * 2.5)));

  // 5. Velocidad de Procesamiento (Math Quiz, Ritmo y Respiración, Esfera en Cuerda Floja, Torre Control Aéreo)
  const mathQuizScore = getAttemptScore("math_quiz", "air_traffic_control", "rhythm_breathing", "tightrope_sphere") ??
    Math.min(100, Math.max(25, Math.round(112 - (avgReactionMs / 11))));

  const createMetric = (
    domainKey: "working_memory" | "inhibitory_control" | "sustained_attention" | "cognitive_flexibility" | "processing_speed",
    domainName: string,
    miniGame: string,
    score: number,
    description: string,
    recommendation: string
  ): ExecutiveFunctionMetric => {
    const status: "optimal" | "warning" | "critical" =
      score >= benchmark ? "optimal" : score >= benchmark - 14 ? "warning" : "critical";
    return {
      domainKey,
      domainName,
      miniGame,
      score,
      benchmark,
      status,
      description,
      recommendation,
    };
  };

  const functions: ExecutiveFunctionMetric[] = [
    createMetric(
      "working_memory",
      "Memoria de Trabajo",
      "Space Memo",
      spaceMemoScore,
      "Capacidad de retener secuencias visuales y manipular patrones activos en memoria inmediata.",
      spaceMemoScore < benchmark
        ? "Reforzar con minijuegos de memorización secuencial espacial y dar instrucciones verbales de un solo paso."
        : "Nivel de retención óptimo. Se recomienda complejizar con patrones de 5 o más estímulos."
    ),
    createMetric(
      "inhibitory_control",
      "Control Inhibitorio",
      "Speed Shield",
      speedShieldScore,
      "Habilidad de resistir impulsos, suprimir distractores visuales y frenar respuestas automáticas.",
      speedShieldScore < benchmark
        ? "Elevada impulsividad o distractibilidad. Configurar periodos de gracia visual y reducir distractores en su entorno de estudio."
        : "Buen autocontrol inhibitorio frente a estímulos distractores periféricos."
    ),
    createMetric(
      "sustained_attention",
      "Atención Sostenida",
      "Focus Lens",
      focusLensScore,
      "Capacidad de mantener la concentración continua a lo largo de tareas prolongadas sin desconectarse.",
      focusLensScore < benchmark
        ? "El foco decae rápidamente. Aplicar pausas activas programadas y acortar la duración por sesión en Ajustes Remotos."
        : "Excelente resistencia atencional. Mantiene el foco por encima del umbral clínico esperado."
    ),
    createMetric(
      "cognitive_flexibility",
      "Flexibilidad Cognitiva",
      "Color Match (Stroop)",
      colorMatchScore,
      "Aptitud para alternar entre reglas cambiantes y adaptarse con agilidad a nuevas condiciones del juego.",
      colorMatchScore < benchmark
        ? "Dificultad de alternancia o rigidez cognitiva frente al cambio de reglas. Intercalar juegos con alternancia de consignas."
        : "Buena capacidad adaptativa frente a estímulos conflictivos y variación de reglas."
    ),
    createMetric(
      "processing_speed",
      "Velocidad de Procesamiento",
      "Math Quiz",
      mathQuizScore,
      "Rapidez en la codificación sensorial, discriminación de estímulos y respuesta motora coordinada.",
      mathQuizScore < benchmark
        ? "Tiempo de reacción enlentecido (>600ms). Promover ejercicios de velocidad motriz guiada y cálculo visual ágil."
        : "Tiempos de reacción rápidos y estables dentro de parámetros neurotípicos."
    ),
  ];

  const overall = Math.round(functions.reduce((acc, f) => acc + f.score, 0) / functions.length);
  const strengths = functions.filter((f) => f.score >= benchmark).map((f) => f.domainName);
  const vulnerabilities = functions.filter((f) => f.score < benchmark).map((f) => f.domainName);

  return {
    studentId: profile.id,
    overallCognitiveIndex: overall,
    functions,
    strengths,
    vulnerabilities,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Analiza la curva de fatiga atencional a lo largo del tiempo de la sesión
 * e identifica el punto exacto de inflexión donde el foco decae significativamente.
 */
export function calculateAttentionalBreakPoint(
  timeline: AttentionDataPoint[] = [],
  totalDurationSeconds = 300
): AttentionalBreakPointAnalysis {
  if (!timeline || timeline.length < 3) {
    const defaultDurationMin = Math.max(4, Math.min(10, Math.round(totalDurationSeconds / 60)));
    return {
      breakPointTime: "06:00",
      breakPointSecond: 360,
      recommendedSessionDurationMin: defaultDurationMin > 0 ? defaultDurationMin : 6,
      recommendedBreakIntervalMin: 2,
      averageDecayRatePerMinute: -3.0,
      fatigueRiskLevel: "moderate",
      clinicalRecommendation: "Datos de telemetría continuos en proceso de acumulación. Se sugiere mantener sesiones estándar de 6 a 8 minutos con descansos de 2 minutos.",
      hasSufficientData: false,
    };
  }

  // Parsear puntos y ordenar por segundo relativo
  const pointsWithSeconds = timeline.map((pt, idx) => {
    let sec = idx * 15;
    if (pt.time && pt.time.includes(":")) {
      const parts = pt.time.split(":");
      const mm = parseInt(parts[0], 10) || 0;
      const ss = parseInt(parts[1], 10) || 0;
      sec = mm * 60 + ss;
    }
    return {
      sec,
      time: pt.time || `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`,
      focus: pt.focus,
      fatigue: pt.fatigue,
    };
  });

  // Buscar el primer punto donde el foco desciende por debajo de 55%
  // o donde la fatiga supera el 65% de forma sostenida
  let breakPointIndex = -1;
  for (let i = 1; i < pointsWithSeconds.length; i++) {
    const curr = pointsWithSeconds[i];
    if (curr.focus < 55 || curr.fatigue > 65) {
      breakPointIndex = i;
      break;
    }
  }

  // Si no hubo caída abrupta, buscar el punto de mayor decaimiento respecto al inicio
  if (breakPointIndex === -1) {
    const initialFocus = pointsWithSeconds[0].focus;
    for (let i = 1; i < pointsWithSeconds.length; i++) {
      if (initialFocus - pointsWithSeconds[i].focus >= 20) {
        breakPointIndex = i;
        break;
      }
    }
  }

  // Si mantuvo atención impecable toda la sesión
  const breakPointPt = breakPointIndex !== -1
    ? pointsWithSeconds[breakPointIndex]
    : pointsWithSeconds[pointsWithSeconds.length - 1];

  const breakPointSecond = breakPointPt.sec;
  const breakPointTime = breakPointPt.time;

  // Duración óptima recomendada (minutos)
  const recDurationMin = Math.max(3, Math.min(15, Math.round(breakPointSecond / 60)));
  const recBreakMin = recDurationMin <= 6 ? 2 : 3;

  // Tasa de decaimiento promedio por minuto
  const initialFocus = pointsWithSeconds[0].focus;
  const endFocus = pointsWithSeconds[pointsWithSeconds.length - 1].focus;
  const durationMinutes = Math.max(1, totalDurationSeconds / 60);
  const avgDecay = +((endFocus - initialFocus) / durationMinutes).toFixed(1);

  // Nivel de riesgo de fatiga
  const fatigueRiskLevel: "low" | "moderate" | "high" =
    breakPointSecond < 240 ? "high" : breakPointSecond < 480 ? "moderate" : "low";

  // Redacción de recomendación clínica
  let clinicalRecommendation = "";
  if (fatigueRiskLevel === "high") {
    clinicalRecommendation = `El foco atencional experimenta un quiebre crítico temprano (alrededor del minuto ${breakPointTime}). Se recomienda ajustar la duración remota de las sesiones a no más de ${recDurationMin} minutos e incorporar pausas activas con respiración o estiramientos breves.`;
  } else if (fatigueRiskLevel === "moderate") {
    clinicalRecommendation = `La curva atencional se sostiene de forma regular hasta el minuto ${breakPointTime}, momento en el que la fatiga ocular aumenta. Se sugiere programar el fin de sesión a los ${recDurationMin} minutos para consolidar el aprendizaje antes de la desconexión.`;
  } else {
    clinicalRecommendation = `Excelente estabilidad atencional a lo largo de toda la sesión. El alumno mantiene niveles de foco superiores al 65% sin requerir pausas intermedias tempranas.`;
  }

  return {
    breakPointTime,
    breakPointSecond,
    recommendedSessionDurationMin: recDurationMin,
    recommendedBreakIntervalMin: recBreakMin,
    averageDecayRatePerMinute: avgDecay,
    fatigueRiskLevel,
    clinicalRecommendation,
    hasSufficientData: true,
  };
}

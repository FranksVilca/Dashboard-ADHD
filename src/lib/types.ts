export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate?: () => Date;
}

export type FirestoreDate = string | number | Date | FirestoreTimestamp | null | undefined;

/**
 * Convierte de forma segura cualquier representación de fecha proveniente
 * de Firestore (Timestamp, string ISO, epoch ms, Date) a un objeto Date nativo.
 */
export function parseFirestoreDate(dateVal: FirestoreDate): Date | null {
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? null : dateVal;
  }
  if (typeof (dateVal as FirestoreTimestamp).toDate === "function") {
    try {
      return (dateVal as FirestoreTimestamp).toDate!();
    } catch {
      // Fall through
    }
  }
  if (typeof dateVal === "object" && typeof (dateVal as { seconds?: unknown }).seconds === "number") {
    return new Date((dateVal as { seconds: number }).seconds * 1000);
  }
  if (typeof dateVal === "string" || typeof dateVal === "number") {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Formatea una fecha para visualización en tablas y tarjetas.
 */
export function formatDisplayDate(dateVal: FirestoreDate, fallback = "Sin fecha"): string {
  const parsed = parseFirestoreDate(dateVal);
  if (!parsed) return fallback;
  return parsed.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export interface GameProgressionData {
  gameId: string;
  highestUnlockedLevel: number;
  completedLevels: number[];
  bestScoreByLevel: Record<string, number>;
  starsByLevel: Record<string, number>;
  lastPlayedAt: string;
}

export interface UserProfile {
  id: string;
  heroName: string;
  ageGroup: string;
  age?: number;
  adhdSubtype?: string; // "hyperactive_impulsive" | "inattentive" | "combined"
  gameProgress?: Record<string, GameProgressionData>;
  level: number;
  coins: number;
  unlockedInventory: string[];
  createdAt: FirestoreDate;
  lastSessionAt?: FirestoreDate;
  lastSession?: FirestoreDate; // Compatibilidad con colección legacy patients
  linkCode?: string;
  linkedTutorIds: string[];
  avatarGender?: string;
  avatarSkinColorHex?: number;
  avatarHairStyle?: string;
  equippedSkinId?: string;
  equippedAccessoryIds?: string[];
  avatarJson?: string;
  totalScore?: number;
  currentStreak?: number;
  skillRating?: number;
  focusScore?: number;
  status?: "success" | "warning" | "danger";
}

export interface SessionNode {
  index: number;
  title: string;
  status: "locked" | "active" | "completed" | string;
  gameId?: string;
  earnedCoins?: number;
}

export interface AttentionDataPoint {
  time: string;
  focus: number;
  fatigue: number;
  timestamp?: FirestoreDate;
  state?: "focused" | "distracted" | "wandering" | string;
}

export interface Session {
  id: string;
  profileId?: string;
  date?: FirestoreDate;
  timestamp?: FirestoreDate;
  originalTimestamp?: string;
  status: "pending" | "active" | "completed" | "skipped" | "abandoned" | string;
  nodes?: SessionNode[];
  totalDurationSeconds: number;
  totalFocusSeconds?: number;
  completionPercentage: number;
  startTime?: string;
  endTime?: string;
  effectiveAttentionTime: number;
  distractionTime: number;
  distractionsPerMinute?: number;
  reactionTimes?: number[];
  focusScore?: number;
  levelsCompleted?: number;
  levelsFailed?: number;
  timeline?: AttentionDataPoint[];
  attentionIntervals?: AttentionIntervalRecord[];
  timeOnTaskMetrics?: TimeOnTaskMetricsRecord;
  averageContinuousAttentionSeconds?: number;
}

export interface LevelAttempt {
  id: string;
  sessionId?: string;
  levelId: string;
  miniGameType: string;
  difficultyMultiplier: number;
  score: number;
  errorsCount: number;
  timeSpentSeconds: number;
  reactionTimeMs: number;
  passed: boolean;
  starsEarned: number;
  timestamp: FirestoreDate;
}

export interface SpecialistSummary {
  profile: UserProfile;
  totalPlayTimeSeconds: number;
  averageAttentionTimePerSession: number;
  averageDistractionTimePerSession: number;
  totalSessions: number;
  status: "success" | "warning" | "danger";
  focusScore: number;
}

export interface RemotePatientConfig {
  distractionGracePeriod: number; // segundos (usado en RemoteConfigModel)
  distractionGracePeriodSeconds?: number; // alias para ConfigurationModel
  sessionDurationMinutes: number; // minutos (usado en RemoteConfigModel)
  defaultSessionDurationMinutes?: number; // alias para ConfigurationModel
  difficultyLevel: number;
  autoScalingDifficulty: boolean;
  attentionThreshold?: number; // 0.0 - 1.0 (usado en ConfigurationModel)
  lastUpdated?: FirestoreDate;
}

export interface DashboardGlobalStats {
  todaySessionsCount: number;
  averageFocusScore: number;
  fatigueAlertsCount: number;
  totalPatientsCount: number;
}

export interface StudentProfileOverride {
  studentId: string;
  heroName?: string;
  ageGroup?: string;
  level?: number;
  status?: "success" | "warning" | "danger";
  institution?: string;
  grade?: string;
  notes?: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Modelos de Autenticación, RBAC y Gestión de Usuarios
// ---------------------------------------------------------------------------

export type UserRole = "admin" | "psychologist" | "tutor";
export type ThemeMode = "light" | "dark";

export interface DashboardUser {
  id: string;
  name: string;
  email: string;
  username?: string;          // Nombre de usuario único para inicio de sesión
  passwordHash?: string;      // Hash PBKDF2-SHA256 seguro (nunca texto plano)
  passwordSalt?: string;      // Sal criptográfica única por usuario
  role: UserRole;
  status: "active" | "inactive";
  createdAt: string;
  lastLoginAt?: string;
  assignedStudentIds: string[]; // Alumnos asignados al psicólogo
  linkedStudentIds: string[];   // Alumnos vinculados al tutor
  licenseNumber?: string;       // Colegiatura / Matrícula profesional
  phone?: string;
}

// ---------------------------------------------------------------------------
// Sistema de Códigos de Vinculación y Auditoría
// ---------------------------------------------------------------------------

export interface LinkingCode {
  code: string;            // Código aleatorio (ej. "CT-8K92F")
  studentId: string;       // ID del alumno en /users o /patients
  studentHeroName: string;
  targetRole: "psychologist" | "tutor" | "any";
  createdBy: string;       // ID del usuario que generó el código
  createdAt: string;
  expiresAt: string;       // Fecha límite de uso
  maxUses: number;
  currentUses: number;
  revoked: boolean;
}

export type LinkingAuditAction =
  | "code_generated"
  | "link_redeemed"
  | "link_revoked"
  | "student_reassigned"
  | "user_created"
  | "user_updated"
  | "user_status_changed";

export interface LinkingAuditRecord {
  id: string;
  timestamp: string;
  action: LinkingAuditAction;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  studentId?: string;
  studentName?: string;
  targetUserId?: string;
  targetUserName?: string;
  details: string;
}

// ---------------------------------------------------------------------------
// Observaciones Profesionales y Notas Clínicas
// ---------------------------------------------------------------------------

export type ObservationCategory =
  | "general"
  | "focus"
  | "behavior"
  | "fatigue"
  | "recommendation";

export type ObservationVisibility = "psychologist_only" | "tutor_visible";

export interface ProfessionalObservation {
  id: string;
  studentId: string;
  psychologistId: string;
  psychologistName: string;
  date: string;
  title: string;
  content: string;
  category: ObservationCategory;
  visibility: ObservationVisibility;
  createdAt: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Estados y Alertas Operativas de Seguimiento
// ---------------------------------------------------------------------------

export type StudentTrackingStatus =
  | "not_started"             // Sin iniciar: Registrado, 0 sesiones y 0 actividades
  | "with_activity"           // Con actividad: Ha completado al menos una sesión o actividad
  | "in_progress"             // En progreso: Actividades o niveles pendientes por completar
  | "completed"               // Progreso completado: Ha completado todos los niveles o actividades establecidas
  | "inactive"                // Inactivo: Sin actividad en los últimos 7 días
  | "active"                  // Activo (compatibilidad con sesiones recientes)
  | "no_recent_activity"     // Sin actividad reciente (compatibilidad)
  | "pending_first_session"   // Pendiente de primera sesión (compatibilidad)
  | "requires_review"         // Requiere revisión profesional: Foco < 50% o distracciones altas
  | "pending_linking";        // Registrado en móvil pero sin psicólogo asignado

export function formatAdhdSubtype(subtype?: string): string {
  if (!subtype) return "General / No especificado";
  const normalized = subtype.toLowerCase().trim();
  if (normalized === "hyperactive_impulsive" || normalized.includes("hyperactive") || normalized.includes("hiperactiv")) {
    return "Hiperactivo / Impulsivo";
  }
  if (normalized === "inattentive" || normalized.includes("inatent")) {
    return "Inatento";
  }
  if (normalized === "combined" || normalized.includes("combinad")) {
    return "Combinado";
  }
  return subtype;
}

export const MINIGAME_METADATA: Record<string, { name: string; domain: string; subtype: string }> = {
  // Inatento
  anomaly_detective: { name: "Detective de Anomalías", domain: "Atención sostenida y discriminación visual", subtype: "Inatento" },
  galactic_sequence: { name: "Secuencia Galáctica", domain: "Memoria de trabajo visoespacial", subtype: "Inatento" },
  fog_maze: { name: "Laberinto con Niebla", domain: "Atención focalizada y orientación espacial", subtype: "Inatento" },
  batch_classifier: { name: "Clasificador por Lotes", domain: "Atención selectiva y categorización", subtype: "Inatento" },
  chained_clues: { name: "Pistas Encadenadas", domain: "Resolución secuencial de problemas", subtype: "Inatento" },
  // Hiperactivo / Impulsivo
  red_light_green_light: { name: "Luz Roja, Luz Verde", domain: "Control inhibitorio y autorregulación motora", subtype: "Hiperactivo/Impulsivo" },
  threat_shield: { name: "Escudo de Amenazas", domain: "Inhibición Go/No-Go y atención selectiva", subtype: "Hiperactivo/Impulsivo" },
  charged_shot: { name: "El Disparo con Carga", domain: "Tolerancia a la demora y espera activa", subtype: "Hiperactivo/Impulsivo" },
  rhythm_breathing: { name: "Ritmo y Respiración", domain: "Autorregulación y sincronización motora", subtype: "Hiperactivo/Impulsivo" },
  tightrope_sphere: { name: "La Esfera en la Cuerda Floja", domain: "Coordinación motora fina y precisión", subtype: "Hiperactivo/Impulsivo" },
  // Combinado
  chameleon_rules: { name: "El Camaleón Cambia-Reglas", domain: "Flexibilidad cognitiva y cambio de regla", subtype: "Combinado" },
  air_traffic_control: { name: "Torre de Control Aéreo", domain: "Atención dividida y coordinación", subtype: "Combinado" },
  counted_moves: { name: "Movimientos Contados", domain: "Planificación y pensamiento anticipatorio", subtype: "Combinado" },
  dual_front_defense: { name: "Defensor de Doble Frente", domain: "Atención alternante y gestión de interrupciones", subtype: "Combinado" },
  crazy_mirror: { name: "El Espejo Loco", domain: "Inhibición reactiva y acciones opuestas", subtype: "Combinado" },
  // Clásicos
  space_memo: { name: "Volteo de Cartas (Space Memo)", domain: "Memoria de trabajo y retención visoespacial", subtype: "General" },
  math_quiz: { name: "Suma Rápida (Math Quiz)", domain: "Agilidad mental y cálculo secuencial", subtype: "General" },
  speed_shield: { name: "Escudo de Velocidad (Speed Shield)", domain: "Tiempo de reacción y reflejos motores", subtype: "General" },
  focus_lens: { name: "Lente de Enfoque (Focus Lens)", domain: "Atención focalizada y concentración", subtype: "General" },
  color_match: { name: "Atrapa el Color (Color Match)", domain: "Inhibición cognitiva y agilidad perceptiva", subtype: "General" },
};

export function getMinigameInfo(gameId: string): { name: string; domain: string; subtype: string } {
  const normalized = gameId.toLowerCase().replace(/\s+/g, "_").replace(/,/g, "");
  if (MINIGAME_METADATA[normalized]) return MINIGAME_METADATA[normalized];
  if (MINIGAME_METADATA[gameId]) return MINIGAME_METADATA[gameId];
  for (const [key, val] of Object.entries(MINIGAME_METADATA)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return val;
    }
  }
  return {
    name: gameId,
    domain: "Entrenamiento neurocognitivo",
    subtype: "General",
  };
}

export type StudentTrend =
  | "improving"
  | "stable"
  | "declining"
  | "insufficient_data";

export interface TrackingAlert {
  id: string;
  studentId: string;
  studentName: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  timestamp: string;
  resolved?: boolean;
}

// ---------------------------------------------------------------------------
// Indicadores de Investigación Metodológica (A hasta J)
// ---------------------------------------------------------------------------

export type DetectionEventType =
  | "distractionCandidate"
  | "distractionConfirmed"
  | "attentionRecovered"
  | "subjectAbsent";

export type DetectionSource =
  | "googleMlKitFaceDetection"
  | "headPoseEulerAngles"
  | "eyeAspectRatio"
  | "simulatedStream";

export interface DetectionEventRecord {
  id: string;
  sessionId: string;
  studentId: string;
  timestamp: string;
  eventType: DetectionEventType;
  detectionSource: DetectionSource;
  pitch: number;
  yaw: number;
  confidenceScore: number;
  firstSignalTimestamp?: string;
  detectionLatencyMs?: number;
  groundTruthReferenceId?: string;
  groundTruthLabel?: string;
  comparisonResult?: "TP" | "FP" | "TN" | "FN" | string;
}

export type InterventionType =
  | "visualOverlay"
  | "hapticVibration"
  | "audioAlert"
  | "multimodalOverlayAudioHaptic";

export interface InterventionEventRecord {
  id: string;
  distractionEventId: string;
  sessionId: string;
  studentId: string;
  detectionTimestamp: string;
  requestedTimestamp: string;
  activatedTimestamp: string;
  activationLatencyMs: number;
  interventionType: InterventionType;
  status: "requested" | "activated" | "completed" | "failed";
  errorMessage?: string;
}

export interface AttentionIntervalRecord {
  start: string;
  end: string;
  durationSeconds: number;
  activityId?: string;
}

export type RecoveryMethod = "cameraConfirmed" | "manualDismiss" | "sessionEnded";
export type RecoveryStatus = "confirmed" | "unconfirmed" | "censored";

export interface AttentionReengagementRecord {
  id: string;
  distractionEventId: string;
  sessionId: string;
  studentId: string;
  distractionStartTimestamp: string;
  recoveryTimestamp?: string;
  firstInteractionTimestamp?: string;
  recoveryMethod: RecoveryMethod;
  status: RecoveryStatus;
  reengagementLatencyMs?: number;
  firstInteractionLatencyMs?: number;
  interventionId?: string;
}

export interface TimeOnTaskMetricsRecord {
  totalScheduledSeconds: number;
  totalElapsedSeconds: number;
  effectiveActiveSeconds: number;
  pausedSeconds: number;
  distractedSeconds: number;
  permanencePercentage: number;
}

export interface SusEvaluationRecord {
  id: string;
  participantId: string;
  role: "teacher" | "psychologist" | "evaluatorUser" | "parent";
  studentId: string;
  appliedAt: string;
  version: string;
  itemScores: Record<string, number>; // item1..item10 con valores 1..5
  status: "completed" | "incomplete";
  calculatedScore?: number; // 0.0 - 100.0
  isValid: boolean;
  comments?: string;
}

export interface PerceptionEvaluationRecord {
  id: string;
  respondentId: string;
  role: "mother" | "father" | "tutor" | "teacher" | "psychologist";
  studentId: string;
  appliedAt: string;
  moment: "preIntervention" | "postIntervention";
  version: string;
  dimensionScores: Record<string, number>; // sustained_attention, etc. (1..5)
  status: "completed" | "incomplete";
  averageScore?: number;
  isValid: boolean;
  qualitativeNotes?: string;
}

export type DistractionCategory =
  | "gazeAversion"
  | "postureShift"
  | "externalDistractor"
  | "motorRestlessness"
  | "verbalInterruption"
  | "other";

export interface ObservedDistractionEpisodeRecord {
  id: string;
  start: string;
  end: string;
  durationSeconds: number;
  category: DistractionCategory;
  notes?: string;
}

export interface StructuredObservationSheetRecord {
  id: string;
  studentId: string;
  sessionId: string;
  observedAt: string;
  observerId: string;
  observerName: string;
  activityObserved: string;
  totalObservationMinutes: number;
  episodes: ObservedDistractionEpisodeRecord[];
  episodesCount: number;
  frequencyPerMinute: number;
  status: "draft" | "finalized";
  generalNotes?: string;
}

// ---------------------------------------------------------------------------
// Modelos de Funciones Ejecutivas y Curva de Fatiga Atencional
// ---------------------------------------------------------------------------

export type CognitiveDomainKey =
  | "working_memory"          // Memoria de Trabajo (Space Memo)
  | "inhibitory_control"       // Control Inhibitorio (Speed Shield)
  | "sustained_attention"      // Atención Sostenida (Focus Lens)
  | "cognitive_flexibility"    // Flexibilidad Cognitiva (Color Match / Stroop)
  | "processing_speed";        // Velocidad de Procesamiento (Math Quiz / Reacción)

export interface ExecutiveFunctionMetric {
  domainKey: CognitiveDomainKey;
  domainName: string;
  miniGame: string;
  score: number;              // 0-100
  benchmark: number;          // 0-100 (media normativa esperada)
  status: "optimal" | "warning" | "critical";
  description: string;
  recommendation: string;
}

export interface StudentCognitiveProfile {
  studentId: string;
  overallCognitiveIndex: number; // 0-100
  functions: ExecutiveFunctionMetric[];
  strengths: string[];
  vulnerabilities: string[];
  calculatedAt: string;
}

export interface AttentionalBreakPointAnalysis {
  breakPointTime: string;          // e.g. "06:15"
  breakPointSecond: number;        // e.g. 375
  recommendedSessionDurationMin: number; // e.g. 7
  recommendedBreakIntervalMin: number;   // e.g. 2
  averageDecayRatePerMinute: number;     // e.g. -4.8 (% / min)
  fatigueRiskLevel: "low" | "moderate" | "high";
  clinicalRecommendation: string;
  hasSufficientData: boolean;
}

export interface LiveSyncNotification {
  id: string;
  studentId: string;
  studentName: string;
  type: "session_completed" | "milestone_achieved" | "fatigue_alert";
  message: string;
  timestamp: string;
}



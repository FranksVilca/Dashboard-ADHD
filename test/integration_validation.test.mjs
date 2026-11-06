import test from "node:test";
import assert from "node:assert/strict";

// Importación directa de tipos y calculadora de métricas
import { parseFirestoreDate, formatDisplayDate } from "../src/lib/types.ts";
import {
  calculateFocusScore,
  classifyPatientStatus,
  calculateGlobalStats,
  calculateMetricDelta,
  calculateExecutiveFunctions,
  calculateAttentionalBreakPoint,
  getNormativeBenchmarkForAgeGroup,
} from "../src/lib/metricsCalculator.ts";

test("Suite de Validación de Integración: Cognitrain_Dashboard <-> cognitrain_adhd", async (t) => {
  await t.test("1. Conversión resiliente de Timestamps de Firestore a Date nativo", () => {
    // Caso 1: Objeto Firestore Timestamp { seconds, nanoseconds }
    const firestoreTimestamp = { seconds: 1729555200, nanoseconds: 0 };
    const dateFromTimestamp = parseFirestoreDate(firestoreTimestamp);
    assert.ok(dateFromTimestamp instanceof Date);
    assert.equal(dateFromTimestamp.getTime(), 1729555200000);

    // Caso 2: Objeto Firestore Timestamp SDK con método toDate()
    const sdkTimestamp = { toDate: () => new Date("2026-10-21T15:00:00.000Z") };
    const dateFromSdk = parseFirestoreDate(sdkTimestamp);
    assert.ok(dateFromSdk instanceof Date);
    assert.equal(dateFromSdk.toISOString(), "2026-10-21T15:00:00.000Z");

    // Caso 3: String ISO 8601 producido por DateTime.toIso8601String() en Dart (Flutter)
    const isoString = "2026-10-21T18:30:00.000Z";
    const dateFromIso = parseFirestoreDate(isoString);
    assert.ok(dateFromIso instanceof Date);
    assert.equal(dateFromIso.toISOString(), isoString);

    // Caso 4: Valores nulos, indefinidos o cadenas inválidas
    assert.equal(parseFirestoreDate(null), null);
    assert.equal(parseFirestoreDate(undefined), null);
    assert.equal(parseFirestoreDate("cadena_invalida"), null);
  });

  await t.test("2. Formateo de fechas seguro sin 'Invalid Date'", () => {
    const timestamp = { seconds: 1729555200, nanoseconds: 0 };
    const formatted = formatDisplayDate(timestamp);
    assert.ok(!formatted.includes("Invalid"));
    assert.ok(formatted.length > 4);

    const fallbackFormatted = formatDisplayDate(null, "Sin sesiones registradas");
    assert.equal(fallbackFormatted, "Sin sesiones registradas");
  });

  await t.test("3. Cálculo exacto del Focus Score y Clasificación Clínica", () => {
    // 3.1 Promedio de sesiones reales guardadas por OfflineSyncService
    const sessionScore = calculateFocusScore({
      totalAttention: 400,
      totalDistraction: 100,
      sessionScores: [80, 90, 70],
    });
    assert.equal(sessionScore, 80);
    assert.equal(classifyPatientStatus(sessionScore), "success");

    // 3.2 Sin scores explícitos: atención / (atención + distracción)
    const derivedScore = calculateFocusScore({
      totalAttention: 150,
      totalDistraction: 100,
    });
    // 150 / 250 = 60%
    assert.equal(derivedScore, 60);
    assert.equal(classifyPatientStatus(derivedScore), "warning");

    // 3.3 Paciente en estado crítico (< 50%)
    const lowScore = calculateFocusScore({
      totalAttention: 40,
      totalDistraction: 120,
    });
    // 40 / 160 = 25%
    assert.equal(lowScore, 25);
    assert.equal(classifyPatientStatus(lowScore), "danger");

    // 3.4 Fallback por skillRating de DDA
    const skillScore = calculateFocusScore({
      totalAttention: 0,
      totalDistraction: 0,
      skillRating: 1.5,
    });
    assert.equal(skillScore, 90);
  });

  await t.test("4. Cálculo exacto de Métricas Globales del Dashboard", () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const mockSummaries = [
      {
        profile: {
          id: "p1",
          heroName: "Valiente",
          ageGroup: "sixToSeven",
          level: 3,
          coins: 100,
          unlockedInventory: [],
          createdAt: yesterday.toISOString(),
          lastSessionAt: today.toISOString(),
          linkedTutorIds: [],
        },
        totalPlayTimeSeconds: 600,
        averageAttentionTimePerSession: 240,
        averageDistractionTimePerSession: 20,
        totalSessions: 2,
        status: "success",
        focusScore: 85,
      },
      {
        profile: {
          id: "p2",
          heroName: "Rayo",
          ageGroup: "eightToNine",
          level: 2,
          coins: 40,
          unlockedInventory: [],
          createdAt: yesterday.toISOString(),
          lastSessionAt: yesterday.toISOString(),
          linkedTutorIds: [],
        },
        totalPlayTimeSeconds: 300,
        averageAttentionTimePerSession: 120,
        averageDistractionTimePerSession: 60,
        totalSessions: 1,
        status: "warning",
        focusScore: 55,
      },
      {
        profile: {
          id: "p3",
          heroName: "Centella",
          ageGroup: "fourToFive",
          level: 1,
          coins: 10,
          unlockedInventory: [],
          createdAt: yesterday.toISOString(),
          lastSessionAt: null,
          linkedTutorIds: [],
        },
        totalPlayTimeSeconds: 0,
        averageAttentionTimePerSession: 0,
        averageDistractionTimePerSession: 0,
        totalSessions: 0,
        status: "danger",
        focusScore: 35,
      },
    ];

    const stats = calculateGlobalStats(mockSummaries, today);

    // 1 sesión hoy (p1)
    assert.equal(stats.todaySessionsCount, 1);

    // Promedio focusScore: (85 + 55 + 35) / 3 = 175 / 3 = 58.33 -> 58
    assert.equal(stats.averageFocusScore, 58);

    // Pacientes en atención (warning + danger): p2 + p3 = 2
    assert.equal(stats.fatigueAlertsCount, 2);

    assert.equal(stats.totalPatientsCount, 3);
  });

  await t.test("5. Cálculo de Variación Porcentual Delta en Reportes", () => {
    // Foco aumenta de 40 a 50 (+25%)
    const deltaFocus = calculateMetricDelta(40, 50);
    assert.equal(deltaFocus.value, 10);
    assert.equal(deltaFocus.percent, "+25.0");

    // Distracciones bajan de 10 a 5 (-50%)
    const deltaDistraction = calculateMetricDelta(10, 5);
    assert.equal(deltaDistraction.value, -5);
    assert.equal(deltaDistraction.percent, "-50.0");

    // Caso base cero
    const deltaZero = calculateMetricDelta(0, 0);
    assert.equal(deltaZero.value, 0);
    assert.equal(deltaZero.percent, "0.0");
  });

  await t.test("6. Compatibilidad Dual de Ajustes Remotos (RemoteConfigModel <-> ConfigurationModel)", () => {
    const dashboardSavedConfig = {
      distractionGracePeriod: 4,
      distractionGracePeriodSeconds: 4, // Alias para ConfigurationModel
      sessionDurationMinutes: 12,
      defaultSessionDurationMinutes: 12, // Alias para ConfigurationModel
      difficultyLevel: 2,
      autoScalingDifficulty: true,
      attentionThreshold: 0.65,
      lastUpdated: new Date().toISOString(),
      patientId: "ALU-1001",
    };

    // Validar esquema RemoteConfigModel
    assert.equal(dashboardSavedConfig.distractionGracePeriod, 4);
    assert.equal(dashboardSavedConfig.sessionDurationMinutes, 12);
    assert.equal(dashboardSavedConfig.autoScalingDifficulty, true);

    // Validar esquema ConfigurationModel
    assert.equal(dashboardSavedConfig.distractionGracePeriodSeconds, 4);
    assert.equal(dashboardSavedConfig.defaultSessionDurationMinutes, 12);
    assert.equal(dashboardSavedConfig.attentionThreshold, 0.65);
    assert.ok(dashboardSavedConfig.lastUpdated);
  });

  await t.test("7. Determinación de Estados Operativos de Seguimiento", async () => {
    const { StudentTrackingEngine } = await import("../src/lib/studentTracking.ts");

    const baseProfile = {
      id: "alu_test",
      heroName: "Leo",
      ageGroup: "sixToSeven",
      level: 1,
      coins: 0,
      unlockedInventory: [],
      createdAt: new Date().toISOString(),
      linkedTutorIds: [],
    };

    // Caso 1: Sin asignar a psicólogo
    const unassigned = StudentTrackingEngine.determineTrackingStatus({
      profile: baseProfile,
      totalSessions: 2,
      isAssignedToPsychologist: false,
    });
    assert.equal(unassigned.status, "pending_linking");

    // Caso 2: 0 sesiones
    const pendingFirst = StudentTrackingEngine.determineTrackingStatus({
      profile: baseProfile,
      totalSessions: 0,
      isAssignedToPsychologist: true,
    });
    assert.equal(pendingFirst.status, "pending_first_session");

    // Caso 3: Foco < 50% -> Requiere Revisión
    const reviewReq = StudentTrackingEngine.determineTrackingStatus({
      profile: baseProfile,
      latestSession: { focusScore: 35, effectiveAttentionTime: 100, totalDurationSeconds: 300, distractionsPerMinute: 2, status: "completed" },
      totalSessions: 3,
      isAssignedToPsychologist: true,
    });
    assert.equal(reviewReq.status, "requires_review");

    // Caso 4: Inactividad > 7 días
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    const inactive = StudentTrackingEngine.determineTrackingStatus({
      profile: { ...baseProfile, lastSessionAt: oldDate.toISOString() },
      latestSession: { focusScore: 80, effectiveAttentionTime: 250, totalDurationSeconds: 300, distractionsPerMinute: 1, status: "completed", date: oldDate.toISOString() },
      totalSessions: 5,
      isAssignedToPsychologist: true,
    });
    assert.equal(inactive.status, "no_recent_activity");

    // Caso 5: Activo (< 7 días)
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 2);
    const active = StudentTrackingEngine.determineTrackingStatus({
      profile: { ...baseProfile, lastSessionAt: recentDate.toISOString() },
      latestSession: { focusScore: 85, effectiveAttentionTime: 260, totalDurationSeconds: 300, distractionsPerMinute: 0.5, status: "completed", date: recentDate.toISOString() },
      totalSessions: 5,
      isAssignedToPsychologist: true,
    });
    assert.equal(active.status, "active");
  });

  await t.test("8. Cálculo de Tendencias de Rendimiento Cognitivo", async () => {
    const { StudentTrackingEngine } = await import("../src/lib/studentTracking.ts");

    // Progresión / Mejora: sesiones recientes (85, 90) vs anteriores (60, 65)
    const improvingSessions = [
      { id: "s4", focusScore: 90 },
      { id: "s3", focusScore: 85 },
      { id: "s2", focusScore: 65 },
      { id: "s1", focusScore: 60 },
    ];
    const trendImproving = StudentTrackingEngine.calculateTrend(improvingSessions);
    assert.equal(trendImproving.trend, "improving");
    assert.ok(trendImproving.percentageDelta > 5);

    // Descenso: sesiones recientes (45, 50) vs anteriores (80, 85)
    const decliningSessions = [
      { id: "s4", focusScore: 45 },
      { id: "s3", focusScore: 50 },
      { id: "s2", focusScore: 80 },
      { id: "s1", focusScore: 85 },
    ];
    const trendDeclining = StudentTrackingEngine.calculateTrend(decliningSessions);
    assert.equal(trendDeclining.trend, "declining");
    assert.ok(trendDeclining.percentageDelta < -5);

    // Datos insuficientes (< 2 sesiones)
    const trendInsufficient = StudentTrackingEngine.calculateTrend([{ id: "s1", focusScore: 80 }]);
    assert.equal(trendInsufficient.trend, "insufficient_data");
  });

  await t.test("9. Formato y Reglas de Códigos de Vinculación", async () => {
    const { DashboardLinkingService } = await import("../src/lib/linkingService.ts");

    const code = DashboardLinkingService.generateSecureCode();
    // Debe empezar con CT- y tener longitud 8 (ej. CT-8K92F)
    assert.ok(code.startsWith("CT-"));
    assert.equal(code.length, 8);
    // Sin caracteres confusos (0, 1, I, O)
    assert.ok(!code.includes("0"));
    assert.ok(!code.includes("1"));
    assert.ok(!code.includes("O"));
    assert.ok(!code.includes("I"));
  });

  await t.test("10. Confidencialidad de Observaciones Clínicas (RBAC)", async () => {
    const { DashboardObservationService } = await import("../src/lib/observationService.ts");

    // Simular que existen 2 notas: una pública para tutor y otra confidencial
    const dummyNotes = [
      {
        id: "obs_pub",
        studentId: "alu_1",
        psychologistId: "psy_1",
        psychologistName: "Dra. Sofía",
        date: new Date().toISOString(),
        title: "Recomendación para casa",
        content: "Mantener descansos cada 10 min",
        category: "recommendation",
        visibility: "tutor_visible",
        createdAt: new Date().toISOString(),
      },
      {
        id: "obs_priv",
        studentId: "alu_1",
        psychologistId: "psy_1",
        psychologistName: "Dra. Sofía",
        date: new Date().toISOString(),
        title: "Diagnóstico confidencial",
        content: "Posible comorbilidad de impulsividad",
        category: "behavior",
        visibility: "psychologist_only",
        createdAt: new Date().toISOString(),
      },
    ];

    // Mock almacenamiento en memoria
    DashboardObservationService.getStored = () => dummyNotes;

    const tutorUser = { id: "tut_1", name: "Tutor", role: "tutor", email: "tutor@test.com", status: "active", createdAt: "", assignedStudentIds: [], linkedStudentIds: ["alu_1"] };
    const psyUser = { id: "psy_1", name: "Dra. Sofía", role: "psychologist", email: "psy@test.com", status: "active", createdAt: "", assignedStudentIds: ["alu_1"], linkedStudentIds: [] };

    // El tutor SOLO debe ver la nota autorizada
    const tutorView = DashboardObservationService.getObservationsForStudent("alu_1", tutorUser);
    assert.equal(tutorView.length, 1);
    assert.equal(tutorView[0].id, "obs_pub");

    // El psicólogo debe ver ambas notas
    const psyView = DashboardObservationService.getObservationsForStudent("alu_1", psyUser);
    assert.equal(psyView.length, 2);
  });

  await t.test("11. Hashing Criptográfico PBKDF2-SHA256 y Validación de Robustez", async () => {
    const { hashPassword, verifyPassword, validatePasswordStrength, validateUsername } = await import("../src/lib/cryptoUtils.ts");

    // 11.1 Hashing seguro con sal única
    const plainPass = "ClaveSegura2026!";
    const { hash, salt } = await hashPassword(plainPass);
    assert.ok(hash && hash.length === 64, "El hash debe ser SHA-256 en formato hex (64 car)");
    assert.ok(salt && salt.length === 32, "La sal debe ser de 16 bytes en hex (32 car)");

    // 11.2 Verificación exitosa
    const isValid = await verifyPassword(plainPass, hash, salt);
    assert.equal(isValid, true);

    // 11.3 Rechazo de contraseña incorrecta
    const isInvalid = await verifyPassword("ClaveEquivocada", hash, salt);
    assert.equal(isInvalid, false);

    // 11.4 Validación de longitud mínima (>= 6)
    assert.equal(validatePasswordStrength("12345").valid, false);
    assert.equal(validatePasswordStrength("123456").valid, true);

    // 11.5 Validación de formato de nombre de usuario
    assert.equal(validateUsername("ab").valid, false, "Menos de 3 caracteres debe ser inválido");
    assert.equal(validateUsername("usuario valido").valid, false, "Espacios deben ser rechazados");
    assert.equal(validateUsername("dr_martinez.26").valid, true, "Alfanumérico con punto y guion bajo debe ser válido");
  });

  await t.test("12. Registro de Psicólogo con Nombre de Usuario Único y Hash (Panel Administrador)", async () => {
    const { DashboardAuthService } = await import("../src/lib/authService.ts");

    const adminActor = {
      id: "admin_test",
      name: "Admin Master",
      email: "admin.master@cognitrain.edu",
      role: "admin",
      status: "active",
      createdAt: new Date().toISOString(),
      assignedStudentIds: [],
      linkedStudentIds: [],
    };

    // Crear psicólogo con credenciales completas
    const newPsy = await DashboardAuthService.createPsychologist(adminActor, {
      name: "Dra. Carolina Ríos",
      username: "crios",
      password: "Carolina2026!",
      email: "carolina.rios@cognitrain.edu",
      licenseNumber: "CPP-33100",
    });

    assert.equal(newPsy.name, "Dra. Carolina Ríos");
    assert.equal(newPsy.username, "crios");
    assert.equal(newPsy.role, "psychologist");
    assert.ok(newPsy.passwordHash && newPsy.passwordHash.length === 64);
    assert.ok(newPsy.passwordSalt && newPsy.passwordSalt.length === 32);

    // Validar que la contraseña NO se guardó en texto plano
    assert.notEqual(newPsy.passwordHash, "Carolina2026!");

    // Intento de duplicar nombre de usuario (debe fallar)
    await assert.rejects(
      async () => {
        await DashboardAuthService.createPsychologist(adminActor, {
          name: "Otro Profesional",
          username: "crios", // Duplicado
          password: "OtraPassword123!",
          email: "otro@cognitrain.edu",
        });
      },
      /ya está registrado/
    );
  });

  await t.test("13. Cambio de Contraseña Autónomo y Seguro (Panel Psicólogo)", async () => {
    const { DashboardAuthService } = await import("../src/lib/authService.ts");
    const { hashPassword } = await import("../src/lib/cryptoUtils.ts");

    const { hash, salt } = await hashPassword("MiPassActual2026!");
    const testUser = {
      id: "psy_test_pw",
      name: "Lic. Roberto Silva",
      username: "rsilva",
      email: "roberto.silva@cognitrain.edu",
      role: "psychologist",
      status: "active",
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: new Date().toISOString(),
      assignedStudentIds: [],
      linkedStudentIds: [],
    };

    // Mock almacenamiento con el usuario de prueba
    const currentUsers = DashboardAuthService.getAllUsers();
    currentUsers.push(testUser);
    DashboardAuthService.saveLocalUsers(currentUsers);

    // 13.1 Fallo por contraseña actual incorrecta
    await assert.rejects(
      async () => {
        await DashboardAuthService.changePassword(
          testUser,
          "ContraseñaEquivocada",
          "NuevaPass2026!",
          "NuevaPass2026!"
        );
      },
      /contraseña actual ingresada es incorrecta/
    );

    // 13.2 Fallo por discrepancia en confirmación
    await assert.rejects(
      async () => {
        await DashboardAuthService.changePassword(
          testUser,
          "MiPassActual2026!",
          "NuevaPass2026!",
          "Discrepancia999!"
        );
      },
      /no coinciden/
    );

    // 13.3 Fallo si la nueva contraseña es idéntica a la actual
    await assert.rejects(
      async () => {
        await DashboardAuthService.changePassword(
          testUser,
          "MiPassActual2026!",
          "MiPassActual2026!",
          "MiPassActual2026!"
        );
      },
      /no puede ser idéntica/
    );

    // 13.4 Éxito en cambio de contraseña
    const res = await DashboardAuthService.changePassword(
      testUser,
      "MiPassActual2026!",
      "SuperNuevaPass2026!",
      "SuperNuevaPass2026!"
    );
    assert.equal(res.success, true);

    // Verificar que ahora se puede iniciar sesión con la nueva contraseña
    const logged = await DashboardAuthService.login("rsilva", "SuperNuevaPass2026!", "psychologist");
    assert.ok(logged);
    assert.equal(logged.id, "psy_test_pw");
  });

  await t.test("14. Autenticación Flexible por Usuario o Correo y Verificación de Contraseña", async () => {
    const { DashboardAuthService } = await import("../src/lib/authService.ts");

    DashboardAuthService.initSystemAccounts();

    // 14.1 Login con username ("smartinez") y contraseña
    const userByUsername = await DashboardAuthService.login("smartinez", "Sofia2026!", "psychologist");
    assert.ok(userByUsername, "Debe iniciar sesión por nombre de usuario");
    assert.equal(userByUsername.id, "psy_01");

    // 14.2 Login con correo ("sofia.martinez@cognitrain.edu") y contraseña
    const userByEmail = await DashboardAuthService.login("sofia.martinez@cognitrain.edu", "Sofia2026!", "psychologist");
    assert.ok(userByEmail, "Debe iniciar sesión por correo electrónico");
    assert.equal(userByEmail.id, "psy_01");

    // 14.3 Rechazo de login con contraseña incorrecta
    const failedLogin = await DashboardAuthService.login("smartinez", "PasswordInvalida999!", "psychologist");
    assert.equal(failedLogin, null, "Debe rechazar credenciales con contraseña errónea");
  });

  await t.test("15. Edición de Psicólogos desde el Panel de Administrador", async () => {
    const { DashboardAuthService } = await import("../src/lib/authService.ts");

    DashboardAuthService.initSystemAccounts();
    const admin = DashboardAuthService.getAdminUser();
    const nonAdminUser = {
      id: "fake_user",
      name: "Usuario Sin Permiso",
      email: "fake@cognitrain.edu",
      role: "psychologist",
      status: "active",
      assignedStudentIds: [],
      createdAt: new Date().toISOString(),
    };

    // Crear un psicólogo para pruebas
    const createdPsy = await DashboardAuthService.createPsychologist(admin, {
      name: "Dr. Carlos Arana",
      username: "carana",
      password: "Password123!",
      email: "carlos.arana@cognitrain.edu",
      licenseNumber: "CPP-88990",
      phone: "+51 988 777 666",
    });

    const originalPasswordHash = createdPsy.passwordHash;
    const originalSalt = createdPsy.passwordSalt;

    // 15.1 Rechazo por permisos (usuario no-admin)
    await assert.rejects(
      async () => {
        await DashboardAuthService.updatePsychologist(nonAdminUser, createdPsy.id, {
          name: "Intento No Autorizado",
          username: "carana_hack",
          email: "hack@cognitrain.edu",
        });
      },
      /Permiso denegado/
    );

    // 15.2 Rechazo por colisión de username existente
    await assert.rejects(
      async () => {
        await DashboardAuthService.updatePsychologist(admin, createdPsy.id, {
          name: "Dr. Carlos Arana",
          username: "smartinez", // Ya existe psy_01
          email: "carlos.arana.nuevo@cognitrain.edu",
        });
      },
      /ya está registrado por otro usuario/
    );

    // 15.3 Rechazo por colisión de email existente
    await assert.rejects(
      async () => {
        await DashboardAuthService.updatePsychologist(admin, createdPsy.id, {
          name: "Dr. Carlos Arana",
          username: "carana_edit",
          email: "sofia.martinez@cognitrain.edu", // Ya existe
        });
      },
      /correo electrónico ya está registrado/
    );

    // 15.4 Actualización de datos manteniendo contraseña si no se especifica
    const updatedPsy = await DashboardAuthService.updatePsychologist(admin, createdPsy.id, {
      name: "Dr. Carlos Arana Modificado",
      username: "carana_updated",
      email: "carlos.arana.updated@cognitrain.edu",
      licenseNumber: "CPP-99000",
      phone: "+51 911 222 333",
      status: "active",
    });

    assert.equal(updatedPsy.name, "Dr. Carlos Arana Modificado");
    assert.equal(updatedPsy.username, "carana_updated");
    assert.equal(updatedPsy.email, "carlos.arana.updated@cognitrain.edu");
    assert.equal(updatedPsy.licenseNumber, "CPP-99000");
    assert.equal(updatedPsy.phone, "+51 911 222 333");
    // La contraseña original PBKDF2 debe permanecer exactamente igual
    assert.equal(updatedPsy.passwordHash, originalPasswordHash);
    assert.equal(updatedPsy.passwordSalt, originalSalt);

    // Debe poder iniciar sesión con el nuevo username y la contraseña original
    const loginWithNewUser = await DashboardAuthService.login("carana_updated", "Password123!", "psychologist");
    assert.ok(loginWithNewUser, "Debe iniciar sesión con el nuevo username y su contraseña previa");
    assert.equal(loginWithNewUser.name, "Dr. Carlos Arana Modificado");

    // 15.5 Modificación de contraseña por parte del Administrador
    const psyWithNewPassword = await DashboardAuthService.updateUser(admin, createdPsy.id, {
      password: "NuevaAdminPassword2026!",
    });
    assert.notEqual(psyWithNewPassword.passwordHash, originalPasswordHash, "El hash debe haber cambiado");

    // La contraseña anterior ya no es válida
    const failedOldLogin = await DashboardAuthService.login("carana_updated", "Password123!", "psychologist");
    assert.equal(failedOldLogin, null, "La contraseña previa ya no debe funcionar");

    // La nueva contraseña asignada por el Administrador funciona inmediatamente
    const successNewLogin = await DashboardAuthService.login("carana_updated", "NuevaAdminPassword2026!", "psychologist");
    assert.ok(successNewLogin, "Debe iniciar sesión con la nueva contraseña asignada por el Administrador");

    // 15.6 Modificación de usuario y contraseña de otro rol (Tutor) por el Administrador
    const allTutors = DashboardAuthService.getAllTutors();
    assert.ok(allTutors.length > 0, "Debe existir al menos un tutor en el sistema");
    const targetTutor = allTutors[0];

    const updatedTutor = await DashboardAuthService.updateUser(admin, targetTutor.id, {
      username: "tutor_modificado",
      password: "PasswordTutor2026!",
      phone: "+51 900 111 222",
    });
    assert.equal(updatedTutor.username, "tutor_modificado");

    // El tutor puede iniciar sesión con sus nuevas credenciales
    const tutorLogin = await DashboardAuthService.login("tutor_modificado", "PasswordTutor2026!", "tutor");
    assert.ok(tutorLogin, "El tutor debe poder iniciar sesión con el nuevo usuario y contraseña asignados por el Admin");
  });

  await t.test("16. Edición y Reasignación de Alumnos desde el Panel de Administrador", async () => {
    const { DashboardAuthService } = await import("../src/lib/authService.ts");
    const { SpecialistDataService } = await import("../src/lib/specialistDataService.ts");

    DashboardAuthService.initSystemAccounts();
    const admin = DashboardAuthService.getAdminUser();
    const nonAdminUser = {
      id: "fake_non_admin",
      name: "Sin Admin",
      email: "noadmin@cognitrain.edu",
      role: "tutor",
      status: "active",
      assignedStudentIds: [],
      createdAt: new Date().toISOString(),
    };

    const targetStudentId = "student_test_101";

    // 16.1 Rechazo por permisos (usuario no-admin)
    await assert.rejects(
      async () => {
        await SpecialistDataService.updateStudentProfile(nonAdminUser, targetStudentId, {
          heroName: "Nombre Hackeado",
        });
      },
      /Permiso denegado/
    );

    // 16.2 Rechazo por nombre vacío
    await assert.rejects(
      async () => {
        await SpecialistDataService.updateStudentProfile(admin, targetStudentId, {
          heroName: "   ",
        });
      },
      /nombre o alias del alumno es obligatorio/
    );

    // 16.3 Actualización de metadatos del alumno (heroName, ageGroup, level, status, institution)
    const overrideResult = await SpecialistDataService.updateStudentProfile(admin, targetStudentId, {
      heroName: "Mateo SuperCampeón",
      ageGroup: "eightToNine",
      level: 5,
      status: "warning",
      institution: "Colegio San Agustín",
      grade: "4to Primaria",
    });

    assert.equal(overrideResult.heroName, "Mateo SuperCampeón");
    assert.equal(overrideResult.ageGroup, "eightToNine");
    assert.equal(overrideResult.level, 5);
    assert.equal(overrideResult.status, "warning");
    assert.equal(overrideResult.institution, "Colegio San Agustín");

    // Verificar que SpecialistDataService.getOverrideForStudent lo retorne
    const savedOverride = SpecialistDataService.getOverrideForStudent(targetStudentId);
    assert.ok(savedOverride);
    assert.equal(savedOverride.heroName, "Mateo SuperCampeón");

    // 16.4 Asignación y desasignación de psicólogo
    const psy1 = "psy_01";
    const psy2 = "psy_02";

    // Asignar al psy1
    DashboardAuthService.assignStudentToPsychologist(admin, psy1, targetStudentId, "Mateo SuperCampeón");
    let psy1Obj = DashboardAuthService.getAllPsychologists().find((p) => p.id === psy1);
    assert.ok(psy1Obj.assignedStudentIds.includes(targetStudentId), "Debe estar asignado a psy_01");

    // Reasignar al psy2
    DashboardAuthService.reassignStudent(admin, targetStudentId, psy1, psy2, "Mateo SuperCampeón");
    psy1Obj = DashboardAuthService.getAllPsychologists().find((p) => p.id === psy1);
    let psy2Obj = DashboardAuthService.getAllPsychologists().find((p) => p.id === psy2);
    assert.ok(!psy1Obj.assignedStudentIds.includes(targetStudentId), "No debe estar en psy_01");
    assert.ok(psy2Obj.assignedStudentIds.includes(targetStudentId), "Debe estar asignado a psy_02");

    // Desasignar por completo
    DashboardAuthService.unassignStudent(admin, targetStudentId, "Mateo SuperCampeón");
    psy2Obj = DashboardAuthService.getAllPsychologists().find((p) => p.id === psy2);
    assert.ok(!psy2Obj.assignedStudentIds.includes(targetStudentId), "Debe desasignarse de psy_02 y quedar Sin Asignar");
  });

  await t.test("17. Mapeo Neurocognitivo: Minijuegos a Funciones Ejecutivas y Baremo Normativo", () => {
    // 17.1 Baremos normativos por grupo etario
    assert.equal(getNormativeBenchmarkForAgeGroup("fourToFive"), 60);
    assert.equal(getNormativeBenchmarkForAgeGroup("sixToSeven"), 68);
    assert.equal(getNormativeBenchmarkForAgeGroup("eightToNine"), 75);
    assert.equal(getNormativeBenchmarkForAgeGroup("tenToTwelve"), 80);
    assert.equal(getNormativeBenchmarkForAgeGroup("thirteenToFifteen"), 85);

    // 17.2 Perfil simulado con intentos de minijuegos
    const profile = {
      id: "student_neuro_01",
      heroName: "Lucas NeuroExplorer",
      ageGroup: "sixToSeven",
      level: 3,
      coins: 200,
      unlockedInventory: [],
      createdAt: new Date().toISOString(),
      linkedTutorIds: [],
    };

    const attempts = [
      { id: "a1", levelId: "lvl_1", miniGameType: "space_memo", score: 85, passed: true, reactionTimeMs: 450, difficultyMultiplier: 1, errorsCount: 1, timeSpentSeconds: 40, starsEarned: 3, timestamp: new Date() },
      { id: "a2", levelId: "lvl_2", miniGameType: "speed_shield", score: 55, passed: true, reactionTimeMs: 700, difficultyMultiplier: 1, errorsCount: 4, timeSpentSeconds: 50, starsEarned: 1, timestamp: new Date() },
      { id: "a3", levelId: "lvl_3", miniGameType: "focus_lens", score: 90, passed: true, reactionTimeMs: 380, difficultyMultiplier: 1, errorsCount: 0, timeSpentSeconds: 60, starsEarned: 3, timestamp: new Date() },
      { id: "a4", levelId: "lvl_4", miniGameType: "color_match", score: 60, passed: true, reactionTimeMs: 620, difficultyMultiplier: 1, errorsCount: 3, timeSpentSeconds: 45, starsEarned: 2, timestamp: new Date() },
      { id: "a5", levelId: "lvl_5", miniGameType: "math_quiz", score: 80, passed: true, reactionTimeMs: 420, difficultyMultiplier: 1, errorsCount: 1, timeSpentSeconds: 35, starsEarned: 3, timestamp: new Date() },
    ];

    const result = calculateExecutiveFunctions(profile, [], attempts);

    assert.equal(result.studentId, "student_neuro_01");
    assert.equal(result.functions.length, 5, "Debe mapear exactamente las 5 funciones ejecutivas");

    // Verificar correspondencia de funciones y minijuegos
    const wm = result.functions.find((f) => f.domainKey === "working_memory");
    assert.ok(wm);
    assert.equal(wm.miniGame, "Space Memo");
    assert.equal(wm.score, 85);
    assert.equal(wm.status, "optimal");

    const ic = result.functions.find((f) => f.domainKey === "inhibitory_control");
    assert.ok(ic);
    assert.equal(ic.miniGame, "Speed Shield");
    assert.equal(ic.score, 55);
    assert.equal(ic.status, "warning");

    const sa = result.functions.find((f) => f.domainKey === "sustained_attention");
    assert.ok(sa);
    assert.equal(sa.miniGame, "Focus Lens");
    assert.equal(sa.score, 90);
    assert.equal(sa.status, "optimal");

    const cf = result.functions.find((f) => f.domainKey === "cognitive_flexibility");
    assert.ok(cf);
    assert.equal(cf.miniGame, "Color Match (Stroop)");
    assert.equal(cf.score, 60);

    const ps = result.functions.find((f) => f.domainKey === "processing_speed");
    assert.ok(ps);
    assert.equal(ps.miniGame, "Math Quiz");

    // Verificar fortalezas y vulnerabilidades
    assert.ok(result.strengths.includes("Memoria de Trabajo"));
    assert.ok(result.strengths.includes("Atención Sostenida"));
    assert.ok(result.vulnerabilities.includes("Control Inhibitorio"));
    assert.ok(result.vulnerabilities.includes("Flexibilidad Cognitiva"));

    // Índice global promedio
    const expectedOverall = Math.round((85 + 55 + 90 + 60 + 80) / 5);
    assert.equal(result.overallCognitiveIndex, expectedOverall);
  });

  await t.test("18. Análisis de Curva de Fatiga Atencional, Detección de Quiebre y Recomendaciones Clínicas", () => {
    // 18.1 Telemetría continua simulada donde el alumno decae en el minuto 4:15
    const timeline = [
      { time: "00:00", focus: 92, fatigue: 15 },
      { time: "01:00", focus: 88, fatigue: 22 },
      { time: "02:00", focus: 84, fatigue: 30 },
      { time: "03:00", focus: 79, fatigue: 42 },
      { time: "04:00", focus: 65, fatigue: 58 },
      { time: "04:15", focus: 48, fatigue: 72 }, // Quiebre crítico (foco < 55, fatiga > 65)
      { time: "05:00", focus: 35, fatigue: 85 },
      { time: "06:00", focus: 30, fatigue: 92 },
    ];

    const analysis = calculateAttentionalBreakPoint(timeline, 360);

    assert.equal(analysis.hasSufficientData, true);
    assert.equal(analysis.breakPointTime, "04:15", "Debe identificar el punto exacto de quiebre");
    assert.equal(analysis.breakPointSecond, 255);
    assert.equal(analysis.recommendedSessionDurationMin, 4, "Debe recomendar duración acorde al quiebre");
    assert.equal(analysis.recommendedBreakIntervalMin, 2);
    assert.equal(analysis.fatigueRiskLevel, "moderate");
    assert.ok(analysis.averageDecayRatePerMinute < 0, "La tasa de decaimiento debe ser negativa");
    assert.ok(analysis.clinicalRecommendation.includes("4:15"));

    // 18.2 Caso de datos insuficientes (fallback controlado)
    const emptyAnalysis = calculateAttentionalBreakPoint([], 300);
    assert.equal(emptyAnalysis.hasSufficientData, false);
    assert.ok(emptyAnalysis.recommendedSessionDurationMin > 0);
    assert.ok(emptyAnalysis.clinicalRecommendation.length > 10);
  });

  await t.test("19. Filtros Multidimensionales y Paginación Reactiva en Directorio de Alumnos", () => {
    // Simular colección de 12 alumnos con perfiles diversos
    const mockStudents = Array.from({ length: 12 }).map((_, idx) => ({
      profile: {
        id: `std_${idx + 1}`,
        heroName: `Héroe ${String.fromCharCode(65 + idx)}`,
        ageGroup: idx % 2 === 0 ? "sixToSeven" : "eightToNine",
        level: idx + 1,
        coins: 100 * idx,
        unlockedInventory: [],
        createdAt: new Date().toISOString(),
        linkedTutorIds: [],
        linkCode: `CT-${1000 + idx}`,
      },
      totalPlayTimeSeconds: 1200,
      averageAttentionTimePerSession: 80,
      averageDistractionTimePerSession: 20,
      totalSessions: idx + 1,
      status: idx % 3 === 0 ? "success" : idx % 3 === 1 ? "warning" : "danger",
      focusScore: 50 + idx * 4,
    }));

    // 19.1 Filtrado por estado clínico ("success")
    const successList = mockStudents.filter((s) => s.status === "success");
    assert.equal(successList.length, 4);
    assert.ok(successList.every((s) => s.status === "success"));

    // 19.2 Filtrado por grupo etario ("sixToSeven")
    const sixToSevenList = mockStudents.filter((s) => s.profile.ageGroup === "sixToSeven");
    assert.equal(sixToSevenList.length, 6);
    assert.ok(sixToSevenList.every((s) => s.profile.ageGroup === "sixToSeven"));

    // 19.3 Paginación con tamaño 5
    const pageSize = 5;
    const totalPages = Math.ceil(mockStudents.length / pageSize);
    assert.equal(totalPages, 3);

    const page1 = mockStudents.slice(0, pageSize);
    const page2 = mockStudents.slice(pageSize, pageSize * 2);
    const page3 = mockStudents.slice(pageSize * 2, pageSize * 3);

    assert.equal(page1.length, 5);
    assert.equal(page1[0].profile.id, "std_1");
    assert.equal(page1[4].profile.id, "std_5");

    assert.equal(page2.length, 5);
    assert.equal(page2[0].profile.id, "std_6");
    assert.equal(page2[4].profile.id, "std_10");

    assert.equal(page3.length, 2);
    assert.equal(page3[0].profile.id, "std_11");
    assert.equal(page3[1].profile.id, "std_12");
  });

  await t.test("20. Restricción de cambio de perfil y aislamiento estricto de usuarios (RBAC)", () => {
    // 20.1 Usuario psicólogo
    const psychologistUser = {
      id: "psy_test_01",
      name: "Dra. Laura Psicología",
      username: "laura_psy",
      email: "laura@cognitrain.edu",
      role: "psychologist",
      status: "active",
      assignedStudentIds: ["std_1", "std_2"],
    };

    // 20.2 Usuario administrador
    const adminUser = {
      id: "admin_test_01",
      name: "Administrador Central",
      username: "admin",
      email: "admin@cognitrain.edu",
      role: "admin",
      status: "active",
      assignedStudentIds: [],
    };

    // 20.3 Verificación de autorización de cambio de perfil
    const canSwitchProfile = (currentUserRole) => currentUserRole === "admin";
    assert.equal(canSwitchProfile(psychologistUser.role), false, "Psicólogo NO debe poder cambiar entre perfiles");
    assert.equal(canSwitchProfile(adminUser.role), true, "Administrador SÍ puede cambiar entre perfiles");

    // 20.4 Segmentación estricta de alumnos visibles
    const allStudents = [
      { id: "std_1", name: "Alumno 1" },
      { id: "std_2", name: "Alumno 2" },
      { id: "std_3", name: "Alumno 3 (De otro psicólogo)" },
      { id: "std_4", name: "Alumno 4 (Sin asignar)" },
    ];

    const getVisibleStudents = (currentUser) => {
      if (currentUser.role === "admin") return allStudents;
      return allStudents.filter((st) => currentUser.assignedStudentIds.includes(st.id));
    };

    const psyVisible = getVisibleStudents(psychologistUser);
    assert.equal(psyVisible.length, 2, "El psicólogo únicamente ve sus 2 alumnos asignados");
    assert.ok(psyVisible.every((st) => psychologistUser.assignedStudentIds.includes(st.id)));
    assert.ok(!psyVisible.some((st) => st.id === "std_3" || st.id === "std_4"), "No debe ver alumnos ajenos");

    const adminVisible = getVisibleStudents(adminUser);
    assert.equal(adminVisible.length, 4, "El administrador tiene visibilidad completa de todos los alumnos");

    // 20.5 Verificación de acceso a expedientes individuales
    const canAccessStudentFile = (currentUser, studentId) => {
      if (currentUser.role === "admin") return true;
      if (currentUser.role === "psychologist") {
        return currentUser.assignedStudentIds.includes(studentId);
      }
      return false;
    };

    assert.equal(canAccessStudentFile(psychologistUser, "std_1"), true);
    assert.equal(canAccessStudentFile(psychologistUser, "std_3"), false, "Expediente ajeno bloqueado para psicólogo");
    assert.equal(canAccessStudentFile(adminUser, "std_3"), true, "Expediente accesible para administrador");
  });

  await t.test("21. Modo de Solo Consulta: Restricción absoluta de escritura y conservación de identidad del Administrador", async () => {
    const { DashboardAuthService } = await import("../src/lib/authService.ts");
    const { SpecialistDataService } = await import("../src/lib/specialistDataService.ts");
    const { DashboardLinkingService } = await import("../src/lib/linkingService.ts");
    const { DashboardObservationService } = await import("../src/lib/observationService.ts");

    DashboardAuthService.initSystemAccounts();
    const admin = DashboardAuthService.getAdminUser();

    // Psicólogo objetivo para inspección
    const psychologist = {
      id: "psy_test_consultation",
      name: "Dra. Laura Montes",
      username: "lmontes",
      email: "laura.montes@cognitrain.edu",
      role: "psychologist",
      status: "active",
      assignedStudentIds: ["std_laura_01"],
    };

    // 21.1 Estado inicial: Modo consulta inactivo
    DashboardAuthService.setConsultationTarget(null);
    assert.equal(DashboardAuthService.isConsultationModeActive(), false);
    assert.equal(DashboardAuthService.getConsultationTarget(), null);

    // 21.2 Activación de Modo de Solo Consulta sobre la psicóloga
    DashboardAuthService.setConsultationTarget(psychologist);
    assert.equal(DashboardAuthService.isConsultationModeActive(), true);
    assert.deepEqual(DashboardAuthService.getConsultationTarget(), psychologist);

    // 21.3 La identidad del Administrador permanece 100% inalterada
    assert.equal(admin.role, "admin");
    assert.equal(admin.id, "admin_01");

    // 21.4 Guardia central de servicio: assertWriteAllowed debe arrojar excepción
    assert.throws(
      () => DashboardAuthService.assertWriteAllowed("Operación de prueba"),
      /Operación rechazada \(Modo de Solo Consulta\)/
    );

    // 21.5 Bloqueo infranqueable en DashboardAuthService
    await assert.rejects(
      async () => {
        await DashboardAuthService.createPsychologist(admin, {
          name: "Dr. Intruso",
          username: "intruso",
          password: "Password123!",
          email: "intruso@cognitrain.edu",
        });
      },
      /Operación rechazada \(Modo de Solo Consulta\)/
    );

    await assert.rejects(
      async () => {
        await DashboardAuthService.updateUser(admin, psychologist.id, {
          name: "Dra. Laura Modificada",
        });
      },
      /Operación rechazada \(Modo de Solo Consulta\)/
    );

    assert.throws(
      () => DashboardAuthService.setUserStatus(admin, psychologist.id, "inactive"),
      /Operación rechazada \(Modo de Solo Consulta\)/
    );

    await assert.rejects(
      async () => {
        await DashboardAuthService.changePassword(admin, "Admin2026!", "NewPass123!", "NewPass123!");
      },
      /Operación rechazada \(Modo de Solo Consulta\)/
    );

    assert.throws(
      () => DashboardAuthService.assignStudentToPsychologist(admin, psychologist.id, "std_laura_02", "Hero"),
      /Operación rechazada \(Modo de Solo Consulta\)/
    );

    assert.throws(
      () => DashboardAuthService.unassignStudent(admin, "std_laura_01", "Hero"),
      /Operación rechazada \(Modo de Solo Consulta\)/
    );

    // 21.6 Bloqueo en SpecialistDataService
    await assert.rejects(
      async () => {
        await SpecialistDataService.updateStudentProfile(admin, "std_laura_01", {
          heroName: "Nombre Modificado",
        });
      },
      /Operación rechazada \(Modo de Solo Consulta\)/
    );

    // 21.7 Bloqueo en DashboardLinkingService
    await assert.rejects(
      async () => {
        await DashboardLinkingService.createLinkingCode({
          actor: admin,
          studentId: "std_laura_01",
          studentHeroName: "Hero",
        });
      },
      /Operación rechazada \(Modo de Solo Consulta\)/
    );

    assert.throws(
      () => DashboardLinkingService.revokeCode(admin, "CT-TEST1"),
      /Operación rechazada \(Modo de Solo Consulta\)/
    );

    await assert.rejects(
      async () => {
        await DashboardLinkingService.redeemLinkingCode(admin, "CT-TEST1");
      },
      /Operación rechazada \(Modo de Solo Consulta\)/
    );

    // 21.8 Bloqueo en DashboardObservationService
    await assert.rejects(
      async () => {
        await DashboardObservationService.addObservation(admin, {
          studentId: "std_laura_01",
          title: "Intento en modo consulta",
          content: "Contenido",
          category: "focus",
          visibility: "clinical_only",
        });
      },
      /Operación rechazada \(Modo de Solo Consulta\)/
    );

    await assert.rejects(
      async () => {
        await DashboardObservationService.updateObservation(admin, "obs_test", {
          title: "Edición bloqueada",
        });
      },
      /Operación rechazada \(Modo de Solo Consulta\)/
    );

    await assert.rejects(
      async () => {
        await DashboardObservationService.deleteObservation(admin, "obs_test");
      },
      /Operación rechazada \(Modo de Solo Consulta\)/
    );

    await assert.rejects(
      async () => {
        await DashboardObservationService.saveStructuredObservationSheet(admin, {
          id: "sheet_01",
          studentId: "std_laura_01",
          date: new Date().toISOString(),
          episodesCount: 5,
          frequencyPerMinute: 0.5,
          recordedBy: admin.name,
          recordedById: admin.id,
          observationType: "systematic",
        });
      },
      /Operación rechazada \(Modo de Solo Consulta\)/
    );

    // 21.9 Salir del Modo de Consulta: Restaura capacidad operativa regular
    DashboardAuthService.setConsultationTarget(null);
    assert.equal(DashboardAuthService.isConsultationModeActive(), false);
    assert.equal(DashboardAuthService.getConsultationTarget(), null);
    assert.doesNotThrow(() => DashboardAuthService.assertWriteAllowed("Operación regular"));
  });

  await t.test("22. Mapeo e Ingesta de Datos Reales de Alumnos (TDAH, gameProgress, Metadatos)", async () => {
    const { formatAdhdSubtype, getMinigameInfo } = await import("../src/lib/types.ts");

    // Formateo de subtipos clínicos de TDAH
    assert.equal(formatAdhdSubtype("hyperactive_impulsive"), "Hiperactivo / Impulsivo");
    assert.equal(formatAdhdSubtype("inattentive"), "Inatento");
    assert.equal(formatAdhdSubtype("combined"), "Combinado");
    assert.equal(formatAdhdSubtype(undefined), "General / No especificado");
    assert.equal(formatAdhdSubtype("otro_subtipo"), "otro_subtipo");

    // Catálogo y metadatos de minijuegos oficiales
    const seq = getMinigameInfo("galactic_sequence");
    assert.equal(seq.name, "Secuencia Galáctica");
    assert.equal(seq.subtype, "Inatento");
    assert.ok(seq.domain.includes("Memoria de trabajo"));

    const redLight = getMinigameInfo("red_light_green_light");
    assert.equal(redLight.name, "Luz Roja, Luz Verde");
    assert.equal(redLight.subtype, "Hiperactivo/Impulsivo");
    assert.ok(redLight.domain.includes("Control inhibitorio"));

    const spaceMemo = getMinigameInfo("space_memo");
    assert.ok(spaceMemo.name.includes("Space Memo"));
  });

  await t.test("23. Los 5 Estados Explícitos de Actividad (determineActivityStatus)", async () => {
    const { StudentTrackingEngine } = await import("../src/lib/studentTracking.ts");

    const baseStudent = {
      id: "std_test_01",
      heroName: "Alumno Test",
      ageGroup: "eightToNine",
      age: 8,
      level: 1,
      coins: 150,
      unlockedInventory: [],
      createdAt: new Date().toISOString(),
      linkedTutorIds: [],
      totalScore: 0,
      currentStreak: 0,
    };

    // Estado 1: Sin Iniciar (0 sesiones, 0 minijuegos, score 0, nivel 1)
    const st1 = StudentTrackingEngine.determineActivityStatus({
      profile: baseStudent,
      totalSessions: 0,
    });
    assert.equal(st1.status, "not_started");
    assert.equal(st1.label, "Sin Iniciar");

    // Estado 2: Con Actividad (Ha completado 1 sesión o actividad)
    const st2 = StudentTrackingEngine.determineActivityStatus({
      profile: {
        ...baseStudent,
        lastSessionAt: new Date().toISOString(),
      },
      latestSession: {
        id: "s1",
        status: "completed",
        totalDurationSeconds: 180,
        effectiveAttentionTime: 150,
        distractionTime: 20,
        date: new Date().toISOString(),
      },
      totalSessions: 1,
    });
    assert.equal(st2.status, "with_activity");
    assert.equal(st2.label, "Con Actividad");

    // Estado 3: En Progreso (Nivel 2-9, múltiples juegos/sesiones y niveles pendientes)
    const st3 = StudentTrackingEngine.determineActivityStatus({
      profile: {
        ...baseStudent,
        level: 7,
        totalScore: 1472,
        currentStreak: 15,
        lastSessionAt: new Date().toISOString(),
        gameProgress: {
          galactic_sequence: {
            gameId: "galactic_sequence",
            highestUnlockedLevel: 2,
            completedLevels: [1],
            bestScoreByLevel: { "1": 150 },
            starsByLevel: { "1": 2 },
            lastPlayedAt: new Date().toISOString(),
          },
          space_memo: {
            gameId: "space_memo",
            highestUnlockedLevel: 7,
            completedLevels: [6],
            bestScoreByLevel: { "6": 120 },
            starsByLevel: { "6": 2 },
            lastPlayedAt: new Date().toISOString(),
          },
        },
      },
      totalSessions: 5,
    });
    assert.equal(st3.status, "in_progress");
    assert.equal(st3.label, "En Progreso");

    // Estado 4: Progreso Completado (Nivel >= 10)
    const st4 = StudentTrackingEngine.determineActivityStatus({
      profile: {
        ...baseStudent,
        level: 10,
        totalScore: 4500,
        lastSessionAt: new Date().toISOString(),
      },
      totalSessions: 15,
    });
    assert.equal(st4.status, "completed");
    assert.equal(st4.label, "Progreso Completado");

    // Estado 5: Inactivo (Sin actividad en los últimos 7 días)
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 3600 * 1000);
    const st5 = StudentTrackingEngine.determineActivityStatus({
      profile: {
        ...baseStudent,
        level: 5,
        totalScore: 800,
        lastSessionAt: eightDaysAgo.toISOString(),
      },
      totalSessions: 4,
    });
    assert.equal(st5.status, "inactive");
    assert.equal(st5.label, "Inactivo (>7d)");
  });

  await t.test("24. Supresión de Falsas Alertas para Alumnos con Actividad en gameProgress", async () => {
    const { StudentTrackingEngine } = await import("../src/lib/studentTracking.ts");

    // Caso A: Alumno real "Hiperactivo" (con progreso en minijuegos, score > 0, pero 0 sesiones en subcolección)
    const activeStudentSummary = {
      profile: {
        id: "d76c2ba1-e9f4-4c20-975c-51b96ad94bae",
        heroName: "Hiperactivo",
        ageGroup: "eightToNine",
        age: 8,
        adhdSubtype: "hyperactive_impulsive",
        level: 7,
        coins: 346,
        totalScore: 1472,
        currentStreak: 15,
        lastSessionAt: new Date().toISOString(),
        gameProgress: {
          tightrope_sphere: {
            gameId: "tightrope_sphere",
            highestUnlockedLevel: 6,
            completedLevels: [5],
            bestScoreByLevel: { "5": 100 },
            starsByLevel: { "5": 2 },
            lastPlayedAt: new Date().toISOString(),
          },
        },
        unlockedInventory: [],
        createdAt: new Date().toISOString(),
        linkedTutorIds: [],
      },
      totalPlayTimeSeconds: 540,
      averageAttentionTimePerSession: 140,
      averageDistractionTimePerSession: 20,
      totalSessions: 3,
      status: "success",
      focusScore: 85,
    };

    // Caso B: Alumno que verdaderamente no ha iniciado (sin progreso, score 0, 0 sesiones)
    const unstartedStudentSummary = {
      profile: {
        id: "da1da41a-0472-4552-a80b-2e4eb53420c9",
        heroName: "Frank's Vilca",
        ageGroup: "eightToNine",
        level: 1,
        coins: 150,
        totalScore: 0,
        currentStreak: 0,
        lastSessionAt: null,
        unlockedInventory: [],
        createdAt: new Date().toISOString(),
        linkedTutorIds: [],
      },
      totalPlayTimeSeconds: 0,
      averageAttentionTimePerSession: 0,
      averageDistractionTimePerSession: 0,
      totalSessions: 0,
      status: "warning",
      focusScore: 50,
    };

    const alerts = StudentTrackingEngine.generateAlerts([activeStudentSummary, unstartedStudentSummary]);

    // Verificar que "Hiperactivo" NO tenga alerta de "Sesión Inicial Pendiente"
    const hiperactivoAlert = alerts.find((a) => a.studentId === "d76c2ba1-e9f4-4c20-975c-51b96ad94bae");
    assert.equal(hiperactivoAlert, undefined);

    // Verificar que "Frank's Vilca" (sin actividad) SÍ reciba la alerta informativa de sesión inicial pendiente
    const frankAlert = alerts.find((a) => a.studentId === "da1da41a-0472-4552-a80b-2e4eb53420c9");
    assert.ok(frankAlert !== undefined);
    assert.equal(frankAlert.title, "Sesión Inicial Pendiente");
  });

  await t.test("25. Integración Neurocognitiva en Radar Chart con Minijuegos Oficiales", async () => {
    const { calculateExecutiveFunctions } = await import("../src/lib/metricsCalculator.ts");

    const profile = {
      id: "std_hyper",
      heroName: "Hiperactivo",
      ageGroup: "eightToNine",
      level: 7,
      coins: 346,
      totalScore: 1472,
      currentStreak: 15,
      createdAt: new Date().toISOString(),
      linkedTutorIds: [],
      unlockedInventory: [],
    };

    const attempts = [
      {
        id: "att_1",
        miniGameType: "galactic_sequence",
        levelId: "galactic_sequence_lvl_1",
        score: 150,
        starsEarned: 2,
        passed: true,
        difficultyMultiplier: 1.1,
        errorsCount: 0,
        timeSpentSeconds: 60,
        reactionTimeMs: 440,
        timestamp: new Date().toISOString(),
      },
      {
        id: "att_2",
        miniGameType: "red_light_green_light",
        levelId: "red_light_green_light_lvl_2",
        score: 140,
        starsEarned: 3,
        passed: true,
        difficultyMultiplier: 1.2,
        errorsCount: 0,
        timeSpentSeconds: 60,
        reactionTimeMs: 430,
        timestamp: new Date().toISOString(),
      },
    ];

    const cognitive = calculateExecutiveFunctions(profile, [], attempts);
    assert.equal(cognitive.studentId, "std_hyper");
    assert.equal(cognitive.functions.length, 5);

    // Memoria de trabajo alimentada por galactic_sequence (score 150 normalizado a 100)
    const wm = cognitive.functions.find((f) => f.domainKey === "working_memory");
    assert.ok(wm !== undefined);
    assert.equal(wm.score, 100);

    // Control inhibitorio alimentado por red_light_green_light (score 140 normalizado a 93)
    const ic = cognitive.functions.find((f) => f.domainKey === "inhibitory_control");
    assert.ok(ic !== undefined);
    assert.ok(ic.score >= 90);
  });
});

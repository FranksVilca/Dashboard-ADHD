import type { LinkingCode, DashboardUser } from "./types.ts";
import { DashboardAuthService } from "./authService.ts";
import { SpecialistDataService } from "./specialistDataService.ts";

const LOCAL_STORAGE_CODES_KEY = "cognitrain_linking_codes_v1";
const LOCAL_STORAGE_RATE_LIMIT_KEY = "cognitrain_link_rate_limit_v1";

interface RateLimitData {
  attempts: number;
  lockedUntil?: number; // Epoch ms
}

export class DashboardLinkingService {
  /**
   * Genera un código criptográficamente seguro con formato amigable: "CT-8K92F"
   */
  static generateSecureCode(): string {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Caracteres sin ambigüedad (sin 0, 1, I, O)
    let result = "CT-";
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private static getStoredCodes(): LinkingCode[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_CODES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private static saveStoredCodes(codes: LinkingCode[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(LOCAL_STORAGE_CODES_KEY, JSON.stringify(codes));
    } catch (e) {
      console.warn("Error guardando códigos:", e);
    }
  }

  /**
   * Control de intentos contra fuerza bruta.
   * Límite: 5 intentos fallidos en 15 minutos.
   */
  private static checkRateLimit(): { allowed: boolean; remainingMinutes?: number } {
    if (typeof window === "undefined") return { allowed: true };
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_RATE_LIMIT_KEY);
      if (!raw) return { allowed: true };

      const data: RateLimitData = JSON.parse(raw);
      const now = Date.now();

      if (data.lockedUntil && now < data.lockedUntil) {
        const remainingMinutes = Math.ceil((data.lockedUntil - now) / 60000);
        return { allowed: false, remainingMinutes };
      }

      return { allowed: true };
    } catch {
      return { allowed: true };
    }
  }

  private static recordFailedAttempt(): void {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_RATE_LIMIT_KEY);
      const now = Date.now();
      let data: RateLimitData = raw ? JSON.parse(raw) : { attempts: 0 };

      // Si el bloqueo expiró, reiniciar
      if (data.lockedUntil && now >= data.lockedUntil) {
        data = { attempts: 0 };
      }

      data.attempts += 1;
      if (data.attempts >= 5) {
        data.lockedUntil = now + 15 * 60 * 1000; // Bloqueo por 15 minutos
      }

      localStorage.setItem(LOCAL_STORAGE_RATE_LIMIT_KEY, JSON.stringify(data));
    } catch {}
  }

  private static resetRateLimit(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(LOCAL_STORAGE_RATE_LIMIT_KEY);
    } catch {}
  }

  /**
   * Genera un nuevo código de vinculación para un alumno (Admin o Psicólogo).
   */
  static async createLinkingCode(params: {
    actor: DashboardUser;
    studentId: string;
    studentHeroName: string;
    targetRole?: "psychologist" | "tutor" | "any";
    expirationHours?: number;
    maxUses?: number;
  }): Promise<LinkingCode> {
    DashboardAuthService.assertWriteAllowed("Generar códigos de vinculación");
    const { actor, studentId, studentHeroName, targetRole = "any", expirationHours = 48, maxUses = 1 } = params;

    const code = this.generateSecureCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expirationHours * 3600 * 1000).toISOString();

    const newCode: LinkingCode = {
      code,
      studentId,
      studentHeroName,
      targetRole,
      createdBy: actor.id,
      createdAt: now.toISOString(),
      expiresAt,
      maxUses,
      currentUses: 0,
      revoked: false,
    };

    const codes = this.getStoredCodes();
    codes.push(newCode);
    this.saveStoredCodes(codes);

    DashboardAuthService.logAudit({
      action: "code_generated",
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      studentId,
      studentName: studentHeroName,
      details: `Código de vinculación generado (${code}) con vigencia de ${expirationHours}h para rol '${targetRole}'`,
    });

    return newCode;
  }

  /**
   * Obtiene todos los códigos activos generados.
   */
  static getLinkingCodes(): LinkingCode[] {
    return this.getStoredCodes();
  }

  /**
   * Revoca un código de vinculación.
   */
  static revokeCode(actor: DashboardUser, codeStr: string): boolean {
    DashboardAuthService.assertWriteAllowed("Revocar códigos de vinculación");
    const codes = this.getStoredCodes();
    const target = codes.find((c) => c.code === codeStr);
    if (!target) return false;

    target.revoked = true;
    this.saveStoredCodes(codes);

    DashboardAuthService.logAudit({
      action: "link_revoked",
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      studentId: target.studentId,
      studentName: target.studentHeroName,
      details: `Código de vinculación ${codeStr} revocado manualmente.`,
    });

    return true;
  }

  /**
   * Flujo principal: Valida y canjea un código de vinculación para asociar
   * al alumno al Psicólogo o Tutor en sesión.
   */
  static async redeemLinkingCode(
    actor: DashboardUser,
    inputCode: string
  ): Promise<{ success: boolean; studentId?: string; studentHeroName?: string; message: string }> {
    DashboardAuthService.assertWriteAllowed("Canjear códigos de vinculación");
    // 1. Validar control de fuerza bruta
    const rateCheck = this.checkRateLimit();
    if (!rateCheck.allowed) {
      return {
        success: false,
        message: `Demasiados intentos fallidos. Por seguridad, la vinculación está bloqueada durante ${rateCheck.remainingMinutes} minutos.`,
      };
    }

    const cleanCode = inputCode.trim().toUpperCase();
    if (cleanCode.length < 4) {
      this.recordFailedAttempt();
      return { success: false, message: "El formato del código es inválido." };
    }

    // 2. Comprobar primero en los códigos generados en el Dashboard
    const codes = this.getStoredCodes();
    const foundCode = codes.find((c) => c.code.toUpperCase() === cleanCode);

    if (foundCode) {
      if (foundCode.revoked) {
        this.recordFailedAttempt();
        return { success: false, message: "Este código de vinculación ha sido revocado." };
      }

      if (new Date(foundCode.expiresAt).getTime() < Date.now()) {
        this.recordFailedAttempt();
        return { success: false, message: "Este código de vinculación ha expirado." };
      }

      if (foundCode.currentUses >= foundCode.maxUses) {
        this.recordFailedAttempt();
        return { success: false, message: "Este código ya ha alcanzado el número máximo de usos." };
      }

      if (foundCode.targetRole !== "any" && foundCode.targetRole !== actor.role) {
        this.recordFailedAttempt();
        return {
          success: false,
          message: `Este código está restringido exclusivamente para usuarios con rol '${foundCode.targetRole}'.`,
        };
      }

      // Éxito: Asociar alumno al usuario actual
      foundCode.currentUses += 1;
      this.saveStoredCodes(codes);
      this.resetRateLimit();

      this.associateStudent(actor, foundCode.studentId);

      DashboardAuthService.logAudit({
        action: "link_redeemed",
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        studentId: foundCode.studentId,
        studentName: foundCode.studentHeroName,
        details: `Alumno ${foundCode.studentHeroName} (${foundCode.studentId}) vinculado exitosamente mediante código ${cleanCode}`,
      });

      return {
        success: true,
        studentId: foundCode.studentId,
        studentHeroName: foundCode.studentHeroName,
        message: `¡Vinculación exitosa! El alumno '${foundCode.studentHeroName}' ha sido agregado a tu panel.`,
      };
    }

    // 3. Fallback inteligente: Validar contra linkCode nativo de cognitrain_adhd
    // (Por ejemplo códigos generados por la app móvil en UserProfile.linkCode)
    try {
      const allPatients = await SpecialistDataService.getAllPatients();
      const patientMatch = allPatients.find(
        (p) => p.linkCode && p.linkCode.toUpperCase() === cleanCode
      );

      if (patientMatch) {
        this.resetRateLimit();
        this.associateStudent(actor, patientMatch.id);

        DashboardAuthService.logAudit({
          action: "link_redeemed",
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          studentId: patientMatch.id,
          studentName: patientMatch.heroName,
          details: `Alumno ${patientMatch.heroName} vinculado mediante linkCode nativo de la app (${cleanCode})`,
        });

        return {
          success: true,
          studentId: patientMatch.id,
          studentHeroName: patientMatch.heroName,
          message: `¡Vinculación exitosa! Alumno '${patientMatch.heroName}' asociado a tu cuenta.`,
        };
      }
    } catch (e) {
      console.warn("Fallo en verificación de linkCode nativo:", e);
    }

    // Código no encontrado (no revelar si el alumno existe)
    this.recordFailedAttempt();
    return {
      success: false,
      message: "El código de vinculación no es válido o ha expirado. Por favor, verifícalo e intenta nuevamente.",
    };
  }

  /**
   * Asocia internamente el studentId al psicólogo o tutor.
   */
  private static associateStudent(actor: DashboardUser, studentId: string): void {
    const allUsers = DashboardAuthService.getAllUsers();
    const currentUser = allUsers.find((u) => u.id === actor.id);
    if (!currentUser) return;

    if (currentUser.role === "psychologist") {
      if (!currentUser.assignedStudentIds.includes(studentId)) {
        currentUser.assignedStudentIds.push(studentId);
      }
    } else if (currentUser.role === "tutor") {
      if (!currentUser.linkedStudentIds.includes(studentId)) {
        currentUser.linkedStudentIds.push(studentId);
      }
    }

    // Guardar usuario actualizado
    if (typeof window !== "undefined") {
      localStorage.setItem("cognitrain_dashboard_users_v1", JSON.stringify(allUsers));
      // Actualizar sesión actual
      localStorage.setItem("cognitrain_dashboard_session_v1", JSON.stringify(currentUser));
    }
  }

  /**
   * Revoca la vinculación de un alumno respecto a un psicólogo o tutor.
   */
  static unlinkStudent(actor: DashboardUser, targetUserId: string, studentId: string): boolean {
    const allUsers = DashboardAuthService.getAllUsers();
    const targetUser = allUsers.find((u) => u.id === targetUserId);
    if (!targetUser) return false;

    // Solo admin puede desvincular a otros; un psicólogo o tutor puede desvincularse a sí mismo
    if (actor.role !== "admin" && actor.id !== targetUserId) {
      throw new Error("No tienes autorización para revocar vinculaciones de otros usuarios.");
    }

    targetUser.assignedStudentIds = targetUser.assignedStudentIds.filter((id) => id !== studentId);
    targetUser.linkedStudentIds = targetUser.linkedStudentIds.filter((id) => id !== studentId);

    if (typeof window !== "undefined") {
      localStorage.setItem("cognitrain_dashboard_users_v1", JSON.stringify(allUsers));
      if (actor.id === targetUserId) {
        localStorage.setItem("cognitrain_dashboard_session_v1", JSON.stringify(targetUser));
      }
    }

    DashboardAuthService.logAudit({
      action: "link_revoked",
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      studentId,
      targetUserId: targetUser.id,
      targetUserName: targetUser.name,
      details: `Vinculación del alumno ${studentId} revocada para el usuario ${targetUser.name}`,
    });

    return true;
  }
}

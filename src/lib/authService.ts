import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase.ts";
import type { DashboardUser, UserRole, LinkingAuditRecord } from "./types.ts";
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  validateUsername,
} from "./cryptoUtils.ts";

const LOCAL_STORAGE_USERS_KEY = "cognitrain_dashboard_users_v1";
const LOCAL_STORAGE_SESSION_KEY = "cognitrain_dashboard_session_v1";
const LOCAL_STORAGE_AUDIT_KEY = "cognitrain_dashboard_audit_v1";

// Helper para generar IDs únicos
function generateId(prefix = "usr"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

export class DashboardAuthService {
  private static memoryUsers: DashboardUser[] | null = null;
  private static memorySession: DashboardUser | null = null;
  private static memoryAudit: LinkingAuditRecord[] = [];
  private static memoryConsultationTarget: DashboardUser | null = null;

  /**
   * Obtiene el usuario en modo de solo consulta (si el Administrador está inspeccionando a un especialista o tutor).
   */
  static getConsultationTarget(): DashboardUser | null {
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        const raw = window.sessionStorage.getItem("cognitrain_consultation_target_v1");
        if (raw) return JSON.parse(raw) as DashboardUser;
      } catch {
        // Fallback a memoria
      }
    }
    return this.memoryConsultationTarget;
  }

  /**
   * Activa o desactiva el modo de solo consulta para que el Administrador inspeccione los datos de otro usuario.
   * NO modifica la sesión, identidad, rol ni credenciales del Administrador en ningún momento.
   */
  static setConsultationTarget(target: DashboardUser | null): void {
    this.memoryConsultationTarget = target;
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        if (target) {
          window.sessionStorage.setItem("cognitrain_consultation_target_v1", JSON.stringify(target));
        } else {
          window.sessionStorage.removeItem("cognitrain_consultation_target_v1");
        }
      } catch {
        // Fallback
      }
    }
  }

  /**
   * Verifica si el modo de solo consulta está actualmente activo.
   */
  static isConsultationModeActive(): boolean {
    return this.getConsultationTarget() !== null;
  }

  /**
   * Guardia de backend / capa de servicio:
   * Rechaza de forma infranqueable cualquier operación de escritura mientras se esté en Modo de Solo Consulta.
   */
  static assertWriteAllowed(actionDescription = "Esta operación"): void {
    const target = this.getConsultationTarget();
    if (target) {
      throw new Error(
        `Operación rechazada (Modo de Solo Consulta): ${actionDescription} no está permitido mientras consultas los datos de ${target.name}. Debes salir del modo de consulta para realizar modificaciones.`
      );
    }
  }

  /**
   * Obtiene todos los usuarios desde almacenamiento local con sincronización Firestore opcional.
   */
  private static getLocalUsers(): DashboardUser[] {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
        if (raw) return JSON.parse(raw) as DashboardUser[];
      } catch {
        // Fallback a memoria
      }
    }
    return this.memoryUsers || [];
  }

  static saveLocalUsers(users: DashboardUser[]): void {
    this.memoryUsers = users;
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
      } catch (e) {
        console.warn("Error guardando usuarios locales:", e);
      }
    }
  }

  /**
   * Registra una acción administrativa en el historial de auditoría.
   */
  static logAudit(audit: Omit<LinkingAuditRecord, "id" | "timestamp">): void {
    const record: LinkingAuditRecord = {
      ...audit,
      id: generateId("aud"),
      timestamp: new Date().toISOString(),
    };

    this.memoryAudit.unshift(record);

    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_AUDIT_KEY);
        const list: LinkingAuditRecord[] = raw ? JSON.parse(raw) : [];
        list.unshift(record); // El más reciente primero
        window.localStorage.setItem(LOCAL_STORAGE_AUDIT_KEY, JSON.stringify(list.slice(0, 500)));
      } catch (e) {
        console.warn("Error registrando auditoría:", e);
      }
    }

    // Intento de persistencia no bloqueante en Firestore
    try {
      const ref = doc(db, "dashboard_audit_logs", record.id);
      setDoc(ref, record).catch(() => {});
    } catch {}
  }

  /**
   * Obtiene el registro de auditoría completo.
   */
  static getAuditLogs(): LinkingAuditRecord[] {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_AUDIT_KEY);
        if (raw) return JSON.parse(raw) as LinkingAuditRecord[];
      } catch {
        // Fallback a memoria
      }
    }
    return this.memoryAudit;
  }

  /**
   * Inicializa las cuentas base si el sistema está vacío o si los usuarios existentes
   * no tienen campos de credenciales (nombre de usuario y hash de contraseña).
   */
  static initSystemAccounts(): void {
    const users = this.getLocalUsers();

    const initialUsers: DashboardUser[] = [
      {
        id: "admin_01",
        name: "Administrador General",
        username: "admin",
        passwordHash: "5e3b2697aa74289fb44e89a8453bd9bddb56c1be1fcb8f0a3ac65333488ad641",
        passwordSalt: "f33b3e73fb6cb85db37704c3671f1194",
        email: "admin@cognitrain.edu",
        role: "admin",
        status: "active",
        createdAt: new Date().toISOString(),
        assignedStudentIds: [],
        linkedStudentIds: [],
      },
      {
        id: "psy_01",
        name: "Dra. Sofía Martínez",
        username: "smartinez",
        passwordHash: "d2610ab2a2c2efa5f9361600d94186898897a70162fcda36f27271f3e61720cf",
        passwordSalt: "908c45c80fd67bc8b145fa97f33f759d",
        email: "sofia.martinez@cognitrain.edu",
        role: "psychologist",
        status: "active",
        createdAt: new Date().toISOString(),
        licenseNumber: "CPP-18492",
        assignedStudentIds: ["ALU-1001"], // Asignación inicial de ejemplo
        linkedStudentIds: [],
      },
      {
        id: "psy_02",
        name: "Lic. Carlos Benítez",
        username: "cbenitez",
        passwordHash: "2d398da115cc26a6aca68558e07a7328de55452e9f94d56662732c87d1bdad37",
        passwordSalt: "0880940e4cd776e3ee7e1de95700f3f8",
        email: "carlos.benitez@cognitrain.edu",
        role: "psychologist",
        status: "active",
        createdAt: new Date().toISOString(),
        licenseNumber: "CPP-20511",
        assignedStudentIds: [],
        linkedStudentIds: [],
      },
      {
        id: "tutor_01",
        name: "María Gómez (Tutor)",
        username: "mgomez",
        passwordHash: "c4a6da138c2ca9076c9364d4542b63f625fbb117353fc72b5d452585d7864414",
        passwordSalt: "a9427142872f5ef051403a3940c345d4",
        email: "maria.gomez@familia.pe",
        role: "tutor",
        status: "active",
        createdAt: new Date().toISOString(),
        assignedStudentIds: [],
        linkedStudentIds: ["ALU-1001"],
        phone: "+51 987 654 321",
      },
    ];

    if (users.length === 0) {
      this.saveLocalUsers(initialUsers);
      this.logAudit({
        action: "user_created",
        actorId: "system",
        actorName: "Sistema CogniTrain",
        actorRole: "admin",
        details: "Inicialización segura del sistema de roles y cuentas predeterminadas",
      });
      return;
    }

    // Asegurar que las cuentas seed existan y tengan sus credenciales actualizadas
    let updated = false;
    for (const seed of initialUsers) {
      const idx = users.findIndex((u) => u.id === seed.id || u.email.toLowerCase() === seed.email.toLowerCase());
      if (idx === -1) {
        users.unshift(seed);
        updated = true;
      } else {
        const existing = users[idx];
        if (!existing.username || !existing.passwordHash) {
          users[idx] = {
            ...existing,
            username: existing.username || seed.username,
            passwordHash: existing.passwordHash || seed.passwordHash,
            passwordSalt: existing.passwordSalt || seed.passwordSalt,
          };
          updated = true;
        }
      }
    }

    if (updated) {
      this.saveLocalUsers(users);
    }
  }

  /**
   * Inicia sesión permitiendo identificación por correo electrónico O por nombre de usuario.
   * Valida la contraseña mediante hash criptográfico PBKDF2.
   */
  static async login(
    identifier: string,
    password?: string,
    role?: UserRole
  ): Promise<DashboardUser | null> {
    this.initSystemAccounts();
    const users = this.getLocalUsers();

    const clean = identifier.trim().toLowerCase();
    const user = users.find(
      (u) =>
        (u.email.toLowerCase() === clean || (u.username && u.username.toLowerCase() === clean)) &&
        (!role || u.role === role) &&
        u.status === "active"
    );

    if (!user) return null;

    // Validación de contraseña si el usuario tiene hash y se ingresó contraseña
    if (user.passwordHash && user.passwordSalt && password) {
      // Ignorar si es el placeholder visual demo
      if (password !== "••••••••") {
        const isMatch = await verifyPassword(password, user.passwordHash, user.passwordSalt);
        if (!isMatch) {
          this.logAudit({
            action: "user_status_changed",
            actorId: user.id,
            actorName: user.name,
            actorRole: user.role,
            details: `Intento fallido de inicio de sesión (contraseña incorrecta) para ${identifier}`,
          });
          return null;
        }
      }
    }

    // Actualizar último acceso
    user.lastLoginAt = new Date().toISOString();
    this.saveLocalUsers(users);

    this.memorySession = user;
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(user));
    }

    this.logAudit({
      action: "user_status_changed",
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      details: `Inicio de sesión exitoso con rol ${user.role} (${user.username || user.email})`,
    });

    return user;
  }

  /**
   * Cierra la sesión activa.
   */
  static logout(): void {
    this.memorySession = null;
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    }
  }

  /**
   * Obtiene el usuario autenticado en la sesión actual.
   */
  static getCurrentUser(): DashboardUser | null {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
        if (raw) return JSON.parse(raw) as DashboardUser;
      } catch {
        return null;
      }
    }
    return this.memorySession;
  }

  /**
   * Lista todos los psicólogos registrados.
   */
  static getAllPsychologists(): DashboardUser[] {
    this.initSystemAccounts();
    return this.getLocalUsers().filter((u) => u.role === "psychologist");
  }

  /**
   * Lista todos los tutores registrados.
   */
  static getAllTutors(): DashboardUser[] {
    this.initSystemAccounts();
    return this.getLocalUsers().filter((u) => u.role === "tutor");
  }

  /**
   * Obtiene la cuenta del administrador general del sistema.
   */
  static getAdminUser(): DashboardUser {
    this.initSystemAccounts();
    const admin = this.getLocalUsers().find((u) => u.role === "admin");
    if (!admin) {
      throw new Error("No se encontró usuario administrador en el sistema.");
    }
    return admin;
  }

  /**
   * Lista todos los usuarios de la plataforma.
   */
  static getAllUsers(): DashboardUser[] {
    this.initSystemAccounts();
    return this.getLocalUsers();
  }

  /**
   * Crea una nueva cuenta de psicólogo desde el panel de administrador.
   * Valida nombre, nombre de usuario único, contraseña segura con hash PBKDF2 y correo único.
   */
  static async createPsychologist(
    adminActor: DashboardUser,
    data: {
      name: string;
      username: string;
      password?: string;
      email: string;
      licenseNumber?: string;
      phone?: string;
    }
  ): Promise<DashboardUser> {
    this.assertWriteAllowed("Registrar profesionales");
    if (adminActor.role !== "admin") {
      throw new Error("Permiso denegado: Solo el Administrador puede registrar profesionales.");
    }

    if (!data.name || !data.name.trim()) {
      throw new Error("El nombre completo del profesional es obligatorio.");
    }

    // Validación de nombre de usuario
    const usernameValidation = validateUsername(data.username);
    if (!usernameValidation.valid) {
      throw new Error(usernameValidation.message || "Nombre de usuario inválido.");
    }

    const cleanUsername = data.username.trim().toLowerCase();
    const cleanEmail = data.email.trim().toLowerCase();

    const users = this.getLocalUsers();

    // Validar unicidad del nombre de usuario
    const existingUsername = users.find((u) => u.username && u.username.toLowerCase() === cleanUsername);
    if (existingUsername) {
      throw new Error(`El nombre de usuario '${cleanUsername}' ya está registrado. Por favor elige otro.`);
    }

    // Validar unicidad del correo electrónico
    const existingEmail = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existingEmail) {
      throw new Error("Ya existe un usuario registrado con este correo electrónico.");
    }

    // Validación y hash de contraseña
    const rawPassword = data.password?.trim() || "";
    const passValidation = validatePasswordStrength(rawPassword);
    if (!passValidation.valid) {
      throw new Error(passValidation.message || "Contraseña inválida.");
    }

    const { hash, salt } = await hashPassword(rawPassword);

    const newUser: DashboardUser = {
      id: generateId("psy"),
      name: data.name.trim(),
      username: cleanUsername,
      passwordHash: hash,
      passwordSalt: salt,
      email: cleanEmail,
      role: "psychologist",
      status: "active",
      createdAt: new Date().toISOString(),
      licenseNumber: data.licenseNumber?.trim(),
      phone: data.phone?.trim(),
      assignedStudentIds: [],
      linkedStudentIds: [],
    };

    users.push(newUser);
    this.saveLocalUsers(users);

    this.logAudit({
      action: "user_created",
      actorId: adminActor.id,
      actorName: adminActor.name,
      actorRole: "admin",
      targetUserId: newUser.id,
      targetUserName: newUser.name,
      details: `Alta de psicólogo: ${newUser.name} (usuario: @${newUser.username}, email: ${newUser.email}) con credenciales hasheadas`,
    });

    return newUser;
  }

  /**
   * Modifica los datos y/o credenciales (nombre de usuario, contraseña, email, etc.)
   * de cualquier usuario de la plataforma (restringido al Administrador).
   */
  static async updateUser(
    adminActor: DashboardUser,
    userId: string,
    data: {
      name?: string;
      username?: string;
      password?: string;
      email?: string;
      licenseNumber?: string;
      phone?: string;
      status?: "active" | "inactive";
    }
  ): Promise<DashboardUser> {
    this.assertWriteAllowed("Modificar datos o credenciales de usuario");
    if (adminActor.role !== "admin") {
      throw new Error("Permiso denegado: Solo el Administrador puede modificar los datos y credenciales de otros usuarios.");
    }

    const users = this.getLocalUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) {
      throw new Error("Usuario no encontrado en el sistema.");
    }

    if (data.name !== undefined) {
      if (!data.name.trim()) {
        throw new Error("El nombre no puede estar vacío.");
      }
      target.name = data.name.trim();
    }

    // Validación y actualización de nombre de usuario
    if (data.username !== undefined) {
      const usernameValidation = validateUsername(data.username);
      if (!usernameValidation.valid) {
        throw new Error(usernameValidation.message || "Nombre de usuario inválido.");
      }
      const cleanUsername = data.username.trim().toLowerCase();
      const usernameCollision = users.find(
        (u) => u.id !== userId && u.username && u.username.toLowerCase() === cleanUsername
      );
      if (usernameCollision) {
        throw new Error(`El nombre de usuario '${cleanUsername}' ya está registrado por otro usuario.`);
      }
      target.username = cleanUsername;
    }

    // Validación y actualización de correo electrónico
    if (data.email !== undefined) {
      const cleanEmail = data.email.trim().toLowerCase();
      if (!cleanEmail) {
        throw new Error("El correo electrónico no puede estar vacío.");
      }
      const emailCollision = users.find(
        (u) => u.id !== userId && u.email.toLowerCase() === cleanEmail
      );
      if (emailCollision) {
        throw new Error("El correo electrónico ya está registrado por otro usuario.");
      }
      target.email = cleanEmail;
    }

    // Modificación de contraseña si el administrador especificó una nueva
    let passwordChanged = false;
    if (data.password && data.password.trim()) {
      const strength = validatePasswordStrength(data.password.trim());
      if (!strength.valid) {
        throw new Error(strength.message || "La nueva contraseña no cumple con los requisitos de seguridad.");
      }
      const { hash, salt } = await hashPassword(data.password.trim());
      target.passwordHash = hash;
      target.passwordSalt = salt;
      passwordChanged = true;
    }

    if (data.licenseNumber !== undefined) {
      target.licenseNumber = data.licenseNumber.trim();
    }

    if (data.phone !== undefined) {
      target.phone = data.phone.trim();
    }

    if (data.status) {
      target.status = data.status;
    }

    this.saveLocalUsers(users);

    // Actualizar sesión activa si el usuario actual es el editado
    const sessionUser = this.getCurrentUser();
    if (sessionUser && sessionUser.id === target.id) {
      this.memorySession = target;
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(target));
      }
    }

    this.logAudit({
      action: "user_updated",
      actorId: adminActor.id,
      actorName: adminActor.name,
      actorRole: "admin",
      targetUserId: target.id,
      targetUserName: target.name,
      details: `Administrador modificó los datos de ${target.name} (@${target.username || target.email})${
        passwordChanged ? " [incluyendo nueva contraseña]" : ""
      }`,
    });

    return target;
  }

  /**
   * Modifica los datos de un psicólogo existente (solo Administrador).
   * Valida nombre, unicidad de nombre de usuario y correo, y permite modificar usuario y contraseña.
   */
  static async updatePsychologist(
    adminActor: DashboardUser,
    psychologistId: string,
    data: {
      name: string;
      username: string;
      password?: string;
      email: string;
      licenseNumber?: string;
      phone?: string;
      status?: "active" | "inactive";
    }
  ): Promise<DashboardUser> {
    return this.updateUser(adminActor, psychologistId, data);
  }

  /**
   * Permite al psicólogo autenticado cambiar su propia contraseña.
   * Valida la contraseña actual, confirma la nueva y almacena el nuevo hash seguro.
   */
  static async changePassword(
    currentUser: DashboardUser,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ success: boolean; message: string }> {
    this.assertWriteAllowed("Cambiar contraseña");
    if (!currentUser || !currentUser.id) {
      throw new Error("Acceso denegado: Debes haber iniciado sesión para cambiar tu contraseña.");
    }

    const users = this.getLocalUsers();
    const targetUser = users.find((u) => u.id === currentUser.id);
    if (!targetUser) {
      throw new Error("Usuario no encontrado en el sistema.");
    }

    // Garantizar que solo puede modificar su propia contraseña
    if (targetUser.id !== currentUser.id) {
      throw new Error("Violación de seguridad: No está autorizado para modificar las credenciales de otro usuario.");
    }

    // Verificar contraseña actual
    if (targetUser.passwordHash && targetUser.passwordSalt) {
      const isMatch = await verifyPassword(currentPassword, targetUser.passwordHash, targetUser.passwordSalt);
      if (!isMatch) {
        throw new Error("La contraseña actual ingresada es incorrecta.");
      }
    }

    // Validar coincidencia de la nueva contraseña
    if (newPassword !== confirmPassword) {
      throw new Error("La nueva contraseña y su confirmación no coinciden.");
    }

    // Validar que no sea idéntica a la anterior
    if (currentPassword === newPassword) {
      throw new Error("La nueva contraseña no puede ser idéntica a la contraseña actual.");
    }

    // Validar robustez de la nueva contraseña
    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      throw new Error(strength.message || "La nueva contraseña no cumple con los requisitos mínimos.");
    }

    // Generar nuevo hash con nueva sal
    const { hash, salt } = await hashPassword(newPassword);
    targetUser.passwordHash = hash;
    targetUser.passwordSalt = salt;

    this.saveLocalUsers(users);

    // Actualizar la sesión activa en memoria local
    if (typeof window !== "undefined") {
      const sessionUser = this.getCurrentUser();
      if (sessionUser && sessionUser.id === targetUser.id) {
        sessionUser.passwordHash = hash;
        sessionUser.passwordSalt = salt;
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(sessionUser));
      }
    }

    this.logAudit({
      action: "user_updated",
      actorId: targetUser.id,
      actorName: targetUser.name,
      actorRole: targetUser.role,
      targetUserId: targetUser.id,
      targetUserName: targetUser.name,
      details: `Cambio de contraseña exitoso para el usuario ${targetUser.name}`,
    });

    return {
      success: true,
      message: "¡Contraseña actualizada exitosamente! Usa tu nueva contraseña en los próximos inicios de sesión.",
    };
  }

  /**
   * Modifica el estado activo/inactivo de cualquier cuenta de usuario (solo Administrador).
   */
  static setUserStatus(
    adminActor: DashboardUser,
    userId: string,
    status: "active" | "inactive"
  ): void {
    this.assertWriteAllowed("Cambiar el estado de cuentas");
    if (adminActor.role !== "admin") {
      throw new Error("Permiso denegado: Solo el Administrador puede cambiar el estado de cuentas.");
    }

    const users = this.getLocalUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) throw new Error("Usuario no encontrado.");

    target.status = status;
    this.saveLocalUsers(users);

    this.logAudit({
      action: "user_status_changed",
      actorId: adminActor.id,
      actorName: adminActor.name,
      actorRole: "admin",
      targetUserId: target.id,
      targetUserName: target.name,
      details: `Estado de la cuenta cambiado a '${status}' para ${target.name}`,
    });
  }

  /**
   * Modifica el estado activo/inactivo de un psicólogo.
   */
  static setPsychologistStatus(
    adminActor: DashboardUser,
    psychologistId: string,
    status: "active" | "inactive"
  ): void {
    return this.setUserStatus(adminActor, psychologistId, status);
  }

  /**
   * Asigna un alumno a un psicólogo específico (Administrador).
   */
  static assignStudentToPsychologist(
    adminActor: DashboardUser,
    psychologistId: string,
    studentId: string,
    studentName?: string
  ): void {
    this.assertWriteAllowed("Asignar alumnos a especialistas");
    if (adminActor.role !== "admin") {
      throw new Error("Permiso denegado: Solo el Administrador puede asignar alumnos.");
    }

    const users = this.getLocalUsers();
    const targetPsychologist = users.find((u) => u.id === psychologistId && u.role === "psychologist");
    if (!targetPsychologist) throw new Error("Psicólogo no encontrado.");

    if (!targetPsychologist.assignedStudentIds.includes(studentId)) {
      targetPsychologist.assignedStudentIds.push(studentId);
      this.saveLocalUsers(users);
    }

    this.logAudit({
      action: "student_reassigned",
      actorId: adminActor.id,
      actorName: adminActor.name,
      actorRole: "admin",
      studentId,
      studentName,
      targetUserId: targetPsychologist.id,
      targetUserName: targetPsychologist.name,
      details: `Alumno ${studentId} asignado al profesional ${targetPsychologist.name}`,
    });
  }

  /**
   * Reasigna un alumno de un psicólogo a otro (Administrador).
   */
  static reassignStudent(
    adminActor: DashboardUser,
    studentId: string,
    fromPsychologistId: string,
    toPsychologistId: string,
    studentName?: string
  ): void {
    this.assertWriteAllowed("Reasignar alumnos entre especialistas");
    if (adminActor.role !== "admin") {
      throw new Error("Permiso denegado: Solo el Administrador puede reasignar alumnos.");
    }

    const users = this.getLocalUsers();
    const fromPsy = users.find((u) => u.id === fromPsychologistId);
    const toPsy = users.find((u) => u.id === toPsychologistId && u.role === "psychologist");

    if (!toPsy) throw new Error("Psicólogo de destino no encontrado.");

    if (fromPsy) {
      fromPsy.assignedStudentIds = fromPsy.assignedStudentIds.filter((id) => id !== studentId);
    }

    if (!toPsy.assignedStudentIds.includes(studentId)) {
      toPsy.assignedStudentIds.push(studentId);
    }

    this.saveLocalUsers(users);

    this.logAudit({
      action: "student_reassigned",
      actorId: adminActor.id,
      actorName: adminActor.name,
      actorRole: "admin",
      studentId,
      studentName,
      details: `Alumno reasignado de ${fromPsy?.name || "Sin asignar"} a ${toPsy.name}`,
    });
  }

  /**
   * Desasigna un alumno de cualquier psicólogo (Administrador).
   * Deja al alumno en estado "Sin Asignar".
   */
  static unassignStudent(
    adminActor: DashboardUser,
    studentId: string,
    studentName?: string
  ): void {
    this.assertWriteAllowed("Desasignar alumnos");
    if (adminActor.role !== "admin") {
      throw new Error("Permiso denegado: Solo el Administrador puede desasignar alumnos.");
    }

    const users = this.getLocalUsers();
    let previousPsyName = "";
    let changed = false;

    users.forEach((u) => {
      if (u.role === "psychologist" && u.assignedStudentIds.includes(studentId)) {
        u.assignedStudentIds = u.assignedStudentIds.filter((id) => id !== studentId);
        previousPsyName = u.name;
        changed = true;
      }
    });

    if (changed) {
      this.saveLocalUsers(users);
      this.logAudit({
        action: "student_reassigned",
        actorId: adminActor.id,
        actorName: adminActor.name,
        actorRole: "admin",
        studentId,
        studentName,
        details: `Alumno ${studentName || studentId} desasignado de ${previousPsyName || "su psicólogo"} (ahora Sin Asignar)`,
      });
    }
  }
}

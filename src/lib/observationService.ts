import type {
  ProfessionalObservation,
  DashboardUser,
  ObservationCategory,
  ObservationVisibility,
  StructuredObservationSheetRecord,
} from "./types.ts";
import { DashboardAuthService } from "./authService.ts";
import { db } from "./firebase.ts";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";

const LOCAL_STORAGE_OBS_KEY = "cognitrain_observations_v1";
const LOCAL_STORAGE_STRUCTURED_KEY = "cognitrain_structured_obs_v1";

function generateId(prefix = "obs"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
}

export class DashboardObservationService {
  private static getStored(): ProfessionalObservation[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_OBS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private static saveStored(list: ProfessionalObservation[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(LOCAL_STORAGE_OBS_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn("Error guardando observaciones en localStorage:", e);
    }
  }

  /**
   * Obtiene las observaciones de un alumno filtradas según el rol del usuario solicitante.
   * Regla de confidencialidad:
   * - Los Tutores SOLO ven notas con visibility === 'tutor_visible'.
   * - Los Psicólogos ven todas las notas del alumno (si lo tienen asignado) y los Admins ven todo.
   */
  static getObservationsForStudent(
    studentId: string,
    currentUser: DashboardUser
  ): ProfessionalObservation[] {
    const all = this.getStored().filter((obs) => obs.studentId === studentId);

    if (currentUser.role === "tutor") {
      // Filtrar confidencialidad: solo recomendaciones autorizadas para tutores
      return all.filter((obs) => obs.visibility === "tutor_visible");
    }

    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Sincroniza y descarga observaciones desde Firestore `/users/{studentId}/observations`.
   * Si no hay conexión o falla, devuelve los datos en caché de localStorage.
   */
  static async fetchObservationsFromFirestore(
    studentId: string,
    currentUser: DashboardUser
  ): Promise<ProfessionalObservation[]> {
    try {
      const obsCol = collection(db, "users", studentId, "observations");
      const q = query(obsCol, orderBy("date", "desc"));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const firestoreObs: ProfessionalObservation[] = snapshot.docs.map((d) => ({
          ...(d.data() as ProfessionalObservation),
          id: d.id,
        }));

        // Merge con localStorage para mantener resiliencia offline
        const localList = this.getStored().filter((o) => o.studentId !== studentId);
        this.saveStored([...firestoreObs, ...localList]);

        if (currentUser.role === "tutor") {
          return firestoreObs.filter((obs) => obs.visibility === "tutor_visible");
        }
        return firestoreObs;
      }
    } catch (err) {
      console.warn(`[ObservationService] Fallback a caché local para alumno ${studentId}:`, err);
    }

    return this.getObservationsForStudent(studentId, currentUser);
  }

  /**
   * Agrega una nueva observación clínica profesional (Psicólogo o Admin).
   * Se guarda en Firestore y en localStorage.
   */
  static async addObservation(
    author: DashboardUser,
    params: {
      studentId: string;
      title: string;
      content: string;
      category: ObservationCategory;
      visibility: ObservationVisibility;
      date?: string;
    }
  ): Promise<ProfessionalObservation> {
    DashboardAuthService.assertWriteAllowed("crear observaciones clínicas");
    if (author.role === "tutor") {
      throw new Error("Los tutores no tienen permisos para redactar observaciones clínicas.");
    }

    const newObs: ProfessionalObservation = {
      id: generateId("obs"),
      studentId: params.studentId,
      psychologistId: author.id,
      psychologistName: author.name,
      title: params.title.trim(),
      content: params.content.trim(),
      category: params.category,
      visibility: params.visibility,
      date: params.date || new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // 1. Guardar en caché local
    const list = this.getStored();
    list.unshift(newObs);
    this.saveStored(list);

    // 2. Persistir en Cloud Firestore de forma asíncrona
    try {
      const userObsRef = doc(db, "users", params.studentId, "observations", newObs.id);
      await setDoc(userObsRef, newObs);

      const rootObsRef = doc(db, "observations", newObs.id);
      await setDoc(rootObsRef, newObs);
    } catch (err) {
      console.warn("[ObservationService] Error persistiendo en Firestore (quedó en caché local):", err);
    }

    DashboardAuthService.logAudit({
      action: "user_updated",
      actorId: author.id,
      actorName: author.name,
      actorRole: author.role,
      studentId: params.studentId,
      details: `Nueva observación clínica registrada: "${newObs.title}" (Visibilidad: ${newObs.visibility})`,
    });

    return newObs;
  }

  /**
   * Edita una observación clínica existente.
   */
  static async updateObservation(
    actor: DashboardUser,
    observationId: string,
    updates: Partial<Pick<ProfessionalObservation, "title" | "content" | "category" | "visibility">>
  ): Promise<ProfessionalObservation> {
    DashboardAuthService.assertWriteAllowed("editar observaciones clínicas");
    const list = this.getStored();
    const target = list.find((o) => o.id === observationId);
    if (!target) throw new Error("Observación no encontrada.");

    if (actor.role !== "admin" && target.psychologistId !== actor.id) {
      throw new Error("No puedes editar observaciones redactadas por otro profesional.");
    }

    if (updates.title) target.title = updates.title.trim();
    if (updates.content) target.content = updates.content.trim();
    if (updates.category) target.category = updates.category;
    if (updates.visibility) target.visibility = updates.visibility;
    target.updatedAt = new Date().toISOString();

    this.saveStored(list);

    try {
      const userObsRef = doc(db, "users", target.studentId, "observations", target.id);
      await setDoc(userObsRef, target, { merge: true });

      const rootObsRef = doc(db, "observations", target.id);
      await setDoc(rootObsRef, target, { merge: true });
    } catch (err) {
      console.warn("[ObservationService] Error actualizando en Firestore:", err);
    }

    return target;
  }

  /**
   * Elimina una observación.
   */
  static async deleteObservation(actor: DashboardUser, observationId: string): Promise<boolean> {
    DashboardAuthService.assertWriteAllowed("eliminar observaciones clínicas");
    const list = this.getStored();
    const target = list.find((o) => o.id === observationId);
    if (!target) return false;

    if (actor.role !== "admin" && target.psychologistId !== actor.id) {
      throw new Error("No tienes autorización para eliminar esta observación.");
    }

    const filtered = list.filter((o) => o.id !== observationId);
    this.saveStored(filtered);

    try {
      const userObsRef = doc(db, "users", target.studentId, "observations", target.id);
      await deleteDoc(userObsRef);

      const rootObsRef = doc(db, "observations", target.id);
      await deleteDoc(rootObsRef);
    } catch (err) {
      console.warn("[ObservationService] Error eliminando en Firestore:", err);
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // Indicador G: Ficha de Observación Estructurada (Instrumento Clínico)
  // ---------------------------------------------------------------------------

  /**
   * Guarda una ficha de observación estructurada (episodios, categorías, frecuencia).
   */
  static async saveStructuredObservationSheet(
    author: DashboardUser,
    sheet: StructuredObservationSheetRecord
  ): Promise<void> {
    DashboardAuthService.assertWriteAllowed("guardar fichas de observación estructurada");
    // 1. Guardar en local storage
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_STRUCTURED_KEY);
        const list: StructuredObservationSheetRecord[] = raw ? JSON.parse(raw) : [];
        const index = list.findIndex((s) => s.id === sheet.id);
        if (index >= 0) {
          list[index] = sheet;
        } else {
          list.unshift(sheet);
        }
        localStorage.setItem(LOCAL_STORAGE_STRUCTURED_KEY, JSON.stringify(list));
      } catch (e) {
        console.warn("Error guardando ficha estructurada local:", e);
      }
    }

    // 2. Persistir en Firestore
    try {
      const subColRef = doc(db, "users", sheet.studentId, "observations", sheet.id);
      await setDoc(subColRef, sheet);

      const rootRef = doc(db, "observations", sheet.id);
      await setDoc(rootRef, sheet);
    } catch (err) {
      console.warn("[ObservationService] Error persistiendo ficha en Firestore:", err);
    }

    DashboardAuthService.logAudit({
      action: "user_updated",
      actorId: author.id,
      actorName: author.name,
      actorRole: author.role,
      studentId: sheet.studentId,
      details: `Ficha de Observación Estructurada registrada (${sheet.episodesCount} episodios, freq: ${sheet.frequencyPerMinute}/min)`,
    });
  }
}

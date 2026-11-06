"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { DashboardUser, UserRole } from "./types";
import { DashboardAuthService } from "./authService";

interface AuthContextType {
  user: DashboardUser | null;
  role: UserRole | null;
  isLoading: boolean;
  consultedUser: DashboardUser | null;
  isConsulting: boolean;
  startConsultation: (userId: string) => void;
  exitConsultation: () => void;
  login: (identifier: string, password?: string, role?: UserRole) => Promise<boolean>;
  logout: () => void;
  switchUser: (userId: string) => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  isLoading: true,
  consultedUser: null,
  isConsulting: false,
  startConsultation: () => {},
  exitConsultation: () => {},
  login: async () => false,
  logout: () => {},
  switchUser: () => {},
  refreshUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [consultedUser, setConsultedUser] = useState<DashboardUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSession = () => {
    try {
      DashboardAuthService.initSystemAccounts();
      const current = DashboardAuthService.getCurrentUser();
      if (current) {
        setUser(current);
      } else {
        // Por defecto, iniciar con el Administrador para facilitar la evaluación inicial
        const admin = DashboardAuthService.getAllUsers().find((u) => u.role === "admin");
        if (admin) {
          setUser(admin);
        }
      }

      // Cargar modo de consulta si estaba activo en sessionStorage
      const existingConsultation = DashboardAuthService.getConsultationTarget();
      setConsultedUser(existingConsultation);
    } catch (e) {
      console.warn("Error cargando sesión:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      loadSession();
    });
  }, []);

  const login = async (identifier: string, password?: string, role?: UserRole): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Salir de cualquier modo de consulta al iniciar nueva sesión
      DashboardAuthService.setConsultationTarget(null);
      setConsultedUser(null);

      const loggedUser = await DashboardAuthService.login(identifier, password, role);
      if (loggedUser) {
        setUser(loggedUser);
        return true;
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    DashboardAuthService.setConsultationTarget(null);
    setConsultedUser(null);
    DashboardAuthService.logout();
    setUser(null);
  };

  /**
   * Inicia el Modo de Solo Consulta para que el Administrador inspeccione los datos de otro usuario.
   * NO modifica la sesión, identidad, rol ni permisos del Administrador.
   */
  const startConsultation = (userId: string) => {
    if (user?.role !== "admin") {
      console.warn("Acceso denegado: Solamente el Administrador puede consultar datos de otros usuarios.");
      return;
    }

    if (user.id === userId) {
      exitConsultation();
      return;
    }

    const all = DashboardAuthService.getAllUsers();
    const target = all.find((u) => u.id === userId);
    if (target) {
      DashboardAuthService.setConsultationTarget(target);
      setConsultedUser(target);
    }
  };

  /**
   * Finaliza el Modo de Solo Consulta y retorna a la vista administrativa regular.
   */
  const exitConsultation = () => {
    DashboardAuthService.setConsultationTarget(null);
    setConsultedUser(null);
  };

  /**
   * Redirige switchUser al modo consulta para evitar cualquier impersonación.
   */
  const switchUser = (userId: string) => {
    startConsultation(userId);
  };

  const refreshUser = () => {
    const current = DashboardAuthService.getCurrentUser();
    setUser(current);
    const target = DashboardAuthService.getConsultationTarget();
    setConsultedUser(target);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        isLoading,
        consultedUser,
        isConsulting: consultedUser !== null,
        startConsultation,
        exitConsultation,
        login,
        logout,
        switchUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

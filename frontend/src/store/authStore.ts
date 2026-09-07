import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  orgId: string | null;
  orgName: string | null;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  mustChangePassword: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string, mustChangePassword?: boolean) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
  isApplicant: () => boolean;
  isEmployer: () => boolean;
  isHM: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      mustChangePassword: false,
      setAuth: (user, accessToken, refreshToken, mustChangePassword = false) =>
        set({ user, accessToken, refreshToken, mustChangePassword }),
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null, mustChangePassword: false }),
      isAuthenticated: () => !!get().accessToken && !!get().user,
      isApplicant: () => get().user?.role === 'applicant',
      isEmployer: () => ['customer_admin', 'customer_manager'].includes(get().user?.role || ''),
      isHM: () => (get().user?.role || '').startsWith('hm_'),
    }),
    { name: 'hirometrics-auth' }
  )
);

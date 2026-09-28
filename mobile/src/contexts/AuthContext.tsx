import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, definirAoExpirarSessao, STORAGE_KEYS } from "../services/api";
import { Usuario } from "../types";

interface AuthContextData {
  usuario: Usuario | null;
  carregando: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const usuarioSalvo = await AsyncStorage.getItem(STORAGE_KEYS.usuario);
      if (usuarioSalvo) setUsuario(JSON.parse(usuarioSalvo));
      setCarregando(false);
    })();
  }, []);

  async function login(email: string, senha: string) {
    const { data } = await api.post("/auth/login", { email, senha });
    await AsyncStorage.setItem(STORAGE_KEYS.accessToken, data.accessToken);
    await AsyncStorage.setItem(STORAGE_KEYS.refreshToken, data.refreshToken);
    await AsyncStorage.setItem(STORAGE_KEYS.usuario, JSON.stringify(data.usuario));
    setUsuario(data.usuario);
  }

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    setUsuario(null);
  }, []);

  // Se o refresh token expirar, o interceptor do axios desloga o usuário
  useEffect(() => {
    definirAoExpirarSessao(() => {
      logout();
    });
    return () => definirAoExpirarSessao(null);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

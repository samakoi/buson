import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import { api } from "../services/api";
import { Notificacao } from "../types";

interface NotificacoesData {
  itens: Notificacao[];
  naoLidas: number;
  atualizar: () => Promise<void>;
  marcarTodasComoLidas: () => Promise<void>;
}

const NotificacoesContext = createContext<NotificacoesData>({} as NotificacoesData);

const INTERVALO_MS = 30_000;

/** Mantém os avisos do aluno (e o contador do badge) atualizados em segundo plano. */
export function NotificacoesProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);

  const atualizar = useCallback(async () => {
    try {
      const { data } = await api.get<{ itens: Notificacao[]; naoLidas: number }>("/notificacoes");
      setItens(data.itens);
      setNaoLidas(data.naoLidas);
    } catch (err) {
      console.warn("Falha ao carregar avisos", err);
    }
  }, []);

  const marcarTodasComoLidas = useCallback(async () => {
    if (naoLidas === 0) return;
    await api.post("/notificacoes/lidas");
    setNaoLidas(0);
  }, [naoLidas]);

  useEffect(() => {
    atualizar();
    const id = setInterval(atualizar, INTERVALO_MS);
    // Ao voltar para o app, busca na hora em vez de esperar o próximo ciclo
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "active") atualizar();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [atualizar]);

  return (
    <NotificacoesContext.Provider value={{ itens, naoLidas, atualizar, marcarTodasComoLidas }}>
      {children}
    </NotificacoesContext.Provider>
  );
}

export const useNotificacoes = () => useContext(NotificacoesContext);

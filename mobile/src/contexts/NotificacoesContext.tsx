import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { api } from "../services/api";
import { CategoriaNotificacao, Notificacao, Papel } from "../types";
import { registrarSeJaPermitido } from "../features/push/push";
import { abrirTelaDoAviso } from "../features/push/abrirAviso";

// Toques já tratados (o mesmo toque pode chegar pelo ouvinte e pela "última resposta")
const toquesTratados = new Set<string>();

interface NotificacoesData {
  itens: Notificacao[];
  naoLidas: number;
  atualizar: () => Promise<void>;
  marcarTodasComoLidas: () => Promise<void>;
}

const NotificacoesContext = createContext<NotificacoesData>({} as NotificacoesData);

const INTERVALO_MS = 30_000;

/** Mantém os avisos (e o contador do badge) atualizados e liga o push do celular. */
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

  // Push no celular: registra o aparelho, atualiza ao chegar aviso e abre a tela certa ao tocar
  useEffect(() => {
    if (Platform.OS === "web") return;
    registrarSeJaPermitido();
    const abrir = (resposta: Notifications.NotificationResponse) => {
      const id = resposta.notification.request.identifier;
      if (toquesTratados.has(id)) return;
      toquesTratados.add(id);
      const dados = resposta.notification.request.content.data as { categoria?: CategoriaNotificacao; papel?: Papel };
      if (dados?.categoria && dados.papel) abrirTelaDoAviso(dados.categoria, dados.papel);
      atualizar();
    };
    // App aberto pelo toque no aviso (estava fechado)
    Notifications.getLastNotificationResponseAsync().then((r) => r && abrir(r)).catch(() => undefined);
    const chegou = Notifications.addNotificationReceivedListener(() => atualizar());
    const tocou = Notifications.addNotificationResponseReceivedListener(abrir);
    return () => {
      chegou.remove();
      tocou.remove();
    };
  }, [atualizar]);

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

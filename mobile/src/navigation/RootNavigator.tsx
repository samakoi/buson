import React, { useEffect, useMemo, useState } from "react";
import { DarkTheme, DefaultTheme, NavigationContainer, Theme } from "@react-navigation/native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSessao } from "../store/sessao";
import { useTema } from "../theme/TemaProvider";
import { Carregando } from "../components/ui";
import { NotificacoesProvider } from "../contexts/NotificacoesContext";
import LoginScreen from "../screens/Auth/LoginScreen";
import CadastroScreen from "../screens/Auth/CadastroScreen";
import AlunoTabs from "./AlunoTabs";
import MotoristaTabs from "./MotoristaTabs";
import AdminTabs from "./AdminTabs";
import { navegacaoRef } from "../features/push/abrirAviso";

function FluxoDeEntrada() {
  const [tela, setTela] = useState<"login" | "cadastro">("login");
  const { cores } = useTema();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo, paddingTop: insets.top }}>
      {tela === "login" ? (
        <LoginScreen onCriarConta={() => setTela("cadastro")} />
      ) : (
        <CadastroScreen onVoltar={() => setTela("login")} />
      )}
    </View>
  );
}

export default function RootNavigator() {
  const { usuario, carregando, iniciar } = useSessao();

  // Lê a sessão salva no aparelho ao abrir o app
  useEffect(() => {
    iniciar();
  }, [iniciar]);
  const { cores, escuro } = useTema();

  // Tema do React Navigation montado a partir dos nossos tokens
  const temaNavegacao = useMemo<Theme>(() => {
    const base = escuro ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: escuro,
      colors: {
        ...base.colors,
        primary: cores.primaria,
        background: cores.fundo,
        card: cores.superficie,
        text: cores.texto,
        border: cores.borda,
        notification: cores.perigoForte,
      },
    };
  }, [cores, escuro]);

  if (carregando) return <Carregando />;

  return (
    <NavigationContainer ref={navegacaoRef} theme={temaNavegacao}>
      {!usuario ? (
        <FluxoDeEntrada />
      ) : (
        // Avisos (e o badge das abas) valem para os três perfis
        <NotificacoesProvider>
          {usuario.papel === "ALUNO" ? <AlunoTabs /> : usuario.papel === "MOTORISTA" ? <MotoristaTabs /> : <AdminTabs />}
        </NotificacoesProvider>
      )}
    </NavigationContainer>
  );
}

import React from "react";
// Registra a tarefa de GPS em segundo plano antes de tudo (o Android a chama com o app fechado)
import "./src/features/gps/rastreador";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { TemaProvider } from "./src/theme/TemaProvider";
import { queryClient } from "./src/services/queryClient";
import RootNavigator from "./src/navigation/RootNavigator";
import { envolverApp, iniciarMonitoramento } from "./src/services/monitoramento";

// Sentry (só com EXPO_PUBLIC_SENTRY_DSN no build)
iniciarMonitoramento();

function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <TemaProvider>
          {/* "auto": texto escuro no tema claro e claro no tema escuro */}
          <StatusBar style="auto" />
          <RootNavigator />
        </TemaProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export default envolverApp(App);

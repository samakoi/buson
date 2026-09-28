import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { TemaProvider } from "./src/theme/TemaProvider";
import { queryClient } from "./src/services/queryClient";
import RootNavigator from "./src/navigation/RootNavigator";

export default function App() {
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

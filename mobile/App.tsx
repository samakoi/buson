import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/contexts/AuthContext";
import { TemaProvider } from "./src/theme/TemaProvider";
import RootNavigator from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <TemaProvider>
        <AuthProvider>
          {/* "auto": texto escuro no tema claro e claro no tema escuro */}
          <StatusBar style="auto" />
          <RootNavigator />
        </AuthProvider>
      </TemaProvider>
    </SafeAreaProvider>
  );
}

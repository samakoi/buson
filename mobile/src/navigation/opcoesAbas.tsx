import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { useTema } from "../theme/TemaProvider";
import type { NomeIcone } from "../components/icones";

/** Aparência comum das abas dos três perfis. */
export function useOpcoesAbas(): BottomTabNavigationOptions {
  const { cores, tipo } = useTema();
  return {
    headerShown: false,
    tabBarActiveTintColor: cores.primaria,
    tabBarInactiveTintColor: cores.textoFraco,
    tabBarStyle: { backgroundColor: cores.superficie, borderTopColor: cores.borda },
    tabBarLabelStyle: { ...tipo.micro, fontSize: tipo.sobrescrito.fontSize },
    tabBarBadgeStyle: { ...tipo.micro, backgroundColor: cores.perigoForte, color: cores.sobrePrimaria },
  };
}

/** Ícone preenchido na aba ativa e contornado nas demais. */
export function iconeAba(preenchido: NomeIcone, contorno: NomeIcone) {
  return function IconeAba({ focused, color, size }: { focused: boolean; color: string; size: number }) {
    return <Ionicons name={focused ? preenchido : contorno} color={color} size={size} />;
  };
}

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNotificacoes } from "../contexts/NotificacoesContext";
import { iconeAba, useOpcoesAbas } from "./opcoesAbas";
import HomeScreen from "../screens/Aluno/HomeScreen";
import QRCodeScreen from "../screens/Aluno/QRCodeScreen";
import OnibusScreen from "../screens/Aluno/OnibusScreen";
import PerfilScreen from "../screens/Aluno/PerfilScreen";
import DadosAcademicosScreen from "../screens/Aluno/DadosAcademicosScreen";
import AvisosScreen from "../screens/Comum/AvisosScreen";

export type AbasAluno = { Início: undefined; "QR Code": undefined; Ônibus: undefined; Avisos: undefined; Perfil: undefined };
export type PilhaAluno = { Abas: undefined; DadosAcademicos: undefined };

const Tab = createBottomTabNavigator<AbasAluno>();
const Pilha = createNativeStackNavigator<PilhaAluno>();

function Abas() {
  const { naoLidas } = useNotificacoes();
  const opcoes = useOpcoesAbas();
  return (
    <Tab.Navigator screenOptions={opcoes}>
      <Tab.Screen name="Início" component={HomeScreen} options={{ tabBarIcon: iconeAba("home", "home-outline") }} />
      <Tab.Screen name="QR Code" component={QRCodeScreen} options={{ tabBarIcon: iconeAba("qr-code", "qr-code-outline") }} />
      <Tab.Screen name="Ônibus" component={OnibusScreen} options={{ tabBarIcon: iconeAba("bus", "bus-outline") }} />
      <Tab.Screen
        name="Avisos"
        component={AvisosScreen}
        options={{
          tabBarIcon: iconeAba("notifications", "notifications-outline"),
          tabBarBadge: naoLidas > 0 ? (naoLidas > 9 ? "9+" : naoLidas) : undefined,
        }}
      />
      <Tab.Screen name="Perfil" component={PerfilScreen} options={{ tabBarIcon: iconeAba("person-circle", "person-circle-outline") }} />
    </Tab.Navigator>
  );
}

/** Abas do aluno + telas de detalhe (dados acadêmicos, documentação, dias...). */
export default function AlunoNavegacao() {
  return (
    <Pilha.Navigator screenOptions={{ headerShown: false }}>
      <Pilha.Screen name="Abas" component={Abas} />
      <Pilha.Screen name="DadosAcademicos" component={DadosAcademicosScreen} />
    </Pilha.Navigator>
  );
}

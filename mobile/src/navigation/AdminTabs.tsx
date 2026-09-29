import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNotificacoes } from "../contexts/NotificacoesContext";
import { iconeAba, useOpcoesAbas } from "./opcoesAbas";
import DashboardScreen from "../screens/Admin/DashboardScreen";
import AlunosScreen from "../screens/Admin/AlunosScreen";
import PerfilAlunoScreen from "../screens/Admin/PerfilAlunoScreen";
import ViagensScreen from "../screens/Admin/ViagensScreen";
import CadastrosScreen from "../screens/Admin/CadastrosScreen";
import AvisosScreen from "../screens/Comum/AvisosScreen";
import MeusDiasScreen from "../features/alocacao/MeusDiasScreen";
import DocumentosScreen from "../features/documentos/DocumentosScreen";
import FaltasScreen from "../features/faltas/FaltasScreen";

export type AbasAdmin = { Dashboard: undefined; Alunos: undefined; Viagens: undefined; Cadastros: undefined; Avisos: undefined };
export type PilhaAdmin = {
  Abas: undefined;
  PerfilAluno: { alunoId: string };
  DiasAluno: { alunoId: string; nome: string };
  Documentos: undefined;
  Faltas: undefined;
};

const Tab = createBottomTabNavigator<AbasAdmin>();
const Pilha = createNativeStackNavigator<PilhaAdmin>();

function Abas() {
  const { naoLidas } = useNotificacoes();
  const opcoes = useOpcoesAbas();
  return (
    <Tab.Navigator screenOptions={opcoes}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarIcon: iconeAba("stats-chart", "stats-chart-outline") }} />
      <Tab.Screen name="Alunos" component={AlunosScreen} options={{ tabBarIcon: iconeAba("people", "people-outline") }} />
      <Tab.Screen name="Viagens" component={ViagensScreen} options={{ tabBarIcon: iconeAba("calendar", "calendar-outline") }} />
      <Tab.Screen name="Cadastros" component={CadastrosScreen} options={{ tabBarIcon: iconeAba("albums", "albums-outline") }} />
      <Tab.Screen
        name="Avisos"
        component={AvisosScreen}
        options={{
          tabBarIcon: iconeAba("notifications", "notifications-outline"),
          tabBarBadge: naoLidas > 0 ? (naoLidas > 9 ? "9+" : naoLidas) : undefined,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AdminNavegacao() {
  return (
    <Pilha.Navigator screenOptions={{ headerShown: false }}>
      <Pilha.Screen name="Abas" component={Abas} />
      <Pilha.Screen name="PerfilAluno" component={PerfilAlunoScreen} />
      <Pilha.Screen name="DiasAluno" component={MeusDiasScreen} />
      <Pilha.Screen name="Documentos" component={DocumentosScreen} />
      <Pilha.Screen name="Faltas" component={FaltasScreen} />
    </Pilha.Navigator>
  );
}

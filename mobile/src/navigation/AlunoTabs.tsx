import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNotificacoes } from "../features/avisos/NotificacoesContext";
import { iconeAba, useOpcoesAbas } from "./opcoesAbas";
import HomeScreen from "../features/viagens/HomeAlunoScreen";
import EmbarcarScreen from "../features/embarque/EmbarcarScreen";
import OnibusScreen from "../features/viagens/OnibusScreen";
import PerfilScreen from "../features/alunos/PerfilScreen";
import DadosAcademicosScreen from "../features/alunos/DadosAcademicosScreen";
import AvisosScreen from "../features/avisos/AvisosScreen";
import MeusDiasScreen from "../features/alocacao/MeusDiasScreen";
import DocumentacaoScreen from "../features/documentos/DocumentacaoScreen";
import MinhasFaltasScreen from "../features/faltas/MinhasFaltasScreen";
import OndeEstaOnibusScreen from "../features/gps/OndeEstaOnibusScreen";

export type AbasAluno = { Início: undefined; Embarcar: undefined; Ônibus: undefined; Avisos: undefined; Perfil: undefined };
export type PilhaAluno = {
  Abas: undefined;
  DadosAcademicos: undefined;
  MeusDias: undefined;
  Documentacao: undefined;
  MinhasFaltas: undefined;
  OndeEstaOnibus: { viagemId: string };
};

const Tab = createBottomTabNavigator<AbasAluno>();
const Pilha = createNativeStackNavigator<PilhaAluno>();

function Abas() {
  const { naoLidas } = useNotificacoes();
  const opcoes = useOpcoesAbas();
  return (
    <Tab.Navigator screenOptions={opcoes}>
      <Tab.Screen name="Início" component={HomeScreen} options={{ tabBarIcon: iconeAba("home", "home-outline") }} />
      <Tab.Screen name="Embarcar" component={EmbarcarScreen} options={{ tabBarIcon: iconeAba("scan-circle", "scan-circle-outline") }} />
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
      <Pilha.Screen name="MeusDias" component={MeusDiasScreen} />
      <Pilha.Screen name="Documentacao" component={DocumentacaoScreen} />
      <Pilha.Screen name="MinhasFaltas" component={MinhasFaltasScreen} />
      <Pilha.Screen name="OndeEstaOnibus" component={OndeEstaOnibusScreen} />
    </Pilha.Navigator>
  );
}

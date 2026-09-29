import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNotificacoes } from "../contexts/NotificacoesContext";
import { iconeAba, useOpcoesAbas } from "./opcoesAbas";
import PainelScreen from "../screens/Motorista/PainelScreen";
import QrMotoristaScreen from "../features/embarque/QrMotoristaScreen";
import PassageirosScreen from "../screens/Motorista/PassageirosScreen";
import RotaScreen from "../screens/Motorista/RotaScreen";
import AvisosScreen from "../screens/Comum/AvisosScreen";
import { useViagemAtual } from "../features/viagens/api";
import { useGpsDaViagem } from "../features/gps/StatusGps";

export type AbasMotorista = { Painel: undefined; Embarque: undefined; Passageiros: undefined; Rota: undefined; Avisos: undefined };

const Tab = createBottomTabNavigator<AbasMotorista>();

export default function MotoristaTabs() {
  const opcoes = useOpcoesAbas();
  const { naoLidas } = useNotificacoes();
  // GPS ligado enquanto a viagem estiver em andamento, em qualquer aba
  const { data: viagem } = useViagemAtual({ atualizarACada: 30_000 });
  useGpsDaViagem(viagem);
  return (
    <Tab.Navigator screenOptions={opcoes}>
      <Tab.Screen name="Painel" component={PainelScreen} options={{ tabBarIcon: iconeAba("speedometer", "speedometer-outline") }} />
      <Tab.Screen name="Embarque" component={QrMotoristaScreen} options={{ tabBarIcon: iconeAba("qr-code", "qr-code-outline") }} />
      <Tab.Screen name="Passageiros" component={PassageirosScreen} options={{ tabBarIcon: iconeAba("people", "people-outline") }} />
      <Tab.Screen name="Rota" component={RotaScreen} options={{ tabBarIcon: iconeAba("map", "map-outline") }} />
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

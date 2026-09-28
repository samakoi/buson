import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNotificacoes } from "../contexts/NotificacoesContext";
import { iconeAba, useOpcoesAbas } from "./opcoesAbas";
import PainelScreen from "../screens/Motorista/PainelScreen";
import EmbarqueScreen from "../screens/Motorista/EmbarqueScreen";
import PassageirosScreen from "../screens/Motorista/PassageirosScreen";
import RotaScreen from "../screens/Motorista/RotaScreen";
import AvisosScreen from "../screens/Comum/AvisosScreen";

export type AbasMotorista = { Painel: undefined; Embarque: undefined; Passageiros: undefined; Rota: undefined; Avisos: undefined };

const Tab = createBottomTabNavigator<AbasMotorista>();

export default function MotoristaTabs() {
  const opcoes = useOpcoesAbas();
  const { naoLidas } = useNotificacoes();
  return (
    <Tab.Navigator screenOptions={opcoes}>
      <Tab.Screen name="Painel" component={PainelScreen} options={{ tabBarIcon: iconeAba("speedometer", "speedometer-outline") }} />
      <Tab.Screen name="Embarque" component={EmbarqueScreen} options={{ tabBarIcon: iconeAba("scan-circle", "scan-circle-outline") }} />
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

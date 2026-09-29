import React, { useState } from "react";
import { View } from "react-native";
import * as Location from "expo-location";
import { Botao, Campo } from "../../components/ui";
import { avisar, mensagemDeErro } from "../../utils/feedback";

export interface Coordenadas {
  latitude: number;
  longitude: number;
}

/** "-5.5263, -47.4777" → coordenadas (ou null se o texto não for válido). */
export function lerCoordenadas(texto: string): Coordenadas | null {
  const m = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(texto);
  if (!m) return null;
  const latitude = Number(m[1]);
  const longitude = Number(m[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export const escreverCoordenadas = (c: { latitude?: number | null; longitude?: number | null }) =>
  c.latitude != null && c.longitude != null ? `${c.latitude.toFixed(6)}, ${c.longitude.toFixed(6)}` : "";

/**
 * Coordenadas de uma parada (mapa do aluno e distância do ônibus). Dá para colar
 * "latitude, longitude" do Google Maps ou usar a posição atual do celular no local.
 */
export function CampoCoordenadas({ valor, onChange }: { valor: string; onChange: (texto: string) => void }) {
  const [buscando, setBuscando] = useState(false);

  async function usarMinhaLocalizacao() {
    setBuscando(true);
    try {
      const permissao = await Location.requestForegroundPermissionsAsync();
      if (!permissao.granted) return avisar("Sem permissão de localização", "Permita a localização ou cole as coordenadas do Google Maps.");
      const atual = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      onChange(escreverCoordenadas(atual.coords));
    } catch (err) {
      avisar("Não foi possível obter a localização", mensagemDeErro(err, "Cole as coordenadas do Google Maps."));
    } finally {
      setBuscando(false);
    }
  }

  const invalido = valor.trim() !== "" && !lerCoordenadas(valor);
  return (
    <View>
      <Campo
        rotulo="Localização no mapa (opcional)"
        value={valor}
        onChangeText={onChange}
        placeholder="-5.526300, -47.477700"
        ajuda={invalido ? "Use o formato: latitude, longitude (com ponto decimal)." : "No Google Maps: toque e segure no local e copie os números."}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
      />
      <Botao titulo="Usar minha localização atual" icone="locate-outline" variante="fantasma" onPress={usarMinhaLocalizacao} carregando={buscando} />
    </View>
  );
}

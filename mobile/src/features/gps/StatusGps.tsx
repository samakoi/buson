import React, { useEffect, useRef, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Viagem } from "../../types";
import { useTema } from "../../theme/TemaProvider";
import { Botao, Card, Texto } from "../../components/ui";
import { iniciarRastreamento, pararRastreamento, useEstadoGps, viagemRastreada } from "./rastreador";

/**
 * Mantém o GPS ligado enquanto a viagem do motorista estiver em andamento
 * (inclusive ao reabrir o app no meio da viagem) e desliga ao encerrar.
 */
export function useGpsDaViagem(viagem: Pick<Viagem, "id" | "status"> | null | undefined) {
  const tentada = useRef<string | null>(null);
  useEffect(() => {
    if (!viagem) return;
    (async () => {
      if (viagem.status === "EM_ANDAMENTO") {
        if (tentada.current !== viagem.id) {
          tentada.current = viagem.id;
          await iniciarRastreamento(viagem.id);
        }
      } else if (await viagemRastreada()) {
        await pararRastreamento();
      }
    })().catch((err) => console.warn("GPS", err));
  }, [viagem?.id, viagem?.status]); // eslint-disable-line react-hooks/exhaustive-deps
}

function useSegundos(desde: number | null) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  return desde ? Math.max(0, Math.round((agora - desde) / 1000)) : null;
}

/** Cartão do Painel: o motorista sabe se os alunos estão vendo o ônibus. */
export function StatusGps({ viagemId }: { viagemId: string }) {
  const { cores } = useTema();
  const { modo, ultimoEnvioEm, pendentes } = useEstadoGps();
  const segundos = useSegundos(ultimoEnvioEm);

  const info: Record<typeof modo, { icone: React.ComponentProps<typeof Ionicons>["name"]; cor: string; titulo: string; texto: string }> = {
    "segundo-plano": {
      icone: "navigate-circle",
      cor: cores.sucesso,
      titulo: "Compartilhando localização",
      texto: "Os alunos veem o ônibus no mapa, mesmo com a tela apagada.",
    },
    "primeiro-plano": {
      icone: "navigate-circle-outline",
      cor: cores.alerta,
      titulo: "Localização só com o app aberto",
      texto: "Se bloquear o celular, a posição para de atualizar. No app instalado (APK), permita a localização \"o tempo todo\".",
    },
    "sem-permissao": {
      icone: "location-outline",
      cor: cores.perigo,
      titulo: "Localização desligada",
      texto: "Sem permissão de localização, os alunos não veem o ônibus no mapa.",
    },
    desligado: { icone: "location-outline", cor: cores.textoFraco, titulo: "Ligando o GPS…", texto: "" },
  };
  const i = info[modo];

  return (
    <Card>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <Ionicons name={i.icone} size={26} color={i.cor} />
        <View style={{ flex: 1, gap: 2 }}>
          <Texto variante="corpoForte">{i.titulo}</Texto>
          {!!i.texto && (
            <Texto variante="pequeno" cor="textoSuave">
              {i.texto}
            </Texto>
          )}
          {(modo === "segundo-plano" || modo === "primeiro-plano") && (
            <Texto variante="legenda" cor="textoFraco">
              {segundos != null ? `Última posição enviada há ${segundos} s` : "Aguardando o primeiro sinal do GPS…"}
              {pendentes > 0 ? ` • ${pendentes} aguardando internet` : ""}
            </Texto>
          )}
        </View>
      </View>
      {modo === "sem-permissao" && (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {Platform.OS !== "web" && <Botao titulo="Abrir configurações" variante="fantasma" onPress={() => Linking.openSettings()} style={{ flex: 1 }} />}
          <Botao titulo="Tentar de novo" icone="refresh" variante="secundario" onPress={() => iniciarRastreamento(viagemId)} style={{ flex: 1 }} />
        </View>
      )}
    </Card>
  );
}
